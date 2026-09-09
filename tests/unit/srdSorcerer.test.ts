import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/sorcerer.json'

const pack = RulepackSchema.parse(fragment)
const sorcerer = pack.classes.find(c => c.id === 'sorcerer')!

describe('SRD sorcerer', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(sorcerer.hitDie).toBe('d6')
    expect(sorcerer.savingThrowProficiencies).toEqual(["con", "cha"])
    expect(sorcerer.skillChoices.count).toBe(2)
    expect(sorcerer.skillChoices.from).toHaveLength(6)
    expect(sorcerer.levels).toHaveLength(20)
    expect(sorcerer.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(sorcerer.spellcastingAbility).toBe('cha')
    expect(sorcerer.isFullCaster).toBe(true)
    expect(sorcerer.levels[0]!.spellSlots).toEqual({"1": 2})
    expect(sorcerer.levels[19]!.spellSlots).toEqual({"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1})
  })

  it('declares the Spells Known column', () => {
    expect(sorcerer.levels.map(l => l.spellsKnown)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15])
  })

  it('declares the Cantrips Known column', () => {
    expect(sorcerer.levels.map(l => l.cantripsKnown)).toEqual([4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = sorcerer.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 1 only', () => {
    const levels = sorcerer.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([1])
  })

  it('ships Draconic Bloodline as its only subclass', () => {
    expect(sorcerer.subclasses?.map(s => s.id)).toEqual(['draconic-bloodline'])
    const levels = sorcerer.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([1, 6, 14, 18])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of sorcerer.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('tracks sorcery points as a pool equal to the sorcerer level', () => {
    const fom = sorcerer.featureDefinitions!.find(f => f.name === 'Font of Magic')!
    expect(fom.usesMax).toBe(2)
    expect(fom.recharge).toBe('long')

    // Same mechanism as barbarian Rage and monk Ki: UPDATE_FEATURE_USES per level.
    const pool = new Map<number, number>([[2, 2]])
    for (const lvl of sorcerer.levels) {
      for (const e of lvl.levelUpEvents) {
        if (e.type === 'UPDATE_FEATURE_USES' && e.featureName === 'Font of Magic') {
          pool.set(lvl.level, e.usesMax as number)
        }
      }
    }
    for (let n = 2; n <= 20; n++) {
      expect(pool.get(n), `sorcery points at level ${n}`).toBe(n)
    }
    expect(pool.has(1)).toBe(false)
  })
  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (sorcerer.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(sorcerer.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of sorcerer.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (sorcerer.featureDefinitions ?? []).map(f => f.name)
    for (const f of sorcerer.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
