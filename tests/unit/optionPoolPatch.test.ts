import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { mergeOptionPools } from '~/services/rulepackMerge'
import {
  resolveLevelUpEvents,
  getChoiceEvents,
  applyResolvedChoices,
  backfillPoolPickFeatures,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, OptionPoolPatch } from '~/types/rulepack'
import type { ChooseOptionEvent, ReplaceOptionEvent } from '~/types/events'
import { validCharacter } from '../fixtures'
import warlock from '~/data/srd/warlock.json'
import spells from '~/data/srd/spells.json'

/**
 * A book widening a pool it does not own — the reason the mechanism exists. These stand
 * in for Tasha's invocations rather than reading them: app/data/tce is gitignored dev
 * data, so a test sourcing it would pass only on a machine that owns the book.
 */
const TCE_POOLS: OptionPoolPatch[] = [
  {
    choiceId: 'pact-boon',
    options: [{ id: 'tce.pact-of-the-talisman', name: 'Pact of the Talisman', description: 'A talisman.' }],
  },
  {
    group: 'eldritch-invocation',
    options: [
      { id: 'tce.eldritch-mind', name: 'Eldritch Mind', description: 'Advantage on concentration.' },
      {
        id: 'tce.rebuke-of-the-talisman',
        name: 'Rebuke of the Talisman',
        description: 'Push the attacker.',
        requiresOption: { choiceId: 'pact-boon', optionId: 'tce.pact-of-the-talisman' },
      },
      { id: 'tce.undying-servitude', name: 'Undying Servitude', description: 'Cast animate dead.', minLevel: 5 },
    ],
  },
]

function pack(optionPools: OptionPoolPatch[] = []): Rulepack {
  return {
    id: 'composed',
    name: 'composed',
    version: '0',
    races: [],
    classes: RulepackSchema.parse(warlock).classes,
    backgrounds: [],
    feats: [],
    spells: RulepackSchema.parse(spells).spells,
    creatures: [],
    optionalFeatures: [],
    optionPools,
  } as unknown as Rulepack
}

function char(level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'warlock', level }],
    spells: [],
    spellSlots: {},
    ...over,
  } as Character
}

function choices(c: Character, level: number, rulepack: Rulepack): ChooseOptionEvent[] {
  return getChoiceEvents(resolveLevelUpEvents(c, 'warlock', level, rulepack))
    .filter((e): e is ChooseOptionEvent => e.type === 'CHOOSE_OPTION')
}

const invocationIds = (events: ChooseOptionEvent[]) =>
  events.find(e => e.group === 'eldritch-invocation')?.options.map(o => o.id) ?? []

describe('option pool patches', () => {
  it('leaves the pool alone when no pack patches it', () => {
    const offered = invocationIds(choices(char(1), 2, pack()))
    expect(offered).toContain('armor-of-shadows')
    expect(offered).not.toContain('tce.eldritch-mind')
  })

  it('offers a patched-in invocation alongside the SRD ones', () => {
    const offered = invocationIds(choices(char(1), 2, pack(TCE_POOLS)))
    expect(offered).toContain('armor-of-shadows')
    expect(offered).toContain('tce.eldritch-mind')
  })

  it('widens an ungrouped choice named by choiceId', () => {
    const boon = choices(char(2), 3, pack(TCE_POOLS)).find(e => e.id === 'pact-boon')
    expect(boon?.options.map(o => o.id)).toEqual(
      expect.arrayContaining(['pact-of-the-blade', 'tce.pact-of-the-talisman']),
    )
  })

  it('gates a patched option on level like any other', () => {
    expect(invocationIds(choices(char(1), 2, pack(TCE_POOLS)))).not.toContain('tce.undying-servitude')
    expect(invocationIds(choices(char(4), 5, pack(TCE_POOLS)))).toContain('tce.undying-servitude')
  })

  it('gates a patched option on the pact boon the same book adds', () => {
    const withoutBoon = char(4, { chosenOptions: { 'pact-boon': 'pact-of-the-blade' } })
    const withBoon = char(4, { chosenOptions: { 'pact-boon': 'tce.pact-of-the-talisman' } })
    expect(invocationIds(choices(withoutBoon, 5, pack(TCE_POOLS))))
      .not.toContain('tce.rebuke-of-the-talisman')
    expect(invocationIds(choices(withBoon, 5, pack(TCE_POOLS))))
      .toContain('tce.rebuke-of-the-talisman')
  })

  it('does not offer a patched pick twice across the pool', () => {
    const taken = char(4, { chosenOptions: { 'eldritch-invocation-1': 'tce.eldritch-mind' } })
    expect(invocationIds(choices(taken, 5, pack(TCE_POOLS)))).not.toContain('tce.eldritch-mind')
  })

  it('names a patched pick on the sheet', () => {
    const rulepack = pack(TCE_POOLS)
    const updated = applyResolvedChoices(
      char(1),
      [{ type: 'RESOLVED_OPTION', choiceId: 'eldritch-invocation-1', optionId: 'tce.eldritch-mind' }],
      rulepack,
      2,
      'warlock',
    )
    expect(updated.features.map(f => f.name)).toContain('Eldritch Mind')
    expect(updated.chosenOptions?.['eldritch-invocation-1']).toBe('tce.eldritch-mind')
  })

  it('backfills the feature for a patched pick made before the pack was loaded', () => {
    const stored = char(2, { chosenOptions: { 'eldritch-invocation-1': 'tce.eldritch-mind' } })
    expect(backfillPoolPickFeatures(stored, pack(TCE_POOLS)).features.map(f => f.name))
      .toContain('Eldritch Mind')
  })

  it('offers a patched option as a retraining target', () => {
    const rulepack = pack(TCE_POOLS)
    const held = char(4, { chosenOptions: { 'eldritch-invocation-1': 'agonizing-blast' } })
    const swap = getChoiceEvents(resolveLevelUpEvents(held, 'warlock', 5, rulepack))
      .find((e): e is ReplaceOptionEvent => e.type === 'REPLACE_OPTION')
    expect(swap?.options.map(o => o.id)).toContain('tce.eldritch-mind')
  })
})

describe('RulepackSchema option pools', () => {
  const envelope = { id: 'tce', name: 'Tasha', version: '1.0' }

  it('accepts a pool naming a group', () => {
    const parsed = RulepackSchema.parse({ ...envelope, optionPools: TCE_POOLS })
    expect(parsed.optionPools).toHaveLength(2)
  })

  it('defaults to no pools', () => {
    expect(RulepackSchema.parse(envelope).optionPools).toEqual([])
  })

  it('rejects a pool that names neither a group nor a choice', () => {
    const bad = { ...envelope, optionPools: [{ options: TCE_POOLS[1]!.options }] }
    expect(RulepackSchema.safeParse(bad).success).toBe(false)
  })
})

describe('mergeOptionPools', () => {
  it('unions the options of two fragments widening the same pool', () => {
    const merged = mergeOptionPools(
      [{ group: 'eldritch-invocation', options: [{ id: 'a', name: 'A', description: '' }] }],
      [{ group: 'eldritch-invocation', options: [{ id: 'b', name: 'B', description: '' }] }],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]!.options.map(o => o.id)).toEqual(['a', 'b'])
  })

  it('keeps pools that name different targets apart', () => {
    const merged = mergeOptionPools(
      [{ group: 'eldritch-invocation', options: [{ id: 'a', name: 'A', description: '' }] }],
      [{ choiceId: 'pact-boon', options: [{ id: 'a', name: 'A', description: '' }] }],
    )
    expect(merged).toHaveLength(2)
  })

  it('lets an incoming option overwrite the one it shares an id with', () => {
    const merged = mergeOptionPools(
      [{ group: 'metamagic', options: [{ id: 'a', name: 'Old', description: '' }] }],
      [{ group: 'metamagic', options: [{ id: 'a', name: 'New', description: '' }] }],
    )
    expect(merged[0]!.options).toEqual([{ id: 'a', name: 'New', description: '' }])
  })
})
