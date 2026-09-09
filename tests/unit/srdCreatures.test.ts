import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { CreatureDefinition, CreatureFilter } from '~/types/rulepack'
import fragment from '~/data/srd/beasts.json'

const pack = RulepackSchema.parse(fragment)
const creatures = pack.creatures as CreatureDefinition[]

/**
 * Mirrors useRulepacksStore().getCreaturesMatching. The store itself relies on Nuxt
 * auto-imports and a Pinia instance, so the filter logic is duplicated here rather
 * than imported — keep the two in step.
 */
function matching(filter: CreatureFilter): CreatureDefinition[] {
  if (filter.ids) {
    const wanted = new Set(filter.ids)
    return creatures.filter(c => wanted.has(c.id))
  }
  return creatures.filter((c) => {
    if (filter.types && !filter.types.includes(c.type)) return false
    if (filter.sizes && !filter.sizes.includes(c.size)) return false
    if (filter.maxCR !== undefined && c.challengeRating > filter.maxCR) return false
    if (filter.minCR !== undefined && c.challengeRating < filter.minCR) return false
    if (filter.allowSwim === false && (c.speeds.swim ?? 0) > 0) return false
    if (filter.allowFly === false && (c.speeds.fly ?? 0) > 0) return false
    return true
  })
}

describe('SRD beast statblocks', () => {
  it('validates against RulepackSchema', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(creatures).toHaveLength(87)
  })

  it('declares no other content, so load order does not matter', () => {
    expect(pack.classes).toEqual([])
    expect(pack.races).toEqual([])
    expect(pack.spells).toEqual([])
    expect(pack.subclasses).toEqual([])
    expect(pack.subraces).toEqual([])
  })

  it('is entirely beasts', () => {
    expect([...new Set(creatures.map(c => c.type))]).toEqual(['beast'])
  })

  it('gives every creature a usable statblock', () => {
    for (const c of creatures) {
      expect(c.id, c.name).toMatch(/^[a-z0-9-]+$/)
      expect(c.hitPoints, c.name).toBeGreaterThan(0)
      expect(c.armorClass, c.name).toBeGreaterThan(0)
      expect(c.hitDice, c.name).toMatch(/^\d+d\d+/)
      expect(Object.keys(c.speeds).length, c.name).toBeGreaterThan(0)
      for (const score of Object.values(c.abilityScores)) {
        expect(score, c.name).toBeGreaterThan(0)
      }
    }
  })

  it('has unique ids', () => {
    const ids = creatures.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses the SRD fractional CR values', () => {
    const crs = [...new Set(creatures.map(c => c.challengeRating))].sort((a, b) => a - b)
    expect(crs).toEqual([0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('creature filter', () => {
  it('matches the SRD druid Wild Shape progression', () => {
    // Level 2: CR 1/4, no swim and no fly
    const l2 = matching({ types: ['beast'], maxCR: 0.25, allowSwim: false, allowFly: false })
    expect(l2.every(c => c.challengeRating <= 0.25)).toBe(true)
    expect(l2.every(c => !c.speeds.swim && !c.speeds.fly)).toBe(true)
    expect(l2.length).toBeGreaterThan(0)

    // Level 4: CR 1/2, swimming allowed, still no fly
    const l4 = matching({ types: ['beast'], maxCR: 0.5, allowFly: false })
    expect(l4.every(c => !c.speeds.fly)).toBe(true)
    expect(l4.length).toBeGreaterThan(l2.length)

    // Level 8: CR 1, everything allowed
    const l8 = matching({ types: ['beast'], maxCR: 1 })
    expect(l8).toHaveLength(70)
    expect(l8.length).toBeGreaterThan(l4.length)
  })

  it('opens up as the CR ceiling rises, for a future Moon Druid', () => {
    // Circle of the Moon uses druid level / 3, so the ceiling goes past CR 1.
    // Nothing here caps CR, which is the point of keeping the limits in data.
    const counts = [1, 2, 3, 4, 5, 6].map(cr => matching({ types: ['beast'], maxCR: cr }).length)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!)
    }
    expect(counts.at(-1)!).toBeGreaterThan(counts[0]!)
  })

  it('treats unset movement gates as unrestricted', () => {
    // A filter that says nothing about swim/fly must not exclude swimmers or fliers,
    // so a Moon Druid fragment can simply omit them.
    const unrestricted = matching({ types: ['beast'], maxCR: 1 })
    expect(unrestricted.some(c => (c.speeds.swim ?? 0) > 0)).toBe(true)
    expect(unrestricted.some(c => (c.speeds.fly ?? 0) > 0)).toBe(true)
  })

  it('lets an explicit id list short-circuit the other fields', () => {
    // Find Familiar names its forms rather than describing them.
    const familiars = ['bat', 'cat', 'crab', 'frog', 'hawk', 'lizard', 'octopus',
                       'owl', 'poisonous-snake', 'rat', 'raven', 'spider', 'weasel']
    const found = matching({ ids: familiars })
    const missing = familiars.filter(id => !found.some(c => c.id === id))
    expect(missing, 'SRD familiar forms absent from the bestiary').toEqual([])
  })

  it('returns nothing for a type the pack does not carry yet', () => {
    // Elementals arrive with the conjure spells; the filter must not throw meanwhile.
    expect(matching({ types: ['elemental'], maxCR: 5 })).toEqual([])
  })

  it('filters by size', () => {
    const tiny = matching({ types: ['beast'], sizes: ['tiny'] })
    expect(tiny.length).toBeGreaterThan(0)
    expect(tiny.every(c => c.size === 'tiny')).toBe(true)
  })
})
