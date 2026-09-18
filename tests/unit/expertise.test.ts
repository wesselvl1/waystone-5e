import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
  projectSkillProficiencies,
  skillsEligibleForExpertise,
} from '~/services/levelUpService'
import type { Character, SkillKey } from '~/types/character'
import type { ResolvedChoice } from '~/types/events'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import bardFragment from '~/data/srd/bard.json'
import rogueFragment from '~/data/srd/rogue.json'

function pack(): Rulepack {
  return {
    id: 'srd-5.1',
    name: 'srd',
    version: '5.1',
    races: [],
    classes: [
      ...RulepackSchema.parse(bardFragment).classes,
      ...RulepackSchema.parse(rogueFragment).classes,
    ],
    backgrounds: [],
    feats: [],
    spells: [],
    creatures: [],
    optionalFeatures: [],
  } as unknown as Rulepack
}

const rulepack = pack()

function charWith(profs: Partial<Record<SkillKey, 0 | 1 | 2>>, level: number, classId: string): Character {
  return {
    ...validCharacter,
    classes: [{ classId, level }],
    skillProficiencies: { ...validCharacter.skillProficiencies, ...profs },
  } as Character
}

describe('Expertise reaches the wizard at all', () => {
  it('is declared by bard at 3 and 10, and rogue at 1 and 6', () => {
    const bard = rulepack.classes.find(c => c.id === 'bard')!
    const rogue = rulepack.classes.find(c => c.id === 'rogue')!
    const at = (cls: typeof bard) => cls.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_EXPERTISE'))
      .map(l => l.level)
    expect(at(bard)).toEqual([3, 10])
    expect(at(rogue)).toEqual([1, 6])
  })

  it('is translated into a runtime event', () => {
    // Regression: resolveLevelUpEvents had no case for it, so the declaration was
    // dropped at stage one and never became an event.
    const char = charWith({}, 2, 'bard')
    const events = resolveLevelUpEvents(char, 'bard', 3, rulepack)
    const expertise = events.find(e => e.type === 'CHOOSE_EXPERTISE')
    expect(expertise).toBeDefined()
    if (expertise?.type === 'CHOOSE_EXPERTISE') {
      expect(expertise.count).toBe(2)
      expect(expertise.options.length).toBeGreaterThan(10)
    }
  })

  it('is classified as a choice, not swallowed as automatic', () => {
    // Regression: isChoiceEvent omitted it, so getAutomaticEvents claimed it and
    // applyAutomaticEvents had no case, discarding it silently.
    const char = charWith({}, 2, 'bard')
    const events = resolveLevelUpEvents(char, 'bard', 3, rulepack)
    expect(getChoiceEvents(events).some(e => e.type === 'CHOOSE_EXPERTISE')).toBe(true)
    expect(getAutomaticEvents(events).some(e => e.type === 'CHOOSE_EXPERTISE')).toBe(false)
  })

  it('survives applyAutomaticEvents without being consumed', () => {
    const char = charWith({}, 2, 'bard')
    const events = resolveLevelUpEvents(char, 'bard', 3, rulepack)
    const applied = applyAutomaticEvents(char, getAutomaticEvents(events), 'average')
    // Nothing was granted automatically; the choice is still the player's to make
    expect(applied.skillProficiencies).toEqual(char.skillProficiencies)
  })
})

describe('applying Expertise', () => {
  it('doubles an existing proficiency', () => {
    const char = charWith({ stealth: 1, acrobatics: 1 }, 3, 'rogue')
    const applied = applyResolvedChoices(
      char,
      [{ type: 'RESOLVED_EXPERTISE', skills: ['stealth', 'acrobatics'] }],
      rulepack,
    )
    expect(applied.skillProficiencies.stealth).toBe(2)
    expect(applied.skillProficiencies.acrobatics).toBe(2)
  })

  it('refuses to grant a skill the character is not proficient in', () => {
    // Expertise doubles a proficiency; it is not a free skill.
    const char = charWith({ arcana: 0 }, 3, 'bard')
    const applied = applyResolvedChoices(
      char,
      [{ type: 'RESOLVED_EXPERTISE', skills: ['arcana'] }],
      rulepack,
    )
    expect(applied.skillProficiencies.arcana).toBe(0)
  })

  it('leaves a skill already at expertise alone', () => {
    const char = charWith({ stealth: 2 }, 6, 'rogue')
    const applied = applyResolvedChoices(
      char,
      [{ type: 'RESOLVED_EXPERTISE', skills: ['stealth'] }],
      rulepack,
    )
    expect(applied.skillProficiencies.stealth).toBe(2)
  })

  it('doubles a skill the same run granted, in the order the run answered', () => {
    const char = charWith({ arcana: 0 }, 1, 'bard')
    const applied = applyResolvedChoices(
      char,
      [
        { type: 'RESOLVED_SKILL', skills: ['arcana'] },
        { type: 'RESOLVED_EXPERTISE', skills: ['arcana'] },
      ],
      rulepack,
    )
    expect(applied.skillProficiencies.arcana).toBe(2)
  })
})

/**
 * The Knowledge Domain shape: one feature grants two skills and then doubles those same
 * two, so the expertise question is asked while the skill answers are still in the run.
 * The wizard's picker calls these two together, against its projected character.
 */
describe('the skills offered for Expertise', () => {
  const KNOWLEDGE_SKILLS: SkillKey[] = ['arcana', 'history', 'nature', 'religion']

  const offered = (char: Character, answered: ResolvedChoice[]) =>
    skillsEligibleForExpertise(KNOWLEDGE_SKILLS, projectSkillProficiencies(char, answered))

  it('includes a skill granted earlier in the same run', () => {
    // Regression: the picker read the stored character, where a CHOOSE_SKILL answered
    // moments ago does not exist yet, so a cleric was told no skill was eligible.
    const char = charWith({ arcana: 0, history: 0, nature: 0, religion: 0 }, 1, 'bard')
    expect(offered(char, [{ type: 'RESOLVED_SKILL', skills: ['arcana', 'history'] }]))
      .toEqual(['arcana', 'history'])
  })

  it('excludes a skill nothing has granted', () => {
    const char = charWith({ arcana: 0, history: 0, nature: 0, religion: 0 }, 1, 'bard')
    expect(offered(char, [{ type: 'RESOLVED_SKILL', skills: ['arcana'] }]))
      .not.toContain('nature')
  })

  it('does not offer a skill the character already has expertise in', () => {
    const char = charWith({ history: 2 }, 1, 'bard')
    expect(offered(char, [{ type: 'RESOLVED_SKILL', skills: ['history'] }]))
      .not.toContain('history')
  })

  it('still offers a stored proficiency, which is all a rogue ever had', () => {
    const char = charWith({ arcana: 1 }, 6, 'rogue')
    expect(offered(char, [])).toEqual(['arcana'])
  })

  it('does not see a skill picked later in the run', () => {
    // The wizard asks in declaration order, and Blessings of Knowledge declares its
    // CHOOSE_SKILL first. An answer that has not been given yet cannot count.
    const char = charWith({ arcana: 0, history: 0, nature: 0, religion: 0 }, 1, 'bard')
    expect(offered(char, [])).toEqual([])
  })
})
