import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/monk.json'

const pack = RulepackSchema.parse(fragment)
const monk = pack.classes.find(c => c.id === 'monk')!

describe('SRD monk', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(monk.hitDie).toBe('d8')
    expect(monk.savingThrowProficiencies).toEqual(["str", "dex"])
    expect(monk.skillChoices.count).toBe(2)
    expect(monk.skillChoices.from).toHaveLength(6)
    expect(monk.levels).toHaveLength(20)
    expect(monk.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is not a spellcaster', () => {
    expect(monk.spellcastingAbility).toBeUndefined()
    expect(monk.levels.every(l => l.spellSlots === undefined)).toBe(true)
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = monk.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 3 only', () => {
    const levels = monk.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([3])
  })

  it('ships Way of the Open Hand as its only subclass', () => {
    expect(monk.subclasses?.map(s => s.id)).toEqual(['way-of-the-open-hand'])
    const levels = monk.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([3, 6, 11, 17])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of monk.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (monk.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(monk.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of monk.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (monk.featureDefinitions ?? []).map(f => f.name)
    for (const f of monk.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
