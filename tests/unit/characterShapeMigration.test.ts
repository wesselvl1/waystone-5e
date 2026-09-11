import { describe, it, expect } from 'vitest'
import { migrateCharacterShape } from '~/services/characterMigration'

describe('the proficiency list is guaranteed', () => {
  it('defaults a record that has none', () => {
    const out = migrateCharacterShape({ name: 'Old' } as object) as { otherProficiencies: string[] }
    expect(out.otherProficiencies).toEqual([])
  })

  it('keeps one that is already there', () => {
    const out = migrateCharacterShape({ otherProficiencies: ['Longsword', "Smith's Tools"] }) as { otherProficiencies: string[] }
    expect(out.otherProficiencies).toEqual(['Longsword', "Smith's Tools"])
  })

  /** `.join` and `.toLowerCase()` are called on these directly. */
  it('drops an entry that is not a string', () => {
    const out = migrateCharacterShape({ otherProficiencies: [null, 'Longsword', { x: 1 }] }) as { otherProficiencies: string[] }
    expect(out.otherProficiencies).toEqual(['Longsword'])
  })

  it('replaces a value that is not a list at all', () => {
    const out = migrateCharacterShape({ otherProficiencies: 'Longsword' }) as { otherProficiencies: string[] }
    expect(out.otherProficiencies).toEqual([])
  })

  it('leaves the rest of the record alone', () => {
    const out = migrateCharacterShape({ name: 'Keep', notes: 'mine' }) as { name: string; notes: string }
    expect(out.name).toBe('Keep')
    expect(out.notes).toBe('mine')
  })

  /** The store calls this on every read, so it has to be a no-op the second time. */
  it('is idempotent', () => {
    const once = migrateCharacterShape({ otherProficiencies: ['Longsword'] })
    const twice = migrateCharacterShape(once)
    expect(twice).toEqual(once)
  })

  it('never rejects a character, however little of one it is', () => {
    expect(() => migrateCharacterShape({})).not.toThrow()
  })
})

describe('duplicate features', () => {
  it('drops a feature stored twice under the same id and name', () => {
    const raw = {
      features: [
        { id: 'race-skill-versatility', name: 'Skill Versatility', source: 'Half-Elf', description: 'a' },
        { id: 'race-skill-versatility', name: 'Skill Versatility', source: 'Half-Elf', description: 'b' },
      ],
    }
    const out = migrateCharacterShape(raw) as { features: Array<{ description?: string }> }
    expect(out.features).toHaveLength(1)
    // The first copy wins: its uses are the ones being tracked
    expect(out.features[0]!.description).toBe('a')
  })

  it('keeps features that only share a name', () => {
    const raw = {
      features: [
        { id: 'race-darkvision', name: 'Darkvision', source: 'Half-Elf' },
        { id: 'subrace-darkvision', name: 'Darkvision', source: 'Half-Elf (Drow Descent)' },
      ],
    }
    expect((migrateCharacterShape(raw) as { features: unknown[] }).features).toHaveLength(2)
  })
})
