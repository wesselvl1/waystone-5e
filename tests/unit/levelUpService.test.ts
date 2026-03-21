import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  getChoiceEvents,
  getAutomaticEvents,
  isChoiceEvent,
} from '~/services/levelUpService'
import { validCharacter, fighterRulepack } from '../fixtures'
import type { AutomaticLevelUpEvent } from '~/types/events'

describe('resolveLevelUpEvents', () => {
  beforeEach(() => {
    // Fix Math.random so HP rolls are deterministic (returns 0.5 → roll = mid-die)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  it('returns empty array when classId is not in the rulepack', () => {
    const events = resolveLevelUpEvents(validCharacter, 'wizard', 1, fighterRulepack)
    expect(events).toEqual([])
  })

  it('returns empty array when the level has no data in the rulepack', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 99, fighterRulepack)
    expect(events).toEqual([])
  })

  it('always includes ADD_HP and UPDATE_HIT_DIE events', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const types = events.map(e => e.type)
    expect(types).toContain('ADD_HP')
    expect(types).toContain('UPDATE_HIT_DIE')
  })

  it('ADD_HP event has correct die-specific values for d10 fighter', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const addHp = events.find(e => e.type === 'ADD_HP')!
    expect(addHp.type).toBe('ADD_HP')
    if (addHp.type === 'ADD_HP') {
      expect(addHp.average).toBe(6)  // floor(10/2)+1
      expect(addHp.max).toBe(10)
    }
  })

  it('UPDATE_HIT_DIE event increments totalDice by 1', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const hitDieEvent = events.find(e => e.type === 'UPDATE_HIT_DIE')!
    expect(hitDieEvent.type).toBe('UPDATE_HIT_DIE')
    if (hitDieEvent.type === 'UPDATE_HIT_DIE') {
      expect(hitDieEvent.totalDice).toBe(validCharacter.hitDice.total + 1)
    }
  })

  it('includes ADD_FEATURE events for features defined at that level', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const featureEvents = events.filter(e => e.type === 'ADD_FEATURE')
    expect(featureEvents.length).toBeGreaterThan(0)
    const names = featureEvents.map(e => e.type === 'ADD_FEATURE' ? e.feature.name : '')
    expect(names).toContain('Action Surge')
  })

  it('includes ABILITY_SCORE_IMPROVEMENT choice event at level 4', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 4, fighterRulepack)
    const asiEvent = events.find(e => e.type === 'ABILITY_SCORE_IMPROVEMENT')
    expect(asiEvent).toBeDefined()
    if (asiEvent?.type === 'ABILITY_SCORE_IMPROVEMENT') {
      expect(asiEvent.points).toBe(2)
    }
  })

  it('does not include CHOOSE_SUBCLASS if character already has a subclass', () => {
    const rulepackWithSubclass = {
      ...fighterRulepack,
      classes: [{
        ...fighterRulepack.classes[0]!,
        levels: [{
          level: 3,
          features: ['Martial Archetype'],
          levelUpEvents: [{ type: 'CHOOSE_SUBCLASS' as const, label: 'Martial Archetype' }],
        }],
      }],
    }
    const charWithSubclass = {
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 2, subclassId: 'champion' }],
    }
    const events = resolveLevelUpEvents(charWithSubclass, 'fighter', 3, rulepackWithSubclass as typeof fighterRulepack)
    const subclassEvent = events.find(e => e.type === 'CHOOSE_SUBCLASS')
    expect(subclassEvent).toBeUndefined()
  })
})

describe('applyAutomaticEvents', () => {
  it('applies average HP on "average" choice', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(validCharacter, automatic, 'average')
    // average for d10 = 6, con mod for 15 = +2 → +8 HP
    expect(updated.hp.max).toBe(validCharacter.hp.max + 8)
    expect(updated.hp.current).toBe(validCharacter.hp.current + 8)
  })

  it('applies max HP on "max" choice', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(validCharacter, automatic, 'max')
    // max for d10 = 10, con mod for 15 = +2 → +12 HP
    expect(updated.hp.max).toBe(validCharacter.hp.max + 12)
  })

  it('HP gain is at least 1 even with severe con penalty', () => {
    const weakChar = {
      ...validCharacter,
      abilityScores: { ...validCharacter.abilityScores, con: 1 }, // mod = -5
    }
    const events = resolveLevelUpEvents(weakChar, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(weakChar, automatic, 'average')
    expect(updated.hp.max).toBeGreaterThanOrEqual(weakChar.hp.max + 1)
  })

  it('adds features to the character', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(validCharacter, automatic, 'average')
    expect(updated.features.some(f => f.name === 'Action Surge')).toBe(true)
  })

  it('does not add duplicate features', () => {
    const charWithActionSurge = {
      ...validCharacter,
      features: [{
        id: 'fighter-action-surge-2',
        name: 'Action Surge',
        source: 'Fighter 2',
        description: '',
      }],
    }
    const events = resolveLevelUpEvents(charWithActionSurge, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(charWithActionSurge, automatic, 'average')
    const surgeFeatures = updated.features.filter(f => f.name === 'Action Surge')
    expect(surgeFeatures.length).toBe(1)
  })

  it('increments hit dice total by 1', () => {
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    const updated = applyAutomaticEvents(validCharacter, automatic, 'average')
    expect(updated.hitDice.total).toBe(validCharacter.hitDice.total + 1)
  })

  it('does not mutate the original character', () => {
    const originalMaxHp = validCharacter.hp.max
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 2, fighterRulepack)
    const automatic = getAutomaticEvents(events)
    applyAutomaticEvents(validCharacter, automatic, 'average')
    expect(validCharacter.hp.max).toBe(originalMaxHp)
  })
})

describe('isChoiceEvent', () => {
  it('identifies ABILITY_SCORE_IMPROVEMENT as a choice event', () => {
    expect(isChoiceEvent({ type: 'ABILITY_SCORE_IMPROVEMENT', points: 2 })).toBe(true)
  })

  it('identifies ADD_HP as not a choice event', () => {
    expect(isChoiceEvent({ type: 'ADD_HP', roll: 5, average: 6, max: 10, conBonus: 2 })).toBe(false)
  })

  it('identifies CHOOSE_SPELL as a choice event', () => {
    expect(isChoiceEvent({ type: 'CHOOSE_SPELL', count: 2, cantrip: false })).toBe(true)
  })
})

describe('getChoiceEvents / getAutomaticEvents', () => {
  it('partitions events into choice and automatic buckets without overlap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const events = resolveLevelUpEvents(validCharacter, 'fighter', 4, fighterRulepack)
    const choices = getChoiceEvents(events)
    const automatic = getAutomaticEvents(events)
    expect(choices.length + automatic.length).toBe(events.length)
    // No event should appear in both buckets
    const choiceTypes = new Set(choices.map(e => e.type))
    const autoTypes = new Set(automatic.map(e => e.type))
    for (const t of choiceTypes) {
      expect(autoTypes.has(t as never)).toBe(false)
    }
  })
})
