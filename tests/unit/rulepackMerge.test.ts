import { describe, it, expect } from 'vitest'
import { mergeById, distributeSubclasses, distributeSubraces } from '~/services/rulepackMerge'
import type { ClassDefinition, Race, SubclassPatchEntry, SubracePatchEntry } from '~/types/rulepack'

function cls(id: string): ClassDefinition {
  return {
    id,
    name: id,
    hitDie: 'd8',
    primaryAbility: [],
    savingThrowProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillChoices: { count: 0, from: [] },
    levels: [],
  }
}

function race(id: string): Race {
  return {
    id,
    name: id,
    size: 'medium',
    speeds: { walk: 30 },
    abilityScoreBonuses: {},
    traits: [],
    languages: [],
  }
}

function subclassPatch(id: string, classId: string): SubclassPatchEntry {
  return { id, classId, name: id, description: '', levels: [] }
}

function subracePatch(id: string, raceId: string): SubracePatchEntry {
  return { id, raceId, name: id, abilityScoreBonuses: {}, traits: [] }
}

describe('mergeById', () => {
  it('lets an incoming item overwrite an existing one with the same id', () => {
    const merged = mergeById(
      [{ id: 'a', v: 1 }, { id: 'b', v: 2 }],
      [{ id: 'b', v: 99 }, { id: 'c', v: 3 }],
    )
    expect(merged).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 99 }, { id: 'c', v: 3 }])
  })

  it('preserves the existing order rather than appending overwrites', () => {
    const merged = mergeById([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }])
    expect(merged.map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('distributeSubclasses', () => {
  it('attaches a patch to the class it names', () => {
    const classes = [cls('barbarian'), cls('wizard')]
    const unresolved = distributeSubclasses(classes, [subclassPatch('totem', 'barbarian')])

    expect(unresolved).toEqual([])
    expect(classes[0]!.subclasses?.map(s => s.id)).toEqual(['totem'])
    expect(classes[1]!.subclasses).toBeUndefined()
  })

  it('strips classId off the stored subclass — it is a routing field, not part of the definition', () => {
    const classes = [cls('barbarian')]
    distributeSubclasses(classes, [subclassPatch('totem', 'barbarian')])

    expect(classes[0]!.subclasses![0]).not.toHaveProperty('classId')
  })

  it('returns a patch whose target class is absent, instead of dropping it', () => {
    // A sourcebook pack patching an SRD class hits this on its own merge: the class it
    // names lives in another pack entirely, and the entry has to survive to be resolved
    // at lookup time. Dropping it here is what forced book fragments to claim id
    // "srd-5.1" and so vanish from the rulepacks list.
    const classes = [cls('wizard')]
    const patch = subclassPatch('gloom-stalker', 'ranger')

    expect(distributeSubclasses(classes, [patch])).toEqual([patch])
  })

  it('separates resolvable patches from unresolvable ones in a single pass', () => {
    const classes = [cls('ranger')]
    const unresolved = distributeSubclasses(classes, [
      subclassPatch('gloom-stalker', 'ranger'),
      subclassPatch('rune-knight', 'fighter'),
    ])

    expect(unresolved.map(p => p.id)).toEqual(['rune-knight'])
    expect(classes[0]!.subclasses?.map(s => s.id)).toEqual(['gloom-stalker'])
  })

  it('lets a later patch overwrite an earlier subclass with the same id', () => {
    const classes = [cls('bard')]
    distributeSubclasses(classes, [subclassPatch('valor', 'bard')])
    classes[0]!.subclasses![0]!.description = 'filled in'
    distributeSubclasses(classes, [subclassPatch('valor', 'bard')])

    expect(classes[0]!.subclasses).toHaveLength(1)
    expect(classes[0]!.subclasses![0]!.description).toBe('')
  })
})

describe('distributeSubraces', () => {
  it('attaches a patch to the race it names', () => {
    const races = [race('dwarf')]
    const unresolved = distributeSubraces(races, [subracePatch('mountain-dwarf', 'dwarf')])

    expect(unresolved).toEqual([])
    expect(races[0]!.subraces?.map(s => s.id)).toEqual(['mountain-dwarf'])
    expect(races[0]!.subraces![0]).not.toHaveProperty('raceId')
  })

  it('returns a patch whose target race lives in another pack', () => {
    const races = [race('elf')]
    const patch = subracePatch('mountain-dwarf', 'dwarf')

    expect(distributeSubraces(races, [patch])).toEqual([patch])
  })
})
