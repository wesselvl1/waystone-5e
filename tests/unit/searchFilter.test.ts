import { describe, it, expect } from 'vitest'
import { searchTerms, matchesSearch, filterBySearch } from '~/services/searchFilter'

describe('searchTerms', () => {
  it('splits on whitespace and lowercases', () => {
    expect(searchTerms('  Fire   Bolt ')).toEqual(['fire', 'bolt'])
  })

  it('is empty for a blank query', () => {
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('matchesSearch', () => {
  it('matches everything when the query is blank', () => {
    expect(matchesSearch('', 'Fireball')).toBe(true)
  })

  it('is case-insensitive on a substring', () => {
    expect(matchesSearch('BAL', 'Fireball')).toBe(true)
  })

  it('requires every term', () => {
    expect(matchesSearch('fire ice', 'Fireball')).toBe(false)
    expect(matchesSearch('fire evocation', 'Fireball', 'evocation')).toBe(true)
  })

  // Terms are matched independently, so a two-word query still finds a one-word name.
  it('matches a compound name from either half', () => {
    expect(matchesSearch('fire ball', 'Fireball')).toBe(true)
  })

  it('lets terms span different fields', () => {
    expect(matchesSearch('elf multiverse', 'High Elf', "Mordenkainen's Multiverse")).toBe(true)
  })

  it('ignores absent fields', () => {
    expect(matchesSearch('tough', 'Tough', undefined, null)).toBe(true)
  })
})

describe('filterBySearch', () => {
  const feats = [
    { name: 'Alert', prerequisite: undefined as string | undefined },
    { name: 'Grappler', prerequisite: 'Strength 13 or higher' },
    { name: 'Great Weapon Master', prerequisite: undefined },
  ]

  it('returns a copy of the whole list when the query is blank', () => {
    const all = filterBySearch(feats, '  ', f => [f.name])
    expect(all).toEqual(feats)
    expect(all).not.toBe(feats)
  })

  it('filters on any of the supplied fields', () => {
    expect(filterBySearch(feats, 'strength', f => [f.name, f.prerequisite]).map(f => f.name))
      .toEqual(['Grappler'])
  })

  it('narrows as terms are added', () => {
    expect(filterBySearch(feats, 'great', f => [f.name]).map(f => f.name))
      .toEqual(['Great Weapon Master'])
    expect(filterBySearch(feats, 'great axe', f => [f.name])).toEqual([])
  })
})
