import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { resolveLevelUpEvents, getChoiceEvents, applyResolvedChoices } from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ChooseOptionEvent } from '~/types/events'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'
import paladin from '~/data/srd/paladin.json'
import ranger from '~/data/srd/ranger.json'
import sorcerer from '~/data/srd/sorcerer.json'
import warlock from '~/data/srd/warlock.json'
import spells from '~/data/srd/spells.json'

function pack(): Rulepack {
  const fragments = [fighter, paladin, ranger, sorcerer, warlock]
  return {
    id: 'srd-5.1',
    name: 'srd',
    version: '5.1',
    races: [],
    classes: fragments.flatMap(f => RulepackSchema.parse(f).classes),
    backgrounds: [],
    feats: [],
    spells: RulepackSchema.parse(spells).spells,
    creatures: [],
    optionalFeatures: [],
  } as unknown as Rulepack
}

const rulepack = pack()

function char(classId: string, level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId, level }],
    spells: [],
    spellSlots: {},
    ...over,
  } as Character
}

function optionChoices(c: Character, classId: string, level: number): ChooseOptionEvent[] {
  return getChoiceEvents(resolveLevelUpEvents(c, classId, level, rulepack))
    .filter((e): e is ChooseOptionEvent => e.type === 'CHOOSE_OPTION')
}

/** Every CHOOSE_OPTION definition in the pack, class levels and subclass levels alike. */
function allOptionDefs() {
  const out: Array<{ id: string, group?: string }> = []
  for (const cls of rulepack.classes) {
    for (const level of cls.levels) {
      for (const e of level.levelUpEvents) {
        if (e.type === 'CHOOSE_OPTION') out.push({ id: e.id, group: e.group })
      }
    }
    for (const sub of cls.subclasses ?? []) {
      for (const level of sub.levels) {
        for (const e of level.levelUpEvents ?? []) {
          if (e.type === 'CHOOSE_OPTION') out.push({ id: e.id, group: e.group })
        }
      }
    }
  }
  return out
}

describe('the groups declared in the data', () => {
  it('groups all four Metamagic picks together', () => {
    const picks = allOptionDefs().filter(e => e.id.startsWith('metamagic-'))
    expect(picks.map(e => e.id)).toEqual([
      'metamagic-1', 'metamagic-2', 'metamagic-3', 'metamagic-4',
    ])
    for (const pick of picks) expect(pick.group).toBe('metamagic')
  })

  it('groups all eight Eldritch Invocation picks together', () => {
    const picks = allOptionDefs().filter(e => e.id.startsWith('eldritch-invocation-'))
    expect(picks).toHaveLength(8)
    for (const pick of picks) expect(pick.group).toBe('eldritch-invocation')
  })

  it('groups Fighting Style with the Champion second pick, and across classes', () => {
    // The SRD forbids taking a Fighting Style option twice even when a later feature or
    // another class offers the choice again.
    const picks = allOptionDefs()
      .filter(e => e.id === 'fighting-style' || e.id === 'additional-fighting-style')
    expect(picks).toHaveLength(4) // fighter, paladin, ranger, champion
    expect(new Set(picks.map(e => e.group))).toEqual(new Set(['fighting-style']))
  })

  it('leaves a one-off choice ungrouped', () => {
    // Pact Boon, Draconic Ancestry and the Hunter picks are each taken once.
    const once = ['pact-boon', 'dragon-ancestor', 'hunters-prey', 'defensive-tactics']
    const picks = allOptionDefs().filter(e => once.includes(e.id))
    expect(picks.length).toBeGreaterThan(0)
    for (const pick of picks) expect(pick.group, pick.id).toBeUndefined()
  })
})

describe('metamagic', () => {
  it('is offered at 3rd level, not 2nd', () => {
    // Font of Magic is the 2nd-level feature; Metamagic is 3rd.
    expect(optionChoices(char('sorcerer', 1), 'sorcerer', 2)).toHaveLength(0)
    expect(optionChoices(char('sorcerer', 2), 'sorcerer', 3).map(e => e.id))
      .toEqual(['metamagic-1', 'metamagic-2'])
  })

  it('offers the whole list twice at 3rd, since neither is answered yet', () => {
    const [first, second] = optionChoices(char('sorcerer', 2), 'sorcerer', 3)
    expect(first!.options).toHaveLength(8)
    expect(second!.options).toHaveLength(8)
  })

  it('drops the two already taken when the third is offered at 10th', () => {
    const c = char('sorcerer', 9, {
      chosenOptions: { 'metamagic-1': 'twinned-spell', 'metamagic-2': 'quickened-spell' },
    })
    const [third] = optionChoices(c, 'sorcerer', 10)
    expect(third!.id).toBe('metamagic-3')
    expect(third!.options).toHaveLength(6)
    expect(third!.options.map(o => o.id)).not.toContain('twinned-spell')
    expect(third!.options.map(o => o.id)).not.toContain('quickened-spell')
  })

  it('drops three by 17th level', () => {
    const c = char('sorcerer', 16, {
      chosenOptions: {
        'metamagic-1': 'twinned-spell',
        'metamagic-2': 'quickened-spell',
        'metamagic-3': 'careful-spell',
      },
    })
    const [fourth] = optionChoices(c, 'sorcerer', 17)
    expect(fourth!.id).toBe('metamagic-4')
    expect(fourth!.options.map(o => o.id).sort()).toEqual([
      'distant-spell', 'empowered-spell', 'extended-spell',
      'heightened-spell', 'subtle-spell',
    ])
  })

  it('does not drop an option answered under a choice in another group', () => {
    const c = char('sorcerer', 9, { chosenOptions: { 'dragon-ancestor': 'red' } })
    const [third] = optionChoices(c, 'sorcerer', 10)
    expect(third!.options).toHaveLength(8)
  })
})

describe('eldritch invocations', () => {
  it('offers two at 2nd level with the full list each time', () => {
    const choices = optionChoices(char('warlock', 1), 'warlock', 2)
    expect(choices.map(e => e.id)).toEqual(['eldritch-invocation-1', 'eldritch-invocation-2'])
    for (const choice of choices) expect(choice.options).toHaveLength(32)
  })

  it('drops both earlier picks when the third is offered at 5th', () => {
    const c = char('warlock', 4, {
      chosenOptions: {
        'eldritch-invocation-1': 'agonizing-blast',
        'eldritch-invocation-2': 'devil-s-sight',
      },
    })
    const [third] = optionChoices(c, 'warlock', 5)
    expect(third!.id).toBe('eldritch-invocation-3')
    expect(third!.options).toHaveLength(30)
    expect(third!.options.map(o => o.id)).not.toContain('agonizing-blast')
    expect(third!.options.map(o => o.id)).not.toContain('devil-s-sight')
  })

  it('leaves the Pact Boon list alone', () => {
    const c = char('warlock', 2, {
      chosenOptions: { 'eldritch-invocation-1': 'agonizing-blast' },
    })
    const boon = optionChoices(c, 'warlock', 3).find(e => e.id === 'pact-boon')
    expect(boon!.options).toHaveLength(3)
  })
})

describe('fighting style', () => {
  it('drops the fighter pick when Champion offers a second at 10th', () => {
    const c = {
      ...char('fighter', 9, { chosenOptions: { 'fighting-style': 'defense' } }),
      classes: [{ classId: 'fighter', level: 9, subclassId: 'champion' }],
    } as Character
    const [second] = optionChoices(c, 'fighter', 10)
    expect(second!.id).toBe('additional-fighting-style')
    expect(second!.options.map(o => o.id)).not.toContain('defense')
    expect(second!.options).toHaveLength(5)
  })

  it('still offers every style to a fighter who has taken none', () => {
    const [first] = optionChoices(char('fighter', 0), 'fighter', 1)
    expect(first!.id).toBe('fighting-style')
    expect(first!.options).toHaveLength(6)
  })
})

describe('resolving a grouped choice', () => {
  it('stores it under its own choice id, so the next level can read it', () => {
    const applied = applyResolvedChoices(
      char('sorcerer', 3),
      [
        { type: 'RESOLVED_OPTION', choiceId: 'metamagic-1', optionId: 'twinned-spell' },
        { type: 'RESOLVED_OPTION', choiceId: 'metamagic-2', optionId: 'subtle-spell' },
      ],
      rulepack,
    )
    expect(applied.chosenOptions).toMatchObject({
      'metamagic-1': 'twinned-spell',
      'metamagic-2': 'subtle-spell',
    })

    const next = { ...applied, classes: [{ classId: 'sorcerer', level: 9 }] } as Character
    const [third] = optionChoices(next, 'sorcerer', 10)
    expect(third!.options.map(o => o.id)).not.toContain('twinned-spell')
    expect(third!.options.map(o => o.id)).not.toContain('subtle-spell')
  })
})
