import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
        levels: [{ level: 21, features: [], levelUpEvents: [] }],
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

  it('accepts a subrace carrying its own languages', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      races: [{
        id: 'elf', name: 'Elf', size: 'medium', speeds: { walk: 30 },
        abilityScoreBonuses: {}, traits: [], languages: ['Common', 'Elvish'],
        subraces: [{
          id: 'drow', name: 'Drow', abilityScoreBonuses: {}, traits: [],
          languages: ['Undercommon'],
        }],
      }],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.races[0]!.subraces?.[0]!.languages).toEqual(['Undercommon'])
  })

  it('leaves a subrace with no languages of its own undefined, not defaulted', () => {
    const result = RulepackSchema.safeParse({
      ...minimalRulepack,
      races: [{
        id: 'dwarf', name: 'Dwarf', size: 'medium', speeds: { walk: 25 },
        abilityScoreBonuses: {}, traits: [], languages: ['Common', 'Dwarvish'],
        subraces: [{ id: 'hill', name: 'Hill Dwarf', abilityScoreBonuses: {}, traits: [] }],
      }],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.races[0]!.subraces?.[0]!.languages).toBeUndefined()
  })
})

describe('RulepackSchema starting equipment', () => {
  const startingEquipment = [{
    options: [{
      label: 'a longsword, a shield and a pack',
      requiresProficiency: true,
      items: [
        { kind: 'weapon', id: 'longsword', quantity: 1 },
        { kind: 'armor', id: 'shield', name: 'Wooden shield' },
        { kind: 'pack', id: 'dungeoneers-pack' },
        { kind: 'item', name: 'Rope', quantity: 1, weight: 10 },
        { kind: 'weaponChoice', category: 'martial', rangeType: 'melee' },
        { kind: 'itemChoice', label: 'Instrument', options: ['Lute', 'Flute'] },
      ],
    }],
  }]

  it('accepts a class with startingEquipment and startingWealth', () => {
    const cls = { ...fighterRulepack.classes[0], startingEquipment, startingWealth: { dice: '5d4', multiplier: 10 } }
    const result = RulepackSchema.safeParse({ ...minimalRulepack, classes: [cls] })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.classes[0]!.startingEquipment).toEqual(startingEquipment)
      expect(result.data.classes[0]!.startingWealth).toEqual({ dice: '5d4', multiplier: 10 })
    }
  })

  it('rejects a startingWealth dice expression with a modifier', () => {
    const cls = { ...fighterRulepack.classes[0], startingWealth: { dice: '5d4+10', multiplier: 10 } }
    expect(RulepackSchema.safeParse({ ...minimalRulepack, classes: [cls] }).success).toBe(false)
    const ok = { ...fighterRulepack.classes[0], startingWealth: { dice: '4D4', multiplier: 10 } }
    expect(RulepackSchema.safeParse({ ...minimalRulepack, classes: [ok] }).success).toBe(true)
  })

  it('defaults equipmentPacks to []', () => {
    const result = RulepackSchema.safeParse(minimalRulepack)
    expect(result.success && result.data.equipmentPacks).toEqual([])
  })
})

describe('docs/rulepacks.md starting equipment example', () => {
  it('validates against RulepackSchema', () => {
    const doc = readFileSync(resolve(__dirname, '../../docs/rulepacks.md'), 'utf8')
    const section = doc.slice(doc.indexOf('### Starting equipment'))
    const block = /```json\r?\n([\s\S]*?)```/.exec(section)![1]!
    const result = RulepackSchema.safeParse(JSON.parse(block))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.classes[0]!.startingEquipment).toHaveLength(2)
  })
})
