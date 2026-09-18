import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import { validCharacter, fighterRulepack } from '../fixtures'
import type { Character } from '~/types/character'
import type { AutomaticLevelUpEvent } from '~/types/events'
import type { Rulepack } from '~/types/rulepack'

describe('the SET_SENSE event def', () => {
  it('is accepted by the rulepack schema, mirroring SET_SPEED', () => {
    const parsed = RulepackSchema.parse({
      id: 'p', name: 'P', version: '1',
      races: [{
        id: 'r', name: 'R', size: 'medium', speeds: { walk: 30 },
        abilityScoreBonuses: {}, traits: [], languages: [],
        levelUpEvents: [{
          level: 1,
          levelUpEvents: [{ type: 'SET_SENSE', mode: 'darkvision', range: 60 }],
        }],
      }],
    })
    expect(parsed.races[0]!.levelUpEvents![0]!.levelUpEvents[0])
      .toMatchObject({ type: 'SET_SENSE', mode: 'darkvision', range: 60 })
  })

  it('rejects a mode outside the four senses', () => {
    expect(() => RulepackSchema.parse({
      id: 'p', name: 'P', version: '1',
      races: [{
        id: 'r', name: 'R', size: 'medium', speeds: { walk: 30 },
        abilityScoreBonuses: {}, traits: [], languages: [],
        levelUpEvents: [{
          level: 1,
          levelUpEvents: [{ type: 'SET_SENSE', mode: 'x-ray-vision', range: 60 }],
        }],
      }],
    })).toThrow()
  })
})

/** Tasha's Custom Lineage: 60ft darkvision or a skill — an "or" a static Race.senses
    field cannot express, which is exactly why SET_SENSE takes a whenOption guard. */
const CHOICE = 'custom-lineage-boon'

function pack(): Rulepack {
  const built = structuredClone(fighterRulepack) as Rulepack
  built.races = [{
    id: 'custom-lineage',
    name: 'Custom Lineage',
    size: 'medium',
    speeds: { walk: 30 },
    abilityScoreBonuses: {},
    traits: [],
    languages: [],
    levelUpEvents: [{
      level: 1,
      levelUpEvents: [
        {
          type: 'CHOOSE_OPTION',
          id: CHOICE,
          label: 'Choose a Boon',
          options: [
            { id: 'darkvision', name: 'Darkvision', description: '60ft darkvision.' },
            { id: 'skill', name: 'Skilled', description: 'One skill of your choice.' },
          ],
        },
        {
          type: 'SET_SENSE',
          mode: 'darkvision',
          range: 60,
          whenOption: { choiceId: CHOICE, optionId: 'darkvision' },
        },
      ],
    }],
  }]
  return built
}

const rulepack = pack()

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    race: 'custom-lineage',
    classes: [{ classId: 'fighter', level: 1 }],
    ...over,
  } as Character
}

describe('a sense hanging off a choice', () => {
  it('sets nothing while the boon is unanswered, but still offers the choice', () => {
    const events = resolveLevelUpEvents(
      char({ classes: [{ classId: 'fighter', level: 0 }] }), 'fighter', 1, rulepack)
    expect(events.filter(e => e.type === 'SET_SENSE')).toHaveLength(0)
    expect(events.some(e => e.type === 'CHOOSE_OPTION')).toBe(true)
  })

  it('sets the sense once the darkvision arm is picked in the same run', () => {
    const applied = applyResolvedChoices(
      char(), [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'darkvision' }], rulepack)
    expect(applied.senses).toEqual({ darkvision: 60 })
  })

  it('sets nothing for the other arm', () => {
    const applied = applyResolvedChoices(
      char(), [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'skill' }], rulepack)
    expect(applied.senses).toBeUndefined()
  })

  it('is applied automatically off a stored answer on a later level-up', () => {
    const stored = char({
      classes: [{ classId: 'fighter', level: 0 }],
      chosenOptions: { [CHOICE]: 'darkvision' },
    })
    const events = resolveLevelUpEvents(stored, 'fighter', 1, rulepack)
    const applied = applyAutomaticEvents(stored, getAutomaticEvents(events), 'average')
    expect(applied.senses).toEqual({ darkvision: 60 })
  })
})

describe('applying an unguarded SET_SENSE', () => {
  it('writes the mode onto character.senses', () => {
    const events: AutomaticLevelUpEvent[] = [{ type: 'SET_SENSE', mode: 'darkvision', range: 60 }]
    const applied = applyAutomaticEvents(char(), events, 'average')
    expect(applied.senses).toEqual({ darkvision: 60 })
  })

  /** Same overwrite semantics SET_SPEED uses: absolute, not a merge with a race's own. */
  it('overwrites just the named mode, leaving the rest of senses alone', () => {
    const withSenses = char({ senses: { darkvision: 30, blindsight: 10 } })
    const events: AutomaticLevelUpEvent[] = [{ type: 'SET_SENSE', mode: 'darkvision', range: 60 }]
    const applied = applyAutomaticEvents(withSenses, events, 'average')
    expect(applied.senses).toEqual({ darkvision: 60, blindsight: 10 })
  })

  it('does not mutate the original character', () => {
    const before = char()
    const events: AutomaticLevelUpEvent[] = [{ type: 'SET_SENSE', mode: 'darkvision', range: 60 }]
    applyAutomaticEvents(before, events, 'average')
    expect(before.senses).toBeUndefined()
  })
})
