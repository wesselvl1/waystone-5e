import { describe, it, expect } from 'vitest'
import { raceResistances, raceSenses } from '~/services/multiclass'
import type { Race, Subrace } from '~/types/rulepack'

describe('senses a race and subrace together grant', () => {
  it('is the race own senses without a subrace', () => {
    expect(raceSenses({ senses: { darkvision: 60 } }, undefined)).toEqual({ darkvision: 60 })
  })

  it('is empty when neither the race nor the subrace has any', () => {
    expect(raceSenses({ senses: undefined }, undefined)).toEqual({})
    expect(raceSenses(undefined, undefined)).toEqual({})
  })

  it('adds a mode the race does not have', () => {
    const senses = raceSenses({ senses: { darkvision: 60 } }, { senses: { blindsight: 10 } })
    expect(senses).toEqual({ darkvision: 60, blindsight: 10 })
  })

  /**
   * Unlike a speed override, a subrace's own sense does not simply replace the race's:
   * a variant printing a smaller range should not blind out a race that already sees
   * further.
   */
  it('takes the larger range when both grant the same mode', () => {
    expect(raceSenses({ senses: { darkvision: 60 } }, { senses: { darkvision: 120 } }).darkvision).toBe(120)
    expect(raceSenses({ senses: { darkvision: 120 } }, { senses: { darkvision: 60 } }).darkvision).toBe(120)
  })

  it('omits a mode neither grants, rather than reporting a zero', () => {
    const senses = raceSenses({ senses: { darkvision: 60 } }, undefined)
    expect(senses.blindsight).toBeUndefined()
    expect('blindsight' in senses).toBe(false)
  })
})

describe('resistances a race and subrace together grant', () => {
  const TIEFLING: Pick<Race, 'damageResistances' | 'damageImmunities' | 'conditionImmunities'> = {
    damageResistances: ['fire'],
  }

  it('is the race own lists without a subrace', () => {
    expect(raceResistances(TIEFLING, undefined)).toEqual({
      damageResistances: ['fire'],
      damageImmunities: [],
      conditionImmunities: [],
    })
  })

  it('unions rather than overrides when both grant one', () => {
    const subrace: Pick<Subrace, 'damageResistances' | 'damageImmunities' | 'conditionImmunities'> = {
      damageResistances: ['cold'],
    }
    expect(raceResistances(TIEFLING, subrace).damageResistances).toEqual(['fire', 'cold'])
  })

  it('does not repeat an entry both the race and the subrace grant', () => {
    const subrace: Pick<Subrace, 'damageResistances' | 'damageImmunities' | 'conditionImmunities'> = {
      damageResistances: ['fire'],
    }
    expect(raceResistances(TIEFLING, subrace).damageResistances).toEqual(['fire'])
  })

  it('keeps damage resistance, damage immunity and condition immunity apart', () => {
    const race: Pick<Race, 'damageResistances' | 'damageImmunities' | 'conditionImmunities'> = {
      damageImmunities: ['poison'],
      conditionImmunities: ['poisoned'],
    }
    expect(raceResistances(race, undefined)).toEqual({
      damageResistances: [],
      damageImmunities: ['poison'],
      conditionImmunities: ['poisoned'],
    })
  })

  it('is empty lists all round when nothing is loaded', () => {
    expect(raceResistances(undefined, undefined)).toEqual({
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
    })
  })
})
