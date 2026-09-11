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

/**
 * Stacking bonuses on one attack, split by where they come from rather than summed.
 *
 * A +1 weapon, Archery, and a circumstantial +2 all land on the same roll, but they come
 * and go independently — the weapon is swapped, the fighting style is retrained, the
 * circumstance passes. Keeping them apart is what lets one be edited without the player
 * re-deriving the other two from a single total they can no longer take apart.
 */
export interface AttackBonusSet {
  magic?: number
  feat?: number
  misc?: number
}

/**
 * The same three slots an attack's bonuses use, applied to the armour class total: a
 * cloak of protection, the Defense fighting style, and whatever the table ruled tonight.
 * Kept apart rather than summed for the same reason — they leave independently.
 */
export type ArmorClassBonuses = AttackBonusSet

/**
 * And again on the initiative roll: a headband of intellect is not the Alert feat is not
 * whatever the table ruled tonight, and they leave independently. What the character's
 * features already add — a Chronurgy wizard's Intelligence, Alert's +5 — is derived from
 * the features themselves and does not belong here; these three are for what no rulepack
 * models.
 */
export type InitiativeBonuses = AttackBonusSet

/**
 * A shield, held apart from the bonus slots because it is a thing carried rather than a
 * number: `equipped` lets a sword-and-board character drop it for a round without losing
 * what it was worth. `bonus` is its whole contribution — 2 for the equipment table's, 3
 * for a +1 — so unequipping takes the enchantment with it.
 */
export interface ArmorClassShield {
  equipped: boolean
  armorId?: string
  name?: string
  bonus: number
}

/**
 * How a character's armour class is arrived at, as opposed to what it comes to.
 *
 * Every field bar the id is denormalized off the rulepack armour entry, so the sheet
 * computes the same number with the pack that supplied it gone — and so a player can
 * nudge one part (a natural armour's base, a Medium Armor Master's raised cap) without
 * the pack having to model their exact case.
 *
 * `armorClass` on the character still wins outright when it is not null; this is what
 * produces the number when it is.
 */
export interface ArmorClassConfig {
  /** The ArmorDefinition this was built from — an armour, or an unarmored base. */
  armorId: string
  /** Denormalized for display without the pack that defines it. */
  armorName: string
  /** The number before any ability modifier. */
  baseValue: number
  /** Maximum Dexterity added; null is uncapped, 0 is none. */
  dexCap: number | null
  /** A second modifier on top of Dexterity — Unarmored Defense's CON or WIS. */
  extraAbility?: AbilityKey
  /**
   * Denormalized rather than read back off the pack, so a monk's Unarmored Defense keeps
   * ruling the shield out when the pack defining it is not loaded. Absent means allowed.
   */
  shieldAllowed?: boolean
  shield?: ArmorClassShield
  bonuses?: ArmorClassBonuses
}

/** The ability an attack rolls with, or a flat roll that adds none. */
export type AttackAbility = AbilityKey | 'none'

export interface AttackEntry {
  id: string
  name: string
  /**
   * A hand-entered total that overrides everything derived below; null derives the roll
   * from `ability`, `proficient` and `attackBonuses`. Predates those fields and is kept
   * because a player transcribing a number off a paper sheet should not have to explain
   * where it came from.
   */
  bonus: number | null
  /** Which modifier the attack rolls with. Absent on attacks stored before this existed. */
  ability?: AttackAbility
  /** Whether the proficiency bonus applies. */
  proficient?: boolean
  attackBonuses?: AttackBonusSet
  /**
   * The modifier added to damage, usually the same as `ability` — but not always: a
   * thrown finesse weapon rolls with DEX and a Duergar's enlarged damage does not follow
   * from the roll at all. 'none' covers both the net and a legacy entry whose modifier is
   * already written into `damageDice`.
   */
  damageAbility?: AttackAbility
  damageBonuses?: AttackBonusSet
  /** The dice alone, e.g. "1d8" — the modifier is derived and appended for display. */
  damageDice: string
  damageType: string
  /** The rulepack weapon this was built from, when it came from the weapon list. */
  weaponId?: string
  /** Copied off the weapon at pick time so the sheet still shows them with no pack loaded. */
  properties?: string[]
  /** Normal/long range in feet, e.g. "80/320", or a reach weapon's "10 ft.". */
  range?: string
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
  /**
   * Cast by spending a class resource rather than a slot or a rest-limited free cast —
   * a Way of Shadow monk pays 2 Ki. `resource` names a feature on the character, which
   * is where the pool itself is tracked, so nothing is duplicated here.
   */
  cost?: { resource: string; amount: number }
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

/**
 * A picture of the character, carried inline as a base64 data URL.
 *
 * There is no backend and no file store, so the image has to travel with the character
 * or it is not really stored at all: a data URL is what survives the JSON export, an
 * import into another browser, and the deep clone every write to IndexedDB goes through.
 * Uploads are downscaled and re-encoded first (`app/services/characterArt.ts`) so a phone
 * photo does not put several megabytes into the record and into every export after it.
 *
 * It is a list rather than one portrait because a character is not one picture: in armor
 * and out of it, a druid's wild shapes, a portrait beside a token.
 */
export interface CharacterImage {
  id: string
  /** The player's own caption — "In plate", "Bear form". May be empty. */
  label: string
  /** `data:image/webp;base64,...` — see `isImageDataUrl` for what is accepted. */
  data: string
}

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
  /**
   * The racial ability increases already folded into `abilityScores` — the race's and
   * subrace's fixed bonuses plus whatever the player distributed.
   *
   * Its ABSENCE is what marks a character as predating racial increases being stored at
   * all, which nothing about the scores themselves can reveal: a dwarf at Constitution
   * 16 could be a 14 plus the race's +2, or a 16 that never received it.
   *
   * Records what was granted, not what fit: a bonus the 20 cap swallowed still appears
   * here, so the record of the grant stays stable while the scores respect the cap.
   */
  appliedRacialBonuses?: Partial<Record<AbilityKey, number>>

  // Combat
  hp: { max: number; current: number; temp: number }
  armorClass: number | null             // null = compute from armorClassConfig
  /**
   * How the computed armour class is built up. Absent on characters predating it, which
   * the calculator reads as plain unarmored — the 10 + Dex they were already shown.
   */
  armorClassConfig?: ArmorClassConfig
  speeds: { walk: number; climb?: number; swim?: number; fly?: number }
  initiative: number | null             // null = derive from Dex, features and the slots below
  /** Hand-entered additions to the derived roll, kept apart the way an attack's are. */
  initiativeBonuses?: InitiativeBonuses
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
  /**
   * What to multiply Strength x 15 by, when the player would rather say than have it
   * worked out. Null or absent means derive it from the features that widen carrying
   * capacity — see `carryingCapacity()` for why that is a guess worth overriding.
   */
  carryingCapacityMultiplier?: number | null
  /**
   * Whether the purse counts against what the character is carrying. Absent means it
   * does, which is the rule as written; plenty of tables ignore coin weight, and a
   * character carries the answer so it survives an export to the table that set it.
   */
  countCoinWeight?: boolean

  notes: string
  appearance?: string
  /** Character art, in the order the player added it. Absent until they upload one. */
  images?: CharacterImage[]

  // Metadata
  createdAt: string                     // ISO date
  updatedAt: string                     // ISO date
  rulepackIds: string[]                 // Which rulepacks were used
  /** Accumulated flat HP bonus per level from feats like Tough. */
  hpBonusPerLevel?: number
  /** Number of Bardic Inspiration dice already expended this rest. */
  bardicInspirationUsed?: number
}
