import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { baseSpellSlots, casterLevelFor, maxSpellLevelForClass } from '~/services/spellcasting'
import type { ClassEntry } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import wizard from '~/data/srd/wizard.json'
import paladin from '~/data/srd/paladin.json'
import cleric from '~/data/srd/cleric.json'

/**
 * The printed Artificer table, levels 1-20. Its distinctive feature is level 1: half of
 * one, rounded UP, is one caster level — so an artificer casts from the very first level
 * where a paladin or ranger does not.
 */
const ARTIFICER_TABLE: Array<[number, Record<number, number>]> = [
  [1, { 1: 2 }], [2, { 1: 2 }], [3, { 1: 3 }], [4, { 1: 3 }],
  [5, { 1: 4, 2: 2 }], [6, { 1: 4, 2: 2 }], [7, { 1: 4, 2: 3 }], [8, { 1: 4, 2: 3 }],
  [9, { 1: 4, 2: 3, 3: 2 }], [10, { 1: 4, 2: 3, 3: 2 }],
  [11, { 1: 4, 2: 3, 3: 3 }], [12, { 1: 4, 2: 3, 3: 3 }],
  [13, { 1: 4, 2: 3, 3: 3, 4: 1 }], [14, { 1: 4, 2: 3, 3: 3, 4: 1 }],
  [15, { 1: 4, 2: 3, 3: 3, 4: 2 }], [16, { 1: 4, 2: 3, 3: 3, 4: 2 }],
  [17, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }], [18, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }],
  [19, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }], [20, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }],
]

const ARTIFICER = {
  id: 'artificer',
  name: 'Artificer',
  hitDie: 'd8',
  primaryAbility: ['int'],
  savingThrowProficiencies: ['con', 'int'],
  armorProficiencies: ['light', 'medium', 'shields'],
  weaponProficiencies: ['simple'],
  toolProficiencies: [],
  skillChoices: { count: 2, from: ['arcana', 'history'] },
  spellcastingAbility: 'int',
  casterProgression: 'artificer',
  spellPreparation: { kind: 'prepared', levelDivisor: 2 },
  levels: ARTIFICER_TABLE.map(([level, spellSlots]) => ({
    level, features: [], spellSlots, levelUpEvents: [],
  })),
}

function pack(): Rulepack {
  return RulepackSchema.parse({
    id: 'p', name: 'Test', version: '1',
    classes: [
      ARTIFICER,
      ...RulepackSchema.parse(wizard).classes,
      ...RulepackSchema.parse(paladin).classes,
      ...RulepackSchema.parse(cleric).classes,
    ],
  }) as unknown as Rulepack
}

const rulepack = pack()
const art = (level: number): ClassEntry[] => [{ classId: 'artificer', level }]
const wizardTable = rulepack.classes.find(c => c.id === 'wizard')!

describe('the artificer caster progression', () => {
  it('contributes half its level rounded UP', () => {
    expect(casterLevelFor({ classId: 'artificer', level: 1 }, rulepack)).toBe(1)
    expect(casterLevelFor({ classId: 'artificer', level: 2 }, rulepack)).toBe(1)
    expect(casterLevelFor({ classId: 'artificer', level: 5 }, rulepack)).toBe(3)
    expect(casterLevelFor({ classId: 'artificer', level: 19 }, rulepack)).toBe(10)
    expect(casterLevelFor({ classId: 'artificer', level: 20 }, rulepack)).toBe(10)
  })

  it('differs from a half caster at every odd level', () => {
    for (let level = 1; level <= 19; level += 2) {
      const artificer = casterLevelFor({ classId: 'artificer', level }, rulepack)
      const paladinLevel = casterLevelFor({ classId: 'paladin', level }, rulepack)
      expect(artificer, `level ${level}`).toBe(paladinLevel + 1)
    }
  })

  it('casts at 1st level, where a paladin does not', () => {
    expect(baseSpellSlots(art(1), rulepack)).toEqual({ 1: 2 })
    expect(baseSpellSlots([{ classId: 'paladin', level: 1 }], rulepack)).toEqual({})
  })

  it('reads its own printed table when single-classed', () => {
    for (const [level, expected] of ARTIFICER_TABLE) {
      expect(baseSpellSlots(art(level), rulepack), `artificer ${level}`).toEqual(expected)
    }
  })

  /**
   * The formula and the printed table have to agree, or a multiclassed artificer would
   * jump up or down relative to a single-classed one of the same level.
   */
  it('agrees with the multiclass table at every level', () => {
    for (const [level, expected] of ARTIFICER_TABLE) {
      const casterLevel = casterLevelFor({ classId: 'artificer', level }, rulepack)
      const viaTable = wizardTable.levels.find(l => l.level === casterLevel)!.spellSlots
      expect(viaTable, `artificer ${level} -> caster level ${casterLevel}`).toEqual(expected)
    }
  })

  it('pools with another caster on the combined level', () => {
    // Artificer 1 (rounds up to 1) + wizard 1 = caster level 2
    const combined = baseSpellSlots(
      [...art(1), { classId: 'wizard', level: 1 }],
      rulepack,
    )
    expect(combined).toEqual(wizardTable.levels.find(l => l.level === 2)!.spellSlots)
    // Rounding down would have given caster level 1 and one slot fewer
    expect(combined).not.toEqual(wizardTable.levels.find(l => l.level === 1)!.spellSlots)
  })

  it('caps learnable spell level by its own table', () => {
    expect(maxSpellLevelForClass('artificer', art(1), rulepack)).toBe(1)
    expect(maxSpellLevelForClass('artificer', art(5), rulepack)).toBe(2)
    expect(maxSpellLevelForClass('artificer', art(17), rulepack)).toBe(5)
  })
})

describe('the existing progressions are untouched', () => {
  it('still reads full and half casters off the booleans alone', () => {
    // Neither SRD class declares casterProgression; the booleans still decide
    expect(rulepack.classes.find(c => c.id === 'wizard')!.casterProgression).toBeUndefined()
    expect(rulepack.classes.find(c => c.id === 'paladin')!.casterProgression).toBeUndefined()
    expect(casterLevelFor({ classId: 'wizard', level: 5 }, rulepack)).toBe(5)
    expect(casterLevelFor({ classId: 'paladin', level: 5 }, rulepack)).toBe(2)
  })

  it('lets casterProgression override a boolean that disagrees', () => {
    const contradictory = RulepackSchema.parse({
      id: 'p', name: 'P', version: '1',
      classes: [{ ...ARTIFICER, id: 'odd', isHalfCaster: true }],
    }) as unknown as Rulepack
    expect(casterLevelFor({ classId: 'odd', level: 1 }, contradictory)).toBe(1)
  })

  it('rejects a progression outside the union', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      classes: [{ ...ARTIFICER, casterProgression: 'quarter' }],
    })
    expect(result.success).toBe(false)
  })
})
