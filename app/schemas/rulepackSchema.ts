import { z } from 'zod'

const AbilityKeySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])

// 'increased' defers to the ability a feat's own increase went to, which the pack
// cannot name: it depends on how the player answers the feat.
const SpellAbilityRefSchema = z.union([AbilityKeySchema, z.literal('increased')])

// Free casts of a granted or chosen spell, on the same terms wherever they appear.
const SpellUsesSchema = z.object({
  max: z.number().int().min(1),
  recharge: z.enum(['short', 'long', 'dawn']),
}).optional()
const SpellCostSchema = z.object({ resource: z.string(), amount: z.number().int().min(1) }).optional()

const SkillKeySchema = z.enum([
  'acrobatics', 'animalHandling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleightOfHand',
  'stealth', 'survival',
])

/**
 * Each distribution hands one bonus to each of that many distinct abilities, so a
 * distribution longer than `from` could never be spent.
 */
const AbilityScoreChoiceSchema = z.object({
  from: z.array(AbilityKeySchema).min(1),
  distributions: z.array(z.array(z.number().int().min(1)).min(1)).min(1),
}).refine(
  c => c.distributions.every(d => d.length <= c.from.length),
  { message: 'a distribution asks for more abilities than `from` offers' },
)

const RaceTraitSchema = z.object({
  name: z.string(),
  description: z.string(),
})

const RaceSpeedsSchema = z.object({
  walk: z.number().int().min(0),
  climb: z.number().int().min(0).optional(),
  swim: z.number().int().min(0).optional(),
  fly: z.number().int().min(0).optional(),
})

const SpellSlotLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
])

const ChooseOptionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  // Set when an option opens later than the pool that offers it.
  minLevel: z.number().int().min(1).max(20).optional(),
  // Prerequisites other than level: another choice's answer (Pact of the Blade) or a
  // spell the option modifies (eldritch blast).
  requiresOption: z.object({ choiceId: z.string(), optionId: z.string() }).optional(),
  requiresSpell: z.string().optional(),
})

const CreatureTypeSchema = z.enum([
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant',
  'swarm', 'undead',
])

const CreatureSizeSchema = z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'])

const CreatureActionSchema = z.object({
  name: z.string(),
  description: z.string(),
  attackBonus: z.number().int().optional(),
  damage: z.string().optional(),
  damageType: z.string().optional(),
})

const CreatureDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: CreatureTypeSchema,
  size: CreatureSizeSchema,
  challengeRating: z.number().min(0),
  armorClass: z.number().int().min(0),
  hitPoints: z.number().int().min(1),
  hitDice: z.string(),
  speeds: z.object({
    walk: z.number().int().optional(),
    climb: z.number().int().optional(),
    swim: z.number().int().optional(),
    fly: z.number().int().optional(),
    burrow: z.number().int().optional(),
  }),
  abilityScores: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  skillBonuses: z.partialRecord(SkillKeySchema, z.number().int()).optional(),
  passivePerception: z.number().int().optional(),
  senses: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  damageResistances: z.array(z.string()).optional(),
  damageImmunities: z.array(z.string()).optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  traits: z.array(RaceTraitSchema).optional(),
  actions: z.array(CreatureActionSchema).optional(),
})
const LevelUpEventDefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADD_FEATURE'), featureId: z.string() }),
  z.object({ type: z.literal('UPDATE_FEATURE_USES'), featureName: z.string(), usesMax: z.number().int().nullable() }),
  z.object({
    type: z.literal('UPDATE_SPELL_SLOTS'),
    slots: z.partialRecord(SpellSlotLevelSchema, z.number()),
  }),
  z.object({ type: z.literal('GAIN_PROFICIENCY'), proficiency: z.string() }),
  z.object({
    type: z.literal('CHOOSE_SPELL'),
    addTo: z.string(),
    count: z.number().int().min(1),
    fromList: z.array(z.string()).optional(),
    cantrip: z.boolean().optional(),
    classes: z.array(z.string()).optional(),
    schools: z.array(z.string()).optional(),
    // Caps spell level for a source that has no class level of its own to cap by.
    maxLevel: z.number().int().min(0).max(9).optional(),
    // Asked only once this option is picked; queued by the wizard's second stage.
    whenOption: z.object({
      choiceId: z.string(),
      optionId: z.string(),
    }).optional(),
    // Set when addTo names a race or background: the source has its own ability.
    ability: SpellAbilityRefSchema.optional(),
    origin: z.enum(['class', 'race', 'background', 'feat']).optional(),
    label: z.string().optional(),
    // The pick is the player's; the limit on casting it free is the source's.
    uses: SpellUsesSchema,
    cost: SpellCostSchema,
    castAtLevel: z.number().int().min(1).optional(),
  }),
  z.object({
    // A standing rule, never applied to a character: it widens what a list may draw
    // from, and is re-derived so a class taken later still gets it. `addTo: 'all'` is
    // what a Ravnica guild background needs — every list, including future ones.
    type: z.literal('EXPAND_SPELL_LIST'),
    addTo: z.string(),
    spellIds: z.array(z.string()).optional(),
    classes: z.array(z.string()).optional(),
    // Gates the rule on an answered CHOOSE_OPTION, as GRANT_SPELLS does.
    whenOption: z.object({
      choiceId: z.string(),
      optionId: z.string(),
    }).optional(),
    // In force only from this character level, for a list that grows later than it starts.
    minLevel: z.number().int().min(1).max(20).optional(),
    label: z.string().optional(),
  }).refine(
    d => (d.spellIds?.length ?? 0) > 0 || (d.classes?.length ?? 0) > 0,
    { message: 'EXPAND_SPELL_LIST needs spellIds or classes; an expansion of nothing is a no-op' },
  ),
  z.object({
    // The source makes the character a caster where they were not one (Eldritch Knight).
    type: z.literal('GRANT_SPELLCASTING'),
    addTo: z.string(),
    ability: AbilityKeySchema,
    list: z.string().optional(),
    origin: z.enum(['class', 'race', 'background', 'feat']).optional(),
    label: z.string().optional(),
  }),
  z.object({
    // "Int, Wis or Cha (your choice)" — the player picks, rather than the source saying.
    type: z.literal('CHOOSE_SPELLCASTING_ABILITY'),
    addTo: z.string(),
    from: z.array(AbilityKeySchema).min(1),
    origin: z.enum(['class', 'race', 'background', 'feat']).optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('CHANGE_SPELL'),
    addTo: z.string(),
    amount: z.number().int().min(1),
    classes: z.array(z.string()).optional(),
    schools: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('CHOOSE_EXPERTISE'),
    label: z.string(),
    options: z.array(SkillKeySchema),
    count: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('CHOOSE_SKILL'),
    count: z.number().int().min(1),
    // Omitted means every skill, which is what "two skills of your choice" prints.
    from: z.array(SkillKeySchema).min(1).optional(),
    // Asked only when an option was picked, e.g. the Skill Versatility arm of a variant.
    whenOption: z.object({
      choiceId: z.string(),
      optionId: z.string(),
    }).optional(),
  }),
  z.object({
    type: z.literal('GRANT_SPELLS'),
    addTo: z.string(),
    spellIds: z.array(z.string()).min(1),
    alwaysPrepared: z.boolean().optional(),
    whenOption: z.object({
      choiceId: z.string(),
      optionId: z.string(),
    }).optional(),
    // Source metadata, for grants that are not a class: a race or background uses its
    // own spellcasting ability and may hand out a limited number of free casts.
    ability: SpellAbilityRefSchema.optional(),
    origin: z.enum(['class', 'race', 'background', 'feat']).optional(),
    label: z.string().optional(),
    uses: SpellUsesSchema,
    // Cast by spending a class resource (2 Ki) rather than a rest-limited free cast.
    cost: SpellCostSchema,
    castAtLevel: z.number().int().min(1).optional(),
  }),
  z.object({
    type: z.literal('SET_WILD_SHAPE_LIMITS'),
    maxCR: z.number().min(0),
    allowSwim: z.boolean().optional(),
    allowFly: z.boolean().optional(),
    types: z.array(CreatureTypeSchema).optional(),
  }),
  z.object({ type: z.literal('CHOOSE_FEAT') }),
  z.object({ type: z.literal('ABILITY_SCORE_IMPROVEMENT'), points: z.number().int() }),
  z.object({ type: z.literal('CHOOSE_SUBCLASS'), label: z.string() }),
  z.object({ type: z.literal('UPDATE_HIT_DIE'), die: z.string() }),
  z.object({
    type: z.literal('CHOOSE_OPTION'),
    id: z.string(),
    label: z.string(),
    options: z.array(ChooseOptionDefSchema).min(1),
    group: z.string().optional(),
  }),
  z.object({
    type: z.literal('REPLACE_OPTION'),
    group: z.string(),
    label: z.string().optional(),
  }),
])

const MulticlassingRulesSchema = z.object({
  prerequisites: z.partialRecord(AbilityKeySchema, z.number().int()).optional(),
  prerequisiteOptions: z.object({
    choose: z.number().int().min(1),
    from: z.array(z.object({
      ability: AbilityKeySchema,
      minimum: z.number().int(),
    })).min(1),
  }).optional(),
  armorProficiencies: z.array(z.string()).optional(),
  weaponProficiencies: z.array(z.string()).optional(),
  toolProficiencies: z.array(z.string()).optional(),
  skillChoices: z.object({
    count: z.number().int().min(0),
    from: z.array(SkillKeySchema),
  }).optional(),
  toolChoices: z.array(z.object({
    count: z.number().int().min(1),
    label: z.string(),
  })).optional(),
})
/**
 * Events belonging to a race, subrace or background, keyed by TOTAL character level.
 * Declared after LevelUpEventDefSchema because it references it.
 */
const SourceLevelEventsSchema = z.object({
  level: z.number().int().min(1).max(20),
  levelUpEvents: z.array(LevelUpEventDefSchema),
  // Names the trait these events come from, so a subrace replacing that trait replaces
  // its events too.
  trait: z.string().optional(),
})
const SubraceSchema = z.object({
  id: z.string(),
  name: z.string(),
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  // A subrace distributes bonuses just as a race can. Omitting this silently dropped
  // every one the packs declare, since the schema strips what it does not name.
  abilityScoreChoice: AbilityScoreChoiceSchema.optional(),
  // Set when the subrace restates the whole ability line instead of adding to the race's.
  replacesRaceAbilityBonuses: z.literal(true).optional(),
  // Race traits this subrace supersedes, by name — the SCAG tiefling bloodlines replace
  // Infernal Legacy, the half-elf descents replace Skill Versatility.
  replacesRaceTraits: z.array(z.string()).optional(),
  traits: z.array(RaceTraitSchema),
  speedOverrides: RaceSpeedsSchema.partial().optional(),
  levelUpEvents: z.array(SourceLevelEventsSchema).optional(),
})

const RaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.enum(['tiny', 'small', 'medium', 'large']),
  speeds: RaceSpeedsSchema,
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  traits: z.array(RaceTraitSchema),
  languages: z.array(z.string()),
  abilityScoreChoice: AbilityScoreChoiceSchema.optional(),
  levelUpEvents: z.array(SourceLevelEventsSchema).optional(),
  // The race stands on its own; any subraces are sourcebook variants, so "None" is offered.
  subraceOptional: z.literal(true).optional(),
  subraces: z.array(SubraceSchema).optional(),
})

const ClassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
  spellSlots: z.partialRecord(SpellSlotLevelSchema, z.number()).optional(),
  cantripsKnown: z.number().int().optional(),
  spellsKnown: z.number().int().optional(),
  levelUpEvents: z.array(LevelUpEventDefSchema),
})

const SubclassFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  usesMax: z.number().int().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
})

const SubclassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(SubclassFeatureSchema),
  // Present only on a subclass that supplies its class's spellcasting.
  spellSlots: z.partialRecord(SpellSlotLevelSchema, z.number()).optional(),
  cantripsKnown: z.number().int().optional(),
  spellsKnown: z.number().int().optional(),
  levelUpEvents: z.array(LevelUpEventDefSchema).optional().default([]),
})

const SubclassDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Set when the subclass is what makes the character a spellcaster at all. */
  spellcasting: z.object({
    ability: AbilityKeySchema,
    progression: z.enum(['full', 'half', 'third', 'artificer']),
    list: z.string().optional(),
    preparation: z.object({
      kind: z.enum(['known', 'prepared']),
      levelDivisor: z.number().int().min(1).optional(),
    }).optional(),
  }).optional(),
  levels: z.array(SubclassLevelSchema),
})

const ClassFeatureDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  usesMax: z.number().int().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
  replaces: z.string().optional(),
})

const ClassDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  hitDie: z.string(),
  primaryAbility: z.array(AbilityKeySchema),
  savingThrowProficiencies: z.array(AbilityKeySchema),
  armorProficiencies: z.array(z.string()),
  weaponProficiencies: z.array(z.string()),
  toolProficiencies: z.array(z.string()),
  skillChoices: z.object({
    count: z.number().int().min(0),
    from: z.array(SkillKeySchema),
  }),
  multiclassing: MulticlassingRulesSchema.optional(),
  spellcastingAbility: AbilityKeySchema.optional(),
  // Preferred over the booleans, which cannot express the artificer's round-up rule.
  casterProgression: z.enum(['full', 'half', 'third', 'artificer']).optional(),
  isFullCaster: z.boolean().optional(),
  isHalfCaster: z.boolean().optional(),
  /** Warlock-style pact magic: slots are absolute and live in character.warlockSlots. */
  pactMagic: z.boolean().optional(),
  /** Known-list vs prepared-each-day, and how the prepared limit scales. */
  spellPreparation: z.object({
    kind: z.enum(['known', 'prepared']),
    levelDivisor: z.number().int().min(1).optional(),
  }).optional(),
  levels: z.array(ClassLevelSchema),
  featureDefinitions: z.array(ClassFeatureDefinitionSchema).optional(),
  subclasses: z.array(SubclassDefinitionSchema).optional(),
})

const BackgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  skillProficiencies: z.array(SkillKeySchema),
  toolProficiencies: z.array(z.string()),
  languages: z.number().int().min(0),
  equipment: z.array(z.string()),
  feature: z.object({ name: z.string(), description: z.string() }),
  levelUpEvents: z.array(SourceLevelEventsSchema).optional(),
})

const FeatPrerequisiteSchema = z.object({
  minAbilityScore: z.partialRecord(AbilityKeySchema, z.number().int()).optional(),
  spellcasting: z.literal(true).optional(),
  proficiency: z.array(z.string()).optional(),
})

const FeatDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  prerequisite: z.string().optional(),
  prerequisiteCheck: FeatPrerequisiteSchema.optional(),
  abilityScoreBonus: z.partialRecord(AbilityKeySchema, z.number()).optional(),
  abilityScoreChoice: AbilityScoreChoiceSchema.optional(),
  grantedSpells: z.array(z.string()).optional(),
  hpBonusPerLevel: z.number().int().min(1).optional(),
  // Fired when the feat is taken. No level wrapper: a feat has no levels of its own.
  levelUpEvents: z.array(LevelUpEventDefSchema).optional(),
})

const SpellDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  description: z.string(),
  classes: z.array(z.string()),
  savingThrow: AbilityKeySchema.optional(),
  attackRoll: z.enum(['melee', 'ranged']).optional(),
})

export const SubclassPatchEntrySchema = SubclassDefinitionSchema.extend({
  classId: z.string(),
})

export const SubracePatchEntrySchema = SubraceSchema.extend({
  raceId: z.string(),
})

export const OptionalClassFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  classId: z.string(),
  level: z.number().int().min(1).max(20),
  replaces: z.string().optional(),
  usesMax: z.number().int().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
})

export const RulepackSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  races: z.array(RaceSchema).optional().default([]),
  classes: z.array(ClassDefinitionSchema).optional().default([]),
  backgrounds: z.array(BackgroundSchema).optional().default([]),
  feats: z.array(FeatDefinitionSchema).optional().default([]),
  spells: z.array(SpellDefinitionSchema).optional().default([]),
  /** Creature statblocks: beasts for Wild Shape now, summons and familiars later. */
  creatures: z.array(CreatureDefinitionSchema).optional().default([]),
  /** Top-level subclass patches: each entry carries a classId specifying which class to attach to. */
  subclasses: z.array(SubclassPatchEntrySchema).optional().default([]),
  /** Top-level subrace patches: each entry carries a raceId specifying which race to attach to. */
  subraces: z.array(SubracePatchEntrySchema).optional().default([]),
  /** Optional class features from supplemental sourcebooks. */
  optionalFeatures: z.array(OptionalClassFeatureSchema).optional().default([]),
}).strip()

export type RulepackInput = z.input<typeof RulepackSchema>
export type RulepackFragment = z.infer<typeof RulepackSchema>
