import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { LevelUpEventDef, Race, Subrace, SubclassDefinition } from '~/types/rulepack'

/**
 * Glob-driven so a new fragment file is schema-validated without touching this test.
 * Mirrors the loader's own glob over app/data/srd.
 */
const fragments = import.meta.glob<{ default: unknown }>('~/data/srd/*.json', { eager: true })

const entries = Object.entries(fragments)
  .map(([path, mod]) => ({ name: path.split('/').pop()!, data: mod.default }))
  .sort((a, b) => a.name.localeCompare(b.name))

describe('SRD data files', () => {
  it('finds fragment files to validate', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  for (const { name, data } of entries) {
    it(`${name} is valid against RulepackSchema`, () => {
      const result = RulepackSchema.safeParse(data)
      if (!result.success) {
        const issue = result.error.issues[0]!
        throw new Error(`${name}: ${issue.path.join('.')} — ${issue.message}`)
      }
      expect(result.success).toBe(true)
    })
  }

  it('every fragment declares the same pack id and version', () => {
    const packs = entries.map(e => RulepackSchema.parse(e.data))
    const ids = [...new Set(packs.map(p => p.id))]
    const versions = [...new Set(packs.map(p => p.version))]
    expect(ids).toEqual(['srd-5.1'])
    expect(versions).toEqual(['5.1'])
  })
})

/**
 * SRD 5.1 publishes exactly one subclass per class. Anything else is non-OGL content
 * that must not be committed — keep it in a gitignored fragment instead.
 */
const SRD_SUBCLASS_IDS = [
  'path-of-the-berserker',
  'college-of-lore',
  'life-domain',
  'circle-of-the-land',
  'champion',
  'way-of-the-open-hand',
  'oath-of-devotion',
  'hunter',
  'thief',
  'draconic-bloodline',
  'the-fiend',
  'school-of-evocation',
]

function allSubclasses(): Array<{ classId: string; sub: SubclassDefinition }> {
  const out: Array<{ classId: string; sub: SubclassDefinition }> = []
  for (const { data } of entries) {
    const pack = RulepackSchema.parse(data)
    for (const cls of pack.classes) {
      for (const sub of cls.subclasses ?? []) out.push({ classId: cls.id, sub })
    }
    // patch-style entries, if any fragment still uses them
    for (const sub of pack.subclasses ?? []) {
      const { classId, ...rest } = sub
      out.push({ classId, sub: rest as SubclassDefinition })
    }
  }
  return out
}

describe('SRD subclass provenance', () => {
  it('contains only SRD 5.1 subclasses', () => {
    const ids = allSubclasses().map(s => s.sub.id)
    const unexpected = ids.filter(id => !SRD_SUBCLASS_IDS.includes(id))
    expect(unexpected, `non-SRD subclass in app/data/srd: ${unexpected.join(', ')}`).toEqual([])
  })

  it('gives no class more than one subclass', () => {
    const byClass = new Map<string, string[]>()
    for (const { classId, sub } of allSubclasses()) {
      byClass.set(classId, [...(byClass.get(classId) ?? []), sub.id])
    }
    for (const [classId, ids] of byClass) {
      expect(ids, `${classId} has multiple subclasses`).toHaveLength(1)
    }
  })

  it('declares each class in exactly one fragment', () => {
    const seen = new Map<string, string[]>()
    for (const { name, data } of entries) {
      for (const cls of RulepackSchema.parse(data).classes) {
        seen.set(cls.id, [...(seen.get(cls.id) ?? []), name])
      }
    }
    for (const [id, files] of seen) {
      expect(files, `${id} declared in multiple fragments`).toHaveLength(1)
    }
  })
})

function allRaces(): Race[] {
  const out: Race[] = []
  for (const { data } of entries) {
    const pack = RulepackSchema.parse(data)
    for (const race of pack.races) out.push(race)
  }
  return out
}

function allSubraces(): Array<{ raceId: string; sub: Subrace }> {
  const out: Array<{ raceId: string; sub: Subrace }> = []
  for (const { data } of entries) {
    const pack = RulepackSchema.parse(data)
    for (const race of pack.races) {
      for (const sub of race.subraces ?? []) out.push({ raceId: race.id, sub })
    }
    // patch-style entries, e.g. subraces.json
    for (const sub of pack.subraces ?? []) {
      const { raceId, ...rest } = sub
      out.push({ raceId, sub: rest as Subrace })
    }
  }
  return out
}

function findRace(id: string): Race {
  const race = allRaces().find(r => r.id === id)
  if (!race) throw new Error(`race not found: ${id}`)
  return race
}

function findSubrace(id: string): Subrace {
  const sub = allSubraces().find(s => s.sub.id === id)?.sub
  if (!sub) throw new Error(`subrace not found: ${id}`)
  return sub
}

/** Every GAIN_PROFICIENCY.proficiency granted anywhere in a source's levelUpEvents. */
function grantedProficiencies(source: Pick<Race | Subrace, 'levelUpEvents'>): string[] {
  const out: string[] = []
  for (const group of source.levelUpEvents ?? []) {
    for (const event of group.levelUpEvents) {
      if (event.type === 'GAIN_PROFICIENCY') out.push(event.proficiency)
    }
  }
  return out
}

function chooseOptionEvent(
  source: Pick<Race | Subrace, 'levelUpEvents'>,
  trait: string,
): Extract<LevelUpEventDef, { type: 'CHOOSE_OPTION' }> {
  const group = (source.levelUpEvents ?? []).find(g => g.trait === trait)
  const event = group?.levelUpEvents.find(e => e.type === 'CHOOSE_OPTION')
  if (!event || event.type !== 'CHOOSE_OPTION') throw new Error(`no CHOOSE_OPTION for trait: ${trait}`)
  return event
}

describe('SRD race proficiencies, senses and resistances', () => {
  it('half-elf is playable without picking a descent subrace', () => {
    expect(findRace('half-elf').subraceOptional).toBe(true)
  })

  it('grants darkvision to the SRD races that print it', () => {
    for (const id of ['dwarf', 'elf', 'gnome', 'half-elf', 'half-orc', 'tiefling']) {
      expect(findRace(id).senses?.darkvision, `${id} senses.darkvision`).toBe(60)
    }
  })

  it('gives the dwarf resistance to poison and the tiefling resistance to fire', () => {
    expect(findRace('dwarf').damageResistances).toContain('poison')
    expect(findRace('tiefling').damageResistances).toContain('fire')
  })

  it('grants Dwarven Combat Training weapon proficiencies', () => {
    const granted = grantedProficiencies(findRace('dwarf'))
    for (const weapon of ['battleaxe', 'handaxe', 'light hammer', 'warhammer']) {
      expect(granted, 'Dwarven Combat Training').toContain(weapon)
    }
  })

  it('offers the dwarf a choice of one artisan\'s tool, each arm granting that tool', () => {
    const dwarf = findRace('dwarf')
    const choice = chooseOptionEvent(dwarf, 'Tool Proficiency')
    const optionIds = choice.options.map(o => o.id)
    expect(optionIds.sort()).toEqual(['brewers-supplies', 'masons-tools', 'smiths-tools'])

    const group = (dwarf.levelUpEvents ?? []).find(g => g.trait === 'Tool Proficiency')!
    const guarded = group.levelUpEvents.filter(
      (e): e is Extract<LevelUpEventDef, { type: 'GAIN_PROFICIENCY' }> => e.type === 'GAIN_PROFICIENCY',
    )
    expect(guarded).toHaveLength(3)
    for (const event of guarded) {
      expect(event.whenOption?.choiceId).toBe(choice.id)
      expect(optionIds).toContain(event.whenOption?.optionId)
    }
  })

  it('grants the elf Keen Senses as a Perception proficiency', () => {
    expect(grantedProficiencies(findRace('elf'))).toContain('perception')
  })

  it('grants the half-orc Menacing as an Intimidation proficiency', () => {
    expect(grantedProficiencies(findRace('half-orc'))).toContain('intimidation')
  })

  it('grants the high elf Elf Weapon Training proficiencies', () => {
    const granted = grantedProficiencies(findSubrace('high-elf'))
    for (const weapon of ['longsword', 'shortsword', 'shortbow', 'longbow']) {
      expect(granted, 'Elf Weapon Training').toContain(weapon)
    }
  })

  it('grants the rock gnome Tinker tool proficiency', () => {
    expect(grantedProficiencies(findSubrace('rock-gnome'))).toContain('tinker\'s tools')
  })
})
