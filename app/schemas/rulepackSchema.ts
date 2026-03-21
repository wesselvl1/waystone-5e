import { z } from 'zod'

const AbilityKeySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])

const SkillKeySchema = z.enum([
  'acrobatics', 'animalHandling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleightOfHand',
  'stealth', 'survival',
])

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

const SubraceSchema = z.object({
  id: z.string(),
  name: z.string(),
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  traits: z.array(RaceTraitSchema),
  speedOverrides: RaceSpeedsSchema.partial().optional(),
})

const RaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.enum(['tiny', 'small', 'medium', 'large']),
  speeds: RaceSpeedsSchema,
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  traits: z.array(RaceTraitSchema),
  languages: z.array(z.string()),
  subraces: z.array(SubraceSchema).optional(),
})

const SpellSlotLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
])

const ChooseOptionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
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
    count: z.number().int().min(1),
    fromList: z.array(z.string()).optional(),
    cantrip: z.boolean().optional(),
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
  }),
])

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
  levelUpEvents: z.array(LevelUpEventDefSchema).optional().default([]),
})

const SubclassDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  levels: z.array(SubclassLevelSchema),
})

const ClassFeatureDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  usesMax: z.number().int().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
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
  spellcastingAbility: AbilityKeySchema.optional(),
  isFullCaster: z.boolean().optional(),
  isHalfCaster: z.boolean().optional(),
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
  abilityScoreChoice: z.object({
    count: z.number().int().min(1),
    from: z.array(AbilityKeySchema).min(1),
    bonus: z.number().int().min(1),
  }).optional(),
  grantedSpells: z.array(z.string()).optional(),
  hpBonusPerLevel: z.number().int().min(1).optional(),
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
  /** Top-level subclass patches: each entry carries a classId specifying which class to attach to. */
  subclasses: z.array(SubclassPatchEntrySchema).optional().default([]),
  /** Top-level subrace patches: each entry carries a raceId specifying which race to attach to. */
  subraces: z.array(SubracePatchEntrySchema).optional().default([]),
  /** Optional class features from supplemental sourcebooks. */
  optionalFeatures: z.array(OptionalClassFeatureSchema).optional().default([]),
}).strip()

export type RulepackInput = z.input<typeof RulepackSchema>
export type RulepackFragment = z.infer<typeof RulepackSchema>
