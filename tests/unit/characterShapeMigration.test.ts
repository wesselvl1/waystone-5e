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
