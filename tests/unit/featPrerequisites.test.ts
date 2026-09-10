import { describe, it, expect } from 'vitest'
import { checkFeatPrerequisite } from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { FeatDefinition } from '~/types/rulepack'

/** Only the fields the check reads; the rest is irrelevant to it. */
function character(over: Record<string, unknown> = {}): Character {
  return {
    abilityScores: { str: 13, dex: 10, con: 12, int: 15, wis: 8, cha: 10 },
    otherProficiencies: ['Longsword', "Smith's Tools"],
    ...over,
  } as unknown as Character
}

function feat(prerequisiteCheck?: FeatDefinition['prerequisiteCheck']): FeatDefinition {
  return { id: 'f', name: 'F', description: '', prerequisiteCheck } as FeatDefinition
}

describe('what the prerequisites actually check', () => {
  it('passes a feat that declares none', () => {
    expect(checkFeatPrerequisite(character(), feat())).toBe(true)
  })

  it('compares an ability against its minimum', () => {
    expect(checkFeatPrerequisite(character(), feat({ minAbilityScore: { int: 13 } }))).toBe(true)
    expect(checkFeatPrerequisite(character(), feat({ minAbilityScore: { wis: 13 } }))).toBe(false)
  })

  it('requires every named minimum, not just one', () => {
    const both = feat({ minAbilityScore: { int: 13, wis: 13 } })
    expect(checkFeatPrerequisite(character(), both)).toBe(false)
  })

  it('requires a spellcasting ability for a caster-only feat', () => {
    const casterOnly = feat({ spellcasting: true })
    expect(checkFeatPrerequisite(character(), casterOnly)).toBe(false)
    expect(checkFeatPrerequisite(character({ spellcastingAbility: 'int' }), casterOnly)).toBe(true)
  })

  it('takes any one of the listed proficiencies', () => {
    const p = feat({ proficiency: ['Shortsword', 'Longsword'] })
    expect(checkFeatPrerequisite(character(), p)).toBe(true)
  })

  it('matches a proficiency regardless of case', () => {
    expect(checkFeatPrerequisite(character(), feat({ proficiency: ['LONGSWORD'] }))).toBe(true)
  })

  it('fails when none of the listed proficiencies is held', () => {
    expect(checkFeatPrerequisite(character(), feat({ proficiency: ['Heavy Armor'] }))).toBe(false)
  })
})

/**
 * The check runs inside the feat picker's `v-for`, so throwing here blanked the entire
 * list. Every one of these used to be an exception rather than a false.
 */
describe('tolerance of a partial character', () => {
  it('survives a character with no proficiency array', () => {
    const c = character({ otherProficiencies: undefined })
    expect(() => checkFeatPrerequisite(c, feat({ proficiency: ['Longsword'] }))).not.toThrow()
    expect(checkFeatPrerequisite(c, feat({ proficiency: ['Longsword'] }))).toBe(false)
  })

  it('still answers the other checks for that character', () => {
    const c = character({ otherProficiencies: undefined })
    expect(checkFeatPrerequisite(c, feat({ minAbilityScore: { int: 13 } }))).toBe(true)
    expect(checkFeatPrerequisite(c, feat())).toBe(true)
  })

  it('survives a character with no ability scores', () => {
    const c = character({ abilityScores: undefined })
    expect(checkFeatPrerequisite(c, feat({ minAbilityScore: { int: 13 } }))).toBe(false)
    expect(checkFeatPrerequisite(c, feat())).toBe(true)
  })

  it('survives an all-but-empty character', () => {
    const c = {} as Character
    expect(checkFeatPrerequisite(c, feat({ minAbilityScore: { int: 13 } }))).toBe(false)
    expect(checkFeatPrerequisite(c, feat({ proficiency: ['Longsword'] }))).toBe(false)
    expect(checkFeatPrerequisite(c, feat({ spellcasting: true }))).toBe(false)
    expect(checkFeatPrerequisite(c, feat())).toBe(true)
  })

  it('survives a non-string in the proficiency list', () => {
    const c = character({ otherProficiencies: [null, 'Longsword'] })
    expect(checkFeatPrerequisite(c, feat({ proficiency: ['Longsword'] }))).toBe(true)
  })

  /** A pack built in code never passes through Zod, so the shape is not guaranteed. */
  it('survives a prerequisite whose proficiency is not a list', () => {
    const odd = { proficiency: 'Longsword' } as unknown as FeatDefinition['prerequisiteCheck']
    expect(() => checkFeatPrerequisite(character(), feat(odd))).not.toThrow()
  })

  /**
   * Read as a list of alternatives, an empty one is a requirement nothing satisfies —
   * which hid the feat permanently instead of asking nothing of the character.
   */
  it('treats an empty proficiency list as no requirement', () => {
    expect(checkFeatPrerequisite(character(), feat({ proficiency: [] }))).toBe(true)
  })
})
