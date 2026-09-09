import type { AbilityKey, Character, ClassEntry, SpellSlotLevel, SpellSlots } from '~/types/character'
import type { ClassDefinition, Rulepack } from '~/types/rulepack'
import { preparedBonusTotal } from '~/utils/preparedSpells'

const SLOT_LEVELS: SpellSlotLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export type SlotTable = Partial<Record<SpellSlotLevel, number>>

function classDef(classId: string, rulepack: Rulepack): ClassDefinition | undefined {
  return rulepack.classes.find(c => c.id === classId)
}

/** Classes that contribute to shared spell slots. Warlock pact magic is tracked separately. */
function isSharedSlotCaster(def: ClassDefinition | undefined): boolean {
  return !!def?.spellcastingAbility && !def.pactMagic
}

/**
 * Caster level contributed by one class: full casters count fully, half casters
 * contribute half rounded down, and pact magic contributes nothing.
 */
export function casterLevelFor(entry: ClassEntry, rulepack: Rulepack): number {
  const def = classDef(entry.classId, rulepack)
  if (!isSharedSlotCaster(def)) return 0
  if (def!.isHalfCaster) return Math.floor(entry.level / 2)
  return entry.level
}

/**
 * The SRD Multiclass Spellcaster table. It is identical to any full caster's own
 * progression, so it is read from the rulepack rather than duplicated here — a corrected
 * class table corrects this automatically.
 */
function multiclassTable(rulepack: Rulepack): Map<number, SlotTable> {
  const full = rulepack.classes.find(c => c.isFullCaster && c.levels.some(l => l.spellSlots))
  const table = new Map<number, SlotTable>()
  for (const lvl of full?.levels ?? []) {
    if (lvl.spellSlots) table.set(lvl.level, lvl.spellSlots)
  }
  return table
}

/**
 * Spell slots a character's classes grant, before manual bonuses.
 *
 * With a single spellcasting class the class's own table applies — which matters for half
 * casters, since a paladin 5 has four 1st- and two 2nd-level slots while a caster level of
 * 2 would give only three 1st-level. The combined caster-level rule is specifically for
 * characters with more than one spellcasting class, per the SRD.
 */
export function baseSpellSlots(classes: ClassEntry[], rulepack: Rulepack): SlotTable {
  const casters = classes.filter(c => isSharedSlotCaster(classDef(c.classId, rulepack)))
  if (casters.length === 0) return {}

  if (casters.length === 1) {
    const only = casters[0]!
    const def = classDef(only.classId, rulepack)
    return def?.levels.find(l => l.level === only.level)?.spellSlots ?? {}
  }

  const casterLevel = casters.reduce((sum, c) => sum + casterLevelFor(c, rulepack), 0)
  if (casterLevel <= 0) return {}
  const table = multiclassTable(rulepack)
  return table.get(Math.min(casterLevel, 20)) ?? {}
}

/** Effective maximum for one slot level: the derived base plus any manual bonus. */
export function spellSlotMax(
  level: SpellSlotLevel,
  character: Pick<Character, 'classes' | 'spellSlots'>,
  rulepack: Rulepack,
): number {
  const base = baseSpellSlots(character.classes, rulepack)[level] ?? 0
  const bonus = character.spellSlots[level]?.bonus ?? 0
  return Math.max(0, base + bonus)
}

/** Every slot level with at least one slot, for rendering. */
export function usableSlotLevels(
  character: Pick<Character, 'classes' | 'spellSlots'>,
  rulepack: Rulepack,
): SpellSlotLevel[] {
  return SLOT_LEVELS.filter(lvl => spellSlotMax(lvl, character, rulepack) > 0)
}

/**
 * Highest spell level castable *from a given class*.
 *
 * Slots come from the combined caster level, but which spells a class can learn or prepare
 * is capped by that class's own level. A cleric 1 / wizard 1 has a 2nd-level slot yet may
 * only prepare 1st-level spells from either list.
 */
export function maxSpellLevelForClass(
  classId: string,
  classes: ClassEntry[],
  rulepack: Rulepack,
): number {
  const entry = classes.find(c => c.classId === classId)
  const def = classDef(classId, rulepack)
  if (!entry || !def?.spellcastingAbility) return 0
  const own = def.levels.find(l => l.level === entry.level)?.spellSlots
  if (!own) return 0
  const levels = Object.keys(own)
    .map(Number)
    .filter(n => (own[n as SpellSlotLevel] ?? 0) > 0)
  return levels.length > 0 ? Math.max(...levels) : 0
}

/** Spell save DC for one spellcasting source. */
export function spellSaveDCFor(ability: AbilityKey, abilityMod: number, profBonus: number): number {
  return 8 + profBonus + abilityMod
}

/** Spell attack bonus for one spellcasting source. */
export function spellAttackBonusFor(abilityMod: number, profBonus: number): number {
  return profBonus + abilityMod
}

/**
 * Clamp `used` against the current effective maximum for every level. Needed after a
 * level-up or a bonus change, since the base is derived and can move underneath stored
 * expenditure.
 */
export function clampSpellSlots(
  character: Pick<Character, 'classes' | 'spellSlots'>,
  rulepack: Rulepack,
): SpellSlots {
  const out: SpellSlots = {}
  for (const lvl of SLOT_LEVELS) {
    const state = character.spellSlots[lvl]
    if (!state) continue
    const max = spellSlotMax(lvl, character, rulepack)
    const used = Math.max(0, Math.min(state.used, max))
    out[lvl] = state.bonus === undefined ? { used } : { used, bonus: state.bonus }
  }
  return out
}

/**
 * Whether a spellcasting source prepares spells each day, or works from a fixed list of
 * known ones.
 *
 * Only a class can prepare: a race or background grant has no class definition behind it,
 * and its spells are always prepared by their nature.
 */
export function preparesSpells(def: ClassDefinition | undefined): boolean {
  return def?.spellPreparation?.kind === 'prepared'
}

/**
 * How many spells a list may have prepared: the spellcasting ability modifier plus the
 * class level over its divisor (1 for cleric, druid and wizard; 2 for paladin), never
 * below one, plus any manual bonus.
 *
 * Returns null when the source does not prepare at all — a known-list class such as
 * sorcerer, or a race or background grant. Callers use null to mean "show no limit"
 * rather than a limit of zero.
 */
export function preparedSpellLimit(
  sourceId: string,
  character: Pick<Character, 'classes' | 'preparedBonuses'>,
  rulepack: Rulepack,
  abilityMod: number,
): number | null {
  const entry = character.classes.find(c => c.classId === sourceId)
  if (!entry) return null

  const def = rulepack.classes.find(c => c.id === sourceId)
  if (!preparesSpells(def)) return null

  const divisor = def!.spellPreparation!.levelDivisor ?? 1
  const base = Math.max(1, abilityMod + Math.floor(entry.level / divisor))
  return Math.max(1, base + preparedBonusTotal(character, sourceId))
}
