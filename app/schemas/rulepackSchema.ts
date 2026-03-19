import { z } from 'zod'

const AbilityKeySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])

const RaceTraitSchema = z.object({
  name: z.string(),
  description: z.string(),
})

const SubraceSchema = z.object({
  id: z.string(),
  name: z.string(),
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  traits: z.array(RaceTraitSchema),
})

const RaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.enum(['tiny', 'small', 'medium', 'large']),
  speed: z.number().int().min(0),
  abilityScoreBonuses: z.partialRecord(AbilityKeySchema, z.number()),
  traits: z.array(RaceTraitSchema),
  languages: z.array(z.string()),
  subraces: z.array(SubraceSchema).optional(),
})

const SpellSlotLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
])

const LevelUpEventDefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADD_FEATURE'), featureId: z.string() }),
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
])

const ClassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  proficiencyBonus: z.number().int().min(2).max(6),
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
})

const SubclassDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  levels: z.array(SubclassLevelSchema),
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
    from: z.array(z.string()),
  }),
  spellcastingAbility: AbilityKeySchema.optional(),
  isFullCaster: z.boolean().optional(),
  isHalfCaster: z.boolean().optional(),
  levels: z.array(ClassLevelSchema),
  subclasses: z.array(SubclassDefinitionSchema).optional(),
})

const BackgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  skillProficiencies: z.array(z.string()),
  toolProficiencies: z.array(z.string()),
  languages: z.number().int().min(0),
  equipment: z.array(z.string()),
  feature: z.object({ name: z.string(), description: z.string() }),
})

const FeatDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  prerequisite: z.string().optional(),
  abilityScoreBonus: z.partialRecord(AbilityKeySchema, z.number()).optional(),
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
})

export const RulepackSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  races: z.array(RaceSchema),
  classes: z.array(ClassDefinitionSchema),
  backgrounds: z.array(BackgroundSchema),
  feats: z.array(FeatDefinitionSchema),
  spells: z.array(SpellDefinitionSchema),
}).strip()

export type RulepackInput = z.input<typeof RulepackSchema>
