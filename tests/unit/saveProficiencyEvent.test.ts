import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ResolvedChoice } from '~/types/events'
import { validCharacter } from '../fixtures'
import fighterFragment from '~/data/srd/fighter.json'
import spellFragment from '~/data/srd/spells.json'

/**
 * Nothing but character creation could write `savingThrowProficiencies`, so a subclass or
 * a feat that grants a save had nowhere to put it: `GAIN_PROFICIENCY` files a word in
 * `otherProficiencies`, which no save reads.
 *
 * The subclasses and the feat below stand in for app/data/xge and app/data/phb, which are
 * gitignored dev data — a test sourcing them would pass only on a machine that owns the
 * book. Each mirrors the real entry's shape.
 */

/** xge.samurai, level 7 — Elegant Courtier: Wisdom outright, then Int or Cha. */
const SAMURAI = {
  id: 'book.samurai',
  name: 'Samurai',
  description: 'A disciplined fighter.',
  classId: 'fighter',
  levels: [{
    level: 7,
    features: [{ name: 'Elegant Courtier', description: 'Your discipline and attention to detail allow you to excel in social situations.' }],
    levelUpEvents: [
      { type: 'GAIN_SAVE_PROFICIENCY' as const, ability: 'wis' as const },
      {
        type: 'CHOOSE_OPTION' as const,
        id: 'book.samurai-elegant-courtier',
        label: 'Elegant Courtier: a second save',
        options: [
          { id: 'int', name: 'Intelligence', description: '' },
          { id: 'cha', name: 'Charisma', description: '' },
        ],
      },
      {
        type: 'GAIN_SAVE_PROFICIENCY' as const,
        ability: 'int' as const,
        whenOption: { choiceId: 'book.samurai-elegant-courtier', optionId: 'int' },
      },
      {
        type: 'GAIN_SAVE_PROFICIENCY' as const,
        ability: 'cha' as const,
        whenOption: { choiceId: 'book.samurai-elegant-courtier', optionId: 'cha' },
      },
    ],
  }],
}

/**
 * A subclass granting a save the class already has. The SRD fighter is proficient in
 * Strength saves from 1st level, and a second entry for it would print twice.
 */
const WARDEN = {
  id: 'book.warden',
  name: 'Warden',
  description: 'Stubborn.',
  classId: 'fighter',
  levels: [{
    level: 7,
    features: [{ name: 'Immovable', description: 'You are hard to shift.' }],
    levelUpEvents: [{ type: 'GAIN_SAVE_PROFICIENCY' as const, ability: 'str' as const }],
  }],
}

/**
 * phb.resilient — the whole of its mechanical text is an ability increase and the save
 * that follows it, which is why `'increased'` exists rather than a second question.
 */
const RESILIENT = {
  id: 'book.resilient',
  name: 'Resilient',
  description: 'Choose one ability score.',
  abilityScoreChoice: {
    from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    distributions: [[1]],
  },
  levelUpEvents: [{ type: 'GAIN_SAVE_PROFICIENCY' as const, ability: 'increased' as const }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p',
    name: 'Test',
    version: '1',
    classes: [...RulepackSchema.parse(fighterFragment).classes],
    spells: RulepackSchema.parse(spellFragment).spells,
    feats: [RESILIENT],
    subclasses: [SAMURAI, WARDEN],
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

function char(level: number, subclassId?: string, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'fighter', level, ...(subclassId ? { subclassId } : {}) }],
    spells: [],
    features: [],
    classSpellcasting: {},
    ...over,
  } as Character
}

/** One level-up through the pipeline, in the order the wizard runs it. */
function levelUpWith(before: Character, newLevel: number, choices: ResolvedChoice[]): Character {
  const events = resolveLevelUpEvents(before, 'fighter', newLevel, rulepack)
  let updated = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
  updated = {
    ...updated,
    classes: updated.classes.map(c => (c.classId === 'fighter' ? { ...c, level: newLevel } : c)),
  }
  return applyResolvedChoices(updated, choices, rulepack)
}

describe('GAIN_SAVE_PROFICIENCY', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  it('grants the save a subclass names outright', () => {
    const result = levelUpWith(char(6, 'book.samurai'), 7, [])
    expect(result.savingThrowProficiencies).toContain('wis')
  })

  it('grants the save the arm of a CHOOSE_OPTION names, and only that arm', () => {
    const result = levelUpWith(char(6, 'book.samurai'), 7, [
      { type: 'RESOLVED_OPTION', choiceId: 'book.samurai-elegant-courtier', optionId: 'int' },
    ])
    expect(result.savingThrowProficiencies).toContain('int')
    expect(result.savingThrowProficiencies).not.toContain('cha')
  })

  it('follows the ability a feat\'s own increase went to', () => {
    // Resilient (Dexterity): the player answers the increase, and the save follows it
    // without being asked a second time.
    const result = applyResolvedChoices(
      char(4),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'book.resilient', abilityBonus: { dex: 1 } }],
      rulepack,
    )
    expect(result.abilityScores.dex).toBe(15)
    expect(result.savingThrowProficiencies).toContain('dex')
  })

  it('grants nothing while the feat\'s increase is still unanswered', () => {
    // A GRANT_FEAT'd Resilient resolves before the player has picked the ability, so
    // there is no save to grant yet; RESOLVED_FEAT_ABILITY replays it once there is.
    const granted = applyResolvedChoices(
      char(4),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'book.resilient' }],
      rulepack,
    )
    expect(granted.savingThrowProficiencies).toEqual(['str', 'con'])

    const answered = applyResolvedChoices(
      granted,
      [{ type: 'RESOLVED_FEAT_ABILITY', featId: 'book.resilient', bonuses: { wis: 1 } }],
      rulepack,
    )
    expect(answered.savingThrowProficiencies).toContain('wis')
  })

  it('does not enter a save the character already has twice', () => {
    const result = levelUpWith(char(6, 'book.warden'), 7, [])
    expect(result.savingThrowProficiencies).toEqual(['str', 'con'])
  })
})

describe('the GAIN_SAVE_PROFICIENCY schema', () => {
  const envelope = { id: 'p', name: 'Test', version: '1' }

  it('accepts an ability and the `increased` reference', () => {
    const parsed = RulepackSchema.parse({
      ...envelope,
      feats: [
        { id: 'a', name: 'A', description: '', levelUpEvents: [{ type: 'GAIN_SAVE_PROFICIENCY', ability: 'con' }] },
        { id: 'b', name: 'B', description: '', levelUpEvents: [{ type: 'GAIN_SAVE_PROFICIENCY', ability: 'increased' }] },
      ],
    })
    expect(parsed.feats).toHaveLength(2)
  })

  it('rejects an ability that is not one', () => {
    const bad = {
      ...envelope,
      feats: [{ id: 'a', name: 'A', description: '', levelUpEvents: [{ type: 'GAIN_SAVE_PROFICIENCY', ability: 'luck' }] }],
    }
    expect(RulepackSchema.safeParse(bad).success).toBe(false)
  })
})
