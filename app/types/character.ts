export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export interface AbilityScores {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface ClassEntry {
  classId: string          // References ClassDefinition.id in a rulepack
  subclassId?: string
  level: number
}

export type SpellSlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * Per-level slot state. `base` is NOT stored: it is derived from the character's
 * classes against the multiclass caster-level table, so a corrected rulepack or a new
 * class level recomputes it. Only expenditure and manual adjustments persist — the same
 * base/bonus split used for limited-use features.
 */
export interface SpellSlotState {
  used: number
  /** Manual adjustment (a magic item granting an extra slot). Survives levelling. */
  bonus?: number
}

export type SpellSlots = Partial<Record<SpellSlotLevel, SpellSlotState>>

export interface AttackEntry {
  id: string
  name: string
  bonus: number | null          // null = use computed value
  damageDice: string            // e.g. "1d8+3"
  damageType: string
  notes?: string
}

/**
 * Limits on which creatures a character may assume as a form, set by a feature such as
 * Wild Shape. Stored on the character so the sheet can filter without re-deriving them
 * from class levels, and so a subclass that widens them (Circle of the Moon) needs no
 * code change — it just emits a later SET_WILD_SHAPE_LIMITS.
 *
 * `types` is string[] rather than CreatureType because character.ts must not import from
 * rulepack.ts — rulepack.ts already imports from here, and the cycle would be worse than
 * the lost narrowing. The sheet widens it back into a CreatureFilter.
 */
export interface CreatureFormLimits {
  maxCR: number
  allowSwim: boolean
  allowFly: boolean
  types?: string[]
}

/** The form a character is currently in. Form hit points are tracked separately from
 * the character's own, and are discarded when the form ends. */
export interface ActiveCreatureForm {
  creatureId: string
  /** Denormalized so the sheet still renders if the pack providing the statblock is gone. */
  name: string
  /** Same shape as Character.hp, so the sheet can present it identically. */
  hp: { max: number; current: number; temp: number }
}

export interface WildShapeState {
  limits: CreatureFormLimits
  active?: ActiveCreatureForm
}
/**
 * Where a spellcasting source came from. Not every source is a class: a race, a
 * background or a feat can grant spells that use their own ability, so the key in
 * Character.classSpellcasting is a source id rather than always a classId.
 */
export type SpellcastingOrigin = 'class' | 'race' | 'background' | 'feat'

export interface ClassSpellcasting {
  /** Spellcasting ability for this source's DC and attack bonus. */
  ability: AbilityKey
  /** Defaults to 'class' when absent, which is what existing data means. */
  origin?: SpellcastingOrigin
  /** Display name for a non-class source, e.g. "Infernal Legacy". */
  label?: string
  /**
   * True when the player picked the ability rather than the source dictating it,
   * so the sheet can offer to change it.
   */
  abilityChosen?: boolean
  /** Spells known or prepared for this source. */
  spells: SpellEntry[]
}

export interface SpellEntry {
  id: string
  spellId: string               // References SpellDefinition.id in a rulepack
  name: string                  // Denormalized for offline display without rulepack
  level: number
  prepared: boolean
  alwaysPrepared?: boolean
  /**
   * A free cast granted by a race, background or feat: castable this many times without
   * expending a slot, recharging on a rest. Ordinary spells draw on spellSlots instead.
   */
  uses?: { max: number; remaining: number; recharge: 'short' | 'long' | 'dawn' }
  /** Fixed slot level for a free cast, e.g. hellish rebuke as a 2nd-level spell. */
  castAtLevel?: number
  classId?: string              // Which class's spell list this spell belongs to
}

export interface WarlockSlots {
  slotLevel: SpellSlotLevel     // All pact magic slots are the same level
  max: number
  used: number
}

export type FeatureUsesBonusSource = 'magic' | 'feat' | 'misc'

export type FeatureUsesBonuses = Partial<Record<FeatureUsesBonusSource, number>>

export interface Feature {
  id: string
  name: string
  source: string                // e.g. "Fighter 1", "Human", "Acolyte"
  description: string
  /** Class-derived base, overwritten by UPDATE_FEATURE_USES on level-up. */
  usesMax?: number
  /**
   * Manual adjustments on top of usesMax, kept apart by source so the sheet can show
   * where extra uses come from and a feat can set its own entry without disturbing a
   * magic item's. Never touched by levelling, so they do not need re-applying.
   * Read through featureUsesMax() rather than summing ad hoc. Values may be negative.
   */
  usesBonuses?: FeatureUsesBonuses
  usesRemaining?: number
  recharge?: 'short' | 'long' | 'dawn'
}

export type SkillKey =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleightOfHand'
  | 'stealth' | 'survival'

export type ProficiencyLevel = 0 | 1 | 2    // 0 = none, 1 = proficient, 2 = expertise

export interface EquipmentEntry {
  id: string
  name: string
  quantity: number
  weight?: number
  notes?: string
}

export interface Currency {
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number
}

export interface HitDicePool {
  classId: string
  die: string
  total: number
  remaining: number
}

export interface DeathSaves {
  successes: number   // 0-3
  failures: number    // 0-3
}

export interface Character {
  id: string                            // UUID
  name: string
  race: string                          // References Race.id
  subrace?: string
  background: string                    // References Background.id
  alignment?: string
  classes: ClassEntry[]                 // Array supports multiclass
  experiencePoints: number
  inspiration: boolean

  abilityScores: AbilityScores
  abilityScoreOverrides: Partial<AbilityScores>  // Manual overrides

  // Combat
  hp: { max: number; current: number; temp: number }
  armorClass: number | null             // null = use computed value
  speeds: { walk: number; climb?: number; swim?: number; fly?: number }
  initiative: number | null             // null = use dex modifier
  /**
   * One pool per class. A fighter/wizard spends d10s and d6s separately, so a single
   * pool cannot represent them. Ordered to match `classes`.
   */
  hitDice: HitDicePool[]
  deathSaves: DeathSaves
  conditions: string[]

  // Proficiencies
  savingThrowProficiencies: AbilityKey[]
  skillProficiencies: Record<SkillKey, ProficiencyLevel>
  otherProficiencies: string[]          // Languages, tools, weapons, armor

  // Attacks & spells
  attacks: AttackEntry[]
  /** @deprecated Use classSpellcasting[classId].ability for per-class DC tracking. */
  spellcastingAbility?: AbilityKey
  classSpellcasting: Record<string, ClassSpellcasting>   // Keyed by classId
  /**
   * Manual additions to a source's prepared-spell limit, keyed by spellcasting source
   * id then by where the bonus comes from. The limit itself is derived from the class
   * and ability modifier, so these are the only part that has to persist — and being
   * separate they survive a level-up without re-applying, like feature-use bonuses.
   */
  spellLimitBonuses?: Record<string, FeatureUsesBonuses>
  spellSlots: SpellSlots
  warlockSlots?: WarlockSlots           // Pact magic slots — separate from regular slots
  spells: SpellEntry[]
  concentrating?: string                // Spell name if concentrating
  /**
   * Options the player has picked, keyed by CHOOSE_OPTION id (e.g. land-circle -> forest).
   *
   * Previously a choice was recorded only by rewriting a feature's name, which nothing
   * could query. A later level needs to know what was picked — Circle of the Land chooses
   * its terrain at 3 but gains spells for it at 3, 5, 7 and 9.
   */
  chosenOptions?: Record<string, string>

  /** Present once a feature grants creature forms (Wild Shape). */
  wildShape?: WildShapeState

  // Features & equipment
  features: Feature[]
  equipment: EquipmentEntry[]
  currency: Currency

  notes: string
  appearance?: string

  // Metadata
  createdAt: string                     // ISO date
  updatedAt: string                     // ISO date
  rulepackIds: string[]                 // Which rulepacks were used
  /** Accumulated flat HP bonus per level from feats like Tough. */
  hpBonusPerLevel?: number
  /** Number of Bardic Inspiration dice already expended this rest. */
  bardicInspirationUsed?: number
}
