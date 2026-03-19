import type { AbilityKey, SkillKey, SpellSlotLevel } from './character'

// ─── Automatic events (applied without player input) ──────────────────────────

export interface AddHpEvent {
  type: 'ADD_HP'
  roll: number          // Actual rolled value
  average: number       // Floor(die/2)+1 for "take average" option
  max: number           // Maximum possible value of the hit die
  conBonus: number
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
  }
}

export interface GainProficiencyEvent {
  type: 'GAIN_PROFICIENCY'
  proficiency: string
  category: 'armor' | 'weapon' | 'tool' | 'language' | 'skill' | 'save'
  skill?: SkillKey
  save?: AbilityKey
}

export interface UpdateHitDieEvent {
  type: 'UPDATE_HIT_DIE'
  die: string
  totalDice: number
}

// ─── Choice events (require player input) ─────────────────────────────────────

export interface ChooseSpellEvent {
  type: 'CHOOSE_SPELL'
  count: number
  cantrip: boolean
  fromList?: string[]   // Spell ids if restricted; empty = any from class list
  replace?: boolean     // Whether player can also swap an existing spell
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

// ─── Resolved event (carries result of a choice) ──────────────────────────────

export interface ResolvedChoiceSpell {
  type: 'RESOLVED_CHOOSE_SPELL'
  spellIds: string[]
  removedSpellIds: string[]
  classId?: string              // Which class's spell list these spells belong to
}

export interface ResolvedChoiceFeat {
  type: 'RESOLVED_CHOOSE_FEAT'
  featId: string
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

// ─── Union types ───────────────────────────────────────────────────────────────

export type AutomaticLevelUpEvent =
  | AddHpEvent
  | UpdateSpellSlotsEvent
  | UpdateWarlockSlotsEvent
  | AddFeatureEvent
  | GainProficiencyEvent
  | UpdateHitDieEvent

export type ChoiceLevelUpEvent =
  | ChooseSpellEvent
  | ChooseFeatEvent
  | AbilityScoreImprovementEvent
  | ChooseSubclassEvent
  | ChooseSkillEvent

export type LevelUpEvent = AutomaticLevelUpEvent | ChoiceLevelUpEvent

export type ResolvedChoice =
  | ResolvedChoiceSpell
  | ResolvedChoiceFeat
  | ResolvedASI
  | ResolvedSubclass
