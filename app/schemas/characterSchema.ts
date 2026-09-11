import { isImageDataUrl } from '~/services/characterArt'
import { migrateCharacterShape } from '~/services/characterMigration'
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
const SpellSlotsSchema = z.partialRecord(
  SpellSlotLevelSchema,
  z.object({
    used: z.number().int().min(0),
    bonus: z.number().int().optional(),
    max: z.number().int().min(0).optional(),
  }).transform(({ used, bonus }) => (bonus === undefined ? { used } : { used, bonus })),
)

// A modifier an attack may roll with, or a flat roll adding none.
const AttackAbilitySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha', 'none'])

// Kept apart rather than summed so each can be edited — and removed — on its own.
const AttackBonusSetSchema = z.object({
  magic: z.number().int().optional(),
  feat: z.number().int().optional(),
  misc: z.number().int().optional(),
})

// How the computed AC is built up. Every field bar the id is denormalized off a rulepack
// armour entry, so an imported character still computes the same number with no pack.
const ArmorClassConfigSchema = z.object({
  armorId: z.string(),
  armorName: z.string(),
  baseValue: z.number().int(),
  // null is uncapped, 0 is none at all — so nullable rather than optional.
  dexCap: z.number().int().min(0).nullable(),
  extraAbility: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
  shieldAllowed: z.boolean().optional(),
  shield: z.object({
    equipped: z.boolean(),
    armorId: z.string().optional(),
    name: z.string().optional(),
    bonus: z.number().int(),
  }).optional(),
  bonuses: AttackBonusSetSchema.optional(),
})

const AttackEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  bonus: z.number().nullable(),
  ability: AttackAbilitySchema.optional(),
  proficient: z.boolean().optional(),
  attackBonuses: AttackBonusSetSchema.optional(),
  damageAbility: AttackAbilitySchema.optional(),
  damageBonuses: AttackBonusSetSchema.optional(),
  damageDice: z.string(),
  damageType: z.string(),
  weaponId: z.string().optional(),
  properties: z.array(z.string()).optional(),
  range: z.string().optional(),
  notes: z.string().optional(),
})

const ClassSpellcastingSchema = z.object({
  ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']),
  // A source is not always a class: a race, background or feat grant carries its own
  // origin and display name, and `abilityChosen` records that the player picked the
  // ability rather than the source dictating it. Zod strips what it does not declare,
  // so omitting these silently dropped them on every character import.
  origin: z.enum(['class', 'race', 'background', 'feat']).optional(),
  label: z.string().optional(),
  abilityChosen: z.boolean().optional(),
  spells: z.array(z.lazy(() => SpellEntrySchema)),
})

const SpellEntrySchema = z.object({
  id: z.string(),
  spellId: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  prepared: z.boolean(),
  alwaysPrepared: z.boolean().optional(),
  uses: z.object({
    max: z.number().int().min(0),
    remaining: z.number().int().min(0),
    recharge: z.enum(['short', 'long', 'dawn']),
  }).optional(),
  // Cast by spending a class resource (2 Ki), rather than a slot or a free cast.
  cost: z.object({ resource: z.string(), amount: z.number().int().min(1) }).optional(),
  castAtLevel: z.number().int().min(1).optional(),
  classId: z.string().optional(),
})

/** The three manual bonus sources, shared by feature uses and prepared-spell limits. */
const BonusesSchema = z.object({
  magic: z.number().int().optional(),
  feat: z.number().int().optional(),
  misc: z.number().int().optional(),
})

const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  description: z.string(),
  usesMax: z.number().optional(),
  usesBonuses: BonusesSchema.optional(),
  usesRemaining: z.number().optional(),
  recharge: z.enum(['short', 'long', 'dawn']).optional(),
})

const EquipmentEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(0),
  /** Pounds for one of them, not for the stack. Absent where nobody weighed it. */
  weight: z.number().min(0).optional(),
  notes: z.string().optional(),
})

/**
 * Character art travels inside the character, so an imported file decides what the sheet
 * will put in an `<img src>`. The data URL is checked against the raster types the app
 * writes rather than taken on trust: nothing else should reach a `src` attribute, and a
 * hand-edited export is exactly the path by which something else would.
 */
const CharacterImageSchema = z.object({
  id: z.string(),
  label: z.string(),
  data: z.string().refine(isImageDataUrl, 'must be a base64 image data URL'),
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
  // Absent on a character created before racial increases were stored at all.
  appliedRacialBonuses: AbilityScoresSchema.partial().optional(),

  hp: z.object({
    max: z.number().int().min(1),
    current: z.number().int(),
    temp: z.number().int().min(0),
  }),
  armorClass: z.number().nullable(),
  armorClassConfig: ArmorClassConfigSchema.optional(),
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
  spellLimitBonuses: z.record(z.string(), BonusesSchema).optional(),
  spellSlots: SpellSlotsSchema,
  warlockSlots: WarlockSlotsSchema.optional(),
  spells: z.array(SpellEntrySchema),
  concentrating: z.string().optional(),
  chosenOptions: z.record(z.string(), z.string()).optional(),
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
  carryingCapacityMultiplier: z.number().positive().nullable().optional(),

  notes: z.string(),
  appearance: z.string().optional(),
  images: z.array(CharacterImageSchema).optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  rulepackIds: z.array(z.string()),
  hpBonusPerLevel: z.number().int().min(0).optional(),
  bardicInspirationUsed: z.number().int().min(0).optional(),
}).strip().transform(c => migrateCharacterShape(c))

export type CharacterInput = z.input<typeof CharacterSchema>
