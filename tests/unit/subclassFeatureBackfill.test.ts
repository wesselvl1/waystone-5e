import { describe, it, expect } from 'vitest'
import { backfillSubclassFeatures } from '~/services/levelUpService'
import { fighterRulepack, validCharacter } from '../fixtures'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'

/** A wizard whose tradition prints two features on the level it is chosen. */
const pack: Rulepack = {
  ...fighterRulepack,
  classes: [{
    ...fighterRulepack.classes[0]!,
    id: 'wizard',
    name: 'Wizard',
    subclasses: [{
      id: 'chronurgy',
      name: 'Chronurgy Magic',
      classId: 'wizard',
      description: '',
      levels: [
        {
          level: 2,
          features: [
            { name: 'Chronal Shift', description: 'Twice per long rest.', usesMax: 2, recharge: 'long' },
            { name: 'Temporal Awareness', description: 'You add your Intelligence modifier.' },
          ],
          levelUpEvents: [],
        },
        { level: 6, features: [{ name: 'Momentary Stasis', description: '' }], levelUpEvents: [] },
      ],
    }],
  }],
}

function wizard(level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'wizard', level, subclassId: 'chronurgy' }],
    features: [],
    ...over,
  }
}

describe('a subclass feature added after the level was taken', () => {
  it('reaches a character already past that level', () => {
    const filled = backfillSubclassFeatures(wizard(5), pack)
    expect(filled.features.map(f => f.name)).toEqual(['Chronal Shift', 'Temporal Awareness'])
  })

  it('carries the uses and recharge the feature declares', () => {
    const shift = backfillSubclassFeatures(wizard(5), pack).features[0]!
    expect(shift).toMatchObject({ usesMax: 2, usesRemaining: 2, recharge: 'long', source: 'Chronurgy Magic' })
  })

  it('leaves a level the character has not reached alone', () => {
    const names = backfillSubclassFeatures(wizard(5), pack).features.map(f => f.name)
    expect(names).not.toContain('Momentary Stasis')
  })

  it('returns the character untouched when nothing is missing', () => {
    const filled = backfillSubclassFeatures(wizard(5), pack)
    expect(backfillSubclassFeatures(filled, pack)).toBe(filled)
  })

  it('does not add a feature the sheet already carries under an older id', () => {
    const existing = wizard(5, {
      features: [{
        id: 'legacy-id',
        name: 'Temporal Awareness',
        source: 'Chronurgy Magic',
        description: '',
      }],
    })
    const names = backfillSubclassFeatures(existing, pack).features.map(f => f.name)
    expect(names.filter(n => n === 'Temporal Awareness')).toHaveLength(1)
  })

  it('does nothing for a class with no subclass chosen', () => {
    const undecided = wizard(1, { classes: [{ classId: 'wizard', level: 1 }] })
    expect(backfillSubclassFeatures(undecided, pack)).toBe(undecided)
  })
})
