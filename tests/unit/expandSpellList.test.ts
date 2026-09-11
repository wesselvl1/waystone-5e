import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import { expandedSpellIdsFor, spellListExpansions, spellIdsForList } from '~/services/spellcasting'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import bard from '~/data/srd/bard.json'
import sorcerer from '~/data/srd/sorcerer.json'
import cleric from '~/data/srd/cleric.json'
import fighter from '~/data/srd/fighter.json'
import warlock from '~/data/srd/warlock.json'
import races from '~/data/srd/races.json'
import spells from '~/data/srd/spells.json'

/** Stand-in for a Ravnica guild background: added to every list, present or future. */
const GUILD_SPELLS = ['command', 'hold-person', 'counterspell']

const BACKGROUND = {
  id: 'azorius',
  name: 'Azorius Functionary',
  description: '',
  skillProficiencies: [],
  toolProficiencies: [],
  languages: 0,
  equipment: [],
  feature: { name: 'Legal Authority', description: '' },
  levelUpEvents: [{
    level: 1,
    levelUpEvents: [{
      type: 'EXPAND_SPELL_LIST' as const,
      addTo: 'all',
      spellIds: GUILD_SPELLS,
      label: 'Azorius Guild Spells',
    }],
  }],
}

/** A plain background, to prove nothing leaks in without a rule. */
const PLAIN_BACKGROUND = {
  id: 'plain', name: 'Plain', description: '',
  skillProficiencies: [], toolProficiencies: [], languages: 0, equipment: [],
  feature: { name: 'Nothing', description: '' },
}

/** Divine Soul: the whole cleric list joins the sorcerer's, from 1st level. */
const DIVINE_SOUL = {
  id: 'divine-soul',
  name: 'Divine Soul',
  description: '',
  classId: 'sorcerer',
  levels: [{
    level: 1,
    features: [{ name: 'Divine Magic', description: '' }],
    levelUpEvents: [{
      type: 'EXPAND_SPELL_LIST' as const,
      addTo: 'sorcerer',
      classes: ['cleric'],
      label: 'Divine Magic',
    }],
  }],
}

/** A subclass whose expansion only arrives at 6th, to pin the level gate. */
const LATE = {
  id: 'late-bloomer',
  name: 'Late Bloomer',
  description: '',
  classId: 'bard',
  levels: [{
    level: 6,
    features: [],
    levelUpEvents: [{
      type: 'EXPAND_SPELL_LIST' as const,
      addTo: 'bard',
      spellIds: ['fireball'],
      label: 'Late Bloomer',
    }],
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p', name: 'Test', version: '1',
    classes: [
      ...RulepackSchema.parse(bard).classes,
      ...RulepackSchema.parse(sorcerer).classes,
      ...RulepackSchema.parse(cleric).classes,
      ...RulepackSchema.parse(fighter).classes,
    ],
    races: RulepackSchema.parse(races).races,
    spells: RulepackSchema.parse(spells).spells,
    backgrounds: [BACKGROUND, PLAIN_BACKGROUND],
    subclasses: [DIVINE_SOUL, LATE],
  }) as unknown as Rulepack
  for (const patch of built.subclasses ?? []) {
    const { classId, ...rest } = patch as never as { classId: string }
    const cls = built.classes.find(c => c.id === classId)
    if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
  }
  return built
}

const rulepack = pack()

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    race: 'human',
    background: 'azorius',
    classes: [{ classId: 'bard', level: 3 }],
    spells: [],
    classSpellcasting: {},
    ...over,
  } as Character
}

const clericSpellIds = rulepack.spells.filter(s => s.classes.includes('cleric')).map(s => s.id)

describe('a background that expands every list', () => {
  it('reaches the class the character has', () => {
    const ids = expandedSpellIdsFor('bard', char(), rulepack)
    expect([...ids].sort()).toEqual([...GUILD_SPELLS].sort())
  })

  /**
   * The case the books call out and the ordering makes awkward: the background is chosen
   * at creation, when there is no spell list to write the spells onto. Deriving rather
   * than storing is what makes this work at all.
   */
  it('reaches a class taken later, without the background being re-applied', () => {
    const multiclassed = char({
      classes: [{ classId: 'bard', level: 3 }, { classId: 'cleric', level: 1 }],
    })
    expect([...expandedSpellIdsFor('cleric', multiclassed, rulepack)].sort())
      .toEqual([...GUILD_SPELLS].sort())
    // and still applies to the original list
    expect(expandedSpellIdsFor('bard', multiclassed, rulepack).size).toBe(3)
  })

  it('reaches a class the character did not have when the rule was written', () => {
    // A non-caster at creation, who multiclasses into a caster at 4th
    const late = char({
      classes: [{ classId: 'fighter', level: 3 }, { classId: 'sorcerer', level: 1 }],
    })
    expect([...expandedSpellIdsFor('sorcerer', late, rulepack)].sort())
      .toEqual([...GUILD_SPELLS].sort())
  })

  it('adds nothing for a background with no rule', () => {
    expect(expandedSpellIdsFor('bard', char({ background: 'plain' }), rulepack).size).toBe(0)
  })

  it('adds nothing for an unknown background', () => {
    expect(expandedSpellIdsFor('bard', char({ background: 'nope' }), rulepack).size).toBe(0)
  })
})

describe('a subclass that widens its own class list', () => {
  it('adds a whole class list by name', () => {
    const ds = char({ classes: [{ classId: 'sorcerer', level: 1, subclassId: 'divine-soul' }], background: 'plain' })
    const ids = expandedSpellIdsFor('sorcerer', ds, rulepack)
    expect(ids.size).toBe(clericSpellIds.length)
    expect(ids.has('cure-wounds')).toBe(true)
    // A cleric-only spell is now on the sorcerer's list
    expect(rulepack.spells.find(s => s.id === 'cure-wounds')!.classes).not.toContain('sorcerer')
  })

  it('does not leak into a sibling class list', () => {
    const ds = char({
      classes: [
        { classId: 'sorcerer', level: 1, subclassId: 'divine-soul' },
        { classId: 'bard', level: 1 },
      ],
      background: 'plain',
    })
    expect(expandedSpellIdsFor('bard', ds, rulepack).size).toBe(0)
  })

  it('respects the level the rule unlocks at', () => {
    const below = char({ classes: [{ classId: 'bard', level: 5, subclassId: 'late-bloomer' }], background: 'plain' })
    const at = char({ classes: [{ classId: 'bard', level: 6, subclassId: 'late-bloomer' }], background: 'plain' })
    expect(expandedSpellIdsFor('bard', below, rulepack).size).toBe(0)
    expect(expandedSpellIdsFor('bard', at, rulepack).has('fireball')).toBe(true)
  })

  it('is inert until the subclass is actually chosen', () => {
    const noSub = char({ classes: [{ classId: 'sorcerer', level: 1 }], background: 'plain' })
    expect(expandedSpellIdsFor('sorcerer', noSub, rulepack).size).toBe(0)
  })
})

describe('several rules at once', () => {
  it('unions a background rule with a subclass rule', () => {
    const both = char({
      classes: [{ classId: 'sorcerer', level: 1, subclassId: 'divine-soul' }],
      background: 'azorius',
    })
    const ids = expandedSpellIdsFor('sorcerer', both, rulepack)
    for (const id of GUILD_SPELLS) expect(ids.has(id), id).toBe(true)
    expect(ids.has('cure-wounds')).toBe(true)
  })

  it('reports each rule separately for display', () => {
    const both = char({
      classes: [{ classId: 'sorcerer', level: 1, subclassId: 'divine-soul' }],
      background: 'azorius',
    })
    const groups = spellListExpansions('sorcerer', both, rulepack)
    expect(groups.map(g => g.label).sort()).toEqual(['Azorius Guild Spells', 'Divine Magic'])
  })
})

describe('the spells a list may draw from', () => {
  const plain = (over: Partial<Character> = {}) => char({ background: 'plain', ...over })

  it('is the class list, not every spell in the pack', () => {
    const ids = spellIdsForList('cleric', plain({ classes: [{ classId: 'cleric', level: 5 }] }), rulepack)!
    expect(ids.has('cure-wounds')).toBe(true)
    // A wizard/sorcerer spell no cleric prepares
    expect(ids.has('fireball')).toBe(false)
    expect(ids.size).toBe(clericSpellIds.length)
  })

  it('includes whatever the expansions in force add', () => {
    const ds = char({ classes: [{ classId: 'sorcerer', level: 1, subclassId: 'divine-soul' }] })
    const ids = spellIdsForList('sorcerer', ds, rulepack)!
    expect(ids.has('fireball')).toBe(true)          // the sorcerer's own
    expect(ids.has('cure-wounds')).toBe(true)       // Divine Magic
    for (const id of GUILD_SPELLS) expect(ids.has(id), id).toBe(true)
  })

  it('narrows nothing for a source that owns no spells', () => {
    // An Eldritch Knight's list is filed under `fighter`, and no spell is a fighter
    // spell — offering only the three the background added would hide the rest
    const ek = char({ classes: [{ classId: 'fighter', level: 3 }] })
    expect(spellIdsForList('fighter', ek, rulepack)).toBeNull()
    expect(spellIdsForList('high-elf', plain(), rulepack)).toBeNull()
  })
})

describe('the event itself', () => {
  it('is emitted as an automatic event, with the rule on it', () => {
    const ds = char({ classes: [{ classId: 'sorcerer', level: 0 }], background: 'azorius' })
    const events = resolveLevelUpEvents(ds, 'sorcerer', 1, rulepack)
    const expand = getAutomaticEvents(events).filter(e => e.type === 'EXPAND_SPELL_LIST')
    expect(expand).toHaveLength(1)
    expect(expand[0]).toMatchObject({
      addTo: 'all',
      spellIds: GUILD_SPELLS,
      label: 'Azorius Guild Spells',
    })
  })

  it('writes nothing to the character when applied', () => {
    const before = char({ classes: [{ classId: 'sorcerer', level: 0 }], background: 'azorius' })
    const events = getAutomaticEvents(resolveLevelUpEvents(before, 'sorcerer', 1, rulepack))
      .filter(e => e.type === 'EXPAND_SPELL_LIST')
    const after = applyAutomaticEvents(before, events, 'average')
    expect(after.spells).toEqual([])
    expect(after.classSpellcasting).toEqual({})
    expect(JSON.stringify(after) === JSON.stringify({ ...before, hp: after.hp })).toBe(true)
  })

  it('is in force from the level itself, needing nothing to have been applied', () => {
    // The rule is derived, so reaching the level is the whole of it
    const atZero = char({ classes: [{ classId: 'sorcerer', level: 0 }], background: 'azorius' })
    const atOne = char({ classes: [{ classId: 'sorcerer', level: 1 }], background: 'azorius' })
    expect(expandedSpellIdsFor('sorcerer', atZero, rulepack).size).toBe(0)
    expect(expandedSpellIdsFor('sorcerer', atOne, rulepack).size).toBe(3)
  })
})

describe('schema', () => {
  it('refuses a rule that expands by nothing', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      backgrounds: [{
        ...PLAIN_BACKGROUND,
        levelUpEvents: [{ level: 1, levelUpEvents: [{ type: 'EXPAND_SPELL_LIST', addTo: 'all' }] }],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts spellIds or classes', () => {
    const mk = (ev: unknown) => RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      backgrounds: [{ ...PLAIN_BACKGROUND, levelUpEvents: [{ level: 1, levelUpEvents: [ev] }] }],
    }).success
    expect(mk({ type: 'EXPAND_SPELL_LIST', addTo: 'all', spellIds: ['command'] })).toBe(true)
    expect(mk({ type: 'EXPAND_SPELL_LIST', addTo: 'bard', classes: ['cleric'] })).toBe(true)
  })
})

/**
 * The Genie shape: one choice, four alternative expansions. Mirrors what the converter
 * generates from TCE, including the ids.
 */
const GENIE_OPTION = 'the-genie-option'
const GENIE_LISTS: Record<string, string[]> = {
  dao: ['sanctuary', 'spike-growth'],
  djinni: ['thunderwave', 'gust-of-wind'],
  efreeti: ['burning-hands', 'scorching-ray'],
  marid: ['fog-cloud', 'blur'],
}

const GENIE = {
  id: 'the-genie',
  name: 'The Genie',
  description: '',
  classId: 'warlock',
  levels: [{
    level: 1,
    features: [{ name: 'Genie\'s Vessel', description: '' }],
    levelUpEvents: [
      {
        type: 'CHOOSE_OPTION' as const,
        id: GENIE_OPTION,
        label: 'Choose your Genie',
        options: Object.keys(GENIE_LISTS).map(id => ({ id, name: id, description: '' })),
      },
      ...Object.entries(GENIE_LISTS).map(([id, spellIds]) => ({
        type: 'EXPAND_SPELL_LIST' as const,
        addTo: 'warlock',
        spellIds,
        whenOption: { choiceId: GENIE_OPTION, optionId: id },
        label: `The Genie: ${id}`,
      })),
    ],
  }],
}

describe('an expansion gated on a choice', () => {
  const geniePack = (() => {
    const built = RulepackSchema.parse({
      id: 'p', name: 'Test', version: '1',
      classes: [
        ...RulepackSchema.parse(bard).classes,
        ...RulepackSchema.parse(warlock).classes,
      ],
      races: RulepackSchema.parse(races).races,
      spells: RulepackSchema.parse(spells).spells,
      backgrounds: [PLAIN_BACKGROUND],
      subclasses: [GENIE],
    }) as unknown as Rulepack
    for (const patch of built.subclasses ?? []) {
      const { classId, ...rest } = patch as never as { classId: string }
      const cls = built.classes.find(c => c.id === classId)
      if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
    }
    return built
  })()

  const genieChar = (chosen?: string): Character => ({
    ...validCharacter,
    race: 'human',
    background: 'plain',
    classes: [{ classId: 'warlock', level: 3, subclassId: 'the-genie' }],
    spells: [],
    classSpellcasting: {},
    chosenOptions: chosen ? { [GENIE_OPTION]: chosen } : {},
  } as Character)

  it('adds nothing until the choice is answered', () => {
    expect(expandedSpellIdsFor('warlock', genieChar(), geniePack).size).toBe(0)
  })

  it('adds only the chosen alternative', () => {
    for (const [chosen, own] of Object.entries(GENIE_LISTS)) {
      const ids = expandedSpellIdsFor('warlock', genieChar(chosen), geniePack)
      expect([...ids].sort(), chosen).toEqual([...own].sort())
      // …and none of the other three genies' spells
      for (const [other, theirs] of Object.entries(GENIE_LISTS)) {
        if (other === chosen) continue
        for (const id of theirs) expect(ids.has(id), `${chosen} must not get ${other}'s ${id}`).toBe(false)
      }
    }
  })

  it('takes effect from the answer alone, with nothing re-applied', () => {
    // RESOLVED_OPTION only writes chosenOptions; the rule is derived off that
    const before = genieChar()
    const after = { ...before, chosenOptions: { [GENIE_OPTION]: 'marid' } }
    expect(expandedSpellIdsFor('warlock', before, geniePack).size).toBe(0)
    expect([...expandedSpellIdsFor('warlock', after, geniePack)].sort())
      .toEqual([...GENIE_LISTS.marid!].sort())
  })

  it('reports only the chosen rule for display', () => {
    const groups = spellListExpansions('warlock', genieChar('efreeti'), geniePack)
    expect(groups.map(g => g.label)).toEqual(['The Genie: efreeti'])
  })

  /** Resolved at the level the rule is declared, with the subclass already set. */
  const atLevel1 = (chosen?: string) => resolveLevelUpEvents(
    { ...genieChar(chosen), classes: [{ classId: 'warlock', level: 0, subclassId: 'the-genie' }] } as Character,
    'warlock', 1, geniePack,
  )

  it('is not emitted as an event until the choice is answered', () => {
    expect(atLevel1().some(e => e.type === 'EXPAND_SPELL_LIST')).toBe(false)
  })

  it('emits exactly the chosen rule once answered, carrying its guard', () => {
    const emitted = getAutomaticEvents(atLevel1('dao')).filter(e => e.type === 'EXPAND_SPELL_LIST')
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({
      addTo: 'warlock',
      spellIds: GENIE_LISTS.dao,
      whenOption: { choiceId: GENIE_OPTION, optionId: 'dao' },
    })
  })

  /**
   * A warlock picks their patron at 1st, the same level the Genie declares its choice —
   * so resolveLevelUpEvents runs before the subclass exists and cannot emit it. The
   * wizard injects a newly-picked subclass's CHOOSE_OPTION for exactly this reason;
   * this pins that the option is there to be injected.
   */
  it('declares its choice on the subclass level, for the wizard to inject', () => {
    const genie = geniePack.classes
      .flatMap(c => c.subclasses ?? [])
      .find(sub => sub.id === 'the-genie')!
    const options = genie.levels
      .find(l => l.level === 1)!
      .levelUpEvents!
      .filter(e => e.type === 'CHOOSE_OPTION')
    expect(options).toHaveLength(1)
    expect(options[0]!.type === 'CHOOSE_OPTION' && options[0].options.map(o => o.id))
      .toEqual(Object.keys(GENIE_LISTS))
  })

  it('accepts whenOption in the schema', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      subclasses: [{ ...GENIE, classId: 'warlock' }],
    })
    expect(result.success).toBe(true)
  })
})

/**
 * The Divine Soul shape, and the reason the two sides split independently: its five
 * affinities all add the whole cleric list and differ only in the spell they grant. So
 * the expansion must stay ungated while the grants are gated by the same one choice.
 */
const AFFINITY_OPTION = 'divine-soul-option'
const AFFINITY_GRANTS: Record<string, string> = {
  good: 'cure-wounds',
  evil: 'inflict-wounds',
  law: 'bless',
  chaos: 'bane',
}

const DIVINE_SOUL_GATED = {
  id: 'divine-soul-gated',
  name: 'Divine Soul',
  description: '',
  classId: 'sorcerer',
  levels: [{
    level: 1,
    features: [{ name: 'Divine Magic', description: '' }],
    levelUpEvents: [
      {
        type: 'CHOOSE_OPTION' as const,
        id: AFFINITY_OPTION,
        label: 'Choose your Divine Soul',
        options: Object.keys(AFFINITY_GRANTS).map(id => ({ id, name: id, description: '' })),
      },
      // Ungated: every affinity grants the cleric list
      {
        type: 'EXPAND_SPELL_LIST' as const,
        addTo: 'sorcerer',
        classes: ['cleric'],
        label: 'Divine Magic',
      },
      // Gated: only the chosen affinity's spell
      ...Object.entries(AFFINITY_GRANTS).map(([id, spellId]) => ({
        type: 'GRANT_SPELLS' as const,
        addTo: 'sorcerer',
        spellIds: [spellId],
        alwaysPrepared: true,
        whenOption: { choiceId: AFFINITY_OPTION, optionId: id },
        label: `Divine Soul: ${id}`,
      })),
    ],
  }],
}

describe('gated grants beside an ungated expansion', () => {
  const dsPack = (() => {
    const built = RulepackSchema.parse({
      id: 'p', name: 'Test', version: '1',
      classes: [
        ...RulepackSchema.parse(sorcerer).classes,
        ...RulepackSchema.parse(cleric).classes,
      ],
      races: RulepackSchema.parse(races).races,
      spells: RulepackSchema.parse(spells).spells,
      backgrounds: [PLAIN_BACKGROUND],
      subclasses: [DIVINE_SOUL_GATED],
    }) as unknown as Rulepack
    for (const patch of built.subclasses ?? []) {
      const { classId, ...rest } = patch as never as { classId: string }
      const cls = built.classes.find(c => c.id === classId)
      if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
    }
    return built
  })()

  const ds = (chosen?: string, level = 1): Character => ({
    ...validCharacter,
    race: 'human',
    background: 'plain',
    classes: [{ classId: 'sorcerer', level, subclassId: 'divine-soul-gated' }],
    spells: [],
    classSpellcasting: {},
    chosenOptions: chosen ? { [AFFINITY_OPTION]: chosen } : {},
  } as Character)

  it('applies the expansion with no affinity chosen', () => {
    // The asymmetry that made splitting the two sides necessary
    const ids = expandedSpellIdsFor('sorcerer', ds(), dsPack)
    expect(ids.has('cure-wounds')).toBe(true)
    expect(ids.size).toBeGreaterThan(20)
  })

  it('keeps the expansion whichever affinity is chosen', () => {
    for (const affinity of Object.keys(AFFINITY_GRANTS)) {
      expect(expandedSpellIdsFor('sorcerer', ds(affinity), dsPack).has('cure-wounds'), affinity)
        .toBe(true)
    }
  })

  it('grants nothing while no affinity has been chosen', () => {
    const events = resolveLevelUpEvents(ds(undefined, 0), 'sorcerer', 1, dsPack)
    expect(getAutomaticEvents(events).some(e => e.type === 'GRANT_SPELLS')).toBe(false)
  })

  it('grants only the chosen affinity spell', () => {
    for (const [affinity, spellId] of Object.entries(AFFINITY_GRANTS)) {
      const events = getAutomaticEvents(resolveLevelUpEvents(ds(affinity, 0), 'sorcerer', 1, dsPack))
        .filter(e => e.type === 'GRANT_SPELLS')
      expect(events, affinity).toHaveLength(1)
      expect(events[0]!.type === 'GRANT_SPELLS' && events[0].spells.map(s => s.spellId))
        .toEqual([spellId])
    }
  })

  /** The affinity is picked on the same level-up as the subclass, so this is the real path. */
  it('applies the grant when the option is resolved on the same level-up', () => {
    const result = applyResolvedChoices(
      ds(undefined, 1),
      [
        { type: 'RESOLVED_SUBCLASS', classId: 'sorcerer', subclassId: 'divine-soul-gated' },
        { type: 'RESOLVED_OPTION', choiceId: AFFINITY_OPTION, optionId: 'evil' },
      ],
      dsPack,
    )
    expect(result.spells.map(s => s.spellId)).toEqual(['inflict-wounds'])
    expect(result.chosenOptions?.[AFFINITY_OPTION]).toBe('evil')
    // …and no other affinity leaked in
    for (const [affinity, spellId] of Object.entries(AFFINITY_GRANTS)) {
      if (affinity === 'evil') continue
      expect(result.spells.some(s => s.spellId === spellId), affinity).toBe(false)
    }
  })
})
