import { describe, it, expect } from 'vitest'
import type { Rulepack, SpellDefinition } from '~/types/rulepack'
import {
  ENTRY_KINDS,
  HOMEBREW_PACK_ID,
  applyField,
  blankHomebrewPack,
  claimedIds,
  deleteEntry,
  entryId,
  entryKindMeta,
  entriesEqual,
  entryName,
  fieldValue,
  forkKey,
  forkStatuses,
  hashEntry,
  inLookupOrder,
  listEntries,
  mintEntryId,
  parseEntryJson,
  poolKey,
  proseBlocks,
  setAtPath,
  unshadowed,
  upsertEntry,
  validateEntry,
} from '~/services/homebrew'

function spell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: 'healing-word',
    name: 'Healing Word',
    level: 1,
    school: 'evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: 'V',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'A creature regains hit points equal to 1d4 + your spellcasting modifier.',
    classes: ['bard', 'cleric', 'druid'],
    ...overrides,
  }
}

function book(id: string, content: Partial<Rulepack> = {}): Rulepack {
  return { ...blankHomebrewPack(), id, name: id, version: '5.1', forkedFrom: undefined, ...content }
}

describe('entry identity', () => {
  it('reads the id off an entry that has one', () => {
    expect(entryId('spells', spell())).toBe('healing-word')
    expect(entryName('spells', spell())).toBe('Healing Word')
  })

  it('identifies a pool patch by the pool it widens, as mergeOptionPools does', () => {
    const pool = { group: 'eldritch-invocation', options: [] }
    expect(entryId('optionPools', pool)).toBe(poolKey(pool))
    expect(entryId('optionPools', pool)).toBe('eldritch-invocation|')
    expect(entryName('optionPools', pool)).toBe('eldritch-invocation')
  })

  it('gives every kind a blank that its own schema accepts', () => {
    for (const meta of ENTRY_KINDS) {
      const result = validateEntry(meta.key, meta.blank())
      expect(result.ok, `${meta.key}: ${result.ok ? '' : result.issues.join('; ')}`).toBe(true)
    }
  })
})

describe('prose blocks', () => {
  it('finds a nested description by shape, not by a list of paths', () => {
    const race = {
      id: 'tiefling',
      name: 'Tiefling',
      traits: [
        { name: 'Darkvision', description: 'You can see in dim light.' },
        { name: 'Hellish Resistance', description: 'You have resistance to fire damage.' },
      ],
    }
    const blocks = proseBlocks(race)
    expect(blocks.map(b => b.name)).toEqual(['Darkvision', 'Hellish Resistance'])
    expect(blocks[0]!.path).toEqual(['traits', 0, 'description'])
    expect(blocks[0]!.context).toBe('Traits')
  })

  it('reaches prose at any depth, labelled by what it sits under', () => {
    const cls = {
      id: 'barbarian',
      name: 'Barbarian',
      subclasses: [
        {
          id: 'berserker',
          name: 'Path of the Berserker',
          description: 'A path of untrammelled fury.',
          levels: [
            { level: 3, features: [{ name: 'Frenzy', description: 'You can go into a frenzy.' }] },
          ],
        },
      ],
    }
    const blocks = proseBlocks(cls)
    const frenzy = blocks.find(b => b.name === 'Frenzy')!
    expect(frenzy.path).toEqual(['subclasses', 0, 'levels', 0, 'features', 0, 'description'])
    expect(frenzy.context).toBe('Subclasses › Path of the Berserker › Level 3')
    // The subclass's own description is prose too, and sits one level up.
    expect(blocks.find(b => b.name === 'Path of the Berserker')!.context).toBe('Subclasses')
  })

  it("leaves the entry's own description to the details form", () => {
    expect(proseBlocks(spell())).toEqual([])
  })

  it('edits through the path it reports, without touching the rest', () => {
    const race = {
      id: 'elf',
      name: 'Elf',
      traits: [
        { name: 'Darkvision', description: 'old' },
        { name: 'Fey Ancestry', description: 'keep me' },
      ],
    }
    const block = proseBlocks(race)[0]!
    const edited = setAtPath(race, block.path, 'new')
    expect(edited.traits[0]!.description).toBe('new')
    expect(edited.traits[1]!.description).toBe('keep me')
    // The original is untouched: the editor works on a draft.
    expect(race.traits[0]!.description).toBe('old')
  })
})

describe('the details form', () => {
  const meta = entryKindMeta('spells')
  const levelField = meta.fields.find(f => f.key === 'level')!
  const classesField = meta.fields.find(f => f.key === 'classes')!

  it('shows a list as a comma-separated line and reads it back as a list', () => {
    expect(fieldValue(spell() as unknown as Record<string, unknown>, classesField))
      .toBe('bard, cleric, druid')
    const next = applyField({}, classesField, 'bard,  cleric ,,druid')
    expect(next.classes).toEqual(['bard', 'cleric', 'druid'])
  })

  it('parses a number field', () => {
    expect(applyField({}, levelField, '3').level).toBe(3)
  })

  it('removes an emptied optional field rather than storing a blank', () => {
    const maxDex = entryKindMeta('armor').fields.find(f => f.key === 'maxDexBonus')!
    // Absent means uncapped where 0 means none at all, so a blank must not become 0.
    expect('maxDexBonus' in applyField({ maxDexBonus: 2 }, maxDex, '')).toBe(false)
  })

  it('keeps a half-typed number as typed, so the schema reports it', () => {
    expect(applyField({}, levelField, '-').level).toBe('-')
  })
})

describe('validation', () => {
  it('normalises the way import does — a weapon property is lowercased', () => {
    const result = validateEntry('weapons', {
      id: 'hb-sword',
      name: 'Sword',
      category: 'martial',
      rangeType: 'melee',
      damageDice: '1d8',
      damageType: 'slashing',
      properties: ['Finesse', 'LIGHT'],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.properties).toEqual(['finesse', 'light'])
  })

  it('reports the field, not the whole book', () => {
    const result = validateEntry('spells', { ...spell(), level: 12 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join()).toContain('level')
  })

  it('reports unparseable JSON as an issue rather than throwing', () => {
    const result = parseEntryJson('spells', '{ nope')
    expect(result.ok).toBe(false)
  })
})

describe('telling an edit from a no-op', () => {
  it('sees no edit in an entry opened and saved untouched', () => {
    // A JSON round-trip is what the editor drafts through, so it must not read as a change.
    expect(entriesEqual('spells', spell(), JSON.parse(JSON.stringify(spell())))).toBe(true)
  })

  it('ignores key order', () => {
    const { name, id, ...rest } = spell()
    expect(entriesEqual('spells', spell(), { ...rest, id, name })).toBe(true)
  })

  it('ignores a difference the schema itself would erase', () => {
    const weapon = {
      id: 'longsword',
      name: 'Longsword',
      category: 'martial',
      rangeType: 'melee',
      damageDice: '1d8',
      damageType: 'slashing',
      properties: ['versatile'],
    }
    // The schema lowercases properties on the way in, so casing is not an edit.
    expect(entriesEqual('weapons', weapon, { ...weapon, properties: ['Versatile'] })).toBe(true)
    // An unknown key is stripped on the way in too, so adding one is not an edit either.
    expect(entriesEqual('weapons', weapon, { ...weapon, notAField: true })).toBe(true)
  })

  it('sees the wording change that is the whole point', () => {
    expect(entriesEqual('spells', spell(), spell({ description: '2d4 hit points' }))).toBe(false)
  })

  it('sees a nested trait change', () => {
    const race = {
      id: 'elf',
      name: 'Elf',
      size: 'medium',
      speeds: { walk: 30 },
      abilityScoreBonuses: { dex: 2 },
      languages: ['Common'],
      traits: [{ name: 'Darkvision', description: 'old' }],
    }
    const edited = setAtPath(race, ['traits', 0, 'description'], 'new')
    expect(entriesEqual('races', race, edited)).toBe(false)
  })

  it('compares what it was given when a side will not validate', () => {
    const broken = { ...spell(), level: 99 }
    expect(entriesEqual('spells', broken, broken)).toBe(true)
    expect(entriesEqual('spells', broken, spell())).toBe(false)
  })
})

describe('writing a pack', () => {
  it('mints a prefixed id, numbering only on a clash', () => {
    const pack = blankHomebrewPack()
    expect(mintEntryId(pack, 'spells', 'Chromatic Orb')).toBe('hb-chromatic-orb')
    const withOne = upsertEntry(pack, 'spells', { ...spell(), id: 'hb-chromatic-orb' })
    expect(mintEntryId(withOne, 'spells', 'Chromatic Orb')).toBe('hb-chromatic-orb-2')
  })

  it('replaces by id rather than appending a second entry', () => {
    let pack = blankHomebrewPack()
    pack = upsertEntry(pack, 'spells', spell() as unknown as Record<string, unknown>)
    pack = upsertEntry(pack, 'spells', { ...spell(), description: 'edited' } as unknown as Record<string, unknown>)
    expect(pack.spells).toHaveLength(1)
    expect(pack.spells[0]!.description).toBe('edited')
  })

  it('records where a copy came from, and forgets it when the copy is deleted', () => {
    const origin = { packId: 'srd-5.1', packName: 'SRD', packVersion: '5.1', hash: 'abcd1234' }
    let pack = upsertEntry(blankHomebrewPack(), 'spells', spell() as unknown as Record<string, unknown>, origin)
    expect(pack.forkedFrom?.[forkKey('spells', 'healing-word')]).toEqual(origin)

    pack = deleteEntry(pack, 'spells', 'healing-word')
    expect(pack.spells).toHaveLength(0)
    expect(pack.forkedFrom?.[forkKey('spells', 'healing-word')]).toBeUndefined()
  })
})

describe('hashing', () => {
  it('ignores key order, so a re-serialised entry is not reported as changed', () => {
    expect(hashEntry({ a: 1, b: [2, 3] })).toBe(hashEntry({ b: [2, 3], a: 1 }))
  })

  it('changes when the wording does', () => {
    expect(hashEntry(spell())).not.toBe(hashEntry(spell({ description: '2d4' })))
  })
})

describe('copies whose book has moved on', () => {
  const origin = (hash: string) => ({ packId: 'srd', packName: 'SRD', packVersion: '5.1', hash })

  function homebrewWith(hash: string): Rulepack {
    return {
      ...blankHomebrewPack(),
      spells: [spell({ description: 'A creature regains 2d4 hit points.' })],
      forkedFrom: { [forkKey('spells', 'healing-word')]: origin(hash) },
    }
  }

  it('says nothing while the source is as it was copied', () => {
    const source = spell()
    const statuses = forkStatuses(homebrewWith(hashEntry(source)), () => source)
    expect(statuses.map(s => s.state)).toEqual(['current'])
  })

  it('notices when the book has been corrected since', () => {
    const statuses = forkStatuses(homebrewWith(hashEntry(spell())), () => spell({ description: 'fixed' }))
    expect(statuses[0]!.state).toBe('changed')
    expect(statuses[0]!.name).toBe('Healing Word')
    expect(statuses[0]!.origin.packName).toBe('SRD')
  })

  it('notices when the book no longer has the entry at all', () => {
    const statuses = forkStatuses(homebrewWith(hashEntry(spell())), () => undefined)
    expect(statuses[0]!.state).toBe('source-missing')
  })

  it('ignores a note left behind for an entry that is gone', () => {
    const pack = { ...homebrewWith('deadbeef'), spells: [] }
    expect(forkStatuses(pack, () => spell())).toEqual([])
  })
})

describe('shadowing', () => {
  const srd = book('srd-5.1', { spells: [spell()] })
  const homebrew: Rulepack = {
    ...blankHomebrewPack(),
    spells: [spell({ description: 'A creature regains 2d4 hit points.' })],
  }

  it("reads the player's own pack first", () => {
    expect(inLookupOrder([srd, homebrew]).map(p => p.id)).toEqual([HOMEBREW_PACK_ID, 'srd-5.1'])
    // Stable: the books keep the order they arrived in.
    const other = book('mpmm')
    expect(inLookupOrder([srd, other, homebrew]).map(p => p.id))
      .toEqual([HOMEBREW_PACK_ID, 'srd-5.1', 'mpmm'])
  })

  it('drops the book\'s version of an entry the player has edited', () => {
    const claimed = claimedIds([homebrew, srd], 'spells')
    expect(claimed.has('healing-word')).toBe(true)
    expect(unshadowed(srd, 'spells', srd.spells, claimed)).toEqual([])
    expect(unshadowed(homebrew, 'spells', homebrew.spells, claimed)).toHaveLength(1)
  })

  it('leaves two books\' takes on one id alone — only the edited pack shadows', () => {
    const mpmm = book('mpmm', { spells: [spell({ name: 'Healing Word (MPMM)' })] })
    const claimed = claimedIds([srd, mpmm], 'spells')
    expect(claimed.size).toBe(0)
    expect(unshadowed(srd, 'spells', srd.spells, claimed)).toHaveLength(1)
    expect(unshadowed(mpmm, 'spells', mpmm.spells, claimed)).toHaveLength(1)
  })

  it('shadows a pool patch by the pool it names', () => {
    const pool = { group: 'eldritch-invocation', options: [{ id: 'agonizing-blast', name: 'A', description: '' }] }
    const tashas = book('tashas', { optionPools: [pool] })
    const mine: Rulepack = { ...blankHomebrewPack(), optionPools: [{ ...pool, options: [] }] }
    const claimed = claimedIds([mine, tashas], 'optionPools')
    expect(unshadowed(tashas, 'optionPools', tashas.optionPools!, claimed)).toEqual([])
  })
})

describe('listEntries', () => {
  it('reads every kind off a pack without knowing its shape', () => {
    const pack = book('srd-5.1', { spells: [spell()] })
    expect(listEntries(pack, 'spells')).toHaveLength(1)
    expect(listEntries(pack, 'creatures')).toEqual([])
  })
})
