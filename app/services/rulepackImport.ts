import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { RulepackFragment } from '~/schemas/rulepackSchema'
import { looksLikeZip, readZip } from '~/services/zip'

/**
 * Both entry points return a *list* of fragments, because a zip holds many — one file
 * per category per book, the shape scripts/pack-rulepacks.mjs produces. A bare JSON file
 * is just the one-element case. Callers merge them in the order returned.
 */

function parseAndValidate(raw: unknown, source?: string): RulepackFragment {
  const result = RulepackSchema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`Rulepack validation failed${source ? ` in ${source}` : ''}:\n${messages}`)
  }
  return result.data
}

function parseJson(text: string, source?: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    throw new Error(source ? `${source} is not valid JSON` : 'File is not valid JSON')
  }
}

/**
 * A fragment with a top-level `subclasses` or `subraces` array patches a class or race
 * defined by another fragment, and is dropped if it merges first. Sorting patches last
 * mirrors SRD_FRAGMENT_ORDER in the SRD loader, and means a hand-assembled zip works
 * whatever order its entries happen to be in.
 */
function inMergeOrder(fragments: RulepackFragment[]): RulepackFragment[] {
  const isPatch = (f: RulepackFragment) =>
    Number((f.subclasses?.length ?? 0) > 0 || (f.subraces?.length ?? 0) > 0)
  return [...fragments].sort((a, b) => isPatch(a) - isPatch(b))
}

/**
 * Unpack a zip of rulepack fragments. Non-JSON entries are ignored so that a readme or
 * the `__MACOSX/` folder the Finder adds does not fail the import; every JSON entry must
 * validate, and the whole import fails if one does not, rather than merging half a book.
 */
async function fragmentsFromZip(bytes: Uint8Array): Promise<RulepackFragment[]> {
  let entries
  try {
    entries = await readZip(bytes)
  }
  catch (err) {
    throw new Error(`Could not read zip: ${(err as Error).message}`)
  }

  const decoder = new TextDecoder()
  const fragments = entries
    .filter(entry => entry.path.endsWith('.json') && !entry.path.startsWith('__MACOSX/'))
    .map(entry => parseAndValidate(parseJson(decoder.decode(entry.bytes), entry.path), entry.path))

  if (fragments.length === 0) throw new Error('Zip contains no .json rulepack files')

  return inMergeOrder(fragments)
}

function fragmentsFromBytes(bytes: Uint8Array, label?: string): Promise<RulepackFragment[]> | RulepackFragment[] {
  // Sniff the magic bytes rather than trusting the extension or content type — a zip
  // served as application/octet-stream is still a zip.
  if (looksLikeZip(bytes)) return fragmentsFromZip(bytes)
  return [parseAndValidate(parseJson(new TextDecoder().decode(bytes), label))]
}

export async function importFromFile(file: File): Promise<RulepackFragment[]> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  }
  catch {
    throw new Error('Could not read file')
  }

  return fragmentsFromBytes(bytes)
}

// URL import: caller must show the URL to the user for confirmation before calling this.
// This prevents silent SSRF — the user explicitly approves the destination.
export async function importFromUrl(url: string): Promise<RulepackFragment[]> {
  // Only allow http/https
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs are supported')
  }

  let response: Response
  try {
    response = await fetch(parsed.href, {
      method: 'GET',
      headers: { Accept: 'application/json, application/zip' },
      credentials: 'omit',
      redirect: 'follow',
    })
  }
  catch {
    throw new Error('Network error fetching rulepack')
  }

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  }
  catch {
    throw new Error('Could not read the response')
  }

  return fragmentsFromBytes(bytes, 'Response')
}
