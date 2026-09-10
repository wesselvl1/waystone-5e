import { isChoiceSatisfied, type AbilityPicks } from '~/services/abilityScoreChoice'
import { raceAbilityBonuses } from '~/services/multiclass'
import type { AbilityKey, Character, HitDicePool, SpellSlots } from '~/types/character'
import type { AbilityScoreChoice, Race, Subrace } from '~/types/rulepack'

/**
 * Bring a stored character up to the current shape.
 *
 * Characters are read straight out of IndexedDB by the characters store, without passing
 * through CharacterSchema — validation only guards the import boundary. So a shape change
 * has to be applied here as well, or stored characters keep the old shape and break code
 * that assumes the new one. Both this and the schema's transform call into it, so there is
 * one implementation rather than two that can drift.
 *
 * Deliberately tolerant: it never rejects a character, because dropping someone's data on
 * a failed migration is worse than carrying a slightly odd record forward.
 */
export function migrateCharacterShape<T extends object>(raw: T): T {
  const src = raw as Record<string, unknown>
  const out = { ...src }

  out.otherProficiencies = migrateOtherProficiencies(src.otherProficiencies)
  out.hitDice = migrateHitDice(src.hitDice, src.classes)
  out.spellSlots = migrateSpellSlots(src.spellSlots)
  out.classSpellcasting = migrateSpellcasting(
    src.classSpellcasting,
    src.spells,
    src.classes,
    src.spellcastingAbility,
  )

  return out as T
}

/**
 * Guarantee the proficiency list.
 *
 * It is typed as required and dereferenced directly wherever it is used — `.join` on
 * the sheet's notes tab, `.push` on the GAIN_PROFICIENCY path — so a record stored
 * before the field existed threw out of whichever render reached it first, blanking a
 * whole tab. Defaulting it here fixes every one of those at once, which no single call
 * site can.
 *
 * A non-string entry is dropped rather than carried through to be rendered as
 * "[object Object]": the app only ever writes strings here.
 */
function migrateOtherProficiencies(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((p): p is string => typeof p === 'string')
}

type ClassLike = { classId?: unknown; level?: unknown }

function firstClassId(classes: unknown): string {
  if (!Array.isArray(classes)) return ''
  const first = classes[0] as ClassLike | undefined
  return typeof first?.classId === 'string' ? first.classId : ''
}

/**
 * The old shape was a single pool with one die size, which cannot describe a d10 fighter
 * plus a d6 wizard. Every die is attributed to the first class: the old record only held
 * one die size, so a multiclass character could not have been represented anyway.
 */
function migrateHitDice(hitDice: unknown, classes: unknown): HitDicePool[] {
  if (Array.isArray(hitDice)) return hitDice as HitDicePool[]
  if (!hitDice || typeof hitDice !== 'object') return []

  const old = hitDice as { total?: unknown; remaining?: unknown; die?: unknown }
  const total = typeof old.total === 'number' ? old.total : 0
  if (total <= 0) return []

  return [{
    classId: firstClassId(classes),
    die: typeof old.die === 'string' ? old.die : 'd8',
    total,
    remaining: typeof old.remaining === 'number' ? old.remaining : total,
  }]
}

/** `max` used to be stored; it is derived from the caster level now, so only `used` and `bonus` survive. */
function migrateSpellSlots(spellSlots: unknown): SpellSlots {
  if (!spellSlots || typeof spellSlots !== 'object') return {}
  const out: Record<string, { used: number; bonus?: number }> = {}
  for (const [level, state] of Object.entries(spellSlots as Record<string, unknown>)) {
    if (!state || typeof state !== 'object') continue
    const s = state as { used?: unknown; bonus?: unknown }
    const used = typeof s.used === 'number' ? s.used : 0
    out[level] = typeof s.bonus === 'number' ? { used, bonus: s.bonus } : { used }
  }
  return out as SpellSlots
}

/**
 * Group the flat spells array into per-source lists. Entries already carry a classId, so
 * grouping is mostly lossless; anything without one goes to the first class rather than
 * being dropped. Lists that are already populated are left alone, so this runs once.
 */
function migrateSpellcasting(
  existing: unknown,
  spells: unknown,
  classes: unknown,
  fallbackAbility: unknown,
): Record<string, { ability: string; spells: unknown[] }> {
  const out = (existing && typeof existing === 'object'
    ? { ...(existing as Record<string, { ability: string; spells: unknown[] }>) }
    : {})

  const alreadyGrouped = Object.values(out).some(v => Array.isArray(v?.spells) && v.spells.length > 0)
  if (alreadyGrouped || !Array.isArray(spells) || spells.length === 0) return out

  const fallbackClass = firstClassId(classes) || 'unknown'
  const ability = typeof fallbackAbility === 'string' ? fallbackAbility : 'int'

  for (const spell of spells) {
    const entry = spell as { classId?: unknown }
    const key = typeof entry?.classId === 'string' ? entry.classId : fallbackClass
    const bucket = out[key]
    if (bucket) bucket.spells = [...bucket.spells, spell]
    else out[key] = { ability, spells: [spell] }
  }
  return out
}

// ── racial ability increases ──────────────────────────────────────────────────
// These need the character's race, which `migrateCharacterShape` has no way to reach:
// it runs at the import boundary and inside the store, neither of which can be sure a
// rulepack is loaded. So they take the race explicitly and are called from the sheet,
// alongside `repairFeatures` — after the packs are in — rather than being folded above.

/**
 * Fold a race's FIXED ability increases into a character that never received them.
 *
 * Creation used to store the base scores while showing the player the bonused ones, so
 * every character made before that was fixed is short its racial increases. Absence of
 * `appliedRacialBonuses` is the only evidence of that, since the scores themselves cannot
 * say whether a bonus is in them already.
 *
 * Only the fixed half is recoverable. What the player would have distributed is a decision
 * nobody recorded, and inventing it would silently change their character, so it is left
 * to them — `outstandingRacialChoice` is what surfaces it.
 *
 * Returns the character untouched when there is nothing to do, so a caller can skip the
 * save. A race none of the loaded packs know is left unmarked rather than marked done,
 * so opening a character before its pack loads does not strand it.
 */
export function backfillRacialBonuses(
  character: Character,
  race: Race | undefined,
  subrace: Subrace | undefined,
): Character {
  if (character.appliedRacialBonuses || !race) return character

  const { bonuses } = raceAbilityBonuses(race, subrace)
  const abilityScores = { ...character.abilityScores }
  for (const [k, v] of Object.entries(bonuses)) {
    const key = k as AbilityKey
    abilityScores[key] = Math.min(20, abilityScores[key] + (v ?? 0))
  }
  // Marked even when the race fixes nothing: the back-fill has run, and a race that
  // leaves its whole line to the player has nothing here to find later.
  return { ...character, abilityScores, appliedRacialBonuses: { ...bonuses } }
}

/** What `appliedRacialBonuses` holds beyond the fixed bonuses — i.e. what was distributed. */
function distributedPart(
  character: Character,
  fixed: Partial<Record<AbilityKey, number>>,
): AbilityPicks {
  const picks: AbilityPicks = {}
  for (const [k, v] of Object.entries(character.appliedRacialBonuses ?? {})) {
    const key = k as AbilityKey
    const extra = (v ?? 0) - (fixed[key] ?? 0)
    if (extra > 0) picks[key] = extra
  }
  return picks
}

/**
 * The increases a character's race leaves to the player, while they are still unspent.
 *
 * Derived rather than stored: whatever `appliedRacialBonuses` holds above the fixed
 * bonuses is what was distributed, and the choice stands open until that satisfies one of
 * its distributions. A character built through the wizard has already answered it, so this
 * is undefined for them.
 */
export function outstandingRacialChoice(
  character: Character,
  race: Race | undefined,
  subrace: Subrace | undefined,
): AbilityScoreChoice | undefined {
  const { bonuses, choice } = raceAbilityBonuses(race, subrace)
  if (!choice) return undefined
  return isChoiceSatisfied(choice, distributedPart(character, bonuses)) ? undefined : choice
}

/**
 * The patch that spends an outstanding racial choice.
 *
 * Adds the picks to the scores and to the record of the grant. The record takes the pick
 * as offered rather than what the 20 cap left room for, so a capped increase does not
 * leave the choice looking unanswered and prompt for it again.
 */
export function racialChoicePatch(character: Character, picks: AbilityPicks): Partial<Character> {
  const abilityScores = { ...character.abilityScores }
  const appliedRacialBonuses = { ...(character.appliedRacialBonuses ?? {}) }
  for (const [k, v] of Object.entries(picks)) {
    const key = k as AbilityKey
    abilityScores[key] = Math.min(20, abilityScores[key] + (v ?? 0))
    appliedRacialBonuses[key] = (appliedRacialBonuses[key] ?? 0) + (v ?? 0)
  }
  return { abilityScores, appliedRacialBonuses }
}
