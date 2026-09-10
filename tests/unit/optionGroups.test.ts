import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { resolveLevelUpEvents, getChoiceEvents, applyResolvedChoices, backfillPoolPickFeatures } from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ChooseOptionEvent, ReplaceOptionEvent } from '~/types/events'
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

/** A warlock who took the eldritch blast cantrip, which three invocations require. */
function blaster(level: number, over: Partial<Character> = {}): Character {
  return char('warlock', level, {
    spells: [{
      id: 'eb', spellId: 'eldritch-blast', name: 'Eldritch Blast', level: 0, prepared: true,
    }],
    ...over,
  })
}

describe('eldritch invocations', () => {
  it('offers two at 2nd level, from the options a 2nd-level warlock qualifies for', () => {
    const choices = optionChoices(blaster(1), 'warlock', 2)
    expect(choices.map(e => e.id)).toEqual(['eldritch-invocation-1', 'eldritch-invocation-2'])
    for (const choice of choices) {
      expect(choice.options.map(o => o.id).sort()).toEqual([
        'agonizing-blast', 'armor-of-shadows', 'beast-speech', 'beguiling-influence',
        'devil-s-sight', 'eldritch-sight', 'eldritch-spear', 'eyes-of-the-rune-keeper',
        'fiendish-vigor', 'gaze-of-two-minds', 'mask-of-many-faces', 'misty-visions',
        'repelling-blast', 'thief-of-five-fates',
      ])
    }
  })

  it('holds back the invocations that need a higher warlock level', () => {
    const [first] = optionChoices(blaster(1), 'warlock', 2)
    const offered = first!.options.map(o => o.id)
    // 5th, 7th, 9th, 12th and 15th level respectively
    expect(offered).not.toContain('mire-the-mind')
    expect(offered).not.toContain('dreadful-word')
    expect(offered).not.toContain('ascendant-step')
    expect(offered).not.toContain('lifedrinker')
    expect(offered).not.toContain('witch-sight')
  })

  it('opens the 5th-level invocations at 5th', () => {
    const [third] = optionChoices(blaster(4), 'warlock', 5)
    const offered = third!.options.map(o => o.id)
    expect(offered).toContain('mire-the-mind')
    expect(offered).toContain('one-with-shadows')
    expect(offered).toContain('sign-of-ill-omen')
    // Thirsting Blade opens at 5th too, but only for a Pact of the Blade warlock
    expect(offered).not.toContain('thirsting-blade')
  })

  it('holds back the invocations that need the matching Pact Boon', () => {
    const blade = blaster(4, { chosenOptions: { 'pact-boon': 'pact-of-the-blade' } })
    const [forBlade] = optionChoices(blade, 'warlock', 5)
    expect(forBlade!.options.map(o => o.id)).toContain('thirsting-blade')
    expect(forBlade!.options.map(o => o.id)).not.toContain('book-of-ancient-secrets')
    expect(forBlade!.options.map(o => o.id)).not.toContain('voice-of-the-chain-master')

    const chain = blaster(4, { chosenOptions: { 'pact-boon': 'pact-of-the-chain' } })
    const [forChain] = optionChoices(chain, 'warlock', 5)
    expect(forChain!.options.map(o => o.id)).toContain('voice-of-the-chain-master')
    expect(forChain!.options.map(o => o.id)).not.toContain('thirsting-blade')
  })

  it('holds back the eldritch blast invocations from a warlock without the cantrip', () => {
    const [first] = optionChoices(char('warlock', 1), 'warlock', 2)
    const offered = first!.options.map(o => o.id)
    expect(offered).not.toContain('agonizing-blast')
    expect(offered).not.toContain('eldritch-spear')
    expect(offered).not.toContain('repelling-blast')
    expect(offered).toContain('armor-of-shadows')
  })

  it('drops both earlier picks when the third is offered at 5th', () => {
    const c = blaster(4, {
      chosenOptions: {
        'eldritch-invocation-1': 'agonizing-blast',
        'eldritch-invocation-2': 'devil-s-sight',
      },
    })
    const [third] = optionChoices(c, 'warlock', 5)
    expect(third!.id).toBe('eldritch-invocation-3')
    expect(third!.options.map(o => o.id)).not.toContain('agonizing-blast')
    expect(third!.options.map(o => o.id)).not.toContain('devil-s-sight')
  })

  it('leaves the Pact Boon list alone', () => {
    const c = blaster(2, {
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

function replacementOffer(c: Character, classId: string, level: number): ReplaceOptionEvent | undefined {
  return getChoiceEvents(resolveLevelUpEvents(c, classId, level, rulepack))
    .find((e): e is ReplaceOptionEvent => e.type === 'REPLACE_OPTION')
}

describe('replacing an eldritch invocation', () => {
  it('is not offered at 2nd, when the first invocations are still being gained', () => {
    expect(replacementOffer(blaster(1), 'warlock', 2)).toBeUndefined()
  })

  it('offers what the warlock knows against what they now qualify for', () => {
    const c = blaster(4, {
      chosenOptions: {
        'eldritch-invocation-1': 'agonizing-blast',
        'eldritch-invocation-2': 'devil-s-sight',
      },
    })
    const offer = replacementOffer(c, 'warlock', 5)!
    expect(offer.group).toBe('eldritch-invocation')
    expect(offer.current.map(h => h.choiceId))
      .toEqual(['eldritch-invocation-1', 'eldritch-invocation-2'])
    expect(offer.current.map(h => h.option.name)).toEqual(['Agonizing Blast', "Devil's Sight"])
    // Newly open at 5th, and nothing the warlock already knows
    expect(offer.options.map(o => o.id)).toContain('mire-the-mind')
    expect(offer.options.map(o => o.id)).not.toContain('agonizing-blast')
    expect(offer.options.map(o => o.id)).not.toContain('devil-s-sight')
    // Still gated, so still not on offer
    expect(offer.options.map(o => o.id)).not.toContain('thirsting-blade')
    expect(offer.options.map(o => o.id)).not.toContain('lifedrinker')
  })

  it('overwrites the traded pick rather than adding a ninth', () => {
    const c = blaster(4, {
      chosenOptions: {
        'eldritch-invocation-1': 'agonizing-blast',
        'eldritch-invocation-2': 'devil-s-sight',
      },
    })
    const applied = applyResolvedChoices(c, [{
      type: 'RESOLVED_OPTION_REPLACEMENT',
      group: 'eldritch-invocation',
      choiceId: 'eldritch-invocation-2',
      optionId: 'mire-the-mind',
    }], rulepack)
    expect(applied.chosenOptions).toEqual({
      'eldritch-invocation-1': 'agonizing-blast',
      'eldritch-invocation-2': 'mire-the-mind',
    })
  })

  it('renames the traded pick’s feature in place', () => {
    const picked = applyResolvedChoices(
      blaster(1),
      [{ type: 'RESOLVED_OPTION', choiceId: 'eldritch-invocation-1', optionId: 'devil-s-sight' }],
      rulepack,
    )
    const feature = picked.features.find(f => f.name === "Devil's Sight")
    expect(feature).toBeDefined()
    expect(feature!.source).toBe('Warlock')

    const swapped = applyResolvedChoices(
      { ...picked, classes: [{ classId: 'warlock', level: 5 }] } as Character,
      [{
        type: 'RESOLVED_OPTION_REPLACEMENT',
        group: 'eldritch-invocation',
        choiceId: 'eldritch-invocation-1',
        optionId: 'mire-the-mind',
      }],
      rulepack,
    )
    expect(swapped.features.filter(f => f.id === feature!.id)).toHaveLength(1)
    expect(swapped.features.find(f => f.id === feature!.id)!.name).toBe('Mire the Mind')
    expect(swapped.features.some(f => f.name === "Devil's Sight")).toBe(false)
  })

  it('is offered on every warlock level from 3rd, the levels that can trade', () => {
    const known = {
      'eldritch-invocation-1': 'agonizing-blast',
      'eldritch-invocation-2': 'devil-s-sight',
    }
    for (let level = 3; level <= 20; level++) {
      const c = blaster(level - 1, { chosenOptions: known })
      expect(replacementOffer(c, 'warlock', level), `level ${level}`).toBeDefined()
    }
  })

  it('is not offered by a class that does not declare the trade', () => {
    const c = char('fighter', 4, { chosenOptions: { 'fighting-style': 'archery' } })
    expect(replacementOffer(c, 'fighter', 5)).toBeUndefined()
  })
})

describe('naming a pool pick on the sheet', () => {
  it('back-fills the features for picks made before they were recorded', () => {
    const c = char('warlock', 5, {
      chosenOptions: {
        'eldritch-invocation-1': 'agonizing-blast',
        'eldritch-invocation-2': 'devil-s-sight',
      },
    })
    const filled = backfillPoolPickFeatures(c, rulepack)
    expect(filled.features.map(f => f.name).sort()).toEqual(['Agonizing Blast', "Devil's Sight"])
    // Idempotent, so the sheet does not re-save on every visit
    expect(backfillPoolPickFeatures(filled, rulepack)).toBe(filled)
  })

  it('leaves a choice outside a shared pool alone, like the Pact Boon', () => {
    // Pact Boon is a one-off pick, already visible through the feature that raised it.
    const c = char('warlock', 3, { chosenOptions: { 'pact-boon': 'pact-of-the-blade' } })
    expect(backfillPoolPickFeatures(c, rulepack)).toBe(c)
  })
})
