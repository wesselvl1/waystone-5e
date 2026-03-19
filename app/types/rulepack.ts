import type { AbilityKey, SkillKey, SpellSlotLevel } from './character'

export interface RaceTrait {
  name: string
  description: string
}

export interface Race {
  id: string
  name: string
  size: 'tiny' | 'small' | 'medium' | 'large'
  speed: number
  abilityScoreBonuses: Partial<Record<AbilityKey, number>>
  traits: RaceTrait[]
  languages: string[]
  subraces?: Subrace[]
}

export interface Subrace {
  id: string
  name: string
  abilityScoreBonuses: Partial<Record<AbilityKey, number>>
  traits: RaceTrait[]
}

export interface SpellSlotTable {
  [level: number]: Partial<Record<SpellSlotLevel, number>>
}

export interface ClassFeatureEntry {
  level: number
  name: string
  description: string
  usesMax?: number | string            // number or formula like "wis_mod"
  recharge?: 'short' | 'long' | 'dawn'
}

export type LevelUpEventDef =
  | { type: 'ADD_FEATURE'; featureId: string }
  | { type: 'UPDATE_SPELL_SLOTS'; slots: Partial<Record<SpellSlotLevel, number>> }
  | { type: 'UPDATE_WARLOCK_SLOTS'; slotLevel: SpellSlotLevel; max: number }
  | { type: 'GAIN_PROFICIENCY'; proficiency: string }
  | { type: 'CHOOSE_SPELL'; count: number; fromList?: string[]; cantrip?: boolean }
  | { type: 'CHOOSE_FEAT' }
  | { type: 'ABILITY_SCORE_IMPROVEMENT'; points: number }
  | { type: 'CHOOSE_SUBCLASS'; label: string }
  | { type: 'UPDATE_HIT_DIE'; die: string }

export interface ClassLevel {
  level: number
  proficiencyBonus: number
  features: string[]                   // Feature names gained at this level
  spellSlots?: Partial<Record<SpellSlotLevel, number>>
  cantripsKnown?: number
  spellsKnown?: number
  levelUpEvents: LevelUpEventDef[]
}

export interface SubclassFeature {
  name: string
  description: string
  usesMax?: number
  recharge?: 'short' | 'long' | 'dawn'
}

export interface SubclassLevel {
  level: number                        // Parent class level when features are gained
  features: SubclassFeature[]
}

export interface SubclassDefinition {
  id: string
  name: string
  description: string
  levels: SubclassLevel[]
}

export interface ClassDefinition {
  id: string
  name: string
  hitDie: string                       // e.g. "d10"
  primaryAbility: AbilityKey[]
  savingThrowProficiencies: AbilityKey[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  skillChoices: { count: number; from: SkillKey[] }
  spellcastingAbility?: AbilityKey
  isFullCaster?: boolean
  isHalfCaster?: boolean
  pactMagic?: boolean                  // Warlock-style pact magic (slots separate from regular slots)
  levels: ClassLevel[]                 // index 0 = level 1
  subclasses?: SubclassDefinition[]
}

export interface Background {
  id: string
  name: string
  description: string
  skillProficiencies: SkillKey[]
  toolProficiencies: string[]
  languages: number                    // count of languages gained
  equipment: string[]
  feature: { name: string; description: string }
}

export interface FeatDefinition {
  id: string
  name: string
  description: string
  prerequisite?: string
  abilityScoreBonus?: Partial<Record<AbilityKey, number>>
}

export interface SpellDefinition {
  id: string
  name: string
  level: number                        // 0 = cantrip
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  classes: string[]                    // ClassDefinition ids
}

export interface Rulepack {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  races: Race[]
  classes: ClassDefinition[]
  backgrounds: Background[]
  feats: FeatDefinition[]
  spells: SpellDefinition[]
}
