import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import fragment from '~/data/srd/warlock.json'

const pack = RulepackSchema.parse(fragment)
const warlock = pack.classes.find(c => c.id === 'warlock')!

describe('SRD warlock', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(warlock.hitDie).toBe('d8')
    expect(warlock.savingThrowProficiencies).toEqual(["wis", "cha"])
    expect(warlock.skillChoices.count).toBe(2)
    expect(warlock.skillChoices.from).toHaveLength(7)
    expect(warlock.levels).toHaveLength(20)
    expect(warlock.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(warlock.spellcastingAbility).toBe('cha')
    expect(warlock.pactMagic).toBe(true)
    expect(warlock.levels[0]!.spellSlots).toEqual({"1": 1})
    expect(warlock.levels[19]!.spellSlots).toEqual({"5": 4})
  })

  it('declares the Spells Known column', () => {
    expect(warlock.levels.map(l => l.spellsKnown)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15])
  })

  it('declares the Cantrips Known column', () => {
    expect(warlock.levels.map(l => l.cantripsKnown)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = warlock.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 1 only', () => {
    const levels = warlock.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([1])
  })

  it('ships The Fiend as its only subclass', () => {
    expect(warlock.subclasses?.map(s => s.id)).toEqual(['the-fiend'])
    const levels = warlock.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([1, 6, 10, 14])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of warlock.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (warlock.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(warlock.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of warlock.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('points every replaces reference at a real feature', () => {
    const names = (warlock.featureDefinitions ?? []).map(f => f.name)
    for (const f of warlock.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})

describe('warlock pact magic', () => {
  it('keeps the pactMagic flag through the schema', () => {
    // pactMagic is declared on ClassDefinition but was missing from ClassDefinitionSchema,
    // so Zod silently stripped it and the loader never saw a warlock as a pact caster.
    expect((fragment as { classes: Array<{ pactMagic?: boolean }> }).classes[0]!.pactMagic).toBe(true)
    expect(warlock.pactMagic).toBe(true)
  })

  it('declares exactly one slot level per level, as pact magic requires', () => {
    // resolveLevelUpEvents takes the last entry as the pact slot level and count,
    // so more than one key per level would silently drop the others.
    for (const lvl of warlock.levels) {
      expect(Object.keys(lvl.spellSlots ?? {}), `level ${lvl.level}`).toHaveLength(1)
    }
  })

  it('follows the SRD pact slot progression', () => {
    const table = warlock.levels.map(l => Object.entries(l.spellSlots ?? {})[0]!)
    expect(table.map(([lv, n]) => `${lv}:${n}`)).toEqual([
      '1:1', '1:2', '2:2', '2:2', '3:2', '3:2', '4:2', '4:2', '5:2', '5:2',
      '5:3', '5:3', '5:3', '5:3', '5:3', '5:3', '5:4', '5:4', '5:4', '5:4',
    ])
  })

  it('offers the SRD number of Eldritch Invocations', () => {
    let total = 0
    const known: Record<number, number> = {}
    for (const lvl of warlock.levels) {
      total += lvl.levelUpEvents.filter(
        e => e.type === 'CHOOSE_OPTION' && e.id.startsWith('eldritch-invocation')).length
      known[lvl.level] = total
    }
    // SRD Invocations Known: 2 at 2nd, then 3/4/5/6/7/8 at 5/7/9/12/15/18
    expect(known[1]).toBe(0)
    expect(known[2]).toBe(2)
    expect(known[5]).toBe(3)
    expect(known[7]).toBe(4)
    expect(known[9]).toBe(5)
    expect(known[12]).toBe(6)
    expect(known[15]).toBe(7)
    expect(known[18]).toBe(8)
    expect(known[20]).toBe(8)
  })

  it('offers all 32 SRD invocations at every pick', () => {
    for (const lvl of warlock.levels) {
      for (const e of lvl.levelUpEvents) {
        if (e.type === 'CHOOSE_OPTION' && e.id.startsWith('eldritch-invocation')) {
          expect(e.options, `level ${lvl.level}`).toHaveLength(32)
        }
      }
    }
  })
})
