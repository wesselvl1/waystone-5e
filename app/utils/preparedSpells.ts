import type { Character, FeatureUsesBonusSource, FeatureUsesBonuses } from '~/types/character'

/** Display order and labels for the prepared-limit bonus editor. */
export const PREPARED_BONUS_SOURCES: ReadonlyArray<{
  key: FeatureUsesBonusSource
  label: string
  hint: string
}> = [
  { key: 'magic', label: 'Magic', hint: 'A magic item letting you prepare more' },
  { key: 'feat', label: 'Feat', hint: 'A feat letting you prepare more' },
  { key: 'misc', label: 'Misc', hint: 'Anything else, including a penalty' },
]

/** Total of every manual bonus on one source's prepared-spell limit. */
export function preparedBonusTotal(
  character: Pick<Character, 'preparedBonuses'>,
  sourceId: string,
): number {
  const bonuses = character.preparedBonuses?.[sourceId]
  if (!bonuses) return 0
  return Object.values(bonuses).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

/**
 * Set one bonus source on one spell list's prepared limit, returning the whole
 * `preparedBonuses` record to persist.
 *
 * A source set to 0 is removed and an empty map is dropped, so a character who never
 * had a bonus stays byte-identical in IndexedDB — the same rule the feature-use editor
 * follows.
 */
export function setPreparedBonus(
  character: Pick<Character, 'preparedBonuses'>,
  sourceId: string,
  source: FeatureUsesBonusSource,
  value: number,
): Record<string, FeatureUsesBonuses> | undefined {
  const forSource = { ...(character.preparedBonuses?.[sourceId] ?? {}) }
  if (value === 0) delete forSource[source]
  else forSource[source] = value

  const next = { ...(character.preparedBonuses ?? {}) }
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
