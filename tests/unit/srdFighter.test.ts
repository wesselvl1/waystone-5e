import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/fighter.json'

const pack = RulepackSchema.parse(fragment)
const fighter = pack.classes.find(c => c.id === 'fighter')!

describe('SRD fighter', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(fighter.hitDie).toBe('d10')
    expect(fighter.savingThrowProficiencies).toEqual(["str", "con"])
    expect(fighter.skillChoices.count).toBe(2)
    expect(fighter.skillChoices.from).toHaveLength(8)
    expect(fighter.levels).toHaveLength(20)
    expect(fighter.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is not a spellcaster', () => {
    expect(fighter.spellcastingAbility).toBeUndefined()
    expect(fighter.levels.every(l => l.spellSlots === undefined)).toBe(true)
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = fighter.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 6, 8, 12, 14, 16, 19])
  })

  it('offers the subclass choice at level 3 only', () => {
    const levels = fighter.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([3])
  })

  it('ships Champion as its only subclass', () => {
    expect(fighter.subclasses?.map(s => s.id)).toEqual(['champion'])
    const levels = fighter.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([3, 7, 10, 15, 18])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of fighter.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (fighter.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(fighter.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of fighter.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (fighter.featureDefinitions ?? []).map(f => f.name)
    for (const f of fighter.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
