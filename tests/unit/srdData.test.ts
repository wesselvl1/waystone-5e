import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'

import spells from '~/data/srd/spells.json'
import classes from '~/data/srd/classes.json'
import backgrounds from '~/data/srd/backgrounds.json'
import races from '~/data/srd/races.json'
import feats from '~/data/srd/feats.json'
import subclasses from '~/data/srd/subclasses.json'
import subraces from '~/data/srd/subraces.json'

const srdFiles = [
  { name: 'spells.json', data: spells },
  { name: 'classes.json', data: classes },
  { name: 'backgrounds.json', data: backgrounds },
  { name: 'races.json', data: races },
  { name: 'feats.json', data: feats },
  { name: 'subclasses.json', data: subclasses },
  { name: 'subraces.json', data: subraces },
]

describe('SRD data files', () => {
  for (const { name, data } of srdFiles) {
    it(`${name} is valid against RulepackSchema`, () => {
      const result = RulepackSchema.safeParse(data)
      if (!result.success) {
        // Surface the first validation error for easy debugging
        const issue = result.error.issues[0]
        throw new Error(`${name}: ${issue.path.join('.')} — ${issue.message}`)
      }
      expect(result.success).toBe(true)
    })
  }
})

/**
 * SRD 5.1 publishes exactly one subclass per class. Anything else in the SRD pack is
 * non-OGL content that must not be committed — keep it in a gitignored fragment instead.
 */
const SRD_SUBCLASS_IDS = [
  'path-of-the-berserker',
  'life-domain',
]

describe('SRD subclass provenance', () => {
  it('contains only SRD 5.1 subclasses', () => {
    const parsed = RulepackSchema.parse(subclasses)
    const ids = (parsed.subclasses ?? []).map(s => s.id)
    const unexpected = ids.filter(id => !SRD_SUBCLASS_IDS.includes(id))
    expect(unexpected, `non-SRD subclass in app/data/srd: ${unexpected.join(', ')}`).toEqual([])
  })

  it('gives every subclass a class that exists in the pack', () => {
    const cls = RulepackSchema.parse(classes)
    const classIds = cls.classes.map(c => c.id)
    for (const s of RulepackSchema.parse(subclasses).subclasses ?? []) {
      expect(classIds, s.id).toContain(s.classId)
    }
  })
})
