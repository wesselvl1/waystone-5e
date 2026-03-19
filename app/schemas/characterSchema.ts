import { z } from 'zod'

const AbilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
})

const ClassEntrySchema = z.object({
  classId: z.string(),
  subclassId: z.string().optional(),
  level: z.number().int().min(1).max(20),
})

const SpellSlotLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
])

const SpellSlotsSchema = z.record(
  SpellSlotLevelSchema,
  z.object({ max: z.number().int().min(0), used: z.number().int().min(0) }),
)

const AttackEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  bonus: z.number().nullable(),
  damageDice: z.string(),
  damageType: z.string(),
  notes: z.string().optional(),
})

const SpellEntrySchema = z.object({
  id: z.string(),
  spellId: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  prepared: z.boolean(),
  alwaysPrepared: z.boolean().optional(),
  classId: z.string().optional(),
})

const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  description: z.string(),
  usesMax: z.number().optional(),
  usesRemaining: z.number().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
})

const EquipmentEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(0),
  weight: z.number().optional(),
  notes: z.string().optional(),
})

const SkillProficienciesSchema = z.record(z.string(), z.union([z.literal(0), z.literal(1), z.literal(2)]))

const WarlockSlotsSchema = z.object({
  slotLevel: SpellSlotLevelSchema,
  max: z.number().int().min(0),
  used: z.number().int().min(0),
})

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  race: z.string(),
  subrace: z.string().optional(),
  background: z.string(),
  alignment: z.string().optional(),
  classes: z.array(ClassEntrySchema).min(1),
  experiencePoints: z.number().int().min(0),
  inspiration: z.boolean(),

  abilityScores: AbilityScoresSchema,
  abilityScoreOverrides: AbilityScoresSchema.partial(),

  hp: z.object({
    max: z.number().int().min(1),
    current: z.number().int(),
    temp: z.number().int().min(0),
  }),
  armorClass: z.number().nullable(),
  speed: z.number().int().min(0),
  initiative: z.number().nullable(),
  hitDice: z.object({
    total: z.number().int().min(1),
    remaining: z.number().int().min(0),
    die: z.string(),
  }),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  conditions: z.array(z.string()),

  savingThrowProficiencies: z.array(z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])),
  skillProficiencies: SkillProficienciesSchema,
  otherProficiencies: z.array(z.string()),

  attacks: z.array(AttackEntrySchema),
  spellcastingAbility: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
  spellSlots: SpellSlotsSchema,
  warlockSlots: WarlockSlotsSchema.optional(),
  spells: z.array(SpellEntrySchema),
  concentrating: z.string().optional(),

  features: z.array(FeatureSchema),
  equipment: z.array(EquipmentEntrySchema),
  currency: z.object({
    cp: z.number().int().min(0),
    sp: z.number().int().min(0),
    ep: z.number().int().min(0),
    gp: z.number().int().min(0),
    pp: z.number().int().min(0),
  }),

  notes: z.string(),
  appearance: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  rulepackIds: z.array(z.string()),
}).strip()

export type CharacterInput = z.input<typeof CharacterSchema>
