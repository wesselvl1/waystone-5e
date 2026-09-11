import { describe, it, expect } from 'vitest'
import { levelForXp, xpProgress, XP_THRESHOLDS, MAX_LEVEL } from '~/utils/experience'

describe('levelForXp', () => {
  it('starts at level 1 and steps on each threshold', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(299)).toBe(1)
    expect(levelForXp(300)).toBe(2)
    expect(levelForXp(2700)).toBe(4)
  })

  it('caps at the top of the table', () => {
    expect(levelForXp(XP_THRESHOLDS[MAX_LEVEL - 1]! + 10_000)).toBe(MAX_LEVEL)
  })
})

describe('xpProgress', () => {
  it('measures the band of the level the character actually has, not the one the XP implies', () => {
    // 1,800 XP is level 3 by the table, but a character who has not levelled up yet is
    // still level 2 — the bar fills its band and says a level-up is waiting.
    const p = xpProgress(1800, 2)
    expect(p.level).toBe(2)
    expect(p.nextLevelAt).toBe(900)
    expect(p.fraction).toBe(1)
    expect(p.canLevelUp).toBe(true)
  })

  it('fills proportionally inside a band', () => {
    const p = xpProgress(1800, 3) // half way from 900 to 2,700
    expect(p.into).toBe(900)
    expect(p.span).toBe(1800)
    expect(p.fraction).toBeCloseTo(0.5)
    expect(p.canLevelUp).toBe(false)
  })

  it('is empty at the very start of a level', () => {
    expect(xpProgress(900, 3).fraction).toBe(0)
  })

  it('is full and final at level 20', () => {
    const p = xpProgress(400_000, 20)
    expect(p.fraction).toBe(1)
    expect(p.nextLevelAt).toBeUndefined()
    expect(p.canLevelUp).toBe(false)
  })

  it('survives a level outside the table and negative XP', () => {
    expect(xpProgress(0, 0).level).toBe(1)
    expect(xpProgress(-50, 1).fraction).toBe(0)
    expect(xpProgress(0, 25).level).toBe(MAX_LEVEL)
  })
})
