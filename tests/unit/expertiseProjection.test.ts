import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { projectSkillProficiencies, skillsEligibleForExpertise } from '~/services/levelUpService'
import type { Character, SkillKey } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ResolvedChoice } from '~/types/events'
import { validCharacter } from '../fixtures'
import rogueFragment from '~/data/srd/rogue.json'

/**
 * A subclass confirmed in this run grants its proficiencies automatically, and
 * RESOLVED_SUBCLASS applies them only once the whole run is applied — after the expertise
 * question has already been asked. Reading the stored character told a Scout there was
 * nothing eligible and the feature did nothing.
 *
 * Stands in for app/data/xge, which is gitignored dev data; it mirrors xge.scout's shape
 * at the level a rogue picks the archetype.
 */
const SCOUT = {
  id: 'book.scout',
  name: 'Scout',
  description: 'At home in the wilderness.',
  classId: 'rogue',
  levels: [{
    level: 3,
    features: [
      { name: 'Skirmisher', description: 'You can move as a reaction.' },
      { name: 'Survivalist', description: 'You gain proficiency in Nature and Survival, and your proficiency bonus is doubled for them.' },
    ],
    levelUpEvents: [
      { type: 'GAIN_PROFICIENCY' as const, proficiency: 'nature' },
      { type: 'GAIN_PROFICIENCY' as const, proficiency: 'survival' },
      { type: 'GAIN_PROFICIENCY' as const, proficiency: 'thieves\' tools' },
      {
        type: 'CHOOSE_EXPERTISE' as const,
        label: 'Survivalist',
        options: ['nature' as const, 'survival' as const],
        count: 2,
      },
    ],
  }],
}

/**
 * The other shape of the same problem: a grant the *level being gained* makes on its own,
 * with no subclass answered in this run to carry it. Mirrors scag's Purple Dragon Knight
 * at subclass level 7, four levels after the archetype was picked — an unconditional
 * proficiency, an arm to say which case the character is in, a grant guarded on one arm,
 * and the expertise that doubles what was just granted.
 */
const ENVOY = {
  id: 'book.envoy',
  name: 'Envoy',
  description: 'A diplomat of the crown.',
  classId: 'rogue',
  levels: [{
    level: 7,
    features: [{ name: 'Royal Envoy', description: 'You gain proficiency in Persuasion.' }],
    levelUpEvents: [
      { type: 'GAIN_PROFICIENCY' as const, proficiency: 'persuasion' },
      {
        type: 'CHOOSE_OPTION' as const,
        id: 'book.envoy-royal-envoy',
        label: 'Royal Envoy',
        options: [
          { id: 'persuasion', name: 'Persuasion', description: 'You were not already proficient.' },
          { id: 'another', name: 'Another skill', description: 'You were already proficient.' },
        ],
      },
      {
        type: 'GAIN_PROFICIENCY' as const,
        proficiency: 'insight',
        whenOption: { choiceId: 'book.envoy-royal-envoy', optionId: 'another' },
      },
      {
        type: 'CHOOSE_EXPERTISE' as const,
        label: 'Royal Envoy',
        options: ['persuasion' as const],
        count: 1,
      },
    ],
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p',
    name: 'Test',
    version: '1',
    classes: [...RulepackSchema.parse(rogueFragment).classes],
    subclasses: [SCOUT, ENVOY],
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

/** The rogue as the wizard projects them: the level being gained is already on `classes`. */
function rogue(): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'rogue', level: 3 }],
    skillProficiencies: { ...validCharacter.skillProficiencies, stealth: 1 },
    features: [],
    spells: [],
  } as Character
}

const TAKES_SCOUT: ResolvedChoice[] = [
  { type: 'RESOLVED_SUBCLASS', classId: 'rogue', subclassId: 'book.scout' },
]

describe('the expertise projection', () => {
  it('offers the skills a subclass confirmed in this run grants automatically', () => {
    const projected = projectSkillProficiencies(rogue(), TAKES_SCOUT, rulepack)
    expect(skillsEligibleForExpertise(['nature', 'survival'], projected))
      .toEqual(['nature', 'survival'])
  })

  it('still withholds a skill nothing has made the character proficient in', () => {
    const projected = projectSkillProficiencies(rogue(), TAKES_SCOUT, rulepack)
    expect(skillsEligibleForExpertise(['arcana', 'nature'], projected)).toEqual(['nature'])
  })

  it('leaves a tool the same subclass grants out of the skill projection', () => {
    // GAIN_PROFICIENCY is one event type covering four kinds of proficiency; only the
    // ones that name a skill belong here, and expertise has nothing to double on a tool.
    const projected = projectSkillProficiencies(rogue(), TAKES_SCOUT, rulepack)
    const gained = (Object.keys(projected) as SkillKey[]).filter(k => (projected[k] ?? 0) > 0)
    expect(gained.sort()).toEqual(['athletics', 'nature', 'perception', 'stealth', 'survival'])
  })

  it('does not offer a skill already at expertise a second time', () => {
    const doubled = { ...rogue(), skillProficiencies: { ...rogue().skillProficiencies, nature: 2 } }
    const projected = projectSkillProficiencies(doubled, TAKES_SCOUT, rulepack)
    expect(skillsEligibleForExpertise(['nature', 'survival'], projected)).toEqual(['survival'])
  })

  it('still folds in a CHOOSE_SKILL answered in the same run', () => {
    const projected = projectSkillProficiencies(
      rogue(),
      [{ type: 'RESOLVED_SKILL', skills: ['arcana'] }],
      rulepack,
    )
    expect(skillsEligibleForExpertise(['arcana'], projected)).toEqual(['arcana'])
  })
})

/** The Envoy as the wizard projects them: level 7 in hand, the archetype stored since 3. */
function envoy(chosenOptions: Record<string, string> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'rogue', level: 7, subclassId: 'book.envoy' }],
    skillProficiencies: { ...validCharacter.skillProficiencies, stealth: 1 },
    chosenOptions,
    features: [],
    spells: [],
  } as Character
}

const AT_SEVEN = { classId: 'rogue', newLevel: 7 }

describe('the expertise projection, for the level being gained', () => {
  it('offers a skill this very level grants automatically', () => {
    const projected = projectSkillProficiencies(envoy(), [], rulepack, AT_SEVEN)
    expect(skillsEligibleForExpertise(['persuasion'], projected)).toEqual(['persuasion'])
  })

  it('offers it whichever arm of the level\'s own choice is answered', () => {
    // Both directions, because the arms only say which case the player is in: the
    // unconditional grant is what the expertise doubles either way.
    for (const optionId of ['persuasion', 'another']) {
      const projected = projectSkillProficiencies(
        envoy({ 'book.envoy-royal-envoy': optionId }), [], rulepack, AT_SEVEN)
      expect(skillsEligibleForExpertise(['persuasion'], projected)).toEqual(['persuasion'])
    }
  })

  it('withholds a guarded grant until its arm is answered', () => {
    // The wizard projects a run's answers onto `chosenOptions` before asking anything
    // later, so an unanswered guard is simply an absent entry.
    const projected = projectSkillProficiencies(envoy(), [], rulepack, AT_SEVEN)
    expect(skillsEligibleForExpertise(['insight'], projected)).toEqual([])
  })

  it('offers a guarded grant once its arm is answered', () => {
    const projected = projectSkillProficiencies(
      envoy({ 'book.envoy-royal-envoy': 'another' }), [], rulepack, AT_SEVEN)
    expect(skillsEligibleForExpertise(['insight'], projected)).toEqual(['insight'])
  })

  it('leaves the level out of the projection when no level is named', () => {
    // The parameter is optional, and every caller that does not name a level — the tests
    // above, a sheet reading a stored character — must see exactly what it always saw.
    const projected = projectSkillProficiencies(envoy(), [], rulepack)
    expect(skillsEligibleForExpertise(['persuasion'], projected)).toEqual([])
  })
})
