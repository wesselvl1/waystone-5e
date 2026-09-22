import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveFirstClassLevel,
  resolveLevelUpEvents,
  getAutomaticEvents,
  applyAutomaticEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import races from '~/data/srd/races.json'
import barbarian from '~/data/srd/barbarian.json'
import cleric from '~/data/srd/cleric.json'

/**
 * Character creation used to finish a level with no questions in it by walking the
 * resolved events and pushing the ADD_FEATURE ones — every other automatic event was
 * resolved and thrown away. A level-1 group never fires again (a later level-up filters
 * on the total level it is gaining), so the character was simply built wrong, for good,
 * with nothing said.
 *
 * The book entries this voided — a background granting a feat, a race granting a skill —
 * live in gitignored directories, so the two cases named below are rebuilt here at the
 * shape the real data has: `aag.wildspacer`, which grants `phb.tough` and asks nothing,
 * and the bugbear's Sneaky, which grants Stealth. The third case needs no rebuilding:
 * the SRD elf's Keen Senses is committed data with the identical shape.
 */

/** phb.tough's shape, which is a flat hit-point grant and no question at all. */
const TOUGH = {
  id: 'test.tough',
  name: 'Tough',
  description: 'Your hit point maximum increases by an amount equal to twice your level.',
  hpBonusPerLevel: 2,
}

/** aag.wildspacer's shape: a background whose feature is a feat, granted outright. */
const WILDSPACER = {
  id: 'test.wildspacer',
  name: 'Wildspacer',
  description: '',
  skillProficiencies: ['athletics', 'survival'],
  toolProficiencies: [],
  languages: 0,
  equipment: [],
  feature: { name: 'Wildspace Adaptation', description: 'You gain the Tough feat.' },
  levelUpEvents: [
    {
      level: 1,
      trait: 'Wildspace Adaptation',
      levelUpEvents: [{ type: 'GRANT_FEAT', featId: 'test.tough' }],
    },
  ],
}

/** The bugbear's shape: a trait that simply is a skill proficiency. */
const BUGBEAR = {
  id: 'test.bugbear',
  name: 'Bugbear',
  size: 'medium',
  speeds: { walk: 30 },
  senses: { darkvision: 60 },
  abilityScoreBonuses: { str: 2, dex: 1 },
  traits: [{ name: 'Sneaky', description: 'You are proficient in the Stealth skill.' }],
  languages: ['Common', 'Goblin'],
  levelUpEvents: [
    {
      level: 1,
      trait: 'Sneaky',
      levelUpEvents: [{ type: 'GAIN_PROFICIENCY', proficiency: 'stealth' }],
    },
  ],
}

/**
 * One pack standing in for the composed pack creation resolves against: the SRD's
 * barbarian, cleric and races beside a book's race, background and feat.
 */
function pack(): Rulepack {
  const book = RulepackSchema.parse({
    id: 'test-book',
    name: 'Test Book',
    version: '1.0.0',
    races: [BUGBEAR],
    backgrounds: [WILDSPACER],
    feats: [TOUGH],
  })
  const srd = RulepackSchema.parse(races)
  return {
    ...(srd as unknown as Rulepack),
    races: [...srd.races, ...book.races] as Rulepack['races'],
    classes: [
      ...RulepackSchema.parse(barbarian).classes,
      ...RulepackSchema.parse(cleric).classes,
    ] as Rulepack['classes'],
    backgrounds: book.backgrounds as Rulepack['backgrounds'],
    feats: book.feats as Rulepack['feats'],
  }
}

const rulepack = pack()

/**
 * A character as the creation wizard hands it over: the level being gained, no hit
 * points and no hit dice (level 1's own ADD_HP and UPDATE_HIT_DIE supply both), and
 * nothing on the sheet but the traits and the background feature it copied across.
 */
function newCharacter(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    race: 'human',
    subrace: undefined,
    background: '',
    classes: [{ classId: 'barbarian', level: 1 }],
    abilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    hp: { max: 0, current: 0, temp: 0 },
    hitDice: [],
    features: [],
    spells: [],
    spellSlots: {},
    classSpellcasting: {},
    skillProficiencies: { ...validCharacter.skillProficiencies, athletics: 0, perception: 0 },
    savingThrowProficiencies: ['str', 'con'],
    otherProficiencies: [],
    ...over,
  } as Character
}

/** d12 + CON 14's +2. What the review step shows, and what the wizard's `max` gives. */
const BARBARIAN_MAX_HP = 14

describe('character creation applies every automatic level-1 event', () => {
  it('gives a wildspacer barbarian the Tough feat and its hit points', () => {
    const { character, choices } = resolveFirstClassLevel(
      newCharacter({ background: 'test.wildspacer' }), 'barbarian', rulepack)

    // The background's feat asks nothing, so nothing forces the level-up wizard: this is
    // exactly the path that used to drop it.
    expect(choices).toHaveLength(0)
    expect(character.features.map(f => f.id)).toContain('test.tough')
    expect(character.hpBonusPerLevel).toBe(2)
    expect(character.hp.max).toBe(BARBARIAN_MAX_HP + 2)
    expect(character.hp.current).toBe(character.hp.max)
  })

  it('gives a bugbear barbarian Stealth, in skillProficiencies', () => {
    const { character, choices } = resolveFirstClassLevel(
      newCharacter({ race: 'test.bugbear' }), 'barbarian', rulepack)

    expect(choices).toHaveLength(0)
    expect(character.skillProficiencies.stealth).toBe(1)
    // Filed as a skill rather than as a word in the flat list, or the Skills panel would
    // still show Stealth unchecked.
    expect(character.otherProficiencies).not.toContain('stealth')
  })

  it('gives an SRD elf barbarian Perception — the same shape, in committed data', () => {
    const { character, choices } = resolveFirstClassLevel(
      newCharacter({ race: 'elf' }), 'barbarian', rulepack)

    expect(choices).toHaveLength(0)
    expect(character.skillProficiencies.perception).toBe(1)
  })

  it('applies the class level itself once: features, hit points and one hit die', () => {
    const { character } = resolveFirstClassLevel(
      newCharacter({ race: 'elf' }), 'barbarian', rulepack)

    expect(character.features.map(f => f.name)).toEqual(['Rage', 'Unarmored Defense'])
    expect(character.hp.max).toBe(BARBARIAN_MAX_HP)
    expect(character.hitDice).toEqual([
      { classId: 'barbarian', die: 'd12', total: 1, remaining: 1 },
    ])
  })

  it('leaves a level that asks a question to the wizard, and applies nothing twice', () => {
    const created = newCharacter({ race: 'elf', classes: [{ classId: 'cleric', level: 1 }] })
    const { character, choices } = resolveFirstClassLevel(created, 'cleric', rulepack)

    // A cleric picks cantrips and a domain at 1st level, so creation stores the character
    // a level short and hands the whole level over.
    expect(choices.map(c => c.type)).toContain('CHOOSE_SUBCLASS')
    expect(character).toBe(created)
    expect(character.hp.max).toBe(0)
    expect(character.hitDice).toEqual([])
    expect(character.skillProficiencies.perception).toBe(0)

    // What the wizard then does with it: stored at level 0, it applies the automatic half
    // itself. Everything lands exactly once — not once here and once there.
    const stored = { ...character, classes: [{ classId: 'cleric', level: 0 }] }
    const levelled = applyAutomaticEvents(
      stored, getAutomaticEvents(resolveLevelUpEvents(stored, 'cleric', 1, rulepack)), 'max')

    expect(levelled.hp.max).toBe(8 + 2) // d8 + CON 14
    expect(levelled.hitDice).toEqual([
      { classId: 'cleric', die: 'd8', total: 1, remaining: 1 },
    ])
    expect(levelled.skillProficiencies.perception).toBe(1)
    expect(levelled.features.map(f => f.id))
      .toEqual([...new Set(levelled.features.map(f => f.id))])
  })
})
