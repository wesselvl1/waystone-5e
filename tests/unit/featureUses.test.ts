import { describe, it, expect } from 'vitest'
import {
  featureUsesMax,
  featureUsesBonusTotal,
  clampFeatureUses,
  setFeatureUsesBonus,
  FEATURE_USES_BONUS_SOURCES,
} from '~/utils/featureUses'
import { applyAutomaticEvents } from '~/services/levelUpService'
import type { Character, Feature } from '~/types/character'
import type { AutomaticLevelUpEvent } from '~/types/events'
import { validCharacter } from '../fixtures'

function feature(over: Partial<Feature> = {}): Feature {
  return {
    id: 'wild-shape',
    name: 'Wild Shape',
    source: 'Druid',
    description: 'Assume the shape of a beast.',
    usesMax: 2,
    usesRemaining: 2,
    recharge: 'short',
    ...over,
  }
}

describe('bonus sources', () => {
  it('exposes magic, feat and misc for the editor', () => {
    expect(FEATURE_USES_BONUS_SOURCES.map(s => s.key)).toEqual(['magic', 'feat', 'misc'])
    for (const s of FEATURE_USES_BONUS_SOURCES) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.hint.length).toBeGreaterThan(0)
    }
  })

  it('totals every source', () => {
    expect(featureUsesBonusTotal(feature())).toBe(0)
    expect(featureUsesBonusTotal(feature({ usesBonuses: { magic: 1, feat: 2 } }))).toBe(3)
    expect(featureUsesBonusTotal(feature({ usesBonuses: { magic: 1, misc: -2 } }))).toBe(-1)
  })
})

describe('featureUsesMax', () => {
  it('is the base when there are no bonuses', () => {
    expect(featureUsesMax(feature())).toBe(2)
  })

  it('adds every source together', () => {
    expect(featureUsesMax(feature({ usesBonuses: { magic: 1, feat: 1, misc: 1 } }))).toBe(5)
  })

  it('subtracts a negative source, so a penalty uses the same mechanism', () => {
    expect(featureUsesMax(feature({ usesBonuses: { misc: -1 } }))).toBe(1)
  })

  it('never goes below zero', () => {
    expect(featureUsesMax(feature({ usesMax: 1, usesBonuses: { misc: -5 } }))).toBe(0)
  })

  it('is undefined for an uncapped feature, where a bonus is meaningless', () => {
    expect(featureUsesMax(feature({ usesMax: undefined, usesBonuses: { magic: 3 } })))
      .toBeUndefined()
  })
})

describe('clampFeatureUses', () => {
  it('trims remaining down when a bonus is removed', () => {
    const boosted = feature({ usesBonuses: { magic: 1 }, usesRemaining: 3 })
    const { usesBonuses: _gone, ...withoutBonus } = boosted
    expect(clampFeatureUses(withoutBonus as Feature).usesRemaining).toBe(2)
  })

  it('does not top a feature up when a bonus is added', () => {
    expect(clampFeatureUses(feature({ usesBonuses: { magic: 2 }, usesRemaining: 1 })).usesRemaining)
      .toBe(1)
  })

  it('returns the same object when nothing needs clamping', () => {
    const f = feature()
    expect(clampFeatureUses(f)).toBe(f)
  })

  it('leaves an uncapped feature alone', () => {
    const f = feature({ usesMax: undefined, usesRemaining: 99 })
    expect(clampFeatureUses(f)).toBe(f)
  })
})

describe('setFeatureUsesBonus', () => {
  it('sets one source without disturbing the others', () => {
    let f = setFeatureUsesBonus(feature(), 'magic', 1)
    f = setFeatureUsesBonus(f, 'feat', 2)
    expect(f.usesBonuses).toEqual({ magic: 1, feat: 2 })
    expect(featureUsesMax(f)).toBe(5)
  })

  it('removes a source set back to zero, keeping the rest', () => {
    let f = setFeatureUsesBonus(feature(), 'magic', 1)
    f = setFeatureUsesBonus(f, 'misc', 1)
    f = setFeatureUsesBonus(f, 'magic', 0)
    expect(f.usesBonuses).toEqual({ misc: 1 })
  })

  it('drops the map entirely once the last source is cleared', () => {
    let f = setFeatureUsesBonus(feature(), 'feat', 1)
    f = setFeatureUsesBonus(f, 'feat', 0)
    expect('usesBonuses' in f).toBe(false)
    expect(featureUsesMax(f)).toBe(2)
  })

  it('clamps remaining when lowering a bonus', () => {
    const boosted = setFeatureUsesBonus(feature({ usesRemaining: 2 }), 'magic', 2)
    const topped = { ...boosted, usesRemaining: 4 }
    expect(setFeatureUsesBonus(topped, 'magic', 0).usesRemaining).toBe(2)
  })
})

describe('manual bonuses survive level-up', () => {
  it('are not trimmed off by UPDATE_FEATURE_USES', () => {
    // The whole point: a magic item granting +1 Wild Shape is entered once, and
    // levelling from 2 uses to 3 must leave the bonus in place.
    const char: Character = {
      ...validCharacter,
      features: [feature({ usesBonuses: { magic: 1 }, usesRemaining: 3 })],
    }
    const events: AutomaticLevelUpEvent[] = [
      { type: 'UPDATE_FEATURE_USES', featureName: 'Wild Shape', usesMax: 3 },
    ]
    const f = applyAutomaticEvents(char, events, 'average')
      .features.find(x => x.name === 'Wild Shape')!

    expect(f.usesMax).toBe(3)
    expect(f.usesBonuses).toEqual({ magic: 1 })
    expect(featureUsesMax(f)).toBe(4)
    expect(f.usesRemaining).toBe(3)
  })

  it('keeps several sources across a level-up', () => {
    const char: Character = {
      ...validCharacter,
      features: [feature({ usesBonuses: { magic: 1, feat: 1, misc: -1 }, usesRemaining: 2 })],
    }
    const f = applyAutomaticEvents(
      char,
      [{ type: 'UPDATE_FEATURE_USES', featureName: 'Wild Shape', usesMax: 4 }],
      'average',
    ).features.find(x => x.name === 'Wild Shape')!

    expect(f.usesBonuses).toEqual({ magic: 1, feat: 1, misc: -1 })
    expect(featureUsesMax(f)).toBe(5)
  })

  it('clamps remaining against base plus bonuses, not the base alone', () => {
    const char: Character = {
      ...validCharacter,
      features: [feature({ usesMax: 6, usesBonuses: { magic: 1 }, usesRemaining: 7 })],
    }
    const f = applyAutomaticEvents(
      char,
      [{ type: 'UPDATE_FEATURE_USES', featureName: 'Wild Shape', usesMax: 2 }],
      'average',
    ).features.find(x => x.name === 'Wild Shape')!

    expect(featureUsesMax(f)).toBe(3)
    expect(f.usesRemaining).toBe(3)
  })

  it('still removes the cap when usesMax is set to null', () => {
    const char: Character = {
      ...validCharacter,
      features: [feature({ usesBonuses: { magic: 1 } })],
    }
    const f = applyAutomaticEvents(
      char,
      [{ type: 'UPDATE_FEATURE_USES', featureName: 'Wild Shape', usesMax: null }],
      'average',
    ).features.find(x => x.name === 'Wild Shape')!

    expect(f.usesMax).toBeUndefined()
    expect(featureUsesMax(f)).toBeUndefined()
  })
})
