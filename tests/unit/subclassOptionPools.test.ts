import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { applyResolvedChoices, backfillPoolPickFeatures } from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, OptionPoolPatch } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import warlockFragment from '~/data/srd/warlock.json'

/**
 * A subclass that prints a pool of its own — a Battle Master's manoeuvres, a Four
 * Elements monk's disciplines. This stands in for the PHB rather than reading it:
 * app/data/phb is gitignored dev data, so a test sourcing it would pass only on a
 * machine that owns the book.
 */
const BOOK_FRAGMENT = {
  id: 'book',
  name: 'Book',
  version: '1.0',
  classes: [{
    id: 'book.warrior',
    name: 'Warrior',
    hitDie: 'd10',
    primaryAbility: ['str'],
    savingThrowProficiencies: ['str', 'con'],
    armorProficiencies: ['light'],
    weaponProficiencies: ['simple'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['athletics', 'intimidation'] },
    levels: [
      { level: 1, features: [], levelUpEvents: [] },
      {
        level: 2,
        features: ['Fighting Style'],
        levelUpEvents: [{
          type: 'CHOOSE_OPTION',
          id: 'book.warrior-style',
          label: 'Choose a fighting style',
          group: 'book.warrior-style',
          options: [{ id: 'book.duelling', name: 'Duelling', description: 'A duellist.' }],
        }],
      },
      { level: 3, features: ['Archetype'], levelUpEvents: [] },
    ],
    subclasses: [{
      id: 'book.war-master',
      name: 'War Master',
      description: 'A master of war.',
      levels: [{
        level: 3,
        features: [{ name: 'Manoeuvres', description: 'You learn manoeuvres.' }],
        levelUpEvents: [
          {
            type: 'CHOOSE_OPTION',
            id: 'book.manoeuvre-1',
            label: 'Choose a manoeuvre',
            group: 'book.manoeuvre',
            options: [
              { id: 'book.trip-attack', name: 'Trip Attack', description: 'Knock them down.' },
              { id: 'book.riposte', name: 'Riposte', description: 'Strike back.' },
            ],
          },
          {
            type: 'CHOOSE_OPTION',
            id: 'book.manoeuvre-2',
            label: 'Choose a manoeuvre',
            group: 'book.manoeuvre',
            options: [
              { id: 'book.trip-attack', name: 'Trip Attack', description: 'Knock them down.' },
              { id: 'book.riposte', name: 'Riposte', description: 'Strike back.' },
            ],
          },
        ],
      }],
    }],
  }],
}

/** A second book widening the subclass's pool, the OptionPoolPatch path. */
const PATCH_POOLS: OptionPoolPatch[] = [{
  group: 'book.manoeuvre',
  options: [{ id: 'xge.brace', name: 'Brace', description: 'Ready a blow.' }],
}]

function pack(optionPools: OptionPoolPatch[] = []): Rulepack {
  return {
    id: 'composed',
    name: 'composed',
    version: '0',
    races: [],
    classes: [
      ...RulepackSchema.parse(BOOK_FRAGMENT).classes,
      ...RulepackSchema.parse(warlockFragment).classes,
    ],
    backgrounds: [],
    feats: [],
    spells: [],
    creatures: [],
    optionalFeatures: [],
    optionPools,
  } as unknown as Rulepack
}

function char(classId: string, level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId, level }],
    spells: [],
    spellSlots: {},
    ...over,
  } as Character
}

describe('a pool declared on a subclass level', () => {
  it('names the pick on the sheet', () => {
    // Regression: poolPickFeature walked cls.levels only, so a manoeuvre was recorded in
    // chosenOptions and the sheet showed nothing for it.
    const applied = applyResolvedChoices(
      char('book.warrior', 2),
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.manoeuvre-1', optionId: 'book.trip-attack' }],
      pack(),
    )
    expect(applied.features.map(f => f.name)).toContain('Trip Attack')
    expect(applied.features.find(f => f.id === 'option-book.manoeuvre-1')?.description)
      .toBe('Knock them down.')
  })

  it('credits the subclass as the source, not the class', () => {
    const applied = applyResolvedChoices(
      char('book.warrior', 2),
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.manoeuvre-1', optionId: 'book.riposte' }],
      pack(),
    )
    expect(applied.features.find(f => f.id === 'option-book.manoeuvre-1')?.source)
      .toBe('War Master')
  })

  it('gives each pick in the pool its own feature', () => {
    const applied = applyResolvedChoices(
      char('book.warrior', 2),
      [
        { type: 'RESOLVED_OPTION', choiceId: 'book.manoeuvre-1', optionId: 'book.trip-attack' },
        { type: 'RESOLVED_OPTION', choiceId: 'book.manoeuvre-2', optionId: 'book.riposte' },
      ],
      pack(),
    )
    expect(applied.features.map(f => f.id))
      .toEqual(expect.arrayContaining(['option-book.manoeuvre-1', 'option-book.manoeuvre-2']))
  })

  it('names a patched-in option picked at a subclass level', () => {
    const applied = applyResolvedChoices(
      char('book.warrior', 2),
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.manoeuvre-1', optionId: 'xge.brace' }],
      pack(PATCH_POOLS),
    )
    expect(applied.features.map(f => f.name)).toContain('Brace')
  })

  it('backfills the feature for a pick made before the traversal reached subclasses', () => {
    const stored = char('book.warrior', 3, {
      chosenOptions: { 'book.manoeuvre-1': 'book.trip-attack' },
    })
    expect(backfillPoolPickFeatures(stored, pack()).features.map(f => f.name))
      .toContain('Trip Attack')
  })
})

describe('a pool declared on a class level', () => {
  it('still names the pick, credited to the class', () => {
    const applied = applyResolvedChoices(
      char('warlock', 1),
      [{ type: 'RESOLVED_OPTION', choiceId: 'eldritch-invocation-1', optionId: 'armor-of-shadows' }],
      pack(),
    )
    const feature = applied.features.find(f => f.id === 'option-eldritch-invocation-1')
    expect(feature?.name).toBe('Armor of Shadows')
    expect(feature?.source).toBe('Warlock')
  })

  it('is found even when a subclass of the same class declares pools too', () => {
    const applied = applyResolvedChoices(
      char('book.warrior', 1),
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.warrior-style', optionId: 'book.duelling' }],
      pack(),
    )
    expect(applied.features.find(f => f.id === 'option-book.warrior-style')?.source)
      .toBe('Warrior')
  })
})
