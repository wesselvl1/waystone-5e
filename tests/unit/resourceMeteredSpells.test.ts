import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import monk from '~/data/srd/monk.json'
import spells from '~/data/srd/spells.json'

/** Way of Shadow: four spells, each cast for 2 Ki, from the level the subclass is taken. */
const SHADOW_SPELLS = ['darkness', 'pass-without-trace', 'silence']

const WAY_OF_SHADOW = {
  id: 'way-of-shadow',
  name: 'Way of Shadow',
  description: '',
  classId: 'monk',
  levels: [{
    level: 3,
    features: [{ name: 'Shadow Arts', description: '' }],
    levelUpEvents: [{
      type: 'GRANT_SPELLS' as const,
      addTo: 'monk',
      spellIds: SHADOW_SPELLS,
      alwaysPrepared: true,
      ability: 'wis' as const,
      cost: { resource: 'Ki', amount: 2 },
      label: 'Shadow Arts',
    }],
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p', name: 'Test', version: '1',
    classes: RulepackSchema.parse(monk).classes,
    spells: RulepackSchema.parse(spells).spells,
    subclasses: [WAY_OF_SHADOW],
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
    classes: [{ classId: 'monk', level: 3, subclassId: 'way-of-shadow' }],
    spells: [],
    classSpellcasting: {},
    features: [{
      id: 'monk-ki-2', name: 'Ki', source: 'Monk', description: '',
      usesMax: 3, usesRemaining: 3, recharge: 'short',
    }],
    ...over,
  } as Character
}

describe('a resource-metered grant', () => {
  it('carries the cost onto the event', () => {
    const events = resolveLevelUpEvents(
      char({ classes: [{ classId: 'monk', level: 2, subclassId: 'way-of-shadow' }] }),
      'monk', 3, rulepack,
    )
    const grant = getAutomaticEvents(events).find(e => e.type === 'GRANT_SPELLS')
    expect(grant?.type === 'GRANT_SPELLS' && grant.cost).toEqual({ resource: 'Ki', amount: 2 })
  })

  it('persists the cost on each spell, with no free-cast pool of its own', () => {
    const before = char({ classes: [{ classId: 'monk', level: 2, subclassId: 'way-of-shadow' }] })
    const events = getAutomaticEvents(resolveLevelUpEvents(before, 'monk', 3, rulepack))
    const after = applyAutomaticEvents(before, events, 'average')
    for (const id of SHADOW_SPELLS) {
      const entry = after.spells.find(s => s.spellId === id)
      expect(entry, id).toBeDefined()
      expect(entry!.cost).toEqual({ resource: 'Ki', amount: 2 })
      // The pool is the Ki feature's; duplicating it here would drift
      expect(entry!.uses).toBeUndefined()
    }
  })

  it('registers the source so the spells get the monk\'s DC', () => {
    const before = char({ classes: [{ classId: 'monk', level: 2, subclassId: 'way-of-shadow' }] })
    const events = getAutomaticEvents(resolveLevelUpEvents(before, 'monk', 3, rulepack))
    const after = applyAutomaticEvents(before, events, 'average')
    expect(after.classSpellcasting.monk).toMatchObject({ ability: 'wis', label: 'Shadow Arts' })
  })

  /**
   * The path that actually happens: a monk picks Way of Shadow at 3rd, the same level the
   * grant sits on, so RESOLVED_SUBCLASS replays it. That replay used to build spell
   * entries by hand and dropped uses, cost and the source's ability entirely.
   */
  it('keeps the cost when replayed at the level the subclass is chosen', () => {
    const result = applyResolvedChoices(
      char({ classes: [{ classId: 'monk', level: 3 }] }),
      [{ type: 'RESOLVED_SUBCLASS', classId: 'monk', subclassId: 'way-of-shadow' }],
      rulepack,
    )
    expect(result.spells.map(s => s.spellId).sort()).toEqual([...SHADOW_SPELLS].sort())
    for (const entry of result.spells) {
      expect(entry.cost, entry.spellId).toEqual({ resource: 'Ki', amount: 2 })
    }
    // …and the source metadata the hand-rolled version also lost
    expect(result.classSpellcasting.monk).toMatchObject({ ability: 'wis', label: 'Shadow Arts' })
  })

  it('names a feature the character actually has, so the pool can be found', () => {
    const c = char()
    const cost = { resource: 'Ki', amount: 2 }
    expect(c.features.some(f => f.name === cost.resource)).toBe(true)
    const ki = c.features.find(f => f.name === 'Ki')!
    expect(ki.usesMax).toBeGreaterThan(0)
  })
})

describe('schema', () => {
  it('accepts a cost on the rulepack grant', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      subclasses: [{ ...WAY_OF_SHADOW }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a cost of zero or less', () => {
    const mk = (amount: number) => RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      subclasses: [{
        ...WAY_OF_SHADOW,
        levels: [{
          level: 3,
          features: [],
          levelUpEvents: [{
            type: 'GRANT_SPELLS', addTo: 'monk', spellIds: ['darkness'],
            cost: { resource: 'Ki', amount },
          }],
        }],
      }],
    }).success
    expect(mk(1)).toBe(true)
    expect(mk(0)).toBe(false)
  })

  it('round-trips the cost on a stored character', () => {
    const stored = {
      ...validCharacter,
      spells: [{
        id: 'x', spellId: 'darkness', name: 'Darkness', level: 2,
        prepared: true, classId: 'monk',
        cost: { resource: 'Ki', amount: 2 },
      }],
    }
    const parsed = CharacterSchema.parse(stored)
    expect(parsed.spells[0]!.cost).toEqual({ resource: 'Ki', amount: 2 })
  })

  it('leaves a spell without a cost alone', () => {
    const parsed = CharacterSchema.parse({
      ...validCharacter,
      spells: [{ id: 'x', spellId: 'darkness', name: 'Darkness', level: 2, prepared: true }],
    })
    expect(parsed.spells[0]!.cost).toBeUndefined()
  })
})
