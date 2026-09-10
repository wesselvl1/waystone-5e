import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import {
  baseSpellSlots, casterLevelFor, maxSpellLevelForClass, knownSpellLimit, spellSlotMax,
} from '~/services/spellcasting'
import type { Character, ClassEntry } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'
import wizard from '~/data/srd/wizard.json'
import paladin from '~/data/srd/paladin.json'
import warlock from '~/data/srd/warlock.json'
import spells from '~/data/srd/spells.json'

/** The printed Eldritch Knight table, level 3-20. Levels 1-2 have no slots. */
const EK_TABLE: Array<[number, Record<number, number>]> = [
  [3, { 1: 2 }], [4, { 1: 3 }], [5, { 1: 3 }], [6, { 1: 3 }],
  [7, { 1: 4, 2: 2 }], [8, { 1: 4, 2: 2 }], [9, { 1: 4, 2: 2 }],
  [10, { 1: 4, 2: 3 }], [11, { 1: 4, 2: 3 }], [12, { 1: 4, 2: 3 }],
  [13, { 1: 4, 2: 3, 3: 2 }], [14, { 1: 4, 2: 3, 3: 2 }], [15, { 1: 4, 2: 3, 3: 2 }],
  [16, { 1: 4, 2: 3, 3: 3 }], [17, { 1: 4, 2: 3, 3: 3 }], [18, { 1: 4, 2: 3, 3: 3 }],
  [19, { 1: 4, 2: 3, 3: 3, 4: 1 }], [20, { 1: 4, 2: 3, 3: 3, 4: 1 }],
]

const EK = {
  id: 'eldritch-knight',
  name: 'Eldritch Knight',
  description: '',
  spellcasting: {
    ability: 'int' as const,
    progression: 'third' as const,
    list: 'wizard',
    preparation: { kind: 'known' as const },
  },
  levels: EK_TABLE.map(([level, spellSlots], i) => ({
    level,
    features: level === 3 ? [{ name: 'Weapon Bond', description: '' }] : [],
    spellSlots,
    cantripsKnown: level >= 10 ? 3 : 2,
    spellsKnown: [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13][i],
    levelUpEvents: level === 3
      ? [{
          type: 'GRANT_SPELLCASTING' as const,
          addTo: 'fighter',
          ability: 'int' as const,
          list: 'wizard',
          origin: 'class' as const,
          label: 'Eldritch Knight',
        }]
      : [],
  })),
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p', name: 'Test', version: '1',
    classes: [
      ...RulepackSchema.parse(fighter).classes,
      ...RulepackSchema.parse(wizard).classes,
      ...RulepackSchema.parse(paladin).classes,
      ...RulepackSchema.parse(warlock).classes,
    ],
    spells: RulepackSchema.parse(spells).spells,
    subclasses: [{ ...EK, classId: 'fighter' }],
  }) as unknown as Rulepack
  // Distribute the patch entry the way the store does at lookup time
  for (const patch of built.subclasses ?? []) {
    const { classId, ...rest } = patch as never as { classId: string }
    const cls = built.classes.find(c => c.id === classId)
    if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
  }
  return built
}

const rulepack = pack()

const ek = (level: number): ClassEntry[] =>
  [{ classId: 'fighter', level, subclassId: 'eldritch-knight' }]

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: ek(3),
    spells: [],
    classSpellcasting: {},
    ...over,
  } as Character
}

describe('a subclass that supplies spellcasting', () => {
  it('reproduces the printed slot table at every level', () => {
    for (const [level, expected] of EK_TABLE) {
      expect(baseSpellSlots(ek(level), rulepack), `fighter ${level}`).toEqual(expected)
    }
  })

  it('gives a plain fighter no slots', () => {
    expect(baseSpellSlots([{ classId: 'fighter', level: 20 }], rulepack)).toEqual({})
  })

  it('gives an Eldritch Knight below 3rd no slots', () => {
    expect(baseSpellSlots(ek(1), rulepack)).toEqual({})
    expect(baseSpellSlots(ek(2), rulepack)).toEqual({})
  })

  it('contributes a third of its level, rounded down, when multiclassing', () => {
    expect(casterLevelFor({ classId: 'fighter', level: 3, subclassId: 'eldritch-knight' }, rulepack)).toBe(1)
    expect(casterLevelFor({ classId: 'fighter', level: 8, subclassId: 'eldritch-knight' }, rulepack)).toBe(2)
    expect(casterLevelFor({ classId: 'fighter', level: 20, subclassId: 'eldritch-knight' }, rulepack)).toBe(6)
    // Without the subclass the fighter still contributes nothing
    expect(casterLevelFor({ classId: 'fighter', level: 20 }, rulepack)).toBe(0)
  })

  it('combines with another caster on the multiclass table', () => {
    // Fighter 3 (EK) + wizard 5 = caster level 1 + 5 = 6
    const combined = baseSpellSlots(
      [...ek(3), { classId: 'wizard', level: 5 }],
      rulepack,
    )
    const wizardTable = rulepack.classes.find(c => c.id === 'wizard')!
    expect(combined).toEqual(wizardTable.levels.find(l => l.level === 6)!.spellSlots)
  })

  it('caps learnable spell level by the subclass table', () => {
    expect(maxSpellLevelForClass('fighter', ek(3), rulepack)).toBe(1)
    expect(maxSpellLevelForClass('fighter', ek(7), rulepack)).toBe(2)
    expect(maxSpellLevelForClass('fighter', ek(19), rulepack)).toBe(4)
    expect(maxSpellLevelForClass('fighter', [{ classId: 'fighter', level: 19 }], rulepack)).toBe(0)
  })

  it('reads Spells Known off the subclass, since the class table has no such column', () => {
    const limit = (level: number) =>
      knownSpellLimit('fighter', { classes: ek(level) } as never, rulepack)
    expect(limit(3)).toBe(3)
    expect(limit(20)).toBe(13)
    expect(knownSpellLimit('fighter', { classes: [{ classId: 'fighter', level: 3 }] } as never, rulepack))
      .toBeNull()
  })

  it('feeds spellSlotMax, so the sheet renders the slots', () => {
    const c = char({ classes: ek(7), spellSlots: { 1: { used: 0 }, 2: { used: 0 } } } as Partial<Character>)
    expect(spellSlotMax(1, c, rulepack)).toBe(4)
    expect(spellSlotMax(2, c, rulepack)).toBe(2)
    expect(spellSlotMax(3, c, rulepack)).toBe(0)
  })
})

describe('existing casters are unaffected', () => {
  it('still reads a half caster from its own table when single-classed', () => {
    const pal = rulepack.classes.find(c => c.id === 'paladin')!
    expect(baseSpellSlots([{ classId: 'paladin', level: 5 }], rulepack))
      .toEqual(pal.levels.find(l => l.level === 5)!.spellSlots)
    expect(casterLevelFor({ classId: 'paladin', level: 5 }, rulepack)).toBe(2)
  })

  it('still excludes pact magic from shared slots but caps its spell level', () => {
    expect(baseSpellSlots([{ classId: 'warlock', level: 5 }], rulepack)).toEqual({})
    expect(casterLevelFor({ classId: 'warlock', level: 5 }, rulepack)).toBe(0)
    // The warlock's own table is still what limits which spells it may learn
    expect(maxSpellLevelForClass('warlock', [{ classId: 'warlock', level: 5 }], rulepack)).toBe(3)
  })

  it('still reads a full caster from its own table', () => {
    const wiz = rulepack.classes.find(c => c.id === 'wizard')!
    expect(baseSpellSlots([{ classId: 'wizard', level: 9 }], rulepack))
      .toEqual(wiz.levels.find(l => l.level === 9)!.spellSlots)
  })
})

describe('GRANT_SPELLCASTING', () => {
  it('is emitted at the level the subclass table starts, as an automatic event', () => {
    const withSub = char({ classes: ek(2) })
    const events = resolveLevelUpEvents(withSub, 'fighter', 3, rulepack)
    const grant = getAutomaticEvents(events).find(e => e.type === 'GRANT_SPELLCASTING')
    expect(grant).toMatchObject({
      addTo: 'fighter',
      ability: 'int',
      list: 'wizard',
      origin: 'class',
      label: 'Eldritch Knight',
    })
  })

  it('is not emitted at a level the subclass does not start casting', () => {
    const events = resolveLevelUpEvents(char({ classes: ek(3) }), 'fighter', 4, rulepack)
    expect(events.some(e => e.type === 'GRANT_SPELLCASTING')).toBe(false)
  })

  it('registers the source so the class gets its own DC', () => {
    const events = resolveLevelUpEvents(char({ classes: ek(2) }), 'fighter', 3, rulepack)
    const result = applyAutomaticEvents(char({ classes: ek(2) }), getAutomaticEvents(events), 'average')
    expect(result.classSpellcasting.fighter).toEqual({
      ability: 'int',
      origin: 'class',
      label: 'Eldritch Knight',
      spells: [],
    })
  })

  it('does not overwrite an ability the player chose', () => {
    const chosen = char({
      classes: ek(2),
      classSpellcasting: {
        fighter: { ability: 'cha', origin: 'class', abilityChosen: true, spells: [] },
      },
    })
    const events = resolveLevelUpEvents(chosen, 'fighter', 3, rulepack)
    const result = applyAutomaticEvents(chosen, getAutomaticEvents(events), 'average')
    expect(result.classSpellcasting.fighter!.ability).toBe('cha')
    expect(result.classSpellcasting.fighter!.abilityChosen).toBe(true)
  })

  it('keeps spells already recorded against the source', () => {
    const withSpell = char({
      classes: ek(2),
      classSpellcasting: {
        fighter: {
          ability: 'int',
          spells: [{ id: 'a', spellId: 'shield', name: 'Shield', level: 1, prepared: true }],
        },
      },
    } as Partial<Character>)
    const events = resolveLevelUpEvents(withSpell, 'fighter', 3, rulepack)
    const result = applyAutomaticEvents(withSpell, getAutomaticEvents(events), 'average')
    expect(result.classSpellcasting.fighter!.spells).toHaveLength(1)
  })

  it('writes no spell slots — those stay derived', () => {
    const events = resolveLevelUpEvents(char({ classes: ek(2) }), 'fighter', 3, rulepack)
    const result = applyAutomaticEvents(char({ classes: ek(2) }), getAutomaticEvents(events), 'average')
    // Nothing stored; the derivation is what produces them once the level is applied
    expect(Object.values(result.spellSlots).every(s => s.bonus === undefined)).toBe(true)
    expect(baseSpellSlots(ek(3), rulepack)).toEqual({ 1: 2 })
  })
})

describe('schema', () => {
  it('rejects an unknown progression', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      subclasses: [{
        id: 's', name: 'S', description: '', classId: 'fighter', levels: [],
        spellcasting: { ability: 'int', progression: 'quarter' },
      }],
    })
    expect(result.success).toBe(false)
  })

  it('keeps a subclass without spellcasting free of the field', () => {
    const parsed = RulepackSchema.parse({
      id: 'p', name: 'P', version: '1',
      subclasses: [{ id: 's', name: 'S', description: '', classId: 'fighter', levels: [] }],
    })
    expect(parsed.subclasses[0]!.spellcasting).toBeUndefined()
  })
})

describe('picking the subclass at the level casting begins', () => {
  /**
   * The real path in play. resolveLevelUpEvents runs before the subclass is chosen, so
   * the subclass's own level-3 events are not in the run at all — RESOLVED_SUBCLASS
   * replays them. Without that an Eldritch Knight would gain slots with no DC.
   */
  it('registers the source from RESOLVED_SUBCLASS', () => {
    const before = char({ classes: [{ classId: 'fighter', level: 3 }] })
    const result = applyResolvedChoices(
      before,
      [{ type: 'RESOLVED_SUBCLASS', classId: 'fighter', subclassId: 'eldritch-knight' }],
      rulepack,
    )
    expect(result.classes[0]!.subclassId).toBe('eldritch-knight')
    expect(result.classSpellcasting.fighter).toMatchObject({
      ability: 'int',
      origin: 'class',
      label: 'Eldritch Knight',
    })
    // …and the slots follow from the subclass now being set
    expect(baseSpellSlots(result.classes, rulepack)).toEqual({ 1: 2 })
  })

  it('adds the subclass feature alongside it', () => {
    const result = applyResolvedChoices(
      char({ classes: [{ classId: 'fighter', level: 3 }] }),
      [{ type: 'RESOLVED_SUBCLASS', classId: 'fighter', subclassId: 'eldritch-knight' }],
      rulepack,
    )
    expect(result.features.map(f => f.name)).toContain('Weapon Bond')
  })
})

/**
 * The Spells Known / Cantrips Known columns turned into choices, one per increase — the
 * shape every SRD known caster uses, but declared on the subclass because that is where
 * the columns live for an Eldritch Knight.
 */
const EK_KNOWN = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]
const EK_CANTRIPS = EK_TABLE.map(([level]) => (level >= 10 ? 3 : 2))

const EK_CHOICES = {
  id: 'ek-choices',
  name: 'Eldritch Knight',
  description: '',
  spellcasting: {
    ability: 'int' as const,
    progression: 'third' as const,
    list: 'wizard',
    preparation: { kind: 'known' as const },
  },
  levels: EK_TABLE.map(([level, spellSlots], i) => {
    const events = []
    const spellGain = EK_KNOWN[i]! - (EK_KNOWN[i - 1] ?? 0)
    const cantripGain = EK_CANTRIPS[i]! - (EK_CANTRIPS[i - 1] ?? 0)
    if (spellGain > 0) {
      events.push({ type: 'CHOOSE_SPELL' as const, addTo: 'fighter', count: spellGain, cantrip: false, classes: ['wizard'] })
    }
    if (cantripGain > 0) {
      events.push({ type: 'CHOOSE_SPELL' as const, addTo: 'fighter', count: cantripGain, cantrip: true, classes: ['wizard'] })
    }
    return {
      level,
      features: [],
      spellSlots,
      cantripsKnown: EK_CANTRIPS[i],
      spellsKnown: EK_KNOWN[i],
      levelUpEvents: events,
    }
  }),
}

describe('a spellcasting subclass asks for its spells', () => {
  const pack2 = (() => {
    const built = RulepackSchema.parse({
      id: 'p', name: 'Test', version: '1',
      classes: [
        ...RulepackSchema.parse(fighter).classes,
        ...RulepackSchema.parse(wizard).classes,
      ],
      spells: RulepackSchema.parse(spells).spells,
      subclasses: [{ ...EK_CHOICES, classId: 'fighter' }],
    }) as unknown as Rulepack
    for (const patch of built.subclasses ?? []) {
      const { classId, ...rest } = patch as never as { classId: string }
      const cls = built.classes.find(c => c.id === classId)
      if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
    }
    return built
  })()

  const ekc = (level: number): ClassEntry[] =>
    [{ classId: 'fighter', level, subclassId: 'ek-choices' }]

  it('asks for three spells and two cantrips at 3rd', () => {
    const events = resolveLevelUpEvents(
      char({ classes: ekc(2) }), 'fighter', 3, pack2,
    )
    const choices = getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL')
    expect(choices.map(c => c.type === 'CHOOSE_SPELL' && [c.count, c.cantrip, c.classes]))
      .toEqual([[3, false, ['wizard']], [2, true, ['wizard']]])
  })

  it('asks nothing at a level the columns do not move', () => {
    for (const level of [5, 6, 9, 12]) {
      const events = resolveLevelUpEvents(char({ classes: ekc(level - 1) }), 'fighter', level, pack2)
      expect(getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL'), `level ${level}`)
        .toEqual([])
    }
  })

  it('asks for one more cantrip at 10th, when the column climbs', () => {
    const events = resolveLevelUpEvents(char({ classes: ekc(9) }), 'fighter', 10, pack2)
    const cantrips = getChoiceEvents(events)
      .filter(e => e.type === 'CHOOSE_SPELL' && e.cantrip)
    expect(cantrips).toHaveLength(1)
    expect(cantrips[0]!.type === 'CHOOSE_SPELL' && cantrips[0].count).toBe(1)
  })

  it('adds the chosen spells to the parent class list', () => {
    const events = resolveLevelUpEvents(char({ classes: ekc(2) }), 'fighter', 3, pack2)
    for (const c of getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL')) {
      expect(c.type === 'CHOOSE_SPELL' && c.addTo).toBe('fighter')
    }
  })

  /** The totals have to match the printed columns, or the subclass drifts from the book. */
  it('asks for exactly as many spells as the table names', () => {
    let cantrips = 0
    let known = 0
    for (const [level] of EK_TABLE) {
      const events = resolveLevelUpEvents(char({ classes: ekc(level - 1) }), 'fighter', level, pack2)
      for (const c of getChoiceEvents(events)) {
        if (c.type !== 'CHOOSE_SPELL') continue
        if (c.cantrip) cantrips += c.count
        else known += c.count
      }
    }
    expect(cantrips).toBe(EK_CANTRIPS.at(-1))
    expect(known).toBe(EK_KNOWN.at(-1))
  })

  it('caps what may be picked by the subclass table, not the fighter class', () => {
    // Third level: 1st-level spells only, from the subclass's own slot table
    expect(maxSpellLevelForClass('fighter', ekc(3), pack2)).toBe(1)
    expect(maxSpellLevelForClass('fighter', ekc(13), pack2)).toBe(3)
  })

  it('asks nothing of a fighter with a non-casting subclass', () => {
    const events = resolveLevelUpEvents(
      char({ classes: [{ classId: 'fighter', level: 2 }] }), 'fighter', 3, pack2,
    )
    expect(getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL')).toEqual([])
  })
})
