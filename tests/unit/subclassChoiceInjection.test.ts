import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  resolveSubclassLevelEvents,
  getChoiceEvents,
  applyResolvedChoices,
  projectSkillProficiencies,
  skillsEligibleForExpertise,
} from '~/services/levelUpService'
import type { Character, SkillKey } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ChooseExpertiseEvent, ChooseSpellEvent } from '~/types/events'
import { validCharacter } from '../fixtures'

/**
 * The Knowledge Domain shape: a subclass picked at the level it is offered, whose own
 * level declares more questions than the wizard used to know how to ask. This stands in
 * for app/data/phb, which is gitignored dev data — a test sourcing it would pass only on
 * a machine that owns the book.
 */
const BOOK_FRAGMENT = {
  id: 'book',
  name: 'Book',
  version: '1.0',
  classes: [{
    id: 'book.priest',
    name: 'Priest',
    hitDie: 'd8',
    primaryAbility: ['wis'],
    savingThrowProficiencies: ['wis', 'cha'],
    armorProficiencies: ['light'],
    weaponProficiencies: ['simple'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['insight', 'medicine'] },
    levels: [
      {
        level: 1,
        features: ['Divine Domain'],
        levelUpEvents: [{ type: 'CHOOSE_SUBCLASS', label: 'Choose a domain' }],
      },
      { level: 2, features: [], levelUpEvents: [] },
    ],
    subclasses: [{
      id: 'book.knowledge',
      name: 'Knowledge Domain',
      description: 'Knowledge is power.',
      levels: [{
        level: 1,
        features: [{ name: 'Blessings of Knowledge', description: 'Two skills, doubled.' }],
        levelUpEvents: [
          { type: 'GAIN_PROFICIENCY', proficiency: 'two languages of your choice' },
          { type: 'CHOOSE_SKILL', count: 2, from: ['arcana', 'history', 'nature', 'religion'] },
          {
            type: 'CHOOSE_EXPERTISE',
            label: 'Blessings of Knowledge: choose the two skills whose bonus is doubled',
            options: ['arcana', 'history', 'nature', 'religion'],
            count: 2,
          },
          {
            type: 'CHOOSE_OPTION',
            id: 'book.lore',
            label: 'Choose a lore',
            group: 'book.lore',
            options: [{ id: 'book.star-lore', name: 'Star Lore', description: 'The stars.' }],
          },
          // addTo left empty, as a subclass that simply adds to its own class's list does
          { type: 'CHOOSE_SPELL', addTo: '', count: 1, cantrip: true },
          { type: 'ABILITY_SCORE_IMPROVEMENT', points: 2 },
          { type: 'UPDATE_FEATURE_USES', featureName: 'Channel Divinity', usesMax: 2 },
        ],
      }],
    }],
  }],
}

const rulepack = {
  id: 'composed',
  name: 'composed',
  version: '0',
  races: [],
  classes: RulepackSchema.parse(BOOK_FRAGMENT).classes,
  backgrounds: [],
  feats: [],
  spells: [],
  creatures: [],
  optionalFeatures: [],
} as unknown as Rulepack

function priest(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'book.priest', level: 0 }],
    skillProficiencies: {
      ...validCharacter.skillProficiencies,
      arcana: 0, history: 0, nature: 0, religion: 0,
    },
    spells: [],
    spellSlots: {},
    ...over,
  } as Character
}

/** What the wizard injects when the subclass is confirmed mid-run. */
const injected = (char: Character) => getChoiceEvents(
  resolveSubclassLevelEvents(char, 'book.priest', 'book.knowledge', 1, rulepack))

describe('a subclass chosen mid-run', () => {
  it('raises every choice its level declares, not a hand-kept three', () => {
    // Regression: the page listed CHOOSE_OPTION, CHOOSE_SPELL and
    // ABILITY_SCORE_IMPROVEMENT, so Blessings of Knowledge was never asked and the
    // feature did nothing for any player — the domain is picked through this path
    // whether the character is fresh or multiclassing.
    expect(injected(priest()).map(e => e.type)).toEqual([
      'CHOOSE_SKILL',
      'CHOOSE_EXPERTISE',
      'CHOOSE_OPTION',
      'CHOOSE_SPELL',
      'ABILITY_SCORE_IMPROVEMENT',
    ])
  })

  it('asks for the skills before the expertise that doubles them', () => {
    const types = injected(priest()).map(e => e.type)
    expect(types.indexOf('CHOOSE_SKILL')).toBeLessThan(types.indexOf('CHOOSE_EXPERTISE'))
  })

  it('offers the skills it just granted as expertise candidates', () => {
    // The end-to-end path: the skill answer is still in the run, not on the character.
    const char = priest()
    const expertise = injected(char)
      .find((e): e is ChooseExpertiseEvent => e.type === 'CHOOSE_EXPERTISE')!
    const answered = projectSkillProficiencies(
      char, [{ type: 'RESOLVED_SKILL', skills: ['arcana', 'history'] }])
    expect(skillsEligibleForExpertise(expertise.options, answered))
      .toEqual(['arcana', 'history'])
  })

  it('leaves the character with two doubled skills once the run is applied', () => {
    const applied = applyResolvedChoices(
      priest(),
      [
        { type: 'RESOLVED_SUBCLASS', subclassId: 'book.knowledge', classId: 'book.priest' },
        { type: 'RESOLVED_SKILL', skills: ['arcana', 'history'] },
        { type: 'RESOLVED_EXPERTISE', skills: ['arcana', 'history'] },
      ],
      rulepack,
    )
    expect(applied.skillProficiencies.arcana).toBe(2)
    expect(applied.skillProficiencies.history).toBe(2)
    expect(applied.skillProficiencies.nature).toBe(0)
  })

  it('files a subclass spell pick under the class, labelled by the subclass', () => {
    // What the page's hand-built CHOOSE_SPELL supplied and the service's own arm did not.
    const spell = injected(priest())
      .find((e): e is ChooseSpellEvent => e.type === 'CHOOSE_SPELL')!
    expect(spell.addTo).toBe('book.priest')
    expect(spell.label).toBe('Knowledge Domain')
  })

  it('also carries the automatic events, for the callers that want them', () => {
    const types = resolveSubclassLevelEvents(priest(), 'book.priest', 'book.knowledge', 1, rulepack)
      .map(e => e.type)
    expect(types).toContain('GAIN_PROFICIENCY')
    expect(types).toContain('UPDATE_FEATURE_USES')
  })

  it('returns nothing for a subclass the pack does not have', () => {
    expect(resolveSubclassLevelEvents(priest(), 'book.priest', 'book.missing', 1, rulepack))
      .toEqual([])
  })
})

describe('the same events through resolveLevelUpEvents', () => {
  it('are not raised while the subclass is still unchosen', () => {
    // Nothing double-raises: at the top of the run the character has no subclass, so the
    // wizard's injection is the only place these questions come from.
    const types = getChoiceEvents(resolveLevelUpEvents(priest(), 'book.priest', 1, rulepack))
      .map(e => e.type)
    expect(types).toEqual(['CHOOSE_SUBCLASS'])
  })

  it('are raised for a character whose subclass is already stored', () => {
    const stored = priest({
      classes: [{ classId: 'book.priest', level: 0, subclassId: 'book.knowledge' }],
    } as Partial<Character>)
    const types = getChoiceEvents(resolveLevelUpEvents(stored, 'book.priest', 1, rulepack))
      .map(e => e.type)
    expect(types).toEqual(expect.arrayContaining(['CHOOSE_SKILL', 'CHOOSE_EXPERTISE']))
    expect(types).not.toContain('CHOOSE_SUBCLASS')
  })
})

describe('the skills a Knowledge-shaped subclass offers', () => {
  const KNOWLEDGE: SkillKey[] = ['arcana', 'history', 'nature', 'religion']

  it('does not offer one the run has not granted', () => {
    expect(skillsEligibleForExpertise(KNOWLEDGE, projectSkillProficiencies(priest(), [])))
      .toEqual([])
  })
})
