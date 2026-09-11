import type { AbilityKey, Character, ClassEntry, SpellSlotLevel, SpellSlots } from '~/types/character'
import type { CasterProgression, ClassDefinition, LevelUpEventDef, Rulepack, SubclassDefinition } from '~/types/rulepack'
import {
  spellLimitBonusTotal, preparedSpellCount, knownSpellCount,
} from '~/utils/spellLimits'

const SLOT_LEVELS: SpellSlotLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export type SlotTable = Partial<Record<SpellSlotLevel, number>>

function classDef(classId: string, rulepack: Rulepack): ClassDefinition | undefined {
  return rulepack.classes.find(c => c.id === classId)
}

/** Classes that contribute to shared spell slots. Warlock pact magic is tracked separately. */
function isSharedSlotCaster(def: ClassDefinition | undefined): boolean {
  return !!def?.spellcastingAbility && !def.pactMagic
}

function subclassOf(entry: ClassEntry, rulepack: Rulepack): SubclassDefinition | undefined {
  if (!entry.subclassId) return undefined
  return rulepack.classes
    .flatMap(c => c.subclasses ?? [])
    .find(sub => sub.id === entry.subclassId)
}

/**
 * How one class entry casts, and where its own slot table lives.
 *
 * Usually the class says: `spellcastingAbility` plus the full/half flags. But a subclass
 * can supply spellcasting to a class that has none — an Eldritch Knight fighter, an
 * Arcane Trickster rogue — and then the ability, the progression and the printed table
 * all come from the subclass instead. Returns undefined for a non-caster, and for a pact
 * caster, whose slots are absolute and tracked on the character.
 */
function castingFor(entry: ClassEntry, rulepack: Rulepack): {
  ability: AbilityKey
  progression: CasterProgression
  slotsAt: (level: number) => SlotTable | undefined
} | undefined {
  const def = classDef(entry.classId, rulepack)
  if (isSharedSlotCaster(def)) {
    return {
      ability: def!.spellcastingAbility!,
      // The explicit field wins; the booleans are what SRD data still says.
      progression: def!.casterProgression ?? (def!.isHalfCaster ? 'half' : 'full'),
      slotsAt: level => def!.levels.find(l => l.level === level)?.spellSlots,
    }
  }
  if (def?.pactMagic) return undefined

  const sub = subclassOf(entry, rulepack)
  if (!sub?.spellcasting) return undefined
  return {
    ability: sub.spellcasting.ability,
    progression: sub.spellcasting.progression,
    slotsAt: level => sub.levels.find(l => l.level === level)?.spellSlots,
  }
}

/**
 * Caster level contributed by one class.
 *
 * Full casters count fully; half and third casters contribute half or a third rounded
 * DOWN, per the SRD's multiclassing rule; pact magic nothing. The artificer is the one
 * exception — Tasha's has it round UP, which is why an artificer 1 already casts.
 */
export function casterLevelFor(entry: ClassEntry, rulepack: Rulepack): number {
  const casting = castingFor(entry, rulepack)
  if (!casting) return 0
  switch (casting.progression) {
    case 'artificer': return Math.ceil(entry.level / 2)
    case 'third': return Math.floor(entry.level / 3)
    case 'half': return Math.floor(entry.level / 2)
    default: return entry.level
  }
}

/**
 * The SRD Multiclass Spellcaster table. It is identical to any full caster's own
 * progression, so it is read from the rulepack rather than duplicated here — a corrected
 * class table corrects this automatically.
 */
function multiclassTable(rulepack: Rulepack): Map<number, SlotTable> {
  // Either spelling counts. casterProgression is the preferred one, so a pack that uses
  // only it would otherwise yield an empty table here and no slots at all for a
  // multiclass caster, while castingFor read that same pack correctly.
  const isFull = (c: ClassDefinition) => (c.casterProgression ?? (c.isFullCaster ? 'full' : undefined)) === 'full'
  const full = rulepack.classes.find(c => isFull(c) && c.levels.some(l => l.spellSlots))
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
  const casters = classes.filter(c => castingFor(c, rulepack))
  if (casters.length === 0) return {}

  if (casters.length === 1) {
    const only = casters[0]!
    return castingFor(only, rulepack)!.slotsAt(only.level) ?? {}
  }

  const casterLevel = casters.reduce((sum, c) => sum + casterLevelFor(c, rulepack), 0)
  if (casterLevel <= 0) return {}
  const table = multiclassTable(rulepack)
  return table.get(Math.min(casterLevel, 20)) ?? {}
}

/** `addTo: 'all'` means every spellcasting list the character has, or later gains. */
const ALL_LISTS = 'all'

type ExpandDef = Extract<LevelUpEventDef, { type: 'EXPAND_SPELL_LIST' }>

/** What deriving the expansions needs off a character: its sources and its answers. */
type ExpansionContext = Pick<
  Character,
  'classes' | 'race' | 'subrace' | 'background' | 'chosenOptions'
>

/**
 * Every EXPAND_SPELL_LIST rule in force for a character, with the source that carries it.
 *
 * Walked fresh rather than stored, which is the whole point. A background is chosen
 * before any class exists, so there is no list to write the spells onto at the time —
 * and the Ravnica wording ("added to the spell list of your spellcasting class… if you
 * are a multiclass character with multiple spell lists, these spells are added to all of
 * them") has to keep holding for a class taken ten levels later.
 *
 * Race, subrace and background events are keyed by TOTAL character level; a class's and
 * its subclass's by that class's level.
 */
function activeExpansions(
  character: ExpansionContext,
  rulepack: Rulepack,
): Array<{ def: ExpandDef; sourceName?: string }> {
  const out: Array<{ def: ExpandDef; sourceName?: string }> = []
  const total = character.classes.reduce((sum, c) => sum + c.level, 0)
  const collect = (
    levels: Array<{ level: number; levelUpEvents?: LevelUpEventDef[] }> | undefined,
    upTo: number,
    sourceName?: string,
  ) => {
    for (const entry of levels ?? []) {
      if (entry.level > upTo) continue
      for (const def of entry.levelUpEvents ?? []) {
        if (def.type !== 'EXPAND_SPELL_LIST') continue
        // A guarded rule waits on its choice: one CHOOSE_OPTION drives four alternative
        // expansions for a Genie warlock, and only the chosen genie's is in force.
        if (def.whenOption
          && character.chosenOptions?.[def.whenOption.choiceId] !== def.whenOption.optionId) {
          continue
        }
        // Part of a list can arrive later than the rest: the Genie adds wish only from
        // 9th level, off the same pact-magic rule that grants the rest at 1st.
        if (def.minLevel && total < def.minLevel) continue
        out.push({ def, sourceName })
      }
    }
  }

  const totalLevel = total

  const race = rulepack.races.find(r => r.id === character.race)
  const subrace = race?.subraces?.find(sr => sr.id === character.subrace)
  const background = rulepack.backgrounds.find(b => b.id === character.background)
  collect(race?.levelUpEvents, totalLevel, race?.name)
  collect(subrace?.levelUpEvents, totalLevel, subrace?.name)
  collect(background?.levelUpEvents, totalLevel, background?.name)

  for (const entry of character.classes) {
    const def = classDef(entry.classId, rulepack)
    collect(def?.levels, entry.level, def?.name)
    const sub = subclassOf(entry, rulepack)
    collect(sub?.levels, entry.level, sub?.name)
  }

  return out
}

/**
 * Spell ids a list may draw from beyond its own class list.
 *
 * `listId` is a spellcasting source id — usually a classId. A rule targeting `'all'`
 * applies to every list, which is how a guild background reaches a class the character
 * did not have when they picked it.
 */
export function expandedSpellIdsFor(
  listId: string,
  character: ExpansionContext,
  rulepack: Rulepack,
): Set<string> {
  const ids = new Set<string>()
  for (const { def } of activeExpansions(character, rulepack)) {
    if (def.addTo !== listId && def.addTo !== ALL_LISTS) continue
    for (const id of def.spellIds ?? []) ids.add(id)
    if (def.classes?.length) {
      for (const spell of rulepack.spells) {
        if (spell.classes.some(c => def.classes!.includes(c))) ids.add(spell.id)
      }
    }
  }
  return ids
}

/**
 * Every spell id one list may draw from, or null where the list narrows nothing.
 *
 * A spell names the classes whose list it is on, so a cleric draws from cleric spells,
 * widened by whatever EXPAND_SPELL_LIST rules are in force — a Divine Soul's cleric
 * access, a guild background.
 *
 * Null is the answer for a source that owns no spells of its own: a race or background
 * grant, or a subclass caster filed under its parent class (an Eldritch Knight's source
 * is `fighter`, and no spell is a fighter spell). Those are not a narrow list, they are
 * no list — narrowing a fighter to the three spells their background added would hide
 * every wizard spell they exist to cast — so the caller offers everything instead.
 */
export function spellIdsForList(
  listId: string,
  character: ExpansionContext,
  rulepack: Rulepack,
): Set<string> | null {
  const own = rulepack.spells.filter(s => s.classes.includes(listId))
  if (own.length === 0) return null
  const ids = expandedSpellIdsFor(listId, character, rulepack)
  for (const spell of own) ids.add(spell.id)
  return ids
}

/**
 * The expansions in force, grouped for display: one entry per rule, so the sheet can
 * say *why* a list is wider than its class list.
 */
export function spellListExpansions(
  listId: string,
  character: ExpansionContext,
  rulepack: Rulepack,
): Array<{ label: string; spellIds: string[] }> {
  const out: Array<{ label: string; spellIds: string[] }> = []
  for (const { def, sourceName } of activeExpansions(character, rulepack)) {
    if (def.addTo !== listId && def.addTo !== ALL_LISTS) continue
    const ids = new Set(def.spellIds ?? [])
    if (def.classes?.length) {
      for (const spell of rulepack.spells) {
        if (spell.classes.some(c => def.classes!.includes(c))) ids.add(spell.id)
      }
    }
    if (ids.size > 0) {
      out.push({ label: def.label ?? sourceName ?? 'Expanded list', spellIds: [...ids] })
    }
  }
  return out
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
  if (!entry) return 0
  const casting = castingFor(entry, rulepack)
  const own = casting?.slotsAt(entry.level)
    // A pact caster is excluded from castingFor, but its own table still caps it.
    ?? classDef(classId, rulepack)?.levels.find(l => l.level === entry.level)?.spellSlots
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
  character: Pick<Character, 'classes' | 'spellLimitBonuses'>,
  rulepack: Rulepack,
  abilityMod: number,
): number | null {
  const entry = character.classes.find(c => c.classId === sourceId)
  if (!entry) return null

  const def = rulepack.classes.find(c => c.id === sourceId)
  if (!preparesSpells(def)) return null

  const divisor = def!.spellPreparation!.levelDivisor ?? 1
  const base = Math.max(1, abilityMod + Math.floor(entry.level / divisor))
  return Math.max(1, base + spellLimitBonusTotal(character, sourceId))
}

/**
 * How many spells a known-list class may have learned at its current level, read off its
 * own level table plus any manual bonus.
 *
 * Returns null for a class that prepares instead, or for a source with no class behind it.
 * Ranger 1 legitimately knows none, so 0 is a real answer and not the same as null.
 */
export function knownSpellLimit(
  sourceId: string,
  character: Pick<Character, 'classes' | 'spellLimitBonuses'>,
  rulepack: Rulepack,
): number | null {
  const entry = character.classes.find(c => c.classId === sourceId)
  if (!entry) return null

  const def = rulepack.classes.find(c => c.id === sourceId)
  // When the spellcasting comes from the subclass, so does the Spells Known column: a
  // fighter's own table names no number, but an Eldritch Knight's does.
  const sub = subclassOf(entry, rulepack)
  const known = def?.spellPreparation?.kind === 'known'
    ? def.levels.find(l => l.level === entry.level)?.spellsKnown
    : sub?.spellcasting?.preparation?.kind === 'known'
      ? sub.levels.find(l => l.level === entry.level)?.spellsKnown
      : undefined

  if (known === undefined) return null
  return Math.max(0, known + spellLimitBonusTotal(character, sourceId))
}

/** Whichever limit a spell list actually has, with what it currently holds. */
export interface SpellListLimit {
  kind: 'prepared' | 'known'
  used: number
  max: number
  bonus: number
}

/**
 * The one limit worth showing for a spell list: how many spells it may prepare, or how
 * many it may know. Null for a list with neither — a race or background grant, or a
 * known-list class whose table names no number at this level.
 *
 * Both kinds are reported the same way so the sheet renders one counter rather than two
 * near-identical ones. Which kind it is decides the label, since knowing you are at the
 * cap is what matters when swapping spells around at a table that allows it.
 */
export function spellListLimit(
  sourceId: string,
  character: Pick<Character, 'classes' | 'spells' | 'spellLimitBonuses'>,
  rulepack: Rulepack,
  abilityMod: number,
): SpellListLimit | null {
  const bonus = spellLimitBonusTotal(character, sourceId)

  const prepared = preparedSpellLimit(sourceId, character, rulepack, abilityMod)
  if (prepared !== null) {
    return {
      kind: 'prepared',
      used: preparedSpellCount(character, sourceId),
      max: prepared,
      bonus,
    }
  }

  const known = knownSpellLimit(sourceId, character, rulepack)
  if (known !== null) {
    return { kind: 'known', used: knownSpellCount(character, sourceId), max: known, bonus }
  }

  return null
}
