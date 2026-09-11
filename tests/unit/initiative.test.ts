import { describe, it, expect } from 'vitest'
import { initiativeBreakdown, initiativeParts } from '~/services/initiative'
import { validCharacter } from '../fixtures'
import type { AbilityKey, Character, Feature } from '~/types/character'

const MODS: Record<AbilityKey, number> = { str: 3, dex: 2, con: 2, int: 4, wis: 1, cha: -1 }
const ctx = { modifiers: MODS, proficiencyBonus: 3 }

function feature(name: string, description: string): Feature {
  return { id: name.toLowerCase(), name, source: 'Test', description }
}

function withFeatures(features: Feature[], extra: Partial<Character> = {}): Character {
  return { ...validCharacter, features, ...extra }
}

const TEMPORAL_AWARENESS = feature(
  'Temporal Awareness',
  '2nd-level Chronurgy Magic feature\n\nYou add your Intelligence modifier to your initiative rolls.',
)

describe('initiative is Dexterity plus what the features say', () => {
  it('is the Dexterity modifier on its own', () => {
    const result = initiativeBreakdown(withFeatures([]), ctx)
    expect(result.total).toBe(2)
    expect(result.parts).toEqual([{ label: 'Dexterity', value: 2 }])
  })

  it('adds the ability a feature names', () => {
    const result = initiativeBreakdown(withFeatures([TEMPORAL_AWARENESS]), ctx)
    expect(result.total).toBe(6)
    expect(result.parts).toContainEqual({ label: 'Temporal Awareness (Intelligence)', value: 4 })
  })

  it('adds a flat bonus a feat spells out', () => {
    const alert = feature('Alert', 'You gain a +5 bonus to initiative.')
    expect(initiativeBreakdown(withFeatures([alert]), ctx).total).toBe(7)
  })

  it('adds a proficiency bonus a trait names', () => {
    const hare = feature(
      'Hare-Trigger',
      'You can add your proficiency bonus to your initiative rolls.',
    )
    expect(initiativeBreakdown(withFeatures([hare]), ctx).total).toBe(5)
  })

  it('stacks a feat with a subclass feature', () => {
    const alert = feature('Alert', 'You gain a +5 bonus to initiative.')
    expect(initiativeBreakdown(withFeatures([TEMPORAL_AWARENESS, alert]), ctx).total).toBe(11)
  })
})

describe('what the sniff refuses to read as an initiative bonus', () => {
  it('ignores an ability named in a sentence that is not about initiative', () => {
    const other = feature(
      'Momentary Stasis',
      'You can use this feature a number of times equal to your Intelligence modifier.'
        + ' Rolling initiative has nothing to do with it.',
    )
    expect(initiativeParts(withFeatures([other]), ctx)).toEqual([])
  })

  it('ignores half a proficiency bonus, which is every ability check', () => {
    const jack = feature(
      'Jack of All Trades',
      'You can add half your proficiency bonus to any ability check you make that does not'
        + ' already include it, initiative among them.',
    )
    expect(initiativeParts(withFeatures([jack]), ctx)).toEqual([])
  })

  it('does not add Dexterity twice when a feature restates it', () => {
    const restated = feature('Quick', 'You add your Dexterity modifier to your initiative.')
    expect(initiativeBreakdown(withFeatures([restated]), ctx).total).toBe(2)
  })

  it('counts a feature stored twice only once', () => {
    const duplicate = { ...TEMPORAL_AWARENESS, id: 'other-id' }
    expect(initiativeBreakdown(withFeatures([TEMPORAL_AWARENESS, duplicate]), ctx).total).toBe(6)
  })
})

describe('the three bonus slots, for what no rulepack models', () => {
  it('adds each slot to the roll', () => {
    const ringed = withFeatures([], { initiativeBonuses: { magic: 1, feat: 2, misc: -1 } })
    expect(initiativeBreakdown(ringed, ctx).total).toBe(4)
  })

  it('lists only the slots that carry something', () => {
    const ringed = withFeatures([], { initiativeBonuses: { magic: 1, feat: 0 } })
    expect(initiativeBreakdown(ringed, ctx).parts).toEqual([
      { label: 'Dexterity', value: 2 },
      { label: 'Magic', value: 1 },
    ])
  })

  it('stacks with a feature that moves the roll', () => {
    const both = withFeatures([TEMPORAL_AWARENESS], { initiativeBonuses: { magic: 1 } })
    expect(initiativeBreakdown(both, ctx).total).toBe(7)
  })

  it('is nothing at all on a character predating the slots', () => {
    expect(initiativeBreakdown(withFeatures([]), ctx).total).toBe(2)
  })
})

describe('a hand-entered initiative still overrides the lot', () => {
  it('takes the stored number and derives nothing', () => {
    const stored = withFeatures([TEMPORAL_AWARENESS], { initiative: 9, initiativeBonuses: { magic: 3 } })
    const result = initiativeBreakdown(stored, ctx)
    expect(result.total).toBe(9)
    expect(result.manual).toBe(true)
    expect(result.parts).toEqual([])
  })

  it('treats a stored zero as a number, not as absent', () => {
    expect(initiativeBreakdown(withFeatures([], { initiative: 0 }), ctx).total).toBe(0)
  })
})
