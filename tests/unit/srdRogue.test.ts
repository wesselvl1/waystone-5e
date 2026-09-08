import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/rogue.json'

const pack = RulepackSchema.parse(fragment)
const rogue = pack.classes.find(c => c.id === 'rogue')!

describe('SRD rogue', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(rogue.hitDie).toBe('d8')
    expect(rogue.savingThrowProficiencies).toEqual(["dex", "int"])
    expect(rogue.skillChoices.count).toBe(4)
    expect(rogue.skillChoices.from).toHaveLength(11)
    expect(rogue.levels).toHaveLength(20)
    expect(rogue.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is not a spellcaster', () => {
    expect(rogue.spellcastingAbility).toBeUndefined()
    expect(rogue.levels.every(l => l.spellSlots === undefined)).toBe(true)
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = rogue.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 10, 12, 16, 19])
  })

  it('offers the subclass choice at level 3 only', () => {
    const levels = rogue.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([3])
  })

  it('ships Thief as its only subclass', () => {
    expect(rogue.subclasses?.map(s => s.id)).toEqual(['thief'])
    const levels = rogue.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([3, 9, 13, 17])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of rogue.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (rogue.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(rogue.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of rogue.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (rogue.featureDefinitions ?? []).map(f => f.name)
    for (const f of rogue.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
