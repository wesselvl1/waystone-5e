import { describe, it, expect, vi, afterEach } from 'vitest'
import { createZip } from '../../scripts/pack-rulepacks.mjs'
import { readZip, looksLikeZip } from '~/services/zip'
import { importFromFile, importFromUrl } from '~/services/rulepackImport'

/**
 * The packing script and the in-app reader are the two halves of one format, so they are
 * tested against each other: whatever `pnpm pack:rulepacks` writes must be exactly what
 * the import screen can open.
 */

function fragment(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `Pack ${id}`,
    version: '1.0',
    ...extra,
  }
}

function zipFile(files: { path: string, content: string }[]): File {
  const zip = createZip(files)
  return new File([new Uint8Array(zip)], 'rulepacks.zip', { type: 'application/zip' })
}

describe('zip reader', () => {
  it('round-trips stored and deflated entries', async () => {
    // Long and repetitive compresses; a couple of bytes does not, so the writer stores it
    const long = 'x'.repeat(5000)
    const zip = createZip([
      { path: 'a/long.json', content: long },
      { path: 'a/tiny.json', content: '{}' },
    ])

    expect(looksLikeZip(new Uint8Array(zip))).toBe(true)

    const entries = await readZip(new Uint8Array(zip))
    const decode = (path: string) =>
      new TextDecoder().decode(entries.find(e => e.path === path)!.bytes)

    expect(entries.map(e => e.path)).toEqual(['a/long.json', 'a/tiny.json'])
    expect(decode('a/long.json')).toBe(long)
    expect(decode('a/tiny.json')).toBe('{}')
  })

  it('rejects something that is not a zip', async () => {
    await expect(readZip(new TextEncoder().encode('not a zip at all')))
      .rejects.toThrow(/not a valid zip/i)
  })

  it('produces byte-identical output for identical input', () => {
    const files = [{ path: 'a/x.json', content: '{"id":"a"}' }]
    expect(createZip(files).equals(createZip(files))).toBe(true)
  })
})

describe('importFromFile', () => {
  it('reads a bare JSON file as a single fragment', async () => {
    const file = new File([JSON.stringify(fragment('solo'))], 'solo.json', { type: 'application/json' })
    const fragments = await importFromFile(file)

    expect(fragments).toHaveLength(1)
    expect(fragments[0]!.id).toBe('solo')
  })

  it('reads every fragment out of a zip', async () => {
    const file = zipFile([
      { path: 'tcoe/feats.json', content: JSON.stringify(fragment('tcoe', { feats: [] })) },
      { path: 'xge/spells.json', content: JSON.stringify(fragment('xge', { spells: [] })) },
    ])

    const fragments = await importFromFile(file)
    expect(fragments.map(f => f.id).sort()).toEqual(['tcoe', 'xge'])
  })

  it('orders patch fragments after the fragments they patch', async () => {
    // Written to the zip in the wrong order on purpose — the importer must reorder,
    // since a subrace merging before its race is silently dropped.
    const file = zipFile([
      {
        path: 'book/subraces.json',
        content: JSON.stringify(fragment('book', {
          subraces: [{ id: 'book.sub', raceId: 'book.race', name: 'Sub', abilityScoreBonuses: {}, traits: [] }],
        })),
      },
      {
        path: 'book/races.json',
        content: JSON.stringify(fragment('book', {
          races: [{
            id: 'book.race',
            name: 'Race',
            size: 'medium',
            speeds: { walk: 30 },
            abilityScoreBonuses: {},
            traits: [],
            languages: [],
          }],
        })),
      },
    ])

    const fragments = await importFromFile(file)
    expect(fragments[0]!.races).toHaveLength(1)
    expect(fragments[1]!.subraces).toHaveLength(1)
  })

  it('ignores non-JSON entries but fails on an invalid fragment', async () => {
    const withReadme = zipFile([
      { path: 'book/README.md', content: 'notes to self' },
      { path: 'book/feats.json', content: JSON.stringify(fragment('book')) },
    ])
    expect(await importFromFile(withReadme)).toHaveLength(1)

    const withBadFragment = zipFile([
      { path: 'book/feats.json', content: JSON.stringify({ name: 'no id' }) },
    ])
    await expect(importFromFile(withBadFragment)).rejects.toThrow(/book\/feats\.json/)
  })

  it('rejects a zip holding no rulepacks', async () => {
    await expect(importFromFile(zipFile([{ path: 'book/README.md', content: 'hi' }])))
      .rejects.toThrow(/no \.json rulepack files/)
  })
})

describe('importFromUrl', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** A zip served over http is recognised by its bytes, whatever content type it carries. */
  it('unpacks a fetched zip', async () => {
    const zip = createZip([
      { path: 'tce/feats.json', content: JSON.stringify(fragment('tce')) },
      { path: 'tce/spells.json', content: JSON.stringify(fragment('tce', { spells: [] })) },
    ])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(zip), {
      headers: { 'content-type': 'application/octet-stream' },
    })))

    expect(await importFromUrl('https://example.com/rulepacks.zip')).toHaveLength(2)
  })

  it('still reads a plain JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fragment('solo')))))

    const fragments = await importFromUrl('https://example.com/pack.json')
    expect(fragments.map(f => f.id)).toEqual(['solo'])
  })

  it('rejects a non-http scheme before fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(importFromUrl('file:///etc/passwd')).rejects.toThrow(/http and https/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
