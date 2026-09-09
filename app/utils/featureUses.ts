import type { Feature, FeatureUsesBonusSource } from '~/types/character'

/** Display order and labels for the bonus editor. */
export const FEATURE_USES_BONUS_SOURCES: ReadonlyArray<{
  key: FeatureUsesBonusSource
  label: string
  hint: string
}> = [
  { key: 'magic', label: 'Magic', hint: 'A magic item granting extra uses' },
  { key: 'feat', label: 'Feat', hint: 'A feat granting extra uses' },
  { key: 'misc', label: 'Misc', hint: 'Anything else, including a penalty' },
]

/**
 * Total of every manual bonus on a feature. Sources are kept apart rather than summed
 * into one field so the sheet can show where the extra uses come from, and so a feat
 * can later set its own entry without disturbing a magic item's.
 */
export function featureUsesBonusTotal(feature: Pick<Feature, 'usesBonuses'>): number {
  const bonuses = feature.usesBonuses
  if (!bonuses) return 0
  return Object.values(bonuses).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

/**
 * Effective maximum uses of a limited-use feature.
 *
 * `usesMax` is the class-derived base and is overwritten on every level-up by
 * UPDATE_FEATURE_USES. The bonuses are manual and never touched by levelling, so they
 * survive without being re-applied.
 *
 * Returns undefined when the feature has no cap at all, in which case a bonus is
 * meaningless: an unlimited feature cannot be made more unlimited.
 */
export function featureUsesMax(feature: Pick<Feature, 'usesMax' | 'usesBonuses'>): number | undefined {
  if (feature.usesMax === undefined) return undefined
  return Math.max(0, feature.usesMax + featureUsesBonusTotal(feature))
}

/**
 * Clamp `usesRemaining` into the effective range. Needed whenever the base or any bonus
 * moves: lowering a bonus must not leave more uses remaining than the feature now has,
 * and raising one must not silently top the feature up.
 */
export function clampFeatureUses(feature: Feature): Feature {
  const max = featureUsesMax(feature)
  if (max === undefined || feature.usesRemaining === undefined) return feature
  const clamped = Math.min(Math.max(0, feature.usesRemaining), max)
  return clamped === feature.usesRemaining ? feature : { ...feature, usesRemaining: clamped }
}

/**
 * Set one bonus source on a feature, keeping remaining uses in range. A source set to 0
 * is removed rather than stored, and an empty bonus map is dropped entirely, so a feature
 * that never had a bonus stays byte-identical in IndexedDB.
 */
export function setFeatureUsesBonus(
  feature: Feature,
  source: FeatureUsesBonusSource,
  value: number,
): Feature {
  const next = { ...(feature.usesBonuses ?? {}) }
  if (value === 0) delete next[source]
  else next[source] = value

  const { usesBonuses: _previous, ...rest } = feature
  const withBonuses: Feature = Object.keys(next).length > 0
    ? { ...rest, usesBonuses: next }
    : (rest as Feature)

  return clampFeatureUses(withBonuses)
}
