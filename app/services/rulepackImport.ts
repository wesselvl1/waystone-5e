import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { Rulepack } from '~/types/rulepack'

function parseAndValidate(raw: unknown): Rulepack {
  const result = RulepackSchema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`Rulepack validation failed:\n${messages}`)
  }
  return result.data as Rulepack
}

export async function importFromFile(file: File): Promise<Rulepack> {
  let text: string
  try {
    text = await file.text()
  }
  catch {
    throw new Error('Could not read file')
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  }
  catch {
    throw new Error('File is not valid JSON')
  }

  return parseAndValidate(raw)
}

// URL import: caller must show the URL to the user for confirmation before calling this.
// This prevents silent SSRF — the user explicitly approves the destination.
export async function importFromUrl(url: string): Promise<Rulepack> {
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
      headers: { Accept: 'application/json' },
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

  let raw: unknown
  try {
    raw = await response.json()
  }
  catch {
    throw new Error('Response is not valid JSON')
  }

  return parseAndValidate(raw)
}
