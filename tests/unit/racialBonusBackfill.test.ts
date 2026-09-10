import { describe, it, expect } from 'vitest'
import {
  backfillRacialBonuses,
  outstandingRacialChoices,
  racialChoicePatch,
} from '~/services/characterMigration'
import type { AbilityScores, Character } from '~/types/character'
import type { Race, Subrace } from '~/types/rulepack'

const SCORES: AbilityScores = { str: 14, dex: 12, con: 14, int: 10, wis: 13, cha: 8 }

function character(over: Partial<Character> = {}): Character {
  return {
    id: 'c',
    name: 'Test',
    race: 'dwarf',
    background: 'soldier',
    classes: [{ classId: 'fighter', level: 3 }],
    experiencePoints: 0,
    inspiration: false,
    abilityScores: { ...SCORES },
    abilityScoreOverrides: {},
    hp: { max: 20, current: 20, temp: 0 },
    armorClass: null,
    initiative: null,
    speeds: { walk: 25 },
    hitDice: [],
    spellSlots: {},
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficiencyBonusOverride: null,
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

const DWARF: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  size: 'medium',
  speeds: { walk: 25 },
  abilityScoreBonuses: { con: 2 },
  traits: [],
  languages: [],
}
const MOUNTAIN: Subrace = { id: 'mountain', name: 'Mountain Dwarf', abilityScoreBonuses: { str: 2 }, traits: [] }

const HALF_ELF: Race = {
  ...DWARF,
  id: 'half-elf',
  name: 'Half-Elf',
  abilityScoreBonuses: { cha: 2 },
  abilityScoreChoice: { from: ['str', 'dex', 'con', 'int', 'wis'], distributions: [[1, 1]] },
}

/** A Monsters of the Multiverse race: nothing fixed, the whole line distributed. */
const FAIRY: Race = {
  ...DWARF,
  id: 'fairy',
  name: 'Fairy',
  abilityScoreBonuses: {},
  abilityScoreChoice: {
    from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    distributions: [[2, 1], [1, 1, 1]],
  },
}

describe('backfilling the fixed increases', () => {
  it('adds the race and subrace bonuses', () => {
    const out = backfillRacialBonuses(character(), DWARF, MOUNTAIN)
    expect(out.abilityScores.con).toBe(16)
    expect(out.abilityScores.str).toBe(16)
    expect(out.abilityScores.dex).toBe(12)
  })

  it('records what the race granted', () => {
    const out = backfillRacialBonuses(character(), DWARF, MOUNTAIN)
    expect(out.appliedRacialBonuses).toEqual({ con: 2, str: 2 })
  })

  /** The record is the marker, so a second pass must find nothing left to do. */
  it('runs once', () => {
    const once = backfillRacialBonuses(character(), DWARF, MOUNTAIN)
    const twice = backfillRacialBonuses(once, DWARF, MOUNTAIN)
    expect(twice).toBe(once)
    expect(twice.abilityScores.con).toBe(16)
  })

  it('leaves a character created through the wizard alone', () => {
    const fresh = character({ appliedRacialBonuses: { con: 2 } })
    expect(backfillRacialBonuses(fresh, DWARF, undefined)).toBe(fresh)
  })

  /** Marking it done would strand the character with no increases for good. */
  it('does nothing when the race is not loaded', () => {
    const c = character()
    const out = backfillRacialBonuses(c, undefined, undefined)
    expect(out).toBe(c)
    expect(out.appliedRacialBonuses).toBeUndefined()
  })

  it('honours a subrace that replaces the race line', () => {
    const draconblood: Subrace = {
      id: 'draconblood',
      name: 'Draconblood',
      abilityScoreBonuses: { int: 2, cha: 1 },
      replacesRaceAbilityBonuses: true,
      traits: [],
    }
    const dragonborn: Race = { ...DWARF, id: 'dragonborn', abilityScoreBonuses: { str: 2, cha: 1 } }
    const out = backfillRacialBonuses(character(), dragonborn, draconblood)
    expect(out.appliedRacialBonuses).toEqual({ int: 2, cha: 1 })
    expect(out.abilityScores.str).toBe(14)
  })

  it('caps a score at 20 but still records the whole grant', () => {
    const out = backfillRacialBonuses(character({ abilityScores: { ...SCORES, con: 19 } }), DWARF, undefined)
    expect(out.abilityScores.con).toBe(20)
    expect(out.appliedRacialBonuses).toEqual({ con: 2 })
  })

  it('marks a race that fixes nothing as done', () => {
    const out = backfillRacialBonuses(character(), FAIRY, undefined)
    expect(out.appliedRacialBonuses).toEqual({})
    expect(out.abilityScores).toEqual(SCORES)
  })
})

describe('the half that cannot be backfilled', () => {
  it('is still outstanding after the fixed bonuses land', () => {
    const out = backfillRacialBonuses(character({ race: 'half-elf' }), HALF_ELF, undefined)
    expect(out.abilityScores.cha).toBe(10)
    expect(outstandingRacialChoices(out, HALF_ELF, undefined)).toEqual([HALF_ELF.abilityScoreChoice])
  })

  it('is outstanding for a race that fixes nothing at all', () => {
    const out = backfillRacialBonuses(character({ race: 'fairy' }), FAIRY, undefined)
    expect(outstandingRacialChoices(out, FAIRY, undefined)).toEqual([FAIRY.abilityScoreChoice])
  })

  it('is not outstanding for a race that offers no choice', () => {
    const out = backfillRacialBonuses(character(), DWARF, MOUNTAIN)
    expect(outstandingRacialChoices(out, DWARF, MOUNTAIN)).toEqual([])
  })

  it('is not outstanding once the player has answered it', () => {
    const answered = character({
      race: 'half-elf',
      appliedRacialBonuses: { cha: 2, str: 1, dex: 1 },
    })
    expect(outstandingRacialChoices(answered, HALF_ELF, undefined)).toEqual([])
  })

  it('stays outstanding while the answer is incomplete', () => {
    const half = character({ race: 'half-elf', appliedRacialBonuses: { cha: 2, str: 1 } })
    expect(outstandingRacialChoices(half, HALF_ELF, undefined)).toEqual([HALF_ELF.abilityScoreChoice])
  })

  /** A fixed bonus on the same ability must not be mistaken for a distributed one. */
  it('does not count the fixed bonus towards the choice', () => {
    // The half-elf's +2 Charisma alone satisfies nothing, even though it is two points
    const onlyFixed = character({ race: 'half-elf', appliedRacialBonuses: { cha: 2 } })
    expect(outstandingRacialChoices(onlyFixed, HALF_ELF, undefined)).toEqual([HALF_ELF.abilityScoreChoice])
  })
})

describe('spending the outstanding choice', () => {
  it('adds the picks to the scores and to the record', () => {
    const c = backfillRacialBonuses(character({ race: 'half-elf' }), HALF_ELF, undefined)
    const patch = racialChoicePatch(c, { str: 1, dex: 1 })
    expect(patch.abilityScores).toEqual({ ...SCORES, cha: 10, str: 15, dex: 13 })
    expect(patch.appliedRacialBonuses).toEqual({ cha: 2, str: 1, dex: 1 })
  })

  it('closes the choice', () => {
    const c = backfillRacialBonuses(character({ race: 'fairy' }), FAIRY, undefined)
    const spent = { ...c, ...racialChoicePatch(c, { int: 2, wis: 1 }) }
    expect(outstandingRacialChoices(spent, FAIRY, undefined)).toEqual([])
    expect(spent.abilityScores.int).toBe(12)
    expect(spent.abilityScores.wis).toBe(14)
  })

  /** Otherwise a capped pick reads as unspent and the sheet asks for it again forever. */
  it('does not reopen when a pick hits the cap', () => {
    const c = backfillRacialBonuses(
      character({ race: 'fairy', abilityScores: { ...SCORES, int: 19 } }),
      FAIRY,
      undefined,
    )
    const spent = { ...c, ...racialChoicePatch(c, { int: 2, wis: 1 }) }
    expect(spent.abilityScores.int).toBe(20)
    expect(outstandingRacialChoices(spent, FAIRY, undefined)).toEqual([])
  })
})
