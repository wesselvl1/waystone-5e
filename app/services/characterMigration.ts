import type { Character, HitDicePool, SpellSlots } from '~/types/character'

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
