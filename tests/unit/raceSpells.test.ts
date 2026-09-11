import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
  resolveUnlockedChoices,
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

describe('half-elf Skill Versatility', () => {
  it('asks for two skills at 1st level, from the whole list', () => {
    const before = char({ race: 'half-elf' })
    const events = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    const choice = getChoiceEvents(events).find(e => e.type === 'CHOOSE_SKILL')
    expect(choice).toBeDefined()
    expect(choice).toMatchObject({ count: 2 })
    // No `from` in the JSON means every skill is on offer
    expect((choice as { from: string[] }).from).toHaveLength(18)
  })

  it('applies both picks as proficiencies', () => {
    const before = char({ race: 'half-elf', skillProficiencies: {} })
    const events = resolveLevelUpEvents(before, 'fighter', 1, rulepack)
    const applied = applyResolvedChoices(
      applyAutomaticEvents(before, getAutomaticEvents(events), 'average'),
      [{ type: 'RESOLVED_SKILL', skills: ['arcana', 'stealth'] }],
      rulepack,
      'fighter',
    )
    expect(applied.skillProficiencies.arcana).toBe(1)
    expect(applied.skillProficiencies.stealth).toBe(1)
  })

  it('does not ask again on later levels', () => {
    const before = char({ race: 'half-elf', classes: [{ classId: 'fighter', level: 1 }] })
    const events = resolveLevelUpEvents(before, 'fighter', 2, rulepack)
    expect(events.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(0)
  })

  it('lists Skill Versatility once', () => {
    const halfElf = rulepack.races.find(r => r.id === 'half-elf')!
    const names = halfElf.traits.map(t => t.name)
    expect(names.filter(n => n === 'Skill Versatility')).toHaveLength(1)
  })
})

describe('a subrace that replaces a race trait', () => {
  /** The SCAG-style variants live in a gitignored pack, so build one here. */
  function packWithVariants(): Rulepack {
    const built = structuredClone(rulepack) as Rulepack
    const tiefling = built.races.find(r => r.id === 'tiefling')!
    tiefling.subraces = [{
      id: 'hellfire-tiefling',
      name: 'Hellfire Tiefling',
      abilityScoreBonuses: {},
      replacesRaceTraits: ['Infernal Legacy'],
      traits: [{ name: 'Hellfire', description: 'You know thaumaturgy…' }],
      levelUpEvents: [{
        level: 3,
        levelUpEvents: [{
          type: 'GRANT_SPELLS', addTo: 'hellfire-tiefling', spellIds: ['burning-hands'],
          alwaysPrepared: true, ability: 'cha', origin: 'race', label: 'Hellfire',
          uses: { max: 1, recharge: 'long' },
        }],
      }],
    }]
    const halfElf = built.races.find(r => r.id === 'half-elf')!
    halfElf.subraces = [{
      id: 'drow-descent-half-elf',
      name: 'Drow Descent Half-Elf',
      abilityScoreBonuses: {},
      replacesRaceTraits: ['Skill Versatility'],
      traits: [{ name: 'Drow Magic', description: 'You know dancing lights…' }],
    }]
    return built
  }

  const variants = packWithVariants()

  it('drops the replaced trait spell grant', () => {
    const before = char({ race: 'tiefling', subrace: 'hellfire-tiefling', classes: [{ classId: 'fighter', level: 2 }] })
    const events = resolveLevelUpEvents(before, 'fighter', 3, variants)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    // Burning hands from the bloodline, no hellish rebuke from Infernal Legacy
    expect(applied.spells.map(s => s.spellId)).toEqual(['burning-hands'])
  })

  it('keeps the race trait for a character without that subrace', () => {
    const before = char({ race: 'tiefling', classes: [{ classId: 'fighter', level: 2 }] })
    const events = resolveLevelUpEvents(before, 'fighter', 3, variants)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spells.map(s => s.spellId)).toEqual(['hellish-rebuke'])
  })

  it('drops the replaced trait skill choice', () => {
    const before = char({ race: 'half-elf', subrace: 'drow-descent-half-elf' })
    const events = resolveLevelUpEvents(before, 'fighter', 1, variants)
    expect(events.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(0)
  })

  it('still asks a half-elf with no descent chosen', () => {
    const before = char({ race: 'half-elf' })
    const events = resolveLevelUpEvents(before, 'fighter', 1, variants)
    expect(events.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(1)
  })
})

describe('a variant feature the player chooses', () => {
  const CHOICE = 'test-descent-variant'

  /** A SCAG-style descent: one pick, each arm carrying its own consequence. */
  function variantPack(): Rulepack {
    const built = structuredClone(rulepack) as Rulepack
    const halfElf = built.races.find(r => r.id === 'half-elf')!
    halfElf.subraces = [{
      id: 'test-descent',
      name: 'Test Descent Half-Elf',
      abilityScoreBonuses: {},
      replacesRaceTraits: ['Skill Versatility'],
      traits: [{ name: 'Variant Feature', description: 'Choose one.' }],
      levelUpEvents: [
        {
          level: 1,
          levelUpEvents: [
            {
              type: 'CHOOSE_OPTION',
              id: CHOICE,
              label: 'Variant Feature',
              options: [
                { id: 'skill-versatility', name: 'Skill Versatility', description: 'Two skills.' },
                { id: 'test-magic', name: 'Test Magic', description: 'A cantrip.' },
              ],
            },
            { type: 'CHOOSE_SKILL', count: 2, whenOption: { choiceId: CHOICE, optionId: 'skill-versatility' } },
            {
              type: 'GRANT_SPELLS', addTo: 'test-descent', spellIds: ['thaumaturgy'],
              alwaysPrepared: true, ability: 'cha', origin: 'race', label: 'Test Descent',
              whenOption: { choiceId: CHOICE, optionId: 'test-magic' },
            },
          ],
        },
        {
          level: 3,
          levelUpEvents: [{
            type: 'GRANT_SPELLS', addTo: 'test-descent', spellIds: ['darkness'],
            alwaysPrepared: true, ability: 'cha', origin: 'race', label: 'Test Descent',
            uses: { max: 1, recharge: 'long' },
            whenOption: { choiceId: CHOICE, optionId: 'test-magic' },
          }],
        },
      ],
    }] as never
    return built
  }

  const variants = variantPack()
  const descendant = (over: Partial<Character> = {}) =>
    char({ race: 'half-elf', subrace: 'test-descent', classes: [{ classId: 'fighter', level: 0 }], ...over })

  it('asks the question without pre-empting either arm', () => {
    const events = resolveLevelUpEvents(descendant(), 'fighter', 1, variants)
    expect(getChoiceEvents(events).some(e => e.type === 'CHOOSE_OPTION' && e.id === CHOICE)).toBe(true)
    // The race's own Skill Versatility is replaced, and the arm's is not asked yet
    expect(events.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(0)
    expect(events.filter(e => e.type === 'GRANT_SPELLS')).toHaveLength(0)
  })

  it('raises the skill question once that arm is picked', () => {
    const unlocked = resolveUnlockedChoices(
      descendant(), { choiceId: CHOICE, optionId: 'skill-versatility' }, 'fighter', 1, variants)
    expect(unlocked.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(1)
  })

  it('raises nothing for the arm not picked', () => {
    const unlocked = resolveUnlockedChoices(
      descendant(), { choiceId: CHOICE, optionId: 'test-magic' }, 'fighter', 1, variants)
    expect(unlocked.filter(e => e.type === 'CHOOSE_SKILL')).toHaveLength(0)
  })

  it('grants the other arm its spell, ability and all, when the answer lands this run', () => {
    const applied = applyResolvedChoices(
      descendant({ classes: [{ classId: 'fighter', level: 1 }] }),
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'test-magic' }],
      variants, 'fighter',
    )
    expect(applied.spells.map(s => s.spellId)).toEqual(['thaumaturgy'])
    // Its own spellcasting source, so the DC is not borrowed from the class
    expect(applied.classSpellcasting['test-descent']).toMatchObject({ ability: 'cha', origin: 'race' })
    // The pick is named on the sheet, which chosenOptions alone never did
    expect(applied.features.map(f => f.name)).toContain('Test Magic')
  })

  it('holds a later level back until that level is reached', () => {
    const applied = applyResolvedChoices(
      descendant({ classes: [{ classId: 'fighter', level: 1 }] }),
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'test-magic' }],
      variants, 'fighter',
    )
    expect(applied.spells.map(s => s.spellId)).not.toContain('darkness')

    // …and hands it over at 3rd, off the stored answer
    const later = char({
      race: 'half-elf', subrace: 'test-descent', classes: [{ classId: 'fighter', level: 2 }],
      chosenOptions: { [CHOICE]: 'test-magic' },
    })
    const events = resolveLevelUpEvents(later, 'fighter', 3, variants)
    const out = applyAutomaticEvents(later, getAutomaticEvents(events), 'average')
    expect(out.spells.map(s => s.spellId)).toEqual(['darkness'])
    expect(out.spells[0]!.uses).toEqual({ max: 1, remaining: 1, recharge: 'long' })
  })

  it('gives the other arm nothing at 3rd', () => {
    const later = char({
      race: 'half-elf', subrace: 'test-descent', classes: [{ classId: 'fighter', level: 2 }],
      chosenOptions: { [CHOICE]: 'skill-versatility' },
    })
    const events = resolveLevelUpEvents(later, 'fighter', 3, variants)
    expect(applyAutomaticEvents(later, getAutomaticEvents(events), 'average').spells).toHaveLength(0)
  })
})

describe('races that stand on their own', () => {
  it('marks the ones a subrace is optional for', () => {
    const optional = rulepack.races.filter(r => r.subraceOptional).map(r => r.id).sort()
    expect(optional).toEqual(['dragonborn', 'half-orc', 'human', 'tiefling'])
  })

  it('leaves the ones whose subrace the SRD requires unmarked', () => {
    for (const id of ['dwarf', 'elf', 'gnome', 'halfling']) {
      expect(rulepack.races.find(r => r.id === id)!.subraceOptional, id).toBeUndefined()
    }
  })

  /**
   * Not optional, unlike the other four: every half-elf has an elf parent, and Half-Elf
   * Versatility is chosen from that parentage's list — with Skill Versatility, the
   * General option, on every one of those lists. A "None" would have meant a half-elf
   * with no parentage at all, which is not a thing the rules describe.
   */
  it('requires a half-elf to name its heritage once a pack supplies them', () => {
    expect(rulepack.races.find(r => r.id === 'half-elf')!.subraceOptional).toBeUndefined()
  })
})

describe('a proficiency an option grants', () => {
  const CHOICE = 'test-weapon-variant'

  function pack(): Rulepack {
    const built = structuredClone(rulepack) as Rulepack
    built.races.find(r => r.id === 'half-elf')!.subraces = [{
      id: 'test-weapons', name: 'Test Weapons Half-Elf', abilityScoreBonuses: {},
      replacesRaceTraits: ['Skill Versatility'],
      traits: [{ name: 'Variant Feature', description: 'Choose one.' }],
      levelUpEvents: [{
        level: 1,
        levelUpEvents: [
          {
            type: 'CHOOSE_OPTION', id: CHOICE, label: 'Variant Feature',
            options: [
              { id: 'weapons', name: 'Elf Weapon Training', description: 'Four weapons.' },
              { id: 'other', name: 'Something Else', description: 'Not weapons.' },
            ],
          },
          { type: 'GAIN_PROFICIENCY', proficiency: 'Longsword', whenOption: { choiceId: CHOICE, optionId: 'weapons' } },
          { type: 'GAIN_PROFICIENCY', proficiency: 'Shortbow', whenOption: { choiceId: CHOICE, optionId: 'weapons' } },
        ],
      }],
    }] as never
    return built
  }

  const weapons = pack()
  const subject = (over: Partial<Character> = {}) => char({
    race: 'half-elf', subrace: 'test-weapons', classes: [{ classId: 'fighter', level: 1 }],
    otherProficiencies: [], ...over,
  })

  it('hands nothing over while the question is unanswered', () => {
    const events = resolveLevelUpEvents(
      subject({ classes: [{ classId: 'fighter', level: 0 }] }), 'fighter', 1, weapons)
    expect(events.filter(e => e.type === 'GAIN_PROFICIENCY')).toHaveLength(0)
  })

  it('grants them when that arm is picked in the same run', () => {
    const applied = applyResolvedChoices(
      subject(), [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'weapons' }], weapons, 'fighter')
    expect(applied.otherProficiencies).toEqual(['Longsword', 'Shortbow'])
  })

  it('grants none of them for the other arm', () => {
    const applied = applyResolvedChoices(
      subject(), [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'other' }], weapons, 'fighter')
    expect(applied.otherProficiencies).toEqual([])
  })

  it('grants them off a stored answer on a later run', () => {
    const stored = subject({ classes: [{ classId: 'fighter', level: 0 }], chosenOptions: { [CHOICE]: 'weapons' } })
    const events = resolveLevelUpEvents(stored, 'fighter', 1, weapons)
    const applied = applyAutomaticEvents(stored, getAutomaticEvents(events), 'average')
    expect(applied.otherProficiencies).toEqual(['Longsword', 'Shortbow'])
  })

  it('never adds the same proficiency twice', () => {
    const applied = applyResolvedChoices(
      subject({ otherProficiencies: ['Longsword'] }),
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'weapons' }], weapons, 'fighter')
    expect(applied.otherProficiencies).toEqual(['Longsword', 'Shortbow'])
  })
})
