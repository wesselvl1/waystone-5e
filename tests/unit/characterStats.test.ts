import { describe, it, expect } from 'vitest'
import { abilityMod, proficiencyBonus } from '~/composables/useCharacterStats'

describe('abilityMod', () => {
  it('returns 0 for a score of 10', () => {
    expect(abilityMod(10)).toBe(0)
  })

  it('returns 0 for a score of 11', () => {
    expect(abilityMod(11)).toBe(0)
  })

  it('returns -1 for a score of 8', () => {
    expect(abilityMod(8)).toBe(-1)
  })

  it('returns -1 for a score of 9', () => {
    expect(abilityMod(9)).toBe(-1)
  })

  it('returns -5 for a score of 1 (minimum)', () => {
    expect(abilityMod(1)).toBe(-5)
  })

  it('returns +2 for a score of 15', () => {
    expect(abilityMod(15)).toBe(2)
  })

  it('returns +3 for a score of 16', () => {
    expect(abilityMod(16)).toBe(3)
  })

  it('returns +5 for a score of 20', () => {
    expect(abilityMod(20)).toBe(5)
  })

  it('returns +10 for a score of 30 (maximum)', () => {
    expect(abilityMod(30)).toBe(10)
  })
})

describe('proficiencyBonus', () => {
  it.each([
    [1, 2], [4, 2],  // tier 1: levels 1-4
    [5, 3], [8, 3],  // tier 2: levels 5-8
    [9, 4], [12, 4], // tier 3: levels 9-12
    [13, 5], [16, 5], // tier 4: levels 13-16
    [17, 6], [20, 6], // tier 5: levels 17-20
  ] as [number, number][])('level %i → +%i', (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected)
  })
})
