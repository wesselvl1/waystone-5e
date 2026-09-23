import { describe, it, expect } from 'vitest'
import { backfillSensesAndResistances } from '~/services/characterMigration'
import type { AbilityScores, Character } from '~/types/character'
import type { Race, Subrace } from '~/types/rulepack'

const SCORES: AbilityScores = { str: 14, dex: 12, con: 14, int: 10, wis: 13, cha: 8 }

function character(over: Partial<Character> = {}): Character {
  return {
    id: 'c',
    name: 'Test',
    race: 'tiefling',
    background: 'soldier',
    classes: [{ classId: 'fighter', level: 3 }],
    experiencePoints: 0,
    inspiration: false,
    abilityScores: { ...SCORES },
    abilityScoreOverrides: {},
    hp: { max: 20, current: 20, temp: 0 },
    armorClass: null,
    initiative: null,
    speeds: { walk: 30 },
    hitDice: [],
    spellSlots: {},
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    savingThrowProficiencies: [],
    skillProficiencies: {},
    features: [],
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spells: [],
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  } as Character
}

const TIEFLING: Race = {
  id: 'tiefling',
  name: 'Tiefling',
  size: 'medium',
  speeds: { walk: 30 },
  senses: { darkvision: 60 },
  abilityScoreBonuses: { cha: 2, int: 1 },
  traits: [],
  languages: [],
  damageResistances: ['fire'],
}

const WINGED: Subrace = {
  id: 'winged',
  name: 'Winged Tiefling',
  abilityScoreBonuses: { dex: 1 },
  traits: [],
  senses: { darkvision: 120 },
}

describe('backfilling senses and resistances', () => {
  it('adds the race darkvision to a character that never had any senses stored', () => {
    const out = backfillSensesAndResistances(character(), TIEFLING, undefined)
    expect(out.senses).toEqual({ darkvision: 60 })
  })

  it('adds the race resistance list', () => {
    const out = backfillSensesAndResistances(character(), TIEFLING, undefined)
    expect(out.damageResistances).toEqual(['fire'])
  })

  it('merges the subrace darkvision, taking the larger range', () => {
    const out = backfillSensesAndResistances(character(), TIEFLING, WINGED)
    expect(out.senses).toEqual({ darkvision: 120 })
  })

  it('does nothing when the race is not loaded', () => {
    const c = character()
    const out = backfillSensesAndResistances(c, undefined, undefined)
    expect(out).toBe(c)
  })

  it('runs once — a second pass over an already-filled character is a no-op', () => {
    const once = backfillSensesAndResistances(character(), TIEFLING, undefined)
    const twice = backfillSensesAndResistances(once, TIEFLING, undefined)
    expect(twice).toBe(once)
  })

  /**
   * Absence, not an empty value, is the only signal a field was never backfilled — the
   * same idiom appliedRacialBonuses uses. A player who cleared their resistance list on
   * the sheet must not have it silently reinstated on the next load.
   */
  it('leaves an empty list the player cleared alone', () => {
    const c = character({ damageResistances: [] })
    const out = backfillSensesAndResistances(c, TIEFLING, undefined)
    expect(out.damageResistances).toEqual([])
  })

  it('leaves a sense mode the player has already set alone, even if smaller than the race grants', () => {
    const c = character({ senses: { darkvision: 30 } })
    const out = backfillSensesAndResistances(c, TIEFLING, undefined)
    expect(out.senses).toEqual({ darkvision: 30 })
  })

  it('fills a mode the character is missing without touching one it already has', () => {
    const c = character({ senses: { blindsight: 10 } })
    const raceWithBoth: Race = { ...TIEFLING, senses: { darkvision: 60, blindsight: 30 } }
    const out = backfillSensesAndResistances(c, raceWithBoth, undefined)
    expect(out.senses).toEqual({ blindsight: 10, darkvision: 60 })
  })

  it('adds nothing when the race grants no senses or resistances at all', () => {
    const plainRace: Race = { id: 'human', name: 'Human', size: 'medium', speeds: { walk: 30 }, abilityScoreBonuses: {}, traits: [], languages: [] }
    const c = character({ race: 'human' })
    const out = backfillSensesAndResistances(c, plainRace, undefined)
    expect(out).toBe(c)
  })

  it('does not mutate the original character', () => {
    const c = character()
    backfillSensesAndResistances(c, TIEFLING, undefined)
    expect(c.senses).toBeUndefined()
  })
})
