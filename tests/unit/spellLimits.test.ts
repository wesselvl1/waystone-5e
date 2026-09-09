import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  preparedSpellLimit, knownSpellLimit, spellListLimit, preparesSpells,
} from '~/services/spellcasting'
import {
  spellLimitBonusTotal,
  preparedSpellCount,
  knownSpellCount,
  setSpellLimitBonus,
  SPELL_LIMIT_BONUS_SOURCES,
} from '~/utils/spellLimits'
import type { Character, SpellEntry } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'

import bard from '~/data/srd/bard.json'
import cleric from '~/data/srd/cleric.json'
import druid from '~/data/srd/druid.json'
import fighter from '~/data/srd/fighter.json'
import paladin from '~/data/srd/paladin.json'
import ranger from '~/data/srd/ranger.json'
import sorcerer from '~/data/srd/sorcerer.json'
import warlock from '~/data/srd/warlock.json'
import wizard from '~/data/srd/wizard.json'

function pack(): Rulepack {
  const fragments = [bard, cleric, druid, fighter, paladin, ranger, sorcerer, warlock, wizard]
  return {
    id: 'srd-5.1',
    name: 'srd',
    version: '5.1',
    races: [],
    classes: fragments.flatMap(f => RulepackSchema.parse(f).classes),
    backgrounds: [],
    feats: [],
    spells: [],
    creatures: [],
    optionalFeatures: [],
  } as unknown as Rulepack
}

const rulepack = pack()
const def = (id: string) => rulepack.classes.find(c => c.id === id)

function char(over: Partial<Character> = {}): Character {
  return { ...validCharacter, spells: [], spellSlots: {}, ...over } as Character
}

function spell(over: Partial<SpellEntry>): SpellEntry {
  return {
    id: crypto.randomUUID(),
    spellId: 'bless',
    name: 'Bless',
    level: 1,
    prepared: true,
    ...over,
  } as SpellEntry
}

describe('which classes prepare', () => {
  it('marks the four preparing classes', () => {
    for (const id of ['cleric', 'druid', 'paladin', 'wizard']) {
      expect(preparesSpells(def(id)), id).toBe(true)
    }
  })

  it('marks the four known-list classes', () => {
    for (const id of ['bard', 'ranger', 'sorcerer', 'warlock']) {
      expect(preparesSpells(def(id)), id).toBe(false)
    }
  })

  it('says no for a class that does not cast, and for nothing at all', () => {
    expect(preparesSpells(def('fighter'))).toBe(false)
    expect(preparesSpells(undefined)).toBe(false)
  })

  it('gives paladin the half-level divisor and the others the full level', () => {
    expect(def('paladin')!.spellPreparation).toEqual({ kind: 'prepared', levelDivisor: 2 })
    for (const id of ['cleric', 'druid', 'wizard']) {
      expect(def(id)!.spellPreparation, id).toEqual({ kind: 'prepared', levelDivisor: 1 })
    }
  })

  it('declares preparation for every SRD caster, so none is left ambiguous', () => {
    const casters = rulepack.classes.filter(c => c.spellcastingAbility)
    expect(casters).toHaveLength(8)
    for (const cls of casters) expect(cls.spellPreparation, cls.id).toBeDefined()
  })
})

describe('the prepared limit', () => {
  const limit = (classId: string, level: number, mod: number, c: Partial<Character> = {}) =>
    preparedSpellLimit(
      classId,
      char({ classes: [{ classId, level }], ...c }),
      rulepack,
      mod,
    )

  it('is the ability modifier plus the class level for a full preparer', () => {
    expect(limit('cleric', 5, 3)).toBe(8)
    expect(limit('wizard', 1, 4)).toBe(5)
    expect(limit('druid', 20, 5)).toBe(25)
  })

  it('is half the level for a paladin, rounded down', () => {
    expect(limit('paladin', 5, 3)).toBe(5) // 3 + floor(5/2)
    expect(limit('paladin', 6, 3)).toBe(6)
    expect(limit('paladin', 2, 0)).toBe(1) // 0 + 1
  })

  it('never drops below one, even with a penalty modifier', () => {
    expect(limit('cleric', 1, -2)).toBe(1)
    expect(limit('paladin', 1, -1)).toBe(1)
  })

  it('is null for a known-list class, which has no limit to track', () => {
    for (const id of ['bard', 'ranger', 'sorcerer', 'warlock']) {
      expect(limit(id, 5, 3), id).toBeNull()
    }
  })

  it('is null for a class that does not cast', () => {
    expect(limit('fighter', 5, 3)).toBeNull()
  })

  it('is null for a race or background grant, which has no class entry', () => {
    const c = char({
      classes: [{ classId: 'fighter', level: 3 }],
      classSpellcasting: {
        tiefling: { ability: 'cha', origin: 'race', label: 'Infernal Legacy' },
      },
    })
    expect(preparedSpellLimit('tiefling', c, rulepack, 3)).toBeNull()
  })

  it('counts each class separately for a multiclass preparer', () => {
    const c = char({
      classes: [{ classId: 'cleric', level: 3 }, { classId: 'wizard', level: 2 }],
    })
    expect(preparedSpellLimit('cleric', c, rulepack, 3)).toBe(6)
    expect(preparedSpellLimit('wizard', c, rulepack, 2)).toBe(4)
  })

  it('adds a manual bonus', () => {
    const c = { spellLimitBonuses: { cleric: { magic: 2 } } }
    expect(limit('cleric', 5, 3, c)).toBe(10)
  })

  it('sums bonuses from every source, and honours a penalty', () => {
    expect(limit('cleric', 5, 3, {
      spellLimitBonuses: { cleric: { magic: 2, feat: 1, misc: -1 } },
    })).toBe(10)
  })

  it('still never drops below one however negative the bonus', () => {
    expect(limit('cleric', 5, 3, { spellLimitBonuses: { cleric: { misc: -99 } } })).toBe(1)
  })

  it('applies a bonus only to the list it was entered on', () => {
    const c = char({
      classes: [{ classId: 'cleric', level: 3 }, { classId: 'wizard', level: 3 }],
      spellLimitBonuses: { cleric: { magic: 3 } },
    })
    expect(preparedSpellLimit('cleric', c, rulepack, 3)).toBe(9)
    expect(preparedSpellLimit('wizard', c, rulepack, 3)).toBe(6)
  })
})

describe('counting what is prepared', () => {
  it('counts prepared spells on that list only', () => {
    const c = char({
      spells: [
        spell({ classId: 'cleric', prepared: true }),
        spell({ classId: 'cleric', prepared: true }),
        spell({ classId: 'cleric', prepared: false }),
        spell({ classId: 'wizard', prepared: true }),
      ],
    })
    expect(preparedSpellCount(c, 'cleric')).toBe(2)
    expect(preparedSpellCount(c, 'wizard')).toBe(1)
  })

  it('ignores cantrips, which are always available', () => {
    const c = char({
      spells: [
        spell({ classId: 'cleric', level: 0, prepared: true }),
        spell({ classId: 'cleric', level: 1, prepared: true }),
      ],
    })
    expect(preparedSpellCount(c, 'cleric')).toBe(1)
  })

  it('ignores an always-prepared spell, which is granted on top of the limit', () => {
    // A Circle of the Land or domain spell does not spend one of your prepared slots.
    const c = char({
      spells: [
        spell({ classId: 'druid', prepared: true, alwaysPrepared: true }),
        spell({ classId: 'druid', prepared: true }),
      ],
    })
    expect(preparedSpellCount(c, 'druid')).toBe(1)
  })

  it('ignores a spell on no list', () => {
    const c = char({ spells: [spell({ classId: undefined, prepared: true })] })
    expect(preparedSpellCount(c, 'cleric')).toBe(0)
  })
})

describe('the bonus editor', () => {
  it('offers the same three sources as the feature-use editor', () => {
    expect(SPELL_LIMIT_BONUS_SOURCES.map(s => s.key)).toEqual(['magic', 'feat', 'misc'])
  })

  it('totals nothing for a character who has never set one', () => {
    expect(spellLimitBonusTotal(char(), 'cleric')).toBe(0)
  })

  it('stores a bonus under its list and source', () => {
    const next = setSpellLimitBonus(char(), 'cleric', 'magic', 2)
    expect(next).toEqual({ cleric: { magic: 2 } })
  })

  it('keeps the other sources and the other lists when one changes', () => {
    const c = char({ spellLimitBonuses: { cleric: { magic: 2 }, wizard: { feat: 1 } } })
    expect(setSpellLimitBonus(c, 'cleric', 'misc', -1))
      .toEqual({ cleric: { magic: 2, misc: -1 }, wizard: { feat: 1 } })
  })

  it('drops a source set back to zero rather than storing it', () => {
    const c = char({ spellLimitBonuses: { cleric: { magic: 2, feat: 1 } } })
    expect(setSpellLimitBonus(c, 'cleric', 'magic', 0)).toEqual({ cleric: { feat: 1 } })
  })

  it('drops the whole record once the last bonus is cleared', () => {
    // So a character who never had one stays byte-identical in IndexedDB.
    const c = char({ spellLimitBonuses: { cleric: { magic: 2 } } })
    expect(setSpellLimitBonus(c, 'cleric', 'magic', 0)).toBeUndefined()
  })

  it('does not mutate the character it was given', () => {
    const c = char({ spellLimitBonuses: { cleric: { magic: 2 } } })
    setSpellLimitBonus(c, 'cleric', 'feat', 3)
    expect(c.spellLimitBonuses).toEqual({ cleric: { magic: 2 } })
  })
})

describe('spellLimitBonuses on the schema', () => {
  it('round-trips', () => {
    const c = { ...validCharacter, spellLimitBonuses: { cleric: { magic: 2, misc: -1 } } }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(c)))
    expect(parsed.spellLimitBonuses).toEqual({ cleric: { magic: 2, misc: -1 } })
  })

  it('is optional, so characters predating it still validate', () => {
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(validCharacter)))
    expect(parsed.spellLimitBonuses).toBeUndefined()
  })
})

describe('the known limit', () => {
  const limit = (classId: string, level: number, c: Partial<Character> = {}) =>
    knownSpellLimit(classId, char({ classes: [{ classId, level }], ...c }), rulepack)

  it('reads the class table', () => {
    // SRD spells known: bard 4 at 1st, sorcerer 6 at 5th, warlock 2 at 1st.
    expect(limit('bard', 1)).toBe(4)
    expect(limit('sorcerer', 5)).toBe(6)
    expect(limit('warlock', 1)).toBe(2)
  })

  it('grows with the class level', () => {
    expect([1, 2, 3, 4, 5].map(l => limit('sorcerer', l))).toEqual([2, 3, 4, 5, 6])
  })

  it('is zero for a ranger 1, which knows none yet', () => {
    // A real answer, not the same as "this list has no limit".
    expect(limit('ranger', 1)).toBe(0)
    expect(limit('ranger', 2)).toBe(2)
  })

  it('is null for a class that prepares instead', () => {
    for (const id of ['cleric', 'druid', 'paladin', 'wizard']) {
      expect(limit(id, 5), id).toBeNull()
    }
  })

  it('is null for a non-caster and for a source with no class behind it', () => {
    expect(limit('fighter', 5)).toBeNull()
    const c = char({
      classes: [{ classId: 'fighter', level: 3 }],
      classSpellcasting: {
        tiefling: { ability: 'cha', origin: 'race', label: 'Infernal Legacy', spells: [] },
      },
    })
    expect(knownSpellLimit('tiefling', c, rulepack)).toBeNull()
  })

  it('takes the same manual bonus as a prepared limit', () => {
    expect(limit('sorcerer', 5, { spellLimitBonuses: { sorcerer: { magic: 2 } } })).toBe(8)
  })

  it('never goes negative, however large the penalty', () => {
    expect(limit('bard', 1, { spellLimitBonuses: { bard: { misc: -99 } } })).toBe(0)
  })

  it('counts each class separately for a multiclass', () => {
    const c = char({
      classes: [{ classId: 'bard', level: 3 }, { classId: 'sorcerer', level: 2 }],
    })
    expect(knownSpellLimit('bard', c, rulepack)).toBe(6)
    expect(knownSpellLimit('sorcerer', c, rulepack)).toBe(3)
  })
})

describe('counting what is known', () => {
  it('counts the levelled spells on that list', () => {
    const c = char({
      spells: [
        spell({ classId: 'sorcerer' }),
        spell({ classId: 'sorcerer', prepared: false }),
        spell({ classId: 'bard' }),
      ],
    })
    // Unlike prepared, a known spell counts whether the flag is set or not
    expect(knownSpellCount(c, 'sorcerer')).toBe(2)
    expect(knownSpellCount(c, 'bard')).toBe(1)
  })

  it('ignores cantrips, which the SRD counts separately', () => {
    const c = char({
      spells: [
        spell({ classId: 'sorcerer', level: 0 }),
        spell({ classId: 'sorcerer', level: 1 }),
      ],
    })
    expect(knownSpellCount(c, 'sorcerer')).toBe(1)
  })

  it('ignores a granted spell, which was not chosen out of the limit', () => {
    const c = char({
      spells: [
        spell({ classId: 'warlock', alwaysPrepared: true }),
        spell({ classId: 'warlock' }),
      ],
    })
    expect(knownSpellCount(c, 'warlock')).toBe(1)
  })
})

describe('the one limit a list actually has', () => {
  const at = (classId: string, level: number, mod: number, over: Partial<Character> = {}) =>
    spellListLimit(
      classId,
      char({ classes: [{ classId, level }], ...over }),
      rulepack,
      mod,
    )

  it('reports a preparer as prepared', () => {
    const c = char({
      classes: [{ classId: 'cleric', level: 5 }],
      spells: [spell({ classId: 'cleric' }), spell({ classId: 'cleric' })],
    })
    expect(spellListLimit('cleric', c, rulepack, 4))
      .toEqual({ kind: 'prepared', used: 2, max: 9, bonus: 0 })
  })

  it('reports a known-list class as known', () => {
    const c = char({
      classes: [{ classId: 'sorcerer', level: 5 }],
      spells: [spell({ classId: 'sorcerer' })],
    })
    expect(spellListLimit('sorcerer', c, rulepack, 3))
      .toEqual({ kind: 'known', used: 1, max: 6, bonus: 0 })
  })

  it('carries the bonus so the sheet can show base and bonus apart', () => {
    expect(at('sorcerer', 5, 3, { spellLimitBonuses: { sorcerer: { feat: 1 } } }))
      .toMatchObject({ kind: 'known', max: 7, bonus: 1 })
  })

  it('is null for a race grant and for a non-caster', () => {
    const c = char({
      classes: [{ classId: 'fighter', level: 3 }],
      classSpellcasting: {
        tiefling: { ability: 'cha', origin: 'race', label: 'Infernal Legacy', spells: [] },
      },
    })
    expect(spellListLimit('tiefling', c, rulepack, 3)).toBeNull()
    expect(at('fighter', 3, 0)).toBeNull()
  })

  it('gives every SRD caster class exactly one kind of limit', () => {
    for (const cls of rulepack.classes.filter(c => c.spellcastingAbility)) {
      const got = at(cls.id, 5, 3)
      expect(got, cls.id).not.toBeNull()
      expect(got!.kind, cls.id)
        .toBe(cls.spellPreparation!.kind === 'known' ? 'known' : 'prepared')
    }
  })

  it('gives a multiclass preparer and known-list caster one each', () => {
    const c = char({
      classes: [{ classId: 'cleric', level: 5 }, { classId: 'sorcerer', level: 3 }],
      spells: [
        spell({ classId: 'cleric' }),
        spell({ classId: 'cleric', alwaysPrepared: true }),
        spell({ classId: 'sorcerer' }),
        spell({ classId: 'sorcerer' }),
      ],
    })
    expect(spellListLimit('cleric', c, rulepack, 4))
      .toEqual({ kind: 'prepared', used: 1, max: 9, bonus: 0 })
    expect(spellListLimit('sorcerer', c, rulepack, 3))
      .toEqual({ kind: 'known', used: 2, max: 4, bonus: 0 })
  })
})
