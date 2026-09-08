import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { SubclassDefinition } from '~/types/rulepack'

/**
 * Glob-driven so a new fragment file is schema-validated without touching this test.
 * Mirrors the loader's own glob over app/data/srd.
 */
const fragments = import.meta.glob<{ default: unknown }>('~/data/srd/*.json', { eager: true })

const entries = Object.entries(fragments)
  .map(([path, mod]) => ({ name: path.split('/').pop()!, data: mod.default }))
  .sort((a, b) => a.name.localeCompare(b.name))

describe('SRD data files', () => {
  it('finds fragment files to validate', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  for (const { name, data } of entries) {
    it(`${name} is valid against RulepackSchema`, () => {
      const result = RulepackSchema.safeParse(data)
      if (!result.success) {
        const issue = result.error.issues[0]!
        throw new Error(`${name}: ${issue.path.join('.')} — ${issue.message}`)
      }
      expect(result.success).toBe(true)
    })
  }

  it('every fragment declares the same pack id and version', () => {
    const packs = entries.map(e => RulepackSchema.parse(e.data))
    const ids = [...new Set(packs.map(p => p.id))]
    const versions = [...new Set(packs.map(p => p.version))]
    expect(ids).toEqual(['srd-5.1'])
    expect(versions).toEqual(['5.1'])
  })
})

/**
 * SRD 5.1 publishes exactly one subclass per class. Anything else is non-OGL content
 * that must not be committed — keep it in a gitignored fragment instead.
 */
const SRD_SUBCLASS_IDS = [
  'path-of-the-berserker',
  'college-of-lore',
  'life-domain',
  'circle-of-the-land',
  'champion',
  'way-of-the-open-hand',
  'oath-of-devotion',
  'hunter',
  'thief',
  'draconic-bloodline',
  'the-fiend',
  'school-of-evocation',
]

function allSubclasses(): Array<{ classId: string; sub: SubclassDefinition }> {
  const out: Array<{ classId: string; sub: SubclassDefinition }> = []
  for (const { data } of entries) {
    const pack = RulepackSchema.parse(data)
    for (const cls of pack.classes) {
      for (const sub of cls.subclasses ?? []) out.push({ classId: cls.id, sub })
    }
    // patch-style entries, if any fragment still uses them
    for (const sub of pack.subclasses ?? []) {
      const { classId, ...rest } = sub
      out.push({ classId, sub: rest as SubclassDefinition })
    }
  }
  return out
}

describe('SRD subclass provenance', () => {
  it('contains only SRD 5.1 subclasses', () => {
    const ids = allSubclasses().map(s => s.sub.id)
    const unexpected = ids.filter(id => !SRD_SUBCLASS_IDS.includes(id))
    expect(unexpected, `non-SRD subclass in app/data/srd: ${unexpected.join(', ')}`).toEqual([])
  })

  it('gives no class more than one subclass', () => {
    const byClass = new Map<string, string[]>()
    for (const { classId, sub } of allSubclasses()) {
      byClass.set(classId, [...(byClass.get(classId) ?? []), sub.id])
    }
    for (const [classId, ids] of byClass) {
      expect(ids, `${classId} has multiple subclasses`).toHaveLength(1)
    }
  })

  it('declares each class in exactly one fragment', () => {
    const seen = new Map<string, string[]>()
    for (const { name, data } of entries) {
      for (const cls of RulepackSchema.parse(data).classes) {
        seen.set(cls.id, [...(seen.get(cls.id) ?? []), name])
      }
    }
    for (const [id, files] of seen) {
      expect(files, `${id} declared in multiple fragments`).toHaveLength(1)
    }
  })
})
