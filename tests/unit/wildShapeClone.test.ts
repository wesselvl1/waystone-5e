import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import type { Rulepack } from '~/types/rulepack'
import type { Character } from '~/types/character'
import { validCharacter } from '../fixtures'
import druidFragment from '~/data/srd/druid.json'
import spellFragment from '~/data/srd/spells.json'

/**
 * The rulepack store keeps packs in reactive state, so everything reached through it is a
 * Vue proxy. Wrapping the fragment in reactive() reproduces that faithfully — without it
 * the regression below cannot fail, because a plain array clones fine.
 */
function reactivePack(): Rulepack {
  const pack = RulepackSchema.parse(druidFragment) as unknown as Rulepack
  pack.spells = RulepackSchema.parse(spellFragment).spells as Rulepack['spells']
  return reactive(pack) as Rulepack
}

function druid(level: number): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'druid', level, name: 'Druid' }],
    spells: [],
    spellSlots: {},
  } as Character
}

describe('level-up output stays structured-cloneable', () => {
  it('a druid reaching level 2 does not store a Vue proxy', () => {
    // Regression: SET_WILD_SHAPE_LIMITS stored eventDef.types by reference. That array
    // belongs to the reactive rulepack, so the character came out holding a proxy and the
    // next structuredClone threw "Proxy object could not be cloned". Level 2 is the one
    // level where it surfaced, because the subclass choice lands there too, meaning
    // applyResolvedChoices runs straight after applyAutomaticEvents.
    const pack = reactivePack()
    const before = druid(1)
    const events = resolveLevelUpEvents(before, 'druid', 2, pack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')

    expect(applied.wildShape?.limits.types).toEqual(['beast'])
    expect(() => structuredClone(applied)).not.toThrow()
  })

  it('survives the full automatic-then-resolved sequence', () => {
    const pack = reactivePack()
    const before = druid(1)
    const events = resolveLevelUpEvents(before, 'druid', 2, pack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')

    // This is the call that threw at levelUpService.ts:457
    const resolved = applyResolvedChoices(
      applied,
      [{ type: 'RESOLVED_SUBCLASS', subclassId: 'circle-of-the-land', classId: 'druid' }],
      pack,
    )

    expect(resolved.classes[0]!.subclassId).toBe('circle-of-the-land')
    expect(resolved.wildShape?.limits.maxCR).toBe(0.25)
    expect(() => structuredClone(resolved)).not.toThrow()
  })

  it('keeps working through every wild shape tier', () => {
    const pack = reactivePack()
    for (const [from, to] of [[1, 2], [3, 4], [7, 8]] as const) {
      const events = resolveLevelUpEvents(druid(from), 'druid', to, pack)
      const applied = applyAutomaticEvents(druid(from), getAutomaticEvents(events), 'average')
      expect(() => structuredClone(applied), `level ${to}`).not.toThrow()
    }
  })

  it('stores a copy, so editing the character cannot mutate the rulepack', () => {
    const pack = reactivePack()
    const events = resolveLevelUpEvents(druid(1), 'druid', 2, pack)
    const applied = applyAutomaticEvents(druid(1), getAutomaticEvents(events), 'average')

    applied.wildShape!.limits.types!.push('elemental')
    const def = pack.classes[0]!.levels
      .find(l => l.level === 2)!.levelUpEvents
      .find(e => e.type === 'SET_WILD_SHAPE_LIMITS')!
    if (def.type === 'SET_WILD_SHAPE_LIMITS') {
      expect(def.types).toEqual(['beast'])
    }
  })
})
