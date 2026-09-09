import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/druid.json'

const pack = RulepackSchema.parse(fragment)
const druid = pack.classes.find(c => c.id === 'druid')!

describe('SRD druid', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(druid.hitDie).toBe('d8')
    expect(druid.savingThrowProficiencies).toEqual(["int", "wis"])
    expect(druid.skillChoices.count).toBe(2)
    expect(druid.skillChoices.from).toHaveLength(8)
    expect(druid.levels).toHaveLength(20)
    expect(druid.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(druid.spellcastingAbility).toBe('wis')
    expect(druid.isFullCaster).toBe(true)
    expect(druid.levels[0]!.spellSlots).toEqual({"1": 2})
    expect(druid.levels[19]!.spellSlots).toEqual({"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1})
  })

  it('declares the Cantrips Known column', () => {
    expect(druid.levels.map(l => l.cantripsKnown)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = druid.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 2 only', () => {
    const levels = druid.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([2])
  })

  it('ships Circle of the Land as its only subclass', () => {
    expect(druid.subclasses?.map(s => s.id)).toEqual(['circle-of-the-land'])
    const levels = druid.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([2, 3, 5, 6, 7, 9, 10, 14])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of druid.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (druid.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(druid.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of druid.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (druid.featureDefinitions ?? []).map(f => f.name)
    for (const f of druid.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
