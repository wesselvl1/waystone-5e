import type { AbilityKey, SkillKey, SpellcastingOrigin, SpellSlotLevel } from './character'

// ─── Automatic events (applied without player input) ──────────────────────────

export interface AddHpEvent {
  type: 'ADD_HP'
  roll: number          // Actual rolled value
  average: number       // Floor(die/2)+1 for "take average" option
  max: number           // Maximum possible value of the hit die
  conBonus: number
  hpFlatBonus: number   // Flat bonus per level from feats (e.g. Tough)
}

export interface UpdateSpellSlotsEvent {
  type: 'UPDATE_SPELL_SLOTS'
  slots: Partial<Record<SpellSlotLevel, number>>
}

export interface UpdateWarlockSlotsEvent {
  type: 'UPDATE_WARLOCK_SLOTS'
  slotLevel: SpellSlotLevel   // All pact magic slots are the same level
  max: number                 // Absolute max (not a delta)
}

export interface AddFeatureEvent {
  type: 'ADD_FEATURE'
  feature: {
    id: string
    name: string
    source: string
    description: string
    usesMax?: number
    recharge?: 'short' | 'long' | 'dawn'
    replaces?: string    // Name of an existing feature to remove when this one is added
  }
}

export interface GainProficiencyEvent {
  type: 'GAIN_PROFICIENCY'
  proficiency: string
  category: 'armor' | 'weapon' | 'tool' | 'language' | 'skill' | 'save'
  skill?: SkillKey
  save?: AbilityKey
}

/**
 * Records which ability a spellcasting source uses. Emitted per class on every level-up,
 * so a multiclass caster ends up with an entry each rather than sharing one ability.
 */
export interface SetSpellcastingAbilityEvent {
  type: 'SET_SPELLCASTING_ABILITY'
  /** classId today; a race or background source later. */
  sourceId: string
  ability: AbilityKey
}

/**
 * Reported, never applied: a list may now draw from more than its class list.
 *
 * The rule is re-derived from the character's sources on every read (see
 * `expandedSpellIdsFor`), for the same reason spell slots are — a background is chosen
 * before any class, and the expansion has to reach a class taken later. This event
 * exists so the level-up screen can say the list widened; `applyAutomaticEvents` writes
 * nothing for it.
 */
export interface ExpandSpellListEvent {
  type: 'EXPAND_SPELL_LIST'
  /** classId, or 'all' for every list the character has or later gains. */
  addTo: string
  /** Ids named outright by the rule. Empty when it names whole class lists instead. */
  spellIds: string[]
  /** Whole class lists the rule adds. */
  classes?: string[]
  /** Guard that was satisfied to produce this event, kept for traceability. */
  whenOption?: { choiceId: string; optionId: string }
  /**
   * Level the rule came into force at, when that is later than where it is declared.
   * The event is only emitted once it is in force, so this is here to be shown rather
   * than tested.
   */
  minLevel?: number
  label?: string
}

/**
 * The character becomes a spellcaster from a source that is not their class's own
 * spellcasting — an Eldritch Knight fighter. Registers the source so it gets its own DC
 * and attack bonus; slots stay derived from the subclass's table, never written here.
 */
export interface GrantSpellcastingEvent {
  type: 'GRANT_SPELLCASTING'
  addTo: string
  ability: AbilityKey
  /** Class list the spells come from, when not the parent class's own. */
  list?: string
  origin?: SpellcastingOrigin
  label?: string
}

export interface UpdateHitDieEvent {
  type: 'UPDATE_HIT_DIE'
  /** Which class's pool gains a die. */
  classId: string
  die: string
}

/** Spells granted outright by a class or subclass (e.g. cleric domain spells). No player choice. */
export interface GrantSpellsEvent {
  type: 'GRANT_SPELLS'
  addTo: string         // classId of the class spell list to add the spells to
  spells: Array<{ spellId: string; name: string; level: number }>
  alwaysPrepared: boolean   // Domain spells are always prepared and don't count against the prepared limit
  /** Guard that was satisfied to produce this event, kept for traceability. */
  whenOption?: { choiceId: string; optionId: string }
  /** Source metadata for a non-class grant. */
  ability?: AbilityKey
  origin?: SpellcastingOrigin
  label?: string
  uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
  /** Cast by spending a class resource — 2 Ki — rather than a slot or a free cast. */
  cost?: { resource: string; amount: number }
  castAtLevel?: number
}

/** Sets or widens the creature forms a character may assume. Absolute, not a delta:
 * a later level replaces the limits rather than adding to them, which is what lets a
 * subclass override the class progression. */
export interface SetWildShapeLimitsEvent {
  type: 'SET_WILD_SHAPE_LIMITS'
  maxCR: number
  allowSwim: boolean
  allowFly: boolean
  types?: string[]
}

export interface UpdateFeatureUsesEvent {
  type: 'UPDATE_FEATURE_USES'
  featureName: string
  usesMax: number | null   // null = unlimited (remove the cap)
}

// ─── Choice events (require player input) ─────────────────────────────────────

export interface ChooseSpellEvent {
  type: 'CHOOSE_SPELL'
  addTo: string         // classId of the class spell list to add chosen spells to
  count: number
  cantrip: boolean
  fromList?: string[]   // Spell ids if restricted; empty = any from class list
  replace?: boolean     // Whether player can also swap an existing spell
  classes?: string[]    // Restrict to spells from these class lists
  schools?: string[]    // Restrict to spells from these schools of magic
  /**
   * Hard cap on spell level, overriding the target class's own cap. Set by sources that
   * grant a spell level outright — a feat gives a non-caster a 1st-level spell, where
   * the class cap would be 0.
   */
  maxLevel?: number
  /** Guard that was satisfied to produce this event, kept for traceability. */
  whenOption?: { choiceId: string; optionId: string }
  /** A free cast of whatever is picked, carried through to the stored spell entry. */
  uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
  cost?: { resource: string; amount: number }
  castAtLevel?: number
  /** Source metadata when addTo names a race or background rather than a class. */
  ability?: AbilityKey
  origin?: SpellcastingOrigin
  label?: string
}

export interface ChangeSpellEvent {
  type: 'CHANGE_SPELL'
  addTo: string         // classId of the class spell list to swap spells in
  amount: number        // Number of spells the player may swap out
  classes?: string[]    // Restrict replacements to spells from these class lists
  schools?: string[]    // Restrict replacements to spells from these schools of magic
}

/**
 * Asks which ability casts a source's spells, for the sources that leave it to the
 * player. The answer is recorded against `addTo` in Character.classSpellcasting, giving
 * that source its own DC and attack bonus.
 */
export interface ChooseSpellcastingAbilityEvent {
  type: 'CHOOSE_SPELLCASTING_ABILITY'
  addTo: string
  from: AbilityKey[]
  origin?: SpellcastingOrigin
  label?: string
}

export interface ChooseExpertiseEvent {
  type: 'CHOOSE_EXPERTISE'
  label: string
  options: SkillKey[]
  count: number
}

export interface ChooseFeatEvent {
  type: 'CHOOSE_FEAT'
}

export interface AbilityScoreImprovementEvent {
  type: 'ABILITY_SCORE_IMPROVEMENT'
  points: number        // Usually 2 (can go +2 one / +1+1)
}

export interface ChooseSubclassEvent {
  type: 'CHOOSE_SUBCLASS'
  label: string         // e.g. "Martial Archetype", "Roguish Archetype"
}

export interface ChooseSkillEvent {
  type: 'CHOOSE_SKILL'
  count: number
  from: SkillKey[]
}

export interface ChooseOptionEvent {
  type: 'CHOOSE_OPTION'
  id: string           // unique id for this choice (e.g. "totem-spirit")
  label: string        // display label (e.g. "Choose a Totem Spirit")
  /** Same shape as the def, prerequisites included: an option can open later than the pool. */
  options: PoolOption[]
  /** Shared pool this choice draws from, when it has one (e.g. "metamagic"). */
  group?: string
}

/** An option as offered to the player; the def's prerequisites ride along unchanged. */
export interface PoolOption {
  id: string
  name: string
  description: string
  minLevel?: number
  requiresOption?: { choiceId: string; optionId: string }
  requiresSpell?: string
}

/**
 * Offers to trade one pick already made from a shared pool for another.
 *
 * `current` is what the character knows, each paired with the choice id that holds it,
 * because the swap is recorded by overwriting that id's answer. Only raised when there
 * is something to trade and something to trade it for.
 */
export interface ReplaceOptionEvent {
  type: 'REPLACE_OPTION'
  group: string
  label: string
  current: Array<{ choiceId: string; option: PoolOption }>
  options: PoolOption[]
}

/** Presented when ≥1 optional features are available at this level from any loaded rulepack. */
export interface OfferOptionalFeaturesEvent {
  type: 'OFFER_OPTIONAL_FEATURES'
  features: Array<{
    id: string
    name: string
    description: string
    classId: string
    level: number
    replaces?: string
    usesMax?: number
    recharge?: 'short' | 'long' | 'dawn'
    sourceName: string   // Rulepack name the feature comes from
  }>
}

// ─── Resolved event (carries result of a choice) ──────────────────────────────

export interface ResolvedChoiceSpell {
  type: 'RESOLVED_CHOOSE_SPELL'
  spellIds: string[]
  removedSpellIds: string[]
  /**
   * The free-cast terms the choice was offered under. Carried on the answer so the
   * stored entry gets them: the player picked the spell, but the source set the limit.
   */
  uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
  cost?: { resource: string; amount: number }
  castAtLevel?: number
  classId?: string              // Which source's spell list these spells belong to
  /** Set when the source is a race or background with its own ability. */
  ability?: AbilityKey
  origin?: SpellcastingOrigin
  label?: string
}

export interface ResolvedChoiceFeat {
  type: 'RESOLVED_CHOOSE_FEAT'
  featId: string
  /** Ability score bonuses chosen by the player for feats with abilityScoreChoice. */
  abilityBonus?: Partial<Record<AbilityKey, number>>
}

/** The ability the player picked to cast a source's spells with. */
export interface ResolvedSpellcastingAbility {
  type: 'RESOLVED_SPELLCASTING_ABILITY'
  sourceId: string
  ability: AbilityKey
  origin?: SpellcastingOrigin
  label?: string
}

export interface ResolvedASI {
  type: 'RESOLVED_ASI'
  bonuses: Partial<Record<AbilityKey, number>>
}

export interface ResolvedSubclass {
  type: 'RESOLVED_SUBCLASS'
  subclassId: string
  classId: string
}

export interface ResolvedOption {
  type: 'RESOLVED_OPTION'
  choiceId: string     // matches ChooseOptionEvent.id
  optionId: string
}

/**
 * A pool pick traded for another. `choiceId` names the pick being overwritten, so the
 * pool keeps one answer per choice id and the count of picks never changes.
 */
export interface ResolvedOptionReplacement {
  type: 'RESOLVED_OPTION_REPLACEMENT'
  group: string
  choiceId: string
  optionId: string
}

/** Carries the player's selections from an OFFER_OPTIONAL_FEATURES choice. */
export interface ResolvedOptionalFeatures {
  type: 'RESOLVED_OPTIONAL_FEATURES'
  /** The full feature objects the player chose to take (self-contained; no rulepack lookup needed). */
  taken: Array<{
    id: string
    name: string
    description: string
    classId: string
    level: number
    replaces?: string
    usesMax?: number
    recharge?: 'short' | 'long' | 'dawn'
    sourceName: string
  }>
}

// ─── Union types ───────────────────────────────────────────────────────────────

/** A movement mode set to a fixed value — Fleet of Foot's 35ft walk, a 30ft swim. */
export interface SetSpeedEvent {
  type: 'SET_SPEED'
  mode: 'walk' | 'climb' | 'swim' | 'fly'
  speed: number
}

export type AutomaticLevelUpEvent =
  | AddHpEvent
  | GrantSpellcastingEvent
  | ExpandSpellListEvent
  | UpdateSpellSlotsEvent
  | UpdateWarlockSlotsEvent
  | AddFeatureEvent
  | GainProficiencyEvent
  | UpdateHitDieEvent
  | UpdateFeatureUsesEvent
  | GrantSpellsEvent
  | SetWildShapeLimitsEvent
  | SetSpellcastingAbilityEvent
  | SetSpeedEvent

export type ChoiceLevelUpEvent =
  | ChooseSpellEvent
  | ChooseSpellcastingAbilityEvent
  | ChangeSpellEvent
  | ChooseExpertiseEvent
  | ChooseFeatEvent
  | AbilityScoreImprovementEvent
  | ChooseSubclassEvent
  | ChooseSkillEvent
  | ChooseOptionEvent
  | ReplaceOptionEvent
  | OfferOptionalFeaturesEvent

export type LevelUpEvent = AutomaticLevelUpEvent | ChoiceLevelUpEvent

/** Skills picked for a CHOOSE_EXPERTISE: proficiency doubled, not newly granted. */
export interface ResolvedExpertise {
  type: 'RESOLVED_EXPERTISE'
  skills: SkillKey[]
}

/** Skills picked for a CHOOSE_SKILL, e.g. the single skill a multiclass bard gains. */
export interface ResolvedSkill {
  type: 'RESOLVED_SKILL'
  skills: SkillKey[]
}

export type ResolvedChoice =  | ResolvedChoiceSpell
  | ResolvedSpellcastingAbility
  | ResolvedChoiceFeat
  | ResolvedASI
  | ResolvedSubclass
  | ResolvedOption
  | ResolvedOptionReplacement
  | ResolvedOptionalFeatures
  | ResolvedSkill
  | ResolvedExpertise
