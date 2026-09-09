import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import { preparedSpellLimit, preparesSpells } from '~/services/spellcasting'
import {
  preparedBonusTotal,
  preparedSpellCount,
  setPreparedBonus,
  PREPARED_BONUS_SOURCES,
} from '~/utils/preparedSpells'
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
    const c = { preparedBonuses: { cleric: { magic: 2 } } }
    expect(limit('cleric', 5, 3, c)).toBe(10)
  })

  it('sums bonuses from every source, and honours a penalty', () => {
    expect(limit('cleric', 5, 3, {
      preparedBonuses: { cleric: { magic: 2, feat: 1, misc: -1 } },
    })).toBe(10)
  })

  it('still never drops below one however negative the bonus', () => {
    expect(limit('cleric', 5, 3, { preparedBonuses: { cleric: { misc: -99 } } })).toBe(1)
  })

  it('applies a bonus only to the list it was entered on', () => {
    const c = char({
      classes: [{ classId: 'cleric', level: 3 }, { classId: 'wizard', level: 3 }],
      preparedBonuses: { cleric: { magic: 3 } },
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
    expect(PREPARED_BONUS_SOURCES.map(s => s.key)).toEqual(['magic', 'feat', 'misc'])
  })

  it('totals nothing for a character who has never set one', () => {
    expect(preparedBonusTotal(char(), 'cleric')).toBe(0)
  })

  it('stores a bonus under its list and source', () => {
    const next = setPreparedBonus(char(), 'cleric', 'magic', 2)
    expect(next).toEqual({ cleric: { magic: 2 } })
  })

  it('keeps the other sources and the other lists when one changes', () => {
    const c = char({ preparedBonuses: { cleric: { magic: 2 }, wizard: { feat: 1 } } })
    expect(setPreparedBonus(c, 'cleric', 'misc', -1))
      .toEqual({ cleric: { magic: 2, misc: -1 }, wizard: { feat: 1 } })
  })

  it('drops a source set back to zero rather than storing it', () => {
    const c = char({ preparedBonuses: { cleric: { magic: 2, feat: 1 } } })
    expect(setPreparedBonus(c, 'cleric', 'magic', 0)).toEqual({ cleric: { feat: 1 } })
  })

  it('drops the whole record once the last bonus is cleared', () => {
    // So a character who never had one stays byte-identical in IndexedDB.
    const c = char({ preparedBonuses: { cleric: { magic: 2 } } })
    expect(setPreparedBonus(c, 'cleric', 'magic', 0)).toBeUndefined()
  })

  it('does not mutate the character it was given', () => {
    const c = char({ preparedBonuses: { cleric: { magic: 2 } } })
    setPreparedBonus(c, 'cleric', 'feat', 3)
    expect(c.preparedBonuses).toEqual({ cleric: { magic: 2 } })
  })
})

describe('preparedBonuses on the schema', () => {
  it('round-trips', () => {
    const c = { ...validCharacter, preparedBonuses: { cleric: { magic: 2, misc: -1 } } }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(c)))
    expect(parsed.preparedBonuses).toEqual({ cleric: { magic: 2, misc: -1 } })
  })

  it('is optional, so characters predating it still validate', () => {
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(validCharacter)))
    expect(parsed.preparedBonuses).toBeUndefined()
  })
})
