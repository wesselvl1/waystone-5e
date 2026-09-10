import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  choiceSummary,
  distributionLabel,
  distributionPrompt,
  isChoiceSatisfied,
  matchedDistribution,
  orderedAmounts,
} from '~/services/abilityScoreChoice'
import type { AbilityScoreChoice } from '~/types/rulepack'

const ALL = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

/** Monsters of the Multiverse: "+2 and +1, or +1 to three different scores". */
const CUSTOM_ORIGIN: AbilityScoreChoice = {
  from: [...ALL],
  distributions: [[2, 1], [1, 1, 1]],
}
/** The half-elf's "+1 to two ability scores of your choice". */
const HALF_ELF: AbilityScoreChoice = {
  from: ['str', 'dex', 'con', 'int', 'wis'],
  distributions: [[1, 1]],
}
/** Custom Lineage: "one ability score of your choice increases by 2". */
const CUSTOM_LINEAGE: AbilityScoreChoice = { from: [...ALL], distributions: [[2]] }

describe('the shape a single bonus could not express', () => {
  it('offers both of the Multiverse rule shapes', () => {
    expect(CUSTOM_ORIGIN.distributions).toHaveLength(2)
    expect(orderedAmounts(CUSTOM_ORIGIN.distributions[0]!)).toEqual([2, 1])
  })

  it('accepts +2 to one ability and +1 to another', () => {
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { int: 2, cha: 1 })).toBe(true)
  })

  it('accepts +1 to three different abilities', () => {
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { str: 1, dex: 1, con: 1 })).toBe(true)
  })

  it('rejects mixing the two shapes', () => {
    // +2, +1 and +1 is neither of the printed options
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { int: 2, cha: 1, wis: 1 })).toBe(false)
  })

  it('rejects a half-spent answer', () => {
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { int: 2 })).toBe(false)
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { str: 1, dex: 1 })).toBe(false)
  })

  it('names which shape an answer spent', () => {
    expect(matchedDistribution(CUSTOM_ORIGIN, { int: 2, cha: 1 })).toEqual([2, 1])
    expect(matchedDistribution(CUSTOM_ORIGIN, { str: 1, dex: 1, con: 1 })).toEqual([1, 1, 1])
  })

  /**
   * The two increases land on different abilities by construction — the answer is keyed
   * by ability — so "+2 and +1 to the same score" cannot be stated, let alone accepted.
   */
  it('cannot double up on one ability', () => {
    expect(isChoiceSatisfied(CUSTOM_ORIGIN, { int: 3 })).toBe(false)
  })
})

describe('the shapes that already worked', () => {
  it('still takes the half-elf two +1s', () => {
    expect(isChoiceSatisfied(HALF_ELF, { str: 1, wis: 1 })).toBe(true)
    expect(isChoiceSatisfied(HALF_ELF, { str: 1 })).toBe(false)
  })

  it('keeps a race bonus out of the pool it excludes', () => {
    // The half-elf's fixed +2 Charisma is not on offer a second time
    expect(isChoiceSatisfied(HALF_ELF, { cha: 1, str: 1 })).toBe(false)
  })

  it('takes Custom Lineage +2 to one ability', () => {
    expect(isChoiceSatisfied(CUSTOM_LINEAGE, { con: 2 })).toBe(true)
    expect(isChoiceSatisfied(CUSTOM_LINEAGE, { con: 1 })).toBe(false)
  })

  it('treats a race with no choice as answered', () => {
    expect(isChoiceSatisfied(undefined, {})).toBe(true)
  })

  it('ignores an ability left at zero', () => {
    expect(isChoiceSatisfied(HALF_ELF, { str: 1, wis: 1, con: 0 })).toBe(true)
  })
})

describe('how a distribution reads', () => {
  it('labels a mixed shape by its bonuses, largest first', () => {
    expect(distributionLabel([1, 2])).toBe('+2/+1')
  })

  it('counts a shape whose bonuses are all one size', () => {
    expect(distributionLabel([1, 1, 1])).toBe('+1 ×3')
    expect(distributionLabel([2])).toBe('+2')
  })

  it('offers both shapes on one line', () => {
    expect(choiceSummary(CUSTOM_ORIGIN)).toBe('+2/+1 or +1 ×3')
    expect(choiceSummary(HALF_ELF)).toBe('+1 ×2')
  })

  it('keeps the wording the feat picker has always used', () => {
    expect(distributionPrompt([1])).toBe('Choose an ability score to increase by +1:')
    expect(distributionPrompt([1, 1])).toBe('Choose 2 ability scores to increase by +1 each:')
  })

  it('spells out a mixed distribution', () => {
    expect(distributionPrompt([2, 1]))
      .toBe('Distribute +2 and +1 among two different ability scores:')
  })
})

describe('schema', () => {
  const parseRace = (choice: unknown) => RulepackSchema.safeParse({
    id: 'p',
    name: 'P',
    version: '1',
    races: [{
      id: 'r',
      name: 'R',
      size: 'medium',
      speeds: { walk: 30 },
      abilityScoreBonuses: {},
      traits: [],
      languages: [],
      abilityScoreChoice: choice,
    }],
  })

  it('round-trips two distributions', () => {
    const r = parseRace(CUSTOM_ORIGIN)
    expect(r.success && r.data.races[0]!.abilityScoreChoice)
      .toEqual({ from: [...ALL], distributions: [[2, 1], [1, 1, 1]] })
  })

  it('rejects a distribution asking for more abilities than the pool holds', () => {
    // "+1 to three" cannot be spent out of two abilities
    expect(parseRace({ from: ['dex', 'cha'], distributions: [[1, 1, 1]] }).success).toBe(false)
  })

  it('rejects an empty distribution list', () => {
    expect(parseRace({ from: [...ALL], distributions: [] }).success).toBe(false)
  })

  it('rejects an empty distribution', () => {
    expect(parseRace({ from: [...ALL], distributions: [[]] }).success).toBe(false)
  })

  it('rejects a zero bonus, which would grant nothing', () => {
    expect(parseRace({ from: [...ALL], distributions: [[0]] }).success).toBe(false)
  })

  /** The old shape said the same thing three fields at a time; it must not linger. */
  it('drops the superseded count/bonus spelling', () => {
    const r = parseRace({ count: 2, from: ['dex', 'cha'], bonus: 1 })
    expect(r.success).toBe(false)
  })
})
