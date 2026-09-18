import { describe, it, expect } from 'vitest'
import { halfProficiency, halfProficiencyBonus } from '~/services/halfProficiency'
import { validCharacter } from '../fixtures'
import type { Character, Feature } from '~/types/character'

function feature(name: string, description: string): Feature {
  return { id: name.toLowerCase().replace(/\s+/g, '-'), name, source: 'Test', description }
}

function withFeatures(features: Feature[], extra: Partial<Character> = {}): Character {
  return { ...validCharacter, features, ...extra }
}

const JACK_OF_ALL_TRADES = feature(
  'Jack of All Trades',
  'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any'
    + ' ability check you make that doesn\'t already include your proficiency bonus.',
)

const REMARKABLE_ATHLETE = feature(
  'Remarkable Athlete',
  'Starting at 3rd level, you can add half your proficiency bonus, round up, to any'
    + ' Strength, Dexterity, or Constitution check you make that doesn\'t already use'
    + ' your proficiency bonus.',
)

describe('what the sniff reads as half a proficiency bonus', () => {
  it('reads Jack of All Trades as every check, rounded down', () => {
    const { sources, manual } = halfProficiency(withFeatures([JACK_OF_ALL_TRADES]))
    expect(manual).toBe(false)
    expect(sources).toEqual([
      { name: 'Jack of All Trades', abilities: undefined, roundUp: false },
    ])
  })

  it('scopes Remarkable Athlete to the three abilities it names, rounded up', () => {
    const { sources } = halfProficiency(withFeatures([REMARKABLE_ATHLETE]))
    expect(sources[0]?.abilities).toEqual(['str', 'dex', 'con'])
    expect(sources[0]?.roundUp).toBe(true)
  })

  it('finds nothing on a character with no such feature', () => {
    expect(halfProficiency(withFeatures([])).sources).toEqual([])
  })

  it('finds nothing without a character', () => {
    expect(halfProficiency(null)).toEqual({ sources: [], manual: false })
  })

  it('counts a feature stored twice only once', () => {
    const duplicate = { ...JACK_OF_ALL_TRADES, id: 'other-id' }
    expect(halfProficiency(withFeatures([JACK_OF_ALL_TRADES, duplicate])).sources).toHaveLength(1)
  })
})

describe('what the sniff refuses to read as half a proficiency bonus', () => {
  it('ignores a half that goes to a saving throw', () => {
    const resilient = feature(
      'Stone Endurance',
      'You can add half your proficiency bonus to your Constitution saving throws.',
    )
    expect(halfProficiency(withFeatures([resilient])).sources).toEqual([])
  })

  it('ignores a half that goes to damage', () => {
    const blessed = feature(
      'Blessed Strikes',
      'You add half your proficiency bonus to the damage of the attack.',
    )
    expect(halfProficiency(withFeatures([blessed])).sources).toEqual([])
  })

  it('ignores a whole proficiency bonus on a check', () => {
    const expertise = feature(
      'Expertise',
      'Your proficiency bonus is doubled for any ability check you make with that skill.',
    )
    expect(halfProficiency(withFeatures([expertise])).sources).toEqual([])
  })
})

describe('what it adds to a check', () => {
  const jack = halfProficiency(withFeatures([JACK_OF_ALL_TRADES]))
  const athlete = halfProficiency(withFeatures([REMARKABLE_ATHLETE]))

  it('rounds an odd proficiency bonus down for Jack of All Trades', () => {
    expect(halfProficiencyBonus(jack, 'cha', 3)).toEqual({ value: 1, source: 'Jack of All Trades' })
  })

  it('rounds an odd proficiency bonus up for Remarkable Athlete', () => {
    expect(halfProficiencyBonus(athlete, 'str', 3)).toEqual({
      value: 2,
      source: 'Remarkable Athlete',
    })
  })

  it('adds nothing to an ability a scoped feature leaves out', () => {
    expect(halfProficiencyBonus(athlete, 'cha', 3)).toEqual({ value: 0, source: null })
  })

  it('takes the better rounding rather than stacking the two', () => {
    const both = halfProficiency(withFeatures([JACK_OF_ALL_TRADES, REMARKABLE_ATHLETE]))
    expect(halfProficiencyBonus(both, 'dex', 3).value).toBe(2)
    expect(halfProficiencyBonus(both, 'wis', 3).value).toBe(1)
  })
})

describe('the override, for what the sniff gets wrong', () => {
  it('reads every check as half when the player says so', () => {
    const said = withFeatures([], { halfProficiencyChecks: true })
    const half = halfProficiency(said)
    expect(half.manual).toBe(true)
    expect(halfProficiencyBonus(half, 'int', 4).value).toBe(2)
  })

  it('switches a misread feature off', () => {
    const said = withFeatures([JACK_OF_ALL_TRADES], { halfProficiencyChecks: false })
    expect(halfProficiencyBonus(halfProficiency(said), 'int', 4).value).toBe(0)
  })

  it('derives it where the field is null, the way a null armour class does', () => {
    const said = withFeatures([JACK_OF_ALL_TRADES], { halfProficiencyChecks: null })
    expect(halfProficiency(said).manual).toBe(false)
    expect(halfProficiencyBonus(halfProficiency(said), 'int', 4).value).toBe(2)
  })
})
