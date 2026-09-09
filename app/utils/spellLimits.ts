import type { Character, FeatureUsesBonusSource, FeatureUsesBonuses } from '~/types/character'

/** Display order and labels for the spell-limit bonus editor. */
export const SPELL_LIMIT_BONUS_SOURCES: ReadonlyArray<{
  key: FeatureUsesBonusSource
  label: string
  hint: string
}> = [
  { key: 'magic', label: 'Magic', hint: 'A magic item raising the limit' },
  { key: 'feat', label: 'Feat', hint: 'A feat raising the limit' },
  { key: 'misc', label: 'Misc', hint: 'Anything else, including a penalty' },
]

/** Total of every manual bonus on one spell list's limit, prepared or known. */
export function spellLimitBonusTotal(
  character: Pick<Character, 'spellLimitBonuses'>,
  sourceId: string,
): number {
  const bonuses = character.spellLimitBonuses?.[sourceId]
  if (!bonuses) return 0
  return Object.values(bonuses).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

/**
 * Set one bonus source on one spell list's limit, returning the whole
 * `spellLimitBonuses` record to persist.
 *
 * A source set to 0 is removed and an empty map is dropped, so a character who never
 * had a bonus stays byte-identical in IndexedDB — the same rule the feature-use editor
 * follows.
 */
export function setSpellLimitBonus(
  character: Pick<Character, 'spellLimitBonuses'>,
  sourceId: string,
  source: FeatureUsesBonusSource,
  value: number,
): Record<string, FeatureUsesBonuses> | undefined {
  const forSource = { ...(character.spellLimitBonuses?.[sourceId] ?? {}) }
  if (value === 0) delete forSource[source]
  else forSource[source] = value

  const next = { ...(character.spellLimitBonuses ?? {}) }
  if (Object.keys(forSource).length > 0) next[sourceId] = forSource
  else delete next[sourceId]

  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * How many of a list's spells are currently prepared.
 *
 * Cantrips are always available and never count. Neither do always-prepared spells — a
 * domain or circle spell is granted on top of the limit, not out of it.
 */
export function preparedSpellCount(
  character: Pick<Character, 'spells'>,
  sourceId: string,
): number {
  return character.spells.filter(s =>
    s.classId === sourceId && s.level > 0 && s.prepared && !s.alwaysPrepared).length
}

/**
 * How many spells a known-list class has learned.
 *
 * Cantrips are counted separately by the SRD and never against spells known. An
 * always-prepared spell was granted rather than chosen, so it does not count either —
 * the same rule as the prepared count, which keeps the two counters comparable.
 */
export function knownSpellCount(
  character: Pick<Character, 'spells'>,
  sourceId: string,
): number {
  return character.spells.filter(s =>
    s.classId === sourceId && s.level > 0 && !s.alwaysPrepared).length
}
