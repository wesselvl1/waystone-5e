import type { AbilityKey, AbilityScores, SkillKey, SpellcastingOrigin, SpellSlotLevel } from './character'

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

/**
 * Level-up events belonging to a race, subrace or background.
 *
 * `level` is the character's **total** level, not a class level: a tiefling gains hellish
 * rebuke at 3rd character level regardless of how those levels are split.
 */
export interface SourceLevelEvents {
  level: number
  levelUpEvents: LevelUpEventDef[]
}

export interface Race {
  id: string
  name: string
  size: 'tiny' | 'small' | 'medium' | 'large'
  speeds: RaceSpeeds
  abilityScoreBonuses: Partial<Record<AbilityKey, number>>
  traits: RaceTrait[]
  languages: string[]
  /** Bonuses the player distributes, e.g. half-elf's +1 to two abilities of choice. */
  abilityScoreChoice?: { count: number; from: AbilityKey[]; bonus: number }
  /** Events fired at a given total character level (tiefling spells, dragonborn ancestry). */
  levelUpEvents?: SourceLevelEvents[]
  subraces?: Subrace[]
}

export interface Subrace {
  id: string
  name: string
  abilityScoreBonuses: Partial<Record<AbilityKey, number>>
  traits: RaceTrait[]
  /** Speed values this subrace grants or overrides (e.g. fly: 30 for Winged Tiefling). */
  speedOverrides?: Partial<RaceSpeeds>
  /** Events fired at a given total character level (high elf's cantrip). */
  levelUpEvents?: SourceLevelEvents[]
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
  | { type: 'UPDATE_FEATURE_USES'; featureName: string; usesMax: number | null }
  | { type: 'UPDATE_SPELL_SLOTS'; slots: Partial<Record<SpellSlotLevel, number>> }
  | { type: 'UPDATE_WARLOCK_SLOTS'; slotLevel: SpellSlotLevel; max: number }
  | { type: 'GAIN_PROFICIENCY'; proficiency: string }
  | {
      type: 'CHOOSE_SPELL'
      addTo: string
      count: number
      fromList?: string[]
      cantrip?: boolean
      classes?: string[]
      schools?: string[]
      /** Source metadata, when `addTo` names a race or background rather than a class. */
      ability?: AbilityKey
      origin?: SpellcastingOrigin
      label?: string
    }
  | { type: 'CHANGE_SPELL'; addTo: string; amount: number; classes?: string[]; schools?: string[] }
  | {
      type: 'GRANT_SPELLS'
      addTo: string
      spellIds: string[]
      alwaysPrepared?: boolean
      /**
       * Only granted when the player has picked this option. Lets a choice made at one
       * level drive grants at later ones, which is how Circle of the Land works.
       */
      whenOption?: { choiceId: string; optionId: string }
      /**
       * Spellcasting ability for `addTo` when it is not a class. A race or background
       * grant uses its own — charisma for a tiefling, intelligence for a high elf.
       */
      ability?: AbilityKey
      origin?: SpellcastingOrigin
      /** Display name for the source, e.g. "Infernal Legacy". */
      label?: string
      /** A free cast: castable this many times, recharging on a rest. */
      uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
      /** Fixed slot level for the free cast, e.g. hellish rebuke as 2nd level. */
      castAtLevel?: number
    }
  | { type: 'SET_WILD_SHAPE_LIMITS'; maxCR: number; allowSwim?: boolean; allowFly?: boolean; types?: CreatureType[] }
  | { type: 'CHOOSE_EXPERTISE'; label: string; options: SkillKey[]; count: number }
  | { type: 'CHOOSE_FEAT' }
  | { type: 'ABILITY_SCORE_IMPROVEMENT'; points: number }
  | { type: 'CHOOSE_SUBCLASS'; label: string }
  | { type: 'UPDATE_HIT_DIE'; die: string }
  | {
    type: 'CHOOSE_OPTION'
    id: string
    label: string
    options: ChooseOptionDef[]
    /**
     * Choices that draw from one shared pool declare the same group, so an option
     * already taken is not offered again. Metamagic, Eldritch Invocations and Fighting
     * Style are each picked several times from one list, and the SRD forbids repeats.
     */
    group?: string
  }

export interface ClassLevel {
  level: number
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

/**
 * How a class comes by its spells. `known` classes have a fixed list; `prepared`
 * classes choose from a larger one each day.
 */
export interface SpellPreparation {
  kind: 'known' | 'prepared'
  /** Only meaningful for `prepared`; defaults to 1 (the whole class level counts). */
  levelDivisor?: number
}

export interface ClassFeatureDefinition {
  name: string
  description: string
  usesMax?: number
  recharge?: 'short' | 'long' | 'dawn'
  replaces?: string    // Name of the feature this one upgrades/replaces
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
  /** Absent means the class cannot be multiclassed into. */
  multiclassing?: MulticlassingRules
  spellcastingAbility?: AbilityKey
  isFullCaster?: boolean
  isHalfCaster?: boolean
  pactMagic?: boolean                  // Warlock-style pact magic (slots separate from regular slots)
  /**
   * How the class comes by its spells. A `known` class has a fixed list and never
   * prepares, so the sheet shows no prepared toggle for it. A `prepared` class prepares
   * `spellcasting ability modifier + floor(class level / levelDivisor)` each day,
   * minimum one — the divisor is 1 for cleric, druid and wizard, 2 for paladin.
   */
  spellPreparation?: SpellPreparation
  levels: ClassLevel[]                 // index 0 = level 1
  featureDefinitions?: ClassFeatureDefinition[]
  subclasses?: SubclassDefinition[]
}

/**
 * A creature statblock. Deliberately generic rather than beast-specific: Wild Shape,
 * Find Familiar, Conjure Animals and Conjure Elemental all need the same shape, and
 * differ only in the filter applied (see CreatureFilter).
 */
export type CreatureType =
  | 'aberration' | 'beast' | 'celestial' | 'construct' | 'dragon' | 'elemental'
  | 'fey' | 'fiend' | 'giant' | 'humanoid' | 'monstrosity' | 'ooze' | 'plant'
  | 'swarm' | 'undead'

export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'

export interface CreatureSpeeds {
  walk?: number
  climb?: number
  swim?: number
  fly?: number
  burrow?: number
}

export interface CreatureAction {
  name: string
  description: string
  attackBonus?: number
  /** Damage expression, e.g. "2d4+2". */
  damage?: string
  damageType?: string
}

export interface CreatureDefinition {
  id: string
  name: string
  type: CreatureType
  size: CreatureSize
  /** Fractional for low-CR creatures: 0, 0.125, 0.25, 0.5, then whole numbers. */
  challengeRating: number
  armorClass: number
  hitPoints: number
  /** e.g. "2d8" — lets the player reroll form hit points if they prefer. */
  hitDice: string
  speeds: CreatureSpeeds
  abilityScores: AbilityScores
  /** Skill bonuses as printed on the statblock, not proficiency levels. */
  skillBonuses?: Partial<Record<SkillKey, number>>
  passivePerception?: number
  senses?: string[]
  languages?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  damageVulnerabilities?: string[]
  conditionImmunities?: string[]
  traits?: RaceTrait[]
  actions?: CreatureAction[]
}

/**
 * Constrains which creatures a feature may select. Wild Shape sets maxCR plus the
 * swim/fly gates; Moon Druid raises maxCR and opens the gates earlier, which is why
 * none of this is hardcoded. Find Familiar and the conjure spells reuse the same shape.
 */
export interface CreatureFilter {
  types?: CreatureType[]
  maxCR?: number
  minCR?: number
  sizes?: CreatureSize[]
  allowSwim?: boolean
  allowFly?: boolean
  /** Restrict to these creature ids exactly, ignoring the other fields. */
  ids?: string[]
}
/**
 * What a class demands and grants when taken as an additional class rather than at
 * character creation. The SRD grants a reduced proficiency set on multiclassing — never
 * saving throws, and often fewer armour, weapon and skill proficiencies.
 */
export interface MulticlassingRules {
  /** Every listed minimum must be met (monk needs both DEX 13 and WIS 13). */
  prerequisites?: Partial<Record<AbilityKey, number>>
  /** Any `choose` of these suffice (fighter needs STR 13 *or* DEX 13). */
  prerequisiteOptions?: {
    choose: number
    from: Array<{ ability: AbilityKey; minimum: number }>
  }
  armorProficiencies?: string[]
  weaponProficiencies?: string[]
  toolProficiencies?: string[]
  /** Usually a single skill, versus the two or more granted at creation. */
  skillChoices?: { count: number; from: SkillKey[] }
  /** Free-text choices with no machine-checkable option list (bard's instrument). */
  toolChoices?: Array<{ count: number; label: string }>
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
  /** Events fired at a given total character level. */
  levelUpEvents?: SourceLevelEvents[]
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
  creatures: CreatureDefinition[]
  optionalFeatures: OptionalClassFeature[]
  /**
   * Patch entries whose target class/race lives in ANOTHER loaded pack, so they could not
   * be distributed at merge time. They stay here, owned by the pack that supplied them,
   * and the rulepacks store folds them in at lookup time. Keeping them on their own pack
   * is what lets a sourcebook be listed — and removed — independently of the SRD.
   */
  subclasses?: SubclassPatchEntry[]
  subraces?: SubracePatchEntry[]
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
  creatures?: CreatureDefinition[]
  /** Subclasses to attach to existing classes identified by classId. */
  subclasses?: SubclassPatchEntry[]
  /** Subraces to attach to existing races identified by raceId. */
  subraces?: SubracePatchEntry[]
  /** Optional class features (e.g. from Tasha's) — stored flat with classId/level. */
  optionalFeatures?: OptionalClassFeature[]
}
