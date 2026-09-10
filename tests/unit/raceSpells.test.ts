import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import races from '~/data/srd/races.json'
import subraces from '~/data/srd/subraces.json'
import fighter from '~/data/srd/fighter.json'
import wizard from '~/data/srd/wizard.json'
import spells from '~/data/srd/spells.json'

/** Races, subraces distributed onto them, plus a couple of classes and the spell list. */
function pack(): Rulepack {
  const r = RulepackSchema.parse(races)
  const sub = RulepackSchema.parse(subraces)
  const built = structuredClone(r) as unknown as Rulepack
  for (const patch of sub.subraces ?? []) {
    const { raceId, ...rest } = patch
    const race = built.races.find(x => x.id === raceId)
    if (race) race.subraces = [...(race.subraces ?? []), rest as never]
  }
  built.classes = [
    ...RulepackSchema.parse(fighter).classes,
    ...RulepackSchema.parse(wizard).classes,
  ] as Rulepack['classes']
  built.spells = RulepackSchema.parse(spells).spells as Rulepack['spells']
  return built
}

const rulepack = pack()

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    race: 'tiefling',
    subrace: undefined,
    classes: [{ classId: 'fighter', level: 0 }],
    spells: [],
    spellSlots: {},
    classSpellcasting: {},
    ...over,
  } as Character
}

describe('SRD race roster', () => {
  it('ships all nine SRD races and four subraces', () => {
    expect(rulepack.races.map(r => r.id)).toEqual([
      'dragonborn', 'dwarf', 'elf', 'gnome', 'half-elf',
      'half-orc', 'halfling', 'human', 'tiefling',
    ])
    const subs = rulepack.races.flatMap(r => (r.subraces ?? []).map(s => s.id)).sort()
    expect(subs).toEqual(['high-elf', 'hill-dwarf', 'lightfoot-halfling', 'rock-gnome'])
  })

  it('carries no non-SRD subrace', () => {
    // mountain-dwarf is PHB and lives in a gitignored fixture now
    const subs = rulepack.races.flatMap(r => (r.subraces ?? []).map(s => s.id))
    expect(subs).not.toContain('mountain-dwarf')
  })

  it('gives half-elf its distributable bonuses', () => {
    // +2 CHA fixed, then +1 to two others — CHA itself is excluded
    const halfElf = rulepack.races.find(r => r.id === 'half-elf')!
    expect(halfElf.abilityScoreBonuses).toEqual({ cha: 2 })
    expect(halfElf.abilityScoreChoice).toEqual({
      from: ['con', 'dex', 'int', 'str', 'wis'], distributions: [[1, 1]],
    })
  })
})

describe('tiefling Infernal Legacy', () => {
  it('grants thaumaturgy at 1st with charisma as its ability', () => {
    const before = char()
    const events = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')
    expect(grant).toBeDefined()

    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spells.map(s => s.spellId)).toEqual(['thaumaturgy'])
    // Its own source, not borrowed from the class
    expect(applied.classSpellcasting.tiefling).toMatchObject({
      ability: 'cha', origin: 'race', label: 'Infernal Legacy',
    })
  })

  it('grants hellish rebuke at 3rd as a free cast, castable at 2nd level', () => {
    const before = char({ classes: [{ classId: 'fighter', level: 2 }] })
    const events = resolveLevelUpEvents(before, 'fighter', 3, rulepack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    const rebuke = applied.spells.find(s => s.spellId === 'hellish-rebuke')!
    expect(rebuke.uses).toEqual({ max: 1, remaining: 1, recharge: 'long' })
    expect(rebuke.castAtLevel).toBe(2)
    expect(rebuke.alwaysPrepared).toBe(true)
  })

  it('grants darkness at 5th', () => {
    const before = char({ classes: [{ classId: 'fighter', level: 4 }] })
    const events = resolveLevelUpEvents(before, 'fighter', 5, rulepack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spells.map(s => s.spellId)).toEqual(['darkness'])
    expect(applied.spells[0]!.uses?.recharge).toBe('long')
  })

  it('grants nothing on a level the trait does not name', () => {
    for (const level of [2, 4, 6]) {
      const before = char({ classes: [{ classId: 'fighter', level: level - 1 }] })
      const events = resolveLevelUpEvents(before, 'fighter', level, rulepack)
      expect(events.filter(e => e.type === 'GRANT_SPELLS'), `level ${level}`).toHaveLength(0)
    }
  })

  it('keys off TOTAL character level, not class level', () => {
    // Fighter 2 / wizard 1 is 3rd level, so the 3rd-level grant fires on the wizard's
    // first level even though that class is only level 1.
    const before = char({ classes: [{ classId: 'fighter', level: 2 }] })
    const events = resolveLevelUpEvents(before, 'wizard', 1, rulepack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spells.map(s => s.spellId)).toContain('hellish-rebuke')
  })

  it('grants nothing to a character of another race', () => {
    const before = char({ race: 'dwarf' })
    const events = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    expect(events.filter(e => e.type === 'GRANT_SPELLS')).toHaveLength(0)
  })
})

describe('high elf cantrip', () => {
  it('offers a choice from the wizard cantrip list, not a grant', () => {
    const before = char({ race: 'elf', subrace: 'high-elf' })
    const events = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    const choice = getChoiceEvents(events).find(e => e.type === 'CHOOSE_SPELL')
    expect(choice).toBeDefined()
    if (choice?.type === 'CHOOSE_SPELL') {
      expect(choice.addTo).toBe('high-elf')
      expect(choice.cantrip).toBe(true)
      expect(choice.count).toBe(1)
      expect(choice.ability).toBe('int')
      expect(choice.fromList).toContain('fire-bolt')
      expect(choice.fromList).toHaveLength(14)
    }
  })

  it('registers intelligence as the source ability once chosen', () => {
    const before = char({ race: 'elf', subrace: 'high-elf' })
    const applied = applyResolvedChoices(before, [{
      type: 'RESOLVED_CHOOSE_SPELL',
      spellIds: ['fire-bolt'],
      removedSpellIds: [],
      classId: 'high-elf',
      ability: 'int',
      origin: 'race',
      label: 'High Elf Cantrip',
    }], rulepack)

    expect(applied.classSpellcasting['high-elf']).toMatchObject({
      ability: 'int', origin: 'race', label: 'High Elf Cantrip',
    })
    expect(applied.spells.map(s => s.spellId)).toContain('fire-bolt')
  })
})

describe('dragonborn ancestry', () => {
  it('asks once and not again', () => {
    const before = char({ race: 'dragonborn' })
    const first = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    // Select by id: fighter level 1 also offers a Fighting Style CHOOSE_OPTION
    const choice = getChoiceEvents(first)
      .find(e => e.type === 'CHOOSE_OPTION' && e.id === 'draconic-ancestry')
    expect(choice).toBeDefined()
    if (choice?.type === 'CHOOSE_OPTION') {
      expect(choice.options).toHaveLength(10)
      expect(choice.options.map(o => o.id)).toContain('red')
    }

    // Once answered, a later level must not re-offer it
    const answered = char({ race: 'dragonborn', chosenOptions: { 'draconic-ancestry': 'red' } })
    const again = resolveLevelUpEvents(answered, 'fighter', 1, rulepack)
    expect(again.filter(e => e.type === 'CHOOSE_OPTION' && e.id === 'draconic-ancestry'))
      .toHaveLength(0)
  })
})

describe('free casts on the character schema', () => {
  it('round-trips uses and castAtLevel', () => {
    const c = {
      ...validCharacter,
      spells: [{
        id: 'a', spellId: 'hellish-rebuke', name: 'Hellish Rebuke', level: 1,
        prepared: true, alwaysPrepared: true,
        uses: { max: 1, remaining: 0, recharge: 'long' as const },
        castAtLevel: 2,
      }],
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(c)))
    expect(parsed.spells[0]!.uses).toEqual({ max: 1, remaining: 0, recharge: 'long' })
    expect(parsed.spells[0]!.castAtLevel).toBe(2)
  })

  it('leaves an ordinary spell without uses', () => {
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(validCharacter)))
    for (const spell of parsed.spells) expect(spell.uses).toBeUndefined()
  })
})
