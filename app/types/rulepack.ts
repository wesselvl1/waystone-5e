import type { AbilityKey, AbilityScores, SkillKey, SpellcastingOrigin, SpellSlotLevel } from './character'

/**
 * Which ability a granted or chosen spell casts with.
 *
 * 'increased' means the ability this FEAT's own increase went to — Tasha's phrasing,
 * "the spells' spellcasting ability is the ability increased by this feat" (Fey Touched,
 * Shadow Touched, Telekinetic, Telepathic). It cannot be written down in the pack
 * because it depends on how the player answered the feat's own abilityScoreChoice, so
 * it is resolved when the feat is taken.
 */
export type SpellAbilityRef = AbilityKey | 'increased'

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
  /**
   * The trait these events belong to, e.g. "Infernal Legacy". Only needed on a race whose
   * subraces may replace that trait — the events are skipped along with it.
   */
  trait?: string
}

/**
 * Ability increases the player distributes rather than the pack fixing.
 *
 * `distributions` lists the legal ways to spend them; each entry is the bonuses to hand
 * out, one per *distinct* ability drawn from `from`. The half-elf's "+1 to two ability
 * scores of your choice" is `[[1, 1]]`, and Custom Lineage's "one ability score of your
 * choice increases by 2" is `[[2]]`.
 *
 * Monsters of the Multiverse states its rule as a choice between two shapes — "increase
 * one score by 2 and increase a different score by 1, or increase three different scores
 * by 1" — which is `[[2, 1], [1, 1, 1]]`. Neither half of that fits a single `bonus`
 * repeated `count` times: the first mixes two sizes, and the two shapes hand out
 * different totals to different numbers of abilities.
 */
export interface AbilityScoreChoice {
  from: AbilityKey[]
  distributions: number[][]
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
  abilityScoreChoice?: AbilityScoreChoice
  /** Events fired at a given total character level (tiefling spells, dragonborn ancestry). */
  levelUpEvents?: SourceLevelEvents[]
  /**
   * The race is playable without picking a subrace, so the wizard offers "None".
   *
   * Set on the races the SRD prints whole — a half-elf, a human, a tiefling. Their
   * subraces only exist because a sourcebook adds variants, and forcing one of those on
   * a player who wants the plain race is wrong. A dwarf or an elf, whose subrace the SRD
   * requires, leaves this unset.
   */
  subraceOptional?: true
  subraces?: Subrace[]
}

export interface Subrace {
  id: string
  name: string
  abilityScoreBonuses: Partial<Record<AbilityKey, number>>
  /**
   * Bonuses the player distributes, as on a race — the winged tiefling's +2 to Dexterity
   * or Charisma, a dragonmark's +1 to one ability of choice.
   */
  abilityScoreChoice?: AbilityScoreChoice
  traits: RaceTrait[]
  /**
   * The subrace's ability bonuses REPLACE the race's rather than adding to them.
   *
   * Most subraces add: a mountain dwarf's +2 Strength sits on top of the dwarf's +2
   * Constitution. A few restate the whole line instead — the Mordenkainen tiefling
   * bloodlines, the Wildemount dragonborn, the Eberron dragonmarks — and adding those
   * would double the parent's bonus. Covers `abilityScoreChoice` too, so a dragonmarked
   * half-elf gets the mark's pick instead of the half-elf's, not both.
   */
  replacesRaceAbilityBonuses?: true
  /**
   * Race traits this subrace replaces, by name — "This trait replaces the Infernal Legacy
   * trait", or the half-elf descents trading Skill Versatility for a heritage feature.
   * The named trait is dropped from the sheet and the race's level-up events tagged with
   * that `trait` never fire, so the subrace's own version is the only one that applies.
   */
  replacesRaceTraits?: string[]
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
  /**
   * Class level this option becomes available at, when the pool it belongs to opens
   * earlier than the option does. An artificer picks infusions from 2nd level, but
   * Arcane Propulsion Armor is not on offer until 14th.
   */
  minLevel?: number
  /**
   * Another choice's answer this option depends on. Several Eldritch Invocations are
   * gated on the Pact Boon rather than on level: Thirsting Blade needs Pact of the Blade,
   * Book of Ancient Secrets needs Pact of the Tome.
   */
  requiresOption?: { choiceId: string; optionId: string }
  /**
   * A spell the character must know for this option to be on offer. Agonizing Blast,
   * Eldritch Spear and Repelling Blast all modify eldritch blast, so they are only open
   * to a warlock who took the cantrip.
   */
  requiresSpell?: string
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
      /**
       * Highest spell level that may be picked. Only needed when the source is not a
       * class: a class's own cap comes from its level (`maxSpellLevelForClass`), but a
       * feat grants a fixed level regardless — Magic Initiate gives a non-caster fighter
       * a 1st-level spell, and without this the class cap of 0 would filter it out.
       */
      maxLevel?: number
      /**
       * Only asked once the player has picked this option. Lets one choice decide which
       * list a later pick draws from — Magic Initiate's class, a Strixhaven college.
       *
       * Unlike a guarded GRANT_SPELLS this cannot be replayed after the fact: a question
       * has to be *asked*. The level-up wizard therefore queues it in a second stage,
       * once the option it depends on has been answered.
       */
      whenOption?: { choiceId: string; optionId: string }
      /** Source metadata, when `addTo` names a race or background rather than a class. */
      ability?: SpellAbilityRef
      origin?: SpellcastingOrigin
      label?: string
      /**
       * A free cast of whatever the player picks, on the same terms GRANT_SPELLS states
       * them: Magic Initiate's 1st-level spell and Fey Touched's two are each castable
       * once per long rest without a slot.
       */
      uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
      /** Cast by spending a class resource instead. As GRANT_SPELLS.cost. */
      cost?: { resource: string; amount: number }
      /** Fixed slot level for the free cast. As GRANT_SPELLS.castAtLevel. */
      castAtLevel?: number
    }
  | {
      /**
       * Widens what a spell list may draw from, without granting anything to cast with.
       * A Ravnica guild background, a Divine Soul's access to the cleric list.
       *
       * Unlike every other event here this is **never applied to a character**: it is a
       * standing rule, re-derived from the character's sources whenever a list is read
       * (see `expandedSpellIdsFor`). It has to be, for two reasons the books force:
       *
       * - A background is chosen before any class. "These spells are added to the spell
       *   list of your spellcasting class" has no list to write to yet, and must still
       *   hold for a class taken at 4th level.
       * - "If you are a multiclass character with multiple spell lists, these spells are
       *   added to all of them" — so the target is a rule, not a fixed id.
       */
      type: 'EXPAND_SPELL_LIST'
      /**
       * The list that gains the spells: a classId, or `'all'` for every spellcasting
       * list the character has or later gains.
       */
      addTo: string
      /** Spells added by id. */
      spellIds?: string[]
      /** Whole class lists added — Divine Soul adds the cleric list to a sorcerer's. */
      classes?: string[]
      /**
       * Only in force once the player has picked this option, so one choice can drive
       * several alternative expansions — which genie a Genie warlock is bound to, each
       * with its own expanded list. Mirrors GRANT_SPELLS.whenOption.
       *
       * Being derived, this needs no replay at the level the option is chosen: the
       * answer lands in `chosenOptions` and the next read picks it up.
       */
      whenOption?: { choiceId: string; optionId: string }
      /**
       * Character level from which the expansion applies, when that is later than the
       * level the rule is declared at. The Genie adds *wish* to its list only from 9th,
       * while the rest of the pact list arrives at 1st.
       */
      minLevel?: number
      /** Display name for the rule, e.g. "Azorius Guild Spells". */
      label?: string
    }
  | {
      /**
       * The source makes the character a spellcaster where they were not one before —
       * an Eldritch Knight fighter, an Arcane Trickster rogue. It registers the source
       * so it gets its own DC; the slots themselves stay derived, from the subclass's
       * own `spellSlots` table and `SubclassSpellcasting.progression`.
       *
       * Not for widening an existing caster's list (Divine Soul, Chronurgy) — that adds
       * nothing to cast with and needs no registration.
       */
      type: 'GRANT_SPELLCASTING'
      /** Source id to register. For a subclass this is the parent classId. */
      addTo: string
      ability: AbilityKey
      /** Class list the spells come from, when not the parent class's own. */
      list?: string
      origin?: SpellcastingOrigin
      label?: string
    }
  | {
      /**
       * The source grants spells but lets the player say which ability casts them —
       * "Intelligence, Wisdom or Charisma (your choice)", as every Monsters of the
       * Multiverse race and the Strixhaven and Dragonlance initiate feats are written.
       * Distinct from a fixed `ability` on GRANT_SPELLS / CHOOSE_SPELL, which is the
       * source dictating it.
       */
      type: 'CHOOSE_SPELLCASTING_ABILITY'
      /** Source id to record the answer against, keying Character.classSpellcasting. */
      addTo: string
      from: AbilityKey[]
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
      ability?: SpellAbilityRef
      origin?: SpellcastingOrigin
      /** Display name for the source, e.g. "Infernal Legacy". */
      label?: string
      /** A free cast: castable this many times, recharging on a rest. */
      uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
      /**
       * Cast by spending a class resource instead — 2 Ki for a Way of Shadow monk.
       * `resource` names a feature, which is where the pool is tracked.
       */
      cost?: { resource: string; amount: number }
      /** Fixed slot level for the free cast, e.g. hellish rebuke as 2nd level. */
      castAtLevel?: number
    }
  | { type: 'SET_WILD_SHAPE_LIMITS'; maxCR: number; allowSwim?: boolean; allowFly?: boolean; types?: CreatureType[] }
  | { type: 'CHOOSE_EXPERTISE'; label: string; options: SkillKey[]; count: number }
  /**
   * Skill proficiencies the player picks — the half-elf's Skill Versatility, a feat's
   * "three skills of your choice". `from` narrows the list; omitted, every skill is on
   * offer. Ones the character already has are shown but not pickable.
   */
  | {
    type: 'CHOOSE_SKILL'
    count: number
    from?: SkillKey[]
    /**
     * Ask only when a `CHOOSE_OPTION` was answered this way — the Skill Versatility arm
     * of a half-elf descent's variant feature. Gated the same way a `GRANT_SPELLS` is.
     */
    whenOption?: { choiceId: string; optionId: string }
  }
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
  | {
    /**
     * Offers to swap one pick already made from a shared pool for another the character
     * qualifies for now. A warlock may trade an invocation on every warlock level, so the
     * offer is declared on each level rather than derived — a pack that does not allow
     * retraining simply omits it.
     */
    type: 'REPLACE_OPTION'
    /** The pool to swap within, matching the `group` of the CHOOSE_OPTION picks. */
    group: string
    label?: string
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
  /**
   * The subclass's own slot table, for a subclass that supplies the spellcasting its
   * class lacks. Read the same way a ClassLevel's is, so nothing about the derivation
   * changes — an Eldritch Knight's slots are simply printed on the subclass rather than
   * the class.
   */
  spellSlots?: Partial<Record<SpellSlotLevel, number>>
  cantripsKnown?: number
  spellsKnown?: number
  levelUpEvents?: LevelUpEventDef[]
}

/**
 * Spellcasting a subclass supplies to a class that has none — Eldritch Knight, Arcane
 * Trickster. A subclass of a class that already casts does not need this; widening what
 * such a class may learn is a different thing entirely.
 *
 * `progression` is used only for the multiclass caster-level sum, where the SRD rounds
 * down. A single-classed character reads the subclass's own printed table instead, which
 * rounds the other way — the same split the class-level code already makes for paladins.
 */
/**
 * How a class's level converts to caster levels when spell slots are pooled across
 * several classes.
 *
 * `half` and `third` round DOWN, per the SRD's multiclassing rule. `artificer` is its
 * own case because Tasha's says to round UP — which is also why an artificer 1 has two
 * 1st-level slots where a half caster has none.
 */
export type CasterProgression = 'full' | 'half' | 'third' | 'artificer'

export interface SubclassSpellcasting {
  ability: AbilityKey
  progression: CasterProgression
  /** Class id whose spell list may be learned from, when not the parent class's own. */
  list?: string
  preparation?: SpellPreparation
}

export interface SubclassDefinition {
  id: string
  name: string
  description: string
  /** Set when the subclass is what makes the character a spellcaster at all. */
  spellcasting?: SubclassSpellcasting
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
  /**
   * Preferred over the two booleans below, which cannot express the artificer's
   * round-up rule. They remain honoured so data predating this keeps working.
   */
  casterProgression?: CasterProgression
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
  abilityScoreChoice?: AbilityScoreChoice
  /** Spell ids automatically granted when this feat is taken. */
  grantedSpells?: string[]
  /** Extra HP added per level (retroactively + on every future level-up, e.g. Tough = 2). */
  hpBonusPerLevel?: number
  /**
   * Everything the feat does that a flat field cannot express, reusing the same event
   * vocabulary as a class level. Fired when the feat is taken, not at a fixed level: a
   * feat has no levels of its own, so there is no `SourceLevelEvents` wrapper here.
   *
   * `grantedSpells` handles a fixed list; this is for the ones that ask the player
   * something — Magic Initiate's two cantrips plus a 1st-level spell, Fey Touched's
   * pick from divination and enchantment — and for the proficiencies a feat hands out
   * (Moderately Armored's medium armour and shields).
   *
   * Choices here are answered *after* the feat is picked, so the level-up wizard appends
   * them to the run rather than knowing them up front.
   */
  levelUpEvents?: LevelUpEventDef[]
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
