import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/wizard.json'

const pack = RulepackSchema.parse(fragment)
const wizard = pack.classes.find(c => c.id === 'wizard')!

describe('SRD wizard', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(wizard.hitDie).toBe('d6')
    expect(wizard.savingThrowProficiencies).toEqual(["int", "wis"])
    expect(wizard.skillChoices.count).toBe(2)
    expect(wizard.skillChoices.from).toHaveLength(6)
    expect(wizard.levels).toHaveLength(20)
    expect(wizard.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(wizard.spellcastingAbility).toBe('int')
    expect(wizard.isFullCaster).toBe(true)
    expect(wizard.levels[0]!.spellSlots).toEqual({"1": 2})
    expect(wizard.levels[19]!.spellSlots).toEqual({"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1})
  })

  it('declares the Cantrips Known column', () => {
    expect(wizard.levels.map(l => l.cantripsKnown)).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = wizard.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 2 only', () => {
    const levels = wizard.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([2])
  })

  it('ships School of Evocation as its only subclass', () => {
    expect(wizard.subclasses?.map(s => s.id)).toEqual(['school-of-evocation'])
    const levels = wizard.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([2, 6, 10, 14])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of wizard.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (wizard.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(wizard.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of wizard.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (wizard.featureDefinitions ?? []).map(f => f.name)
    for (const f of wizard.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
