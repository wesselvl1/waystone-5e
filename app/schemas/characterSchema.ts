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

/**
 * Slot state as stored. `max` was persisted before slots became derived from the
 * multiclass caster-level table; it is accepted and dropped so old characters load.
 */
const SpellSlotsSchema = z.record(
  SpellSlotLevelSchema,
  z.object({
    used: z.number().int().min(0),
    bonus: z.number().int().optional(),
    max: z.number().int().min(0).optional(),
  }).transform(({ used, bonus }) => (bonus === undefined ? { used } : { used, bonus })),
)

const AttackEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  bonus: z.number().nullable(),
  damageDice: z.string(),
  damageType: z.string(),
  notes: z.string().optional(),
})

const ClassSpellcastingSchema = z.object({
  ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']),
  spells: z.array(z.lazy(() => SpellEntrySchema)),
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
  usesBonuses: z.object({
    magic: z.number().int().optional(),
    feat: z.number().int().optional(),
    misc: z.number().int().optional(),
  }).optional(),
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
  speeds: z.object({
    walk: z.number().int().min(0),
    climb: z.number().int().min(0).optional(),
    swim: z.number().int().min(0).optional(),
    fly: z.number().int().min(0).optional(),
  }),
  initiative: z.number().nullable(),
  // Either the pre-multiclass single pool or the per-class array; normalised below.
  hitDice: z.union([
    z.object({
      total: z.number().int().min(1),
      remaining: z.number().int().min(0),
      die: z.string(),
    }),
    z.array(z.object({
      classId: z.string(),
      die: z.string(),
      total: z.number().int().min(0),
      remaining: z.number().int().min(0),
    })),
  ]),  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  conditions: z.array(z.string()),

  savingThrowProficiencies: z.array(z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])),
  skillProficiencies: SkillProficienciesSchema,
  otherProficiencies: z.array(z.string()),

  attacks: z.array(AttackEntrySchema),
  spellcastingAbility: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
  classSpellcasting: z.record(z.string(), ClassSpellcastingSchema).default({}),
  spellSlots: SpellSlotsSchema,
  warlockSlots: WarlockSlotsSchema.optional(),
  spells: z.array(SpellEntrySchema),
  concentrating: z.string().optional(),
  wildShape: z.object({
    limits: z.object({
      maxCR: z.number().min(0),
      allowSwim: z.boolean(),
      allowFly: z.boolean(),
      types: z.array(z.string()).optional(),
    }),
    active: z.object({
      creatureId: z.string(),
      name: z.string(),
      hp: z.object({
        max: z.number().int(),
        current: z.number().int(),
        // Defaulted: forms stored before temp existed have no value for it.
        temp: z.number().int().optional().default(0),
      }),
    }).optional(),
  }).optional(),

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
  hpBonusPerLevel: z.number().int().min(0).optional(),
  bardicInspirationUsed: z.number().int().min(0).optional(),
}).strip().transform((c) => {
  // Migrate the single hit dice pool onto the character's first class. Attributing every
  // die to one class is the only defensible guess: the old shape recorded a single die
  // size, so a multiclass character predating this could not have been represented anyway.
  const hitDice = Array.isArray(c.hitDice)
    ? c.hitDice
    : [{
        classId: c.classes[0]?.classId ?? '',
        die: c.hitDice.die,
        total: c.hitDice.total,
        remaining: c.hitDice.remaining,
      }]

  // Adopt the flat spells array into per-source lists. Entries already carry a classId;
  // those without one are attributed to the first class that can cast, so nothing is lost.
  const classSpellcasting = { ...c.classSpellcasting }
  const alreadyGrouped = Object.values(classSpellcasting).some(v => v.spells.length > 0)
  if (!alreadyGrouped && c.spells.length > 0) {
    const fallback = c.classes[0]?.classId ?? 'unknown'
    for (const spell of c.spells) {
      const key = spell.classId ?? fallback
      const existing = classSpellcasting[key]
      if (existing) existing.spells = [...existing.spells, spell]
      else classSpellcasting[key] = { ability: c.spellcastingAbility ?? 'int', spells: [spell] }
    }
  }

  return { ...c, hitDice, classSpellcasting }
})

export type CharacterInput = z.input<typeof CharacterSchema>
