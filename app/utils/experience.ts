/**
 * Experience thresholds for character levels 1–20 (SRD 5.1, "Beyond 1st Level").
 * Index 0 holds level 1, so a level's threshold is `XP_THRESHOLDS[level - 1]`.
 *
 * This is one of the few rules kept in code rather than in a rulepack: the table is not
 * part of `RulepackSchema`, and a book reprinting it would be restating core progression
 * rather than adding content.
 */
export const XP_THRESHOLDS: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]

/** The highest level the table covers. */
export const MAX_LEVEL = XP_THRESHOLDS.length

export interface XpProgress {
  /** The level the bar is measured from — the character's own, not one derived from XP. */
  level: number
  /** XP at which `level` began. */
  levelStart: number
  /** The next level, absent at level 20. */
  nextLevel?: number
  /** XP the next level needs, absent at level 20. */
  nextLevelAt?: number
  /** XP earned since `level` began, clamped to the band. */
  into: number
  /** XP the whole band spans, absent at level 20. */
  span?: number
  /** Fill of the bar, 0–1. Level 20 is always full. */
  fraction: number
  /** Whether the character has earned enough XP to advance. */
  canLevelUp: boolean
}

/** The highest level whose threshold `xp` has reached. */
export function levelForXp(xp: number): number {
  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]!) level = i + 1
  }
  return level
}

/**
 * Progress toward the next level.
 *
 * The band is anchored on the character's *actual* total level rather than on a level
 * derived from XP, because levelling up is a deliberate trip through the wizard: a player
 * who has banked enough XP but not spent it should see a full bar and `canLevelUp`, not a
 * bar that has silently jumped to the band above.
 */
export function xpProgress(xp: number, totalLevel: number): XpProgress {
  const level = Math.min(Math.max(Math.trunc(totalLevel) || 1, 1), MAX_LEVEL)
  const earned = Math.max(0, xp)
  const levelStart = XP_THRESHOLDS[level - 1]!

  if (level >= MAX_LEVEL) {
    return { level, levelStart, into: earned - levelStart, fraction: 1, canLevelUp: false }
  }

  const nextLevelAt = XP_THRESHOLDS[level]!
  const span = nextLevelAt - levelStart
  const into = Math.min(Math.max(earned - levelStart, 0), span)
  return {
    level,
    levelStart,
    nextLevel: level + 1,
    nextLevelAt,
    into,
    span,
    fraction: span > 0 ? into / span : 1,
    canLevelUp: earned >= nextLevelAt,
  }
}
