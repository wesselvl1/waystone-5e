import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { raceAbilityBonuses, raceSpeeds } from '~/services/multiclass'
import type { Race, Subrace } from '~/types/rulepack'

const DWARF: Pick<Race, 'abilityScoreBonuses' | 'abilityScoreChoice'> = {
  abilityScoreBonuses: { con: 2 },
}
const HALF_ELF: Pick<Race, 'abilityScoreBonuses' | 'abilityScoreChoice'> = {
  abilityScoreBonuses: { cha: 2 },
  abilityScoreChoice: { from: ['str', 'dex', 'con', 'int', 'wis'], distributions: [[1, 1]] },
}
const DRAGONBORN: Pick<Race, 'abilityScoreBonuses' | 'abilityScoreChoice'> = {
  abilityScoreBonuses: { str: 2, cha: 1 },
}

type Sub = Pick<Subrace, 'abilityScoreBonuses' | 'abilityScoreChoice' | 'replacesRaceAbilityBonuses'>

/** The ordinary case: a mountain dwarf's Strength on top of the dwarf's Constitution. */
const MOUNTAIN: Sub = { abilityScoreBonuses: { str: 2 } }
/** Wildemount restates the whole line: INT and CHA, and no Strength. */
const DRACONBLOOD: Sub = { abilityScoreBonuses: { int: 2, cha: 1 }, replacesRaceAbilityBonuses: true }
/** A dragonmark replaces both halves — the fixed bonus and the half-elf's own pick. */
const MARK_OF_DETECTION: Sub = {
  abilityScoreBonuses: { wis: 2 },
  abilityScoreChoice: { from: ['str', 'dex', 'con', 'int', 'cha'], distributions: [[1]] },
  replacesRaceAbilityBonuses: true,
}

describe('a subrace that adds to its race', () => {
  it('sums both sets of bonuses', () => {
    expect(raceAbilityBonuses(DWARF, MOUNTAIN).bonuses).toEqual({ con: 2, str: 2 })
  })

  it('keeps the race bonuses when there is no subrace', () => {
    expect(raceAbilityBonuses(DWARF, undefined).bonuses).toEqual({ con: 2 })
  })

  it('keeps the race distributable bonuses', () => {
    expect(raceAbilityBonuses(HALF_ELF, undefined).choices).toEqual([HALF_ELF.abilityScoreChoice])
  })

  it('stacks a shared ability rather than overwriting it', () => {
    const both = raceAbilityBonuses({ abilityScoreBonuses: { con: 2 } }, { abilityScoreBonuses: { con: 1 } })
    expect(both.bonuses).toEqual({ con: 3 })
  })
})

describe('a subrace that replaces its race', () => {
  it('drops the race bonuses entirely', () => {
    // Not INT 2 / CHA 1 *plus* the dragonborn's STR 2
    expect(raceAbilityBonuses(DRAGONBORN, DRACONBLOOD).bonuses).toEqual({ int: 2, cha: 1 })
  })

  it('needs no negative numbers to cancel the race', () => {
    const { bonuses } = raceAbilityBonuses(DRAGONBORN, DRACONBLOOD)
    expect(Object.values(bonuses).every(v => (v ?? 0) > 0)).toBe(true)
  })

  /**
   * The half of this that a delta could never express: Race.abilityScoreChoice is its
   * own field, so a subrace's pick used to land on top of the race's rather than instead
   * of it, leaving a dragonmarked half-elf +1 to two abilities too strong.
   */
  it('replaces the race distributable bonuses too', () => {
    const { bonuses, choices } = raceAbilityBonuses(HALF_ELF, MARK_OF_DETECTION)
    expect(bonuses).toEqual({ wis: 2 })
    expect(choices).toEqual([MARK_OF_DETECTION.abilityScoreChoice])
    expect(choices).not.toContain(HALF_ELF.abilityScoreChoice)
  })

  it('leaves no distributable bonus when the subrace names none', () => {
    expect(raceAbilityBonuses(HALF_ELF, DRACONBLOOD).choices).toEqual([])
  })

  it('is inert without the flag', () => {
    const additive: Sub = { abilityScoreBonuses: { int: 2, cha: 1 } }
    expect(raceAbilityBonuses(DRAGONBORN, additive).bonuses).toEqual({ str: 2, cha: 2, int: 2 })
  })
})

describe('schema', () => {
  const parse = (subrace: Record<string, unknown>) => RulepackSchema.safeParse({
    id: 'p', name: 'P', version: '1',
    subraces: [{ id: 's', name: 'S', raceId: 'dragonborn', traits: [], ...subrace }],
  })

  it('round-trips the flag', () => {
    const r = parse({ abilityScoreBonuses: { int: 2 }, replacesRaceAbilityBonuses: true })
    expect(r.success && r.data.subraces[0]!.replacesRaceAbilityBonuses).toBe(true)
  })

  it('rejects the flag set to false, so it means one thing', () => {
    expect(parse({ abilityScoreBonuses: {}, replacesRaceAbilityBonuses: false }).success).toBe(false)
  })

  /** The schema strips what it does not name, which silently dropped every one of these. */
  it('keeps a subrace distributable bonus', () => {
    const r = parse({
      abilityScoreBonuses: { int: 1 },
      abilityScoreChoice: { from: ['dex', 'cha'], distributions: [[2]] },
    })
    expect(r.success && r.data.subraces[0]!.abilityScoreChoice)
      .toEqual({ from: ['dex', 'cha'], distributions: [[2]] })
  })

  it('leaves both fields off a subrace that has neither', () => {
    const r = parse({ abilityScoreBonuses: { str: 2 } })
    expect(r.success && r.data.subraces[0]!.abilityScoreChoice).toBeUndefined()
    expect(r.success && r.data.subraces[0]!.replacesRaceAbilityBonuses).toBeUndefined()
  })
})

describe('speeds a subrace overrides', () => {
  it('adds a movement mode the race does not have', () => {
    const speeds = raceSpeeds({ speeds: { walk: 30 } }, { speedOverrides: { walk: 30, fly: 30 } })
    expect(speeds).toEqual({ walk: 30, fly: 30 })
  })

  it('leaves the modes the subrace does not name alone', () => {
    const speeds = raceSpeeds({ speeds: { walk: 30, climb: 30 } }, { speedOverrides: { swim: 30 } })
    expect(speeds).toEqual({ walk: 30, climb: 30, swim: 30 })
  })

  it('overrides a mode the race already had', () => {
    expect(raceSpeeds({ speeds: { walk: 25 } }, { speedOverrides: { walk: 35 } }).walk).toBe(35)
  })

  it('is the race own speeds without a subrace', () => {
    expect(raceSpeeds({ speeds: { walk: 25 } }, undefined)).toEqual({ walk: 25 })
  })

  it('falls back to 30ft walking when there is no race either', () => {
    expect(raceSpeeds(undefined, undefined)).toEqual({ walk: 30 })
  })
})
