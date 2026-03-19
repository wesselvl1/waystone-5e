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
  speed: number
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
  spellcastingAbility?: AbilityKey
  spellSlots: SpellSlots
  warlockSlots?: WarlockSlots           // Pact magic slots — separate from regular slots
  spells: SpellEntry[]
  concentrating?: string                // Spell name if concentrating

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
}
