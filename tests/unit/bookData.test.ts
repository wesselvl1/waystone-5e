import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'

/**
 * Glob-driven over every book directory under app/data, srd/ included, so a new
 * fragment — from any book, not just the SRD — is schema-validated without touching
 * this test. `tests/unit/srdData.test.ts` covers SRD-specific content rules (subclass
 * provenance, race traits, …); this test is only about every fragment parsing.
 *
 * Every book directory other than srd/ is gitignored (see CLAUDE.md, "Non-SRD books"),
 * so a CI clone sees app/data/srd/ alone. The glob then yields just the SRD fragments,
 * which srdData.test.ts already proves parse — so this test still runs and still
 * passes, just without anything extra to say. It must never fail or skip noisily in
 * that state.
 */
const fragments = import.meta.glob<{ default: unknown }>('~/data/*/*.json', { eager: true })

const entries = Object.entries(fragments)
  .map(([path, mod]) => ({ path: path.replace(/^.*\/app\/data\//, 'app/data/'), data: mod.default }))
  .sort((a, b) => a.path.localeCompare(b.path))

describe('book data files', () => {
  it('finds at least the SRD fragments to validate', () => {
    // A bare CI clone has only app/data/srd/*.json; every other book directory is
    // gitignored. Either way there is always something here.
    expect(entries.length).toBeGreaterThan(0)
  })

  for (const { path, data } of entries) {
    it(`${path} is valid against RulepackSchema`, () => {
      const result = RulepackSchema.safeParse(data)
      if (!result.success) {
        const issue = result.error.issues[0]!
        throw new Error(`${path}: ${issue.path.join('.')} — ${issue.message}`)
      }
      expect(result.success).toBe(true)
    })
  }
})
