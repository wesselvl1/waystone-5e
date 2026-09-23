import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveOptionalFeatureEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, OptionalClassFeature } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'
import ranger from '~/data/srd/ranger.json'
import spells from '~/data/srd/spells.json'

/**
 * Standing in for Tasha's optional ranger features: an always-prepared spell
 * (Primal Awareness), a free-cast grant with its own resource (Wild Companion), one
 * that declares no events at all (still-inert text), and one whose events presuppose a
 * class the way a feat's own excluded set does.
 */
const OPTIONAL_FEATURES: OptionalClassFeature[] = [
  {
    id: 'primal-awareness',
    name: 'Primal Awareness',
    description: '',
    classId: 'ranger',
    level: 3,
    levelUpEvents: [
      { type: 'GRANT_SPELLS', addTo: '', spellIds: ['speak-with-animals'], alwaysPrepared: true },
    ],
  },
  {
    id: 'wild-companion',
    name: 'Wild Companion',
    description: '',
    classId: 'ranger',
    level: 3,
    levelUpEvents: [
      {
        type: 'GRANT_SPELLS',
        addTo: '',
        spellIds: ['find-familiar'],
        alwaysPrepared: true,
        uses: { max: 1, recharge: 'long' },
      },
    ],
  },
  {
    id: 'inert-feature',
    name: 'Inert',
    description: '',
    classId: 'ranger',
    level: 3,
  },
  {
    id: 'no-class-events',
    name: 'No Class Events',
    description: '',
    classId: 'ranger',
    level: 3,
    levelUpEvents: [
      { type: 'GAIN_PROFICIENCY', proficiency: 'shields' },
      // Meaningless on an optional feature: there is no level being gained to raise it.
      { type: 'CHOOSE_SUBCLASS', label: 'Nonsense' },
    ],
  },
]

function pack(): Rulepack {
  const built = RulepackSchema.parse(fighter) as unknown as Rulepack
  built.classes = [
    ...RulepackSchema.parse(fighter).classes,
    ...RulepackSchema.parse(ranger).classes,
  ] as Rulepack['classes']
  built.spells = RulepackSchema.parse(spells).spells as Rulepack['spells']
  built.optionalFeatures = OPTIONAL_FEATURES
  return built
}

const rulepack = pack()
const feature = (id: string) => rulepack.optionalFeatures.find(f => f.id === id)!

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'ranger', level: 3 }],
    spells: [],
    classSpellcasting: {},
    otherProficiencies: [],
    ...over,
  } as Character
}

describe('OptionalClassFeature.levelUpEvents — schema', () => {
  it('accepts an optional feature carrying level-up events', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      optionalFeatures: [OPTIONAL_FEATURES[0], OPTIONAL_FEATURES[1]],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.optionalFeatures[0]!.levelUpEvents).toHaveLength(1)
  })

  it('rejects an event type that is not in the union', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      optionalFeatures: [{
        id: 'x', name: 'X', description: '', classId: 'ranger', level: 3,
        levelUpEvents: [{ type: 'NOT_AN_EVENT' }],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('defaults to no events for a feature that declares none', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      optionalFeatures: [{ id: 'x', name: 'X', description: '', classId: 'ranger', level: 3 }],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.optionalFeatures[0]!.levelUpEvents).toBeUndefined()
  })
})

describe('resolveOptionalFeatureEvents', () => {
  it("defaults addTo to the feature's own class and tags the source as a class feature", () => {
    const events = resolveOptionalFeatureEvents(char(), feature('primal-awareness'), rulepack)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')!
    expect(grant).toMatchObject({
      addTo: 'ranger',
      origin: 'class',
      label: 'Primal Awareness',
      alwaysPrepared: true,
    })
    expect(grant.type === 'GRANT_SPELLS' && grant.spells.map(s => s.spellId)).toEqual(['speak-with-animals'])
  })

  it("carries a free cast's own resource through, same as a feat's grant", () => {
    const events = resolveOptionalFeatureEvents(char(), feature('wild-companion'), rulepack)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')!
    expect(grant).toMatchObject({ uses: { max: 1, recharge: 'long' } })
  })

  it('yields nothing for a feature that declares no events', () => {
    expect(resolveOptionalFeatureEvents(char(), feature('inert-feature'), rulepack)).toEqual([])
  })

  it('ignores event types that presuppose a level being gained', () => {
    const events = resolveOptionalFeatureEvents(char(), feature('no-class-events'), rulepack)
    expect(events.map(e => e.type)).toEqual(['GAIN_PROFICIENCY'])
  })

  it('splits automatic events from choices', () => {
    const events = resolveOptionalFeatureEvents(char(), feature('primal-awareness'), rulepack)
    expect(getAutomaticEvents(events).map(e => e.type)).toEqual(['GRANT_SPELLS'])
    expect(getChoiceEvents(events)).toEqual([])
  })
})

describe('taking an optional feature', () => {
  it('adds the feature and grants the always-prepared spell it carries', () => {
    const result = applyResolvedChoices(
      char(),
      [{
        type: 'RESOLVED_OPTIONAL_FEATURES',
        taken: [{ ...feature('primal-awareness'), sourceName: "Tasha's" }],
      }],
      rulepack,
    )
    expect(result.features.map(f => f.id)).toContain('primal-awareness')
    const spell = result.spells.find(s => s.spellId === 'speak-with-animals')
    expect(spell).toMatchObject({ alwaysPrepared: true })
  })

  it('adds a feature with no events without touching spells or proficiencies', () => {
    const result = applyResolvedChoices(
      char(),
      [{
        type: 'RESOLVED_OPTIONAL_FEATURES',
        taken: [{ ...feature('inert-feature'), sourceName: "Tasha's" }],
      }],
      rulepack,
    )
    expect(result.features.map(f => f.id)).toContain('inert-feature')
    expect(result.spells).toEqual([])
  })

  it('does not grant the spell twice when the feature is already on the character', () => {
    const start = char({
      features: [{ id: 'primal-awareness', name: 'Primal Awareness', source: 'Ranger', description: '' }],
      spells: [{ id: 'x', spellId: 'speak-with-animals', name: 'Speak with Animals', level: 1, prepared: true, alwaysPrepared: true }],
    } as Partial<Character>)
    const result = applyResolvedChoices(
      start,
      [{
        type: 'RESOLVED_OPTIONAL_FEATURES',
        taken: [{ ...feature('primal-awareness'), sourceName: "Tasha's" }],
      }],
      rulepack,
    )
    expect(result.spells.filter(s => s.spellId === 'speak-with-animals')).toHaveLength(1)
  })

  it('takes more than one optional feature in the same run', () => {
    const result = applyResolvedChoices(
      char(),
      [{
        type: 'RESOLVED_OPTIONAL_FEATURES',
        taken: [
          { ...feature('primal-awareness'), sourceName: "Tasha's" },
          { ...feature('wild-companion'), sourceName: "Tasha's" },
        ],
      }],
      rulepack,
    )
    expect(result.spells.map(s => s.spellId).sort()).toEqual(['find-familiar', 'speak-with-animals'])
    const familiar = result.spells.find(s => s.spellId === 'find-familiar')!
    expect(familiar.uses).toEqual({ max: 1, recharge: 'long', remaining: 1 })
  })
})
