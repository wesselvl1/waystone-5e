import { describe, it, expect } from 'vitest'
import { CharacterSchema } from '~/schemas/characterSchema'
import { validCharacter } from '../fixtures'

describe('CharacterSchema', () => {
  it('accepts a valid character', () => {
    const result = CharacterSchema.safeParse(validCharacter)
    expect(result.success).toBe(true)
  })

  it('rejects a character with no name', () => {
    const result = CharacterSchema.safeParse({ ...validCharacter, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an ability score above 30', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      abilityScores: { ...validCharacter.abilityScores, str: 31 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an ability score below 1', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      abilityScores: { ...validCharacter.abilityScores, con: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty classes array', () => {
    const result = CharacterSchema.safeParse({ ...validCharacter, classes: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a class level above 20', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 21 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a class level below 1', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative HP max', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      hp: { max: 0, current: 0, temp: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative currency', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      currency: { ...validCharacter.currency, gp: -1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects death saves above 3', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      deathSaves: { successes: 4, failures: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('strips unknown extra fields', () => {
    const result = CharacterSchema.safeParse({ ...validCharacter, unknownField: 'should be removed' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('unknownField' in result.data).toBe(false)
    }
  })
})
