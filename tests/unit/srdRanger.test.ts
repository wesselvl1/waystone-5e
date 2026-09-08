import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/ranger.json'

const pack = RulepackSchema.parse(fragment)
const ranger = pack.classes.find(c => c.id === 'ranger')!

describe('SRD ranger', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(ranger.hitDie).toBe('d10')
    expect(ranger.savingThrowProficiencies).toEqual(["str", "dex"])
    expect(ranger.skillChoices.count).toBe(3)
    expect(ranger.skillChoices.from).toHaveLength(8)
    expect(ranger.levels).toHaveLength(20)
    expect(ranger.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(ranger.spellcastingAbility).toBe('wis')
    expect(ranger.isHalfCaster).toBe(true)
    expect(ranger.levels[1]!.spellSlots).toEqual({"1": 2})
    expect(ranger.levels[19]!.spellSlots).toEqual({"1": 4, "2": 3, "3": 3, "4": 3, "5": 2})
  })

  it('declares the Spells Known column', () => {
    expect(ranger.levels.map(l => l.spellsKnown)).toEqual([0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11])
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = ranger.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 3 only', () => {
    const levels = ranger.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([3])
  })

  it('ships Hunter as its only subclass', () => {
    expect(ranger.subclasses?.map(s => s.id)).toEqual(['hunter'])
    const levels = ranger.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([3, 7, 11, 15])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of ranger.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (ranger.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(ranger.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of ranger.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (ranger.featureDefinitions ?? []).map(f => f.name)
    for (const f of ranger.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
