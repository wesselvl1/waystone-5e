import type { AbilityKey, SkillKey, SpellSlotLevel } from './character'

export interface RaceTrait {
  name: string
  description: string
}

export interface RaceSpeeds {
  walk: number
  climb?: number
  swim?: number
  fly?: number
}

export interface Race {
  id: string
  name: string
  size: 'tiny' | 'small' | 'medium' | 'large'
  speeds: RaceSpeeds
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
  /** Speed values this subrace grants or overrides (e.g. fly: 30 for Winged Tiefling). */
  speedOverrides?: Partial<RaceSpeeds>
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

export interface ChooseOptionDef {
  id: string
  name: string
  description: string
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
  | { type: 'CHOOSE_OPTION'; id: string; label: string; options: ChooseOptionDef[] }

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
  levelUpEvents?: LevelUpEventDef[]
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

export interface FeatPrerequisite {
  minAbilityScore?: Partial<Record<AbilityKey, number>>
  /** Character must have a spellcasting ability set (i.e. be a spellcaster). */
  spellcasting?: true
  /** Character must have at least one of the listed proficiencies. */
  proficiency?: string[]
}

export interface FeatDefinition {
  id: string
  name: string
  description: string
  /** Human-readable prerequisite text. */
  prerequisite?: string
  /** Machine-checkable prerequisites (must ALL be satisfied). */
  prerequisiteCheck?: FeatPrerequisite
  /** Direct flat ability score bonuses applied when the feat is taken. */
  abilityScoreBonus?: Partial<Record<AbilityKey, number>>
  /** Let the player choose which abilities to boost (e.g. +1 to one of Wis/Int/Cha). */
  abilityScoreChoice?: { count: number; from: AbilityKey[]; bonus: number }
  /** Spell ids automatically granted when this feat is taken. */
  grantedSpells?: string[]
  /** Extra HP added per level (retroactively + on every future level-up, e.g. Tough = 2). */
  hpBonusPerLevel?: number
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
  savingThrow?: AbilityKey
  attackRoll?: 'melee' | 'ranged'
}

/** An optional class feature from a supplemental sourcebook (e.g. Tasha's). */
export interface OptionalClassFeature {
  id: string
  name: string
  description: string
  classId: string          // Which class can take this
  level: number            // At which class level it becomes available
  /** Name of the base class feature this optionally replaces (informational). */
  replaces?: string
  usesMax?: number
  recharge?: 'short' | 'long' | 'dawn'
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
  optionalFeatures: OptionalClassFeature[]
}

/** A subclass entry in a patch file — carries the target classId alongside the subclass definition. */
export interface SubclassPatchEntry extends SubclassDefinition {
  classId: string
}

/** A subrace entry in a patch file — carries the target raceId alongside the subrace definition. */
export interface SubracePatchEntry extends Subrace {
  raceId: string
}

/**
 * A rulepack fragment: a partial rulepack file that can be merged into an existing rulepack.
 * All content arrays are optional and default to []. Top-level `subclasses` / `subraces` entries are
 * distributed into the matching class / race when merged.
 */
export interface RulepackFragment {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  races?: Race[]
  classes?: ClassDefinition[]
  backgrounds?: Background[]
  feats?: FeatDefinition[]
  spells?: SpellDefinition[]
  /** Subclasses to attach to existing classes identified by classId. */
  subclasses?: SubclassPatchEntry[]
  /** Subraces to attach to existing races identified by raceId. */
  subraces?: SubracePatchEntry[]
  /** Optional class features (e.g. from Tasha's) — stored flat with classId/level. */
  optionalFeatures?: OptionalClassFeature[]
}
