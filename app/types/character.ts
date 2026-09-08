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

export type SpellSlots = Record<SpellSlotLevel, { max: number; used: number }>

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
  hp: { max: number; current: number }
}

export interface WildShapeState {
  limits: CreatureFormLimits
  active?: ActiveCreatureForm
}
export interface ClassSpellcasting {
  ability: AbilityKey               // Spellcasting ability used for DC and attack bonus
  spells: SpellEntry[]              // Spells known/prepared for this class
}

export interface SpellEntry {
  id: string
  spellId: string               // References SpellDefinition.id in a rulepack
  name: string                  // Denormalized for offline display without rulepack
  level: number
  prepared: boolean
  alwaysPrepared?: boolean
  classId?: string              // Which class's spell list this spell belongs to
}

export interface WarlockSlots {
  slotLevel: SpellSlotLevel     // All pact magic slots are the same level
  max: number
  used: number
}

export interface Feature {
  id: string
  name: string
  source: string                // e.g. "Fighter 1", "Human", "Acolyte"
  description: string
  usesMax?: number
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
  hitDice: { total: number; remaining: number; die: string }
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
  spellSlots: SpellSlots
  warlockSlots?: WarlockSlots           // Pact magic slots — separate from regular slots
  spells: SpellEntry[]
  concentrating?: string                // Spell name if concentrating
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
