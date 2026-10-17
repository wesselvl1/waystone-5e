import { describe, it, expect } from 'vitest'
import type { Rulepack } from '~/types/rulepack'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { blankHomebrewPack } from '~/services/homebrew'
import { searchRulepacks } from '~/services/rulepackSearch'
import spells from '~/data/srd/spells.json'
import races from '~/data/srd/races.json'
import fighter from '~/data/srd/fighter.json'
import warlock from '~/data/srd/warlock.json'

function pack(id: string, content: Partial<Rulepack> = {}): Rulepack {
  return { ...blankHomebrewPack(), id, name: id, version: '1', forkedFrom: undefined, ...content }
}

/** The SRD's spells, races, fighter and warlock as one pack, the way the loader merges them. */
function srd(): Rulepack {
  const parts = [spells, races, fighter, warlock].map(json => RulepackSchema.parse(json))
  return pack('srd-5.1', {
    name: 'SRD 5.1',
    spells: parts[0]!.spells,
    races: parts[1]!.races,
    classes: [...parts[2]!.classes, ...parts[3]!.classes],
  })
}

describe('searchRulepacks', () => {
  it('finds nothing for a blank query', () => {
    expect(searchRulepacks([srd()], '   ')).toEqual([])
  })

  it('finds a spell by a partial name, with its pack and description', () => {
    const [hit] = searchRulepacks([srd()], 'fire bo')
    expect(hit).toMatchObject({ name: 'Fire Bolt', kind: 'spells', label: 'spell', packName: 'SRD 5.1' })
    expect(hit!.description.length).toBeGreaterThan(20)
    expect(hit!.summary).toMatch(/^Cantrip · evocation/)
  })

  it('puts an exact name ahead of names that merely contain it', () => {
    const names = searchRulepacks([srd()], 'fireball').map(hit => hit.name)
    expect(names[0]).toBe('Fireball')
    expect(names).toContain('Delayed Blast Fireball')
  })

  it('finds a race and its traits come along', () => {
    const hit = searchRulepacks([srd()], 'dwarf').find(h => h.kind === 'races' && h.label === 'race')
    expect(hit?.name).toBe('Dwarf')
    expect(hit!.prose.map(block => block.name)).toContain('Darkvision')
  })

  it('finds a subclass printed inside its class, named after the class', () => {
    const hit = searchRulepacks([srd()], 'champ').find(h => h.label === 'subclass')
    expect(hit).toMatchObject({ name: 'Champion', parent: 'Fighter', kind: 'classes' })
  })

  it('finds a feature inside an entry, below the entries themselves', () => {
    const hits = searchRulepacks([srd()], 'agonizing')
    const feature = hits.find(h => h.label === 'feature')
    expect(feature?.name).toBe('Agonizing Blast')
    expect(feature!.parent).toMatch(/^Warlock/)
    expect(feature!.description).toMatch(/Charisma/)
  })

  it('lists the same name from two books as two hits, each labelled', () => {
    const satyr = { id: 'satyr', name: 'Satyr', size: 'medium', speeds: { walk: 35 }, abilityScoreBonuses: {}, traits: [], languages: [] }
    const hits = searchRulepacks([
      pack('mpmm', { name: 'Monsters of the Multiverse', races: [satyr as never] }),
      pack('mtof', { name: 'Mythic Odysseys', races: [satyr as never] }),
    ], 'satyr')
    expect(hits.map(h => h.packName).sort()).toEqual(['Monsters of the Multiverse', 'Mythic Odysseys'])
  })

  it('shows an entry edited into the homebrew pack once, as the homebrew copy', () => {
    const book = srd()
    const fireBolt = book.spells.find(s => s.id === 'fire-bolt')!
    const homebrew = { ...blankHomebrewPack(), spells: [{ ...fireBolt, description: 'Mine.' }] }
    const hits = searchRulepacks([book, homebrew], 'fire bolt')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ packId: 'homebrew', description: 'Mine.' })
  })

  it('does not search descriptions', () => {
    expect(searchRulepacks([srd()], 'fire bolt').every(h => h.name.toLowerCase().includes('fire bolt'))).toBe(true)
  })
})
