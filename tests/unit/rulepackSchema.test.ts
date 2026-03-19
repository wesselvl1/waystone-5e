import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { fighterRulepack } from '../fixtures'

const minimalRulepack = {
  id: 'test',
  name: 'Test Pack',
  version: '1.0.0',
  races: [],
  classes: [],
  backgrounds: [],
  feats: [],
  spells: [],
}

describe('RulepackSchema', () => {
  it('accepts a valid minimal rulepack', () => {
    const result = RulepackSchema.safeParse(minimalRulepack)
    expect(result.success).toBe(true)
  })

  it('accepts a rulepack with a full fighter class definition', () => {
    const result = RulepackSchema.safeParse(fighterRulepack)
    expect(result.success).toBe(true)
  })

  it('rejects a rulepack with no name', () => {
    const result = RulepackSchema.safeParse({ ...minimalRulepack, name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts a rulepack fragment with only some content arrays', () => {
    // All content arrays are optional — a file can contain just spells, classes, subclasses, etc.
    const fragment = { id: 'test', name: 'Test Pack', version: '1.0.0' }
    const result = RulepackSchema.safeParse(fragment)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.classes).toEqual([])
      expect(result.data.spells).toEqual([])
    }
  })

  it('rejects a race with negative walk speed', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      races: [{
        id: 'elf', name: 'Elf', size: 'medium', speeds: { walk: -5 },
        abilityScoreBonuses: {}, traits: [], languages: [],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a race with an invalid size', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      races: [{
        id: 'dwarf', name: 'Dwarf', size: 'colossal', speeds: { walk: 25 },
        abilityScoreBonuses: {}, traits: [], languages: [],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a class level above 20', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      classes: [{
        ...fighterRulepack.classes[0],
        levels: [{ level: 21, proficiencyBonus: 7, features: [], levelUpEvents: [] }],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a spell with level above 9', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      spells: [{
        id: 'uber-spell', name: 'Uber Spell', level: 10, school: 'abjuration',
        castingTime: '1 action', range: '60 ft', components: 'V, S',
        duration: 'Instantaneous', concentration: false, ritual: false,
        description: 'Too powerful.', classes: ['sorcerer'],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('strips unknown extra fields', () => {
    const result = RulepackSchema.safeParse({ ...minimalRulepack, extraField: 'ignored' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('extraField' in result.data).toBe(false)
    }
  })
})
