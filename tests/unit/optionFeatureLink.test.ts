import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { applyResolvedChoices } from '~/services/levelUpService'
import type { Character, Feature } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import barbarianFragment from '~/data/srd/barbarian.json'
import bardFragment from '~/data/srd/bard.json'
import fighterFragment from '~/data/srd/fighter.json'
import warlockFragment from '~/data/srd/warlock.json'

/**
 * Which feature an answered CHOOSE_OPTION is written onto.
 *
 * The link used to be `feature.id.includes(choiceId)` over the whole character, which hit
 * whatever happened to contain the string — and missed whatever did not. The subclasses
 * below stand in for app/data/xge and app/data/phb, which are gitignored dev data; each
 * mirrors the real entry's shape at the level that declares the choice.
 */

/**
 * xge.path-of-the-storm-herald — the false negative. `xge.storm-herald-environment` is
 * nowhere inside `xge.path-of-the-storm-herald-storm-aura-3`, so the desert/sea/tundra
 * answer appeared nowhere on the sheet at all.
 */
const STORM_HERALD = {
  id: 'book.path-of-the-storm-herald',
  name: 'Path of the Storm Herald',
  description: 'A storm follows you.',
  classId: 'barbarian',
  levels: [{
    level: 3,
    features: [{
      name: 'Storm Aura',
      description: 'Starting at 3rd level, you emanate a stormy, magical aura while you rage.',
    }],
    levelUpEvents: [{
      type: 'CHOOSE_OPTION' as const,
      id: 'book.storm-herald-environment',
      label: 'Choose your Storm Aura environment',
      options: [
        { id: 'desert', name: 'Desert', description: 'All other creatures in your aura take 2 fire damage each.' },
        { id: 'sea', name: 'Sea', description: 'One creature in your aura takes 1d6 lightning damage.' },
      ],
    }],
  }],
}

/**
 * phb.path-of-the-totem-warrior — the same miss, with a sibling feature at the level, so
 * the pick has to find Totem Spirit among two rather than fall back to the only one.
 */
const TOTEM_WARRIOR = {
  id: 'book.path-of-the-totem-warrior',
  name: 'Path of the Totem Warrior',
  description: 'A spirit animal guides you.',
  classId: 'barbarian',
  levels: [{
    level: 3,
    features: [
      { name: 'Spirit Seeker', description: 'You can cast beast sense and speak with animals as rituals.' },
      { name: 'Totem Spirit', description: 'You choose a totem spirit and gain its feature.' },
    ],
    levelUpEvents: [{
      type: 'CHOOSE_OPTION' as const,
      id: 'book.totem-spirit',
      label: 'Choose a Totem Spirit',
      options: [
        { id: 'bear', name: 'Bear', description: 'While raging, you have resistance to all damage but psychic.' },
        { id: 'wolf', name: 'Wolf', description: 'Your friends have advantage on attacks against creatures within 5 feet of you.' },
      ],
    }],
  }],
}

/**
 * xge.cavalier — the false positive whose damage was to the text: the feature id does
 * contain the choice id, and the book's printed paragraph was traded for the option's
 * five-word label.
 */
const CAVALIER = {
  id: 'book.cavalier',
  name: 'Cavalier',
  description: 'A guardian of the battlefield.',
  classId: 'fighter',
  levels: [{
    level: 3,
    features: [
      {
        name: 'Bonus Proficiency',
        description: 'When you choose this archetype at 3rd level, you gain proficiency in one of the following skills of your choice: Animal Handling, History, Insight, Performance, or Persuasion. Alternatively, you learn one language of your choice.',
      },
      { name: 'Born to the Saddle', description: 'Your mastery as a rider becomes apparent.' },
    ],
    levelUpEvents: [{
      type: 'CHOOSE_OPTION' as const,
      id: 'book.cavalier-bonus-proficiency',
      label: 'Bonus Proficiency: skill or language',
      options: [
        { id: 'skill', name: 'A skill', description: 'Animal Handling, History, Insight, Performance, or Persuasion.' },
        { id: 'language', name: 'A language', description: 'You learn one language of your choice.' },
      ],
    }],
  }],
}

/**
 * The collision the substring test loses outright: a feature at an *earlier* level whose
 * id contains the later level's choice id. `.find()` returns it first, so the wrong
 * feature was renamed and the right one never touched.
 */
const COURTIER = {
  id: 'book.courtier',
  name: 'Courtier',
  description: 'At home in a court.',
  classId: 'fighter',
  levels: [
    {
      level: 3,
      features: [{ name: 'Elegant Courtier Training', description: 'You begin your schooling in etiquette.' }],
      levelUpEvents: [],
    },
    {
      level: 7,
      features: [{ name: 'Elegant Courtier', description: 'Your discipline lets you excel in social situations.' }],
      levelUpEvents: [{
        type: 'CHOOSE_OPTION' as const,
        id: 'book.courtier-elegant-courtier',
        label: 'Elegant Courtier',
        options: [{ id: 'poise', name: 'Poise', description: 'You keep your composure.' }],
      }],
    },
  ],
}

/**
 * xge.college-of-swords — a *grouped* pick, which gets its own `option-…` feature. Its
 * choice id is also a substring of the "Fighting Style" feature's id, so that feature was
 * renamed and overwritten as well and the sheet showed the pick twice.
 */
const COLLEGE_OF_SWORDS = {
  id: 'book.college-of-swords',
  name: 'College of Swords',
  description: 'A blade dancer.',
  classId: 'bard',
  levels: [{
    level: 3,
    features: [
      { name: 'Bonus Proficiencies', description: 'You gain proficiency with medium armor and the scimitar.' },
      { name: 'Fighting Style', description: 'At 3rd level, you adopt a style of fighting as your specialty.' },
    ],
    levelUpEvents: [{
      type: 'CHOOSE_OPTION' as const,
      id: 'book.college-of-swords-fighting-style',
      label: 'Choose a Fighting Style',
      group: 'fighting-style',
      options: [
        { id: 'dueling', name: 'Dueling', description: 'You gain a +2 bonus to damage rolls with that weapon.' },
      ],
    }],
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p',
    name: 'Test',
    version: '1',
    classes: [
      ...RulepackSchema.parse(barbarianFragment).classes,
      ...RulepackSchema.parse(bardFragment).classes,
      ...RulepackSchema.parse(fighterFragment).classes,
      ...RulepackSchema.parse(warlockFragment).classes,
    ],
    subclasses: [STORM_HERALD, TOTEM_WARRIOR, CAVALIER, COURTIER, COLLEGE_OF_SWORDS],
  }) as unknown as Rulepack
  // Distribute the patch entries into their classes, the way the store does at merge time
  for (const patch of built.subclasses ?? []) {
    const { classId, ...rest } = patch as never as { classId: string }
    const cls = built.classes.find(c => c.id === classId)
    if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
  }
  return built
}

const rulepack = pack()

/** The features a subclass's level grants, filed under the ids the pipeline gives them. */
function subclassFeatures(subclass: { id: string; name: string; levels: Array<{ level: number; features: Array<{ name: string; description: string }> }> }): Feature[] {
  return subclass.levels.flatMap(level => level.features.map(f => ({
    id: `${subclass.id}-${f.name.toLowerCase().replaceAll(' ', '-')}-${level.level}`,
    name: f.name,
    source: subclass.name,
    description: f.description,
  })))
}

function char(classId: string, level: number, subclassId: string, features: Feature[]): Character {
  return {
    ...validCharacter,
    classes: [{ classId, level, subclassId }],
    spells: [],
    features,
    classSpellcasting: {},
  } as Character
}

describe('the feature an answered option is written onto', () => {
  it('names a Storm Aura the level declares beside nothing else', () => {
    const before = char('barbarian', 3, STORM_HERALD.id, subclassFeatures(STORM_HERALD))
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.storm-herald-environment', optionId: 'desert' }],
      rulepack,
    )
    const aura = after.features.find(f => f.id === 'book.path-of-the-storm-herald-storm-aura-3')!
    expect(aura.name).toBe('Storm Aura (Desert)')
    expect(aura.description).toContain('you emanate a stormy, magical aura')
    expect(aura.description).toContain('take 2 fire damage')
  })

  it('names the Totem Spirit rather than its sibling at the same level', () => {
    const before = char('barbarian', 3, TOTEM_WARRIOR.id, subclassFeatures(TOTEM_WARRIOR))
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.totem-spirit', optionId: 'bear' }],
      rulepack,
    )
    expect(after.features.find(f => f.name.startsWith('Totem Spirit'))!.name).toBe('Totem Spirit (Bear)')
    expect(after.features.find(f => f.id.includes('spirit-seeker'))!.name).toBe('Spirit Seeker')
  })

  it('keeps the book paragraph of the feature it annotates', () => {
    const before = char('fighter', 3, CAVALIER.id, subclassFeatures(CAVALIER))
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.cavalier-bonus-proficiency', optionId: 'skill' }],
      rulepack,
    )
    const bonus = after.features.find(f => f.id === 'book.cavalier-bonus-proficiency-3')!
    expect(bonus.name).toBe('Bonus Proficiency (A skill)')
    expect(bonus.description).toContain('When you choose this archetype at 3rd level')
    expect(after.features.find(f => f.id.includes('born-to-the-saddle'))!.name).toBe('Born to the Saddle')
  })

  it('leaves alone a feature whose id contains the choice id but which did not raise it', () => {
    const before = char('fighter', 7, COURTIER.id, subclassFeatures(COURTIER))
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.courtier-elegant-courtier', optionId: 'poise' }],
      rulepack,
    )
    const training = after.features.find(f => f.id === 'book.courtier-elegant-courtier-training-3')!
    expect(training.name).toBe('Elegant Courtier Training')
    expect(training.description).toBe('You begin your schooling in etiquette.')
    expect(after.features.find(f => f.id === 'book.courtier-elegant-courtier-7')!.name)
      .toBe('Elegant Courtier (Poise)')
  })

  it('gives a grouped pick one row on the sheet, not two', () => {
    const before = char('bard', 3, COLLEGE_OF_SWORDS.id, subclassFeatures(COLLEGE_OF_SWORDS))
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'book.college-of-swords-fighting-style', optionId: 'dueling' }],
      rulepack,
    )
    expect(after.features.filter(f => f.name.includes('Dueling'))).toHaveLength(1)
    const style = after.features.find(f => f.id === 'book.college-of-swords-fighting-style-3')!
    expect(style.name).toBe('Fighting Style')
    expect(style.description).toBe('At 3rd level, you adopt a style of fighting as your specialty.')
  })

  it('still names an ungrouped pick a class declares on its own level', () => {
    // Pact Boon, the case CLAUDE.md documents: the answer renames the feature that
    // raised it rather than getting a feature of its own.
    const before = char('warlock', 3, '', [{
      id: 'warlock-pact-boon-3',
      name: 'Pact Boon',
      source: 'Warlock',
      description: 'Your patron bestows a gift upon you.',
    }])
    const after = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_OPTION', choiceId: 'pact-boon', optionId: 'pact-of-the-blade' }],
      rulepack,
    )
    const boon = after.features.find(f => f.id === 'warlock-pact-boon-3')!
    expect(boon.name).toBe('Pact Boon (Pact of the Blade)')
    expect(boon.description).toContain('Your patron bestows a gift upon you.')
    expect(after.features).toHaveLength(1)
  })
})
