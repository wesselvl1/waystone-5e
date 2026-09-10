import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  applyResolvedChoices,
  featIncreasedAbility,
  getChoiceEvents,
  resolveFeatEvents,
} from '~/services/levelUpService'
import { spellListExpansions } from '~/services/spellcasting'
import type { Character } from '~/types/character'
import type { ChooseSpellEvent } from '~/types/events'
import type { FeatDefinition, Rulepack } from '~/types/rulepack'

function character(over: Partial<Character> = {}): Character {
  return {
    id: 'c',
    name: 'T',
    race: 'human',
    background: 'soldier',
    classes: [{ classId: 'fighter', level: 4 }],
    experiencePoints: 0,
    inspiration: false,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    abilityScoreOverrides: {},
    hp: { max: 30, current: 30, temp: 0 },
    armorClass: null,
    initiative: null,
    speeds: { walk: 30 },
    hitDice: [],
    spellSlots: {},
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficiencyBonusOverride: null,
    savingThrowProficiencies: [],
    skillProficiencies: {},
    features: [],
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spells: [],
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  } as Character
}

const MISTY_STEP = { id: 'misty-step', name: 'Misty Step', level: 2, school: 'conjuration', castingTime: '1 bonus action', range: 'Self', components: 'V', duration: 'Instantaneous', description: '', classes: ['wizard'] }
const CHARM = { ...MISTY_STEP, id: 'charm-person', name: 'Charm Person', level: 1, school: 'enchantment' }

function pack(over: Partial<Rulepack> = {}): Rulepack {
  return {
    id: 'p',
    name: 'P',
    version: '1',
    races: [],
    classes: [],
    backgrounds: [],
    feats: [],
    spells: [MISTY_STEP, CHARM],
    optionalFeatures: [],
    ...over,
  } as Rulepack
}

/** Fey Touched: a fixed spell and a chosen one, each free once per long rest. */
const FEY_TOUCHED: FeatDefinition = {
  id: 'fey-touched',
  name: 'Fey Touched',
  description: '',
  abilityScoreChoice: { from: ['int', 'wis', 'cha'], distributions: [[1]] },
  levelUpEvents: [
    {
      type: 'GRANT_SPELLS',
      addTo: 'fey-touched',
      spellIds: ['misty-step'],
      alwaysPrepared: true,
      uses: { max: 1, recharge: 'long' },
      ability: 'increased',
      origin: 'feat',
    },
    {
      type: 'CHOOSE_SPELL',
      addTo: 'fey-touched',
      count: 1,
      schools: ['enchantment', 'divination'],
      maxLevel: 1,
      uses: { max: 1, recharge: 'long' },
      ability: 'increased',
      origin: 'feat',
    },
  ],
}

describe('a chosen spell keeps its free cast', () => {
  it('offers the choice on the terms the source set', () => {
    const events = resolveFeatEvents(character(), FEY_TOUCHED, pack(), 'wis')
    const choice = getChoiceEvents(events)
      .find((e): e is ChooseSpellEvent => e.type === 'CHOOSE_SPELL')!
    expect(choice.uses).toEqual({ max: 1, recharge: 'long' })
  })

  it('stores the picked spell with its uses full', () => {
    const out = applyResolvedChoices(character(), [{
      type: 'RESOLVED_CHOOSE_SPELL',
      spellIds: ['charm-person'],
      removedSpellIds: [],
      classId: 'fey-touched',
      uses: { max: 1, recharge: 'long' },
    }], pack(), 'fighter', 5)
    const entry = out.spells.find(s => s.spellId === 'charm-person')!
    expect(entry.uses).toEqual({ max: 1, recharge: 'long', remaining: 1 })
  })

  /** The limit was silently dropped before, so the pick alone is not enough. */
  it('leaves an ordinary pick unmetered', () => {
    const out = applyResolvedChoices(character(), [{
      type: 'RESOLVED_CHOOSE_SPELL',
      spellIds: ['charm-person'],
      removedSpellIds: [],
      classId: 'wizard',
    }], pack(), 'wizard', 2)
    expect(out.spells.find(s => s.spellId === 'charm-person')!.uses).toBeUndefined()
  })

  it('accepts uses on CHOOSE_SPELL through the schema', () => {
    const r = RulepackSchema.safeParse({
      id: 'p',
      name: 'P',
      version: '1',
      feats: [{
        id: 'f',
        name: 'F',
        description: '',
        levelUpEvents: [{
          type: 'CHOOSE_SPELL',
          addTo: 'f',
          count: 1,
          uses: { max: 1, recharge: 'long' },
        }],
      }],
    })
    expect(r.success).toBe(true)
  })
})

describe('casting with the ability the feat increased', () => {
  it('resolves to the ability the player raised', () => {
    const events = resolveFeatEvents(character(), FEY_TOUCHED, pack(), 'wis')
    for (const e of events) {
      if (e.type === 'GRANT_SPELLS' || e.type === 'CHOOSE_SPELL') expect(e.ability).toBe('wis')
    }
  })

  it('reads the increase off the player answer', () => {
    expect(featIncreasedAbility(FEY_TOUCHED, { cha: 1 })).toBe('cha')
  })

  it('falls back to a feat whose increase is fixed', () => {
    expect(featIncreasedAbility({ abilityScoreBonus: { con: 1 } })).toBe('con')
  })

  /** Better unset — which falls back to the class's ability — than guessed. */
  it('leaves it unresolved while the answer is pending', () => {
    expect(featIncreasedAbility(FEY_TOUCHED, {})).toBeUndefined()
    const events = resolveFeatEvents(character(), FEY_TOUCHED, pack(), undefined)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')!
    expect((grant as { ability?: string }).ability).toBeUndefined()
  })

  it('registers the resolved ability against the feat', () => {
    const out = applyResolvedChoices(character(), [{
      type: 'RESOLVED_CHOOSE_FEAT',
      featId: 'fey-touched',
      abilityBonus: { wis: 1 },
    }], pack({ feats: [FEY_TOUCHED] }), 'fighter', 5)
    expect(out.classSpellcasting?.['fey-touched']?.ability).toBe('wis')
  })

  it("rejects a sentinel the pack cannot mean, on GRANT_SPELLCASTING", () => {
    const r = RulepackSchema.safeParse({
      id: 'p',
      name: 'P',
      version: '1',
      feats: [{
        id: 'f',
        name: 'F',
        description: '',
        levelUpEvents: [{ type: 'GRANT_SPELLCASTING', addTo: 'f', ability: 'increased' }],
      }],
    })
    expect(r.success).toBe(false)
  })
})

describe('an expansion that arrives later than the rule', () => {
  const warlock = {
    id: 'warlock',
    name: 'Warlock',
    hitDie: 'd8',
    primaryAbility: ['cha'],
    savingThrowProficiencies: ['wis', 'cha'],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillChoices: { count: 2, from: [] },
    levels: Array.from({ length: 20 }, (_, i) => ({
      level: i + 1,
      features: [],
      levelUpEvents: i === 0
        ? [
            { type: 'EXPAND_SPELL_LIST', addTo: 'warlock', spellIds: ['charm-person'], label: 'Genie' },
            { type: 'EXPAND_SPELL_LIST', addTo: 'warlock', spellIds: ['misty-step'], minLevel: 9, label: 'Genie' },
          ]
        : [],
    })),
  }

  const withLevel = (level: number) => character({ classes: [{ classId: 'warlock', level }] })
  const p = () => pack({ classes: [warlock] as Rulepack['classes'] })

  it('holds back the late spell', () => {
    const ids = spellListExpansions('warlock', withLevel(3), p()).flatMap(e => e.spellIds ?? [])
    expect(ids).toContain('charm-person')
    expect(ids).not.toContain('misty-step')
  })

  it('adds it once the level is reached', () => {
    const ids = spellListExpansions('warlock', withLevel(9), p()).flatMap(e => e.spellIds ?? [])
    expect(ids).toEqual(expect.arrayContaining(['charm-person', 'misty-step']))
  })

  it('counts total character level, not the declaring level', () => {
    const multi = character({ classes: [{ classId: 'warlock', level: 5 }, { classId: 'fighter', level: 4 }] })
    const ids = spellListExpansions('warlock', multi, p()).flatMap(e => e.spellIds ?? [])
    expect(ids).toContain('misty-step')
  })
})

describe('a pool of picks that grows with level', () => {
  const options = [
    { id: 'a', name: 'A', description: '' },
    { id: 'b', name: 'B', description: '' },
    { id: 'c', name: 'C', description: '', minLevel: 6 },
  ]
  const parse = (opts: unknown) => RulepackSchema.safeParse({
    id: 'p',
    name: 'P',
    version: '1',
    classes: [{
      id: 'artificer',
      name: 'Artificer',
      hitDie: 'd8',
      primaryAbility: ['int'],
      savingThrowProficiencies: ['con', 'int'],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillChoices: { count: 2, from: [] },
      levels: [
        { level: 1, features: [], levelUpEvents: [] },
        {
          level: 2,
          features: [],
          levelUpEvents: [
            { type: 'CHOOSE_OPTION', id: 'inf-1', label: 'Infusion', options: opts, group: 'infusions' },
            { type: 'CHOOSE_OPTION', id: 'inf-2', label: 'Infusion (2)', options: opts, group: 'infusions' },
          ],
        },
      ],
    }],
  })

  it('declares one choice per pick, sharing a group', () => {
    const r = parse(options)
    expect(r.success).toBe(true)
    const evs = r.success ? r.data.classes[0]!.levels[1]!.levelUpEvents : []
    expect(evs).toHaveLength(2)
    expect(new Set(evs.map(e => (e as { group?: string }).group))).toEqual(new Set(['infusions']))
    // Distinct ids, or the wizard cannot tell the two picks apart
    expect(new Set(evs.map(e => (e as { id: string }).id)).size).toBe(2)
  })

  it('round-trips an option that opens later than the pool', () => {
    const r = parse(options)
    const opts = r.success
      ? (r.data.classes[0]!.levels[1]!.levelUpEvents[0] as { options: Array<{ minLevel?: number }> }).options
      : []
    expect(opts[2]!.minLevel).toBe(6)
  })

  it('rejects a minLevel outside the level range', () => {
    expect(parse([{ id: 'a', name: 'A', description: '', minLevel: 21 }]).success).toBe(false)
  })
})
