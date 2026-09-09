import { describe, it, expect } from 'vitest'
import { importCharacter } from '~/services/characterIO'
import { validCharacter } from '../fixtures'

describe('importCharacter', () => {
  it('parses and returns a valid character from a JSON string', async () => {
    const json = JSON.stringify(validCharacter)
    const result = await importCharacter(json)
    expect(result.id).toBe(validCharacter.id)
    expect(result.name).toBe(validCharacter.name)
  })

  it('throws on malformed JSON string', async () => {
    await expect(importCharacter('{not valid json')).rejects.toThrow('Invalid JSON string')
  })

  it('throws when JSON is valid but fails schema validation', async () => {
    const invalid = { ...validCharacter, name: '', classes: [] }
    await expect(importCharacter(JSON.stringify(invalid))).rejects.toThrow('Character validation failed')
  })

  it('throws when a required field is missing', async () => {
    const { abilityScores: _, ...missing } = validCharacter as Record<string, unknown>
    await expect(importCharacter(JSON.stringify(missing))).rejects.toThrow('Character validation failed')
  })

  it('strips unknown extra fields', async () => {
    const withExtra = { ...validCharacter, extraField: 'should be stripped' }
    const result = await importCharacter(JSON.stringify(withExtra))
    expect('extraField' in result).toBe(false)
  })
})
