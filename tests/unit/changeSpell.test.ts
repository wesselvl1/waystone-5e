import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  resolveSpellChange,
  getChoiceEvents,
  applyResolvedChoices,
} from '~/services/levelUpService'
import type { Character, SpellEntry } from '~/types/character'
import type { LevelUpEventDef, Rulepack } from '~/types/rulepack'
import type { ChangeSpellEvent } from '~/types/events'
import { validCharacter } from '../fixtures'
import bard from '~/data/srd/bard.json'
import ranger from '~/data/srd/ranger.json'
import sorcerer from '~/data/srd/sorcerer.json'
import warlock from '~/data/srd/warlock.json'
import wizard from '~/data/srd/wizard.json'
import spells from '~/data/srd/spells.json'

function pack(): Rulepack {
  const fragments = [bard, ranger, sorcerer, warlock, wizard]
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

function known(spellId: string, over: Partial<SpellEntry> = {}): SpellEntry {
  const def = rulepack.spells.find(s => s.id === spellId)!
  return {
    id: `entry-${spellId}-${over.classId ?? 'none'}`,
    spellId,
    name: def.name,
    level: def.level,
    prepared: def.level === 0,
    ...over,
  }
}

function char(classes: Character['classes'], spellList: SpellEntry[]): Character {
  return {
    ...validCharacter,
    classes,
    spells: spellList,
    spellSlots: {},
  } as Character
}

function swapOffers(c: Character, classId: string, level: number): ChangeSpellEvent[] {
  return getChoiceEvents(resolveLevelUpEvents(c, classId, level, rulepack))
    .filter((e): e is ChangeSpellEvent => e.type === 'CHANGE_SPELL')
}

const sorcererSwap: Extract<LevelUpEventDef, { type: 'CHANGE_SPELL' }> = {
  type: 'CHANGE_SPELL',
  addTo: 'sorcerer',
  amount: 1,
  classes: ['sorcerer'],
}

describe('offering a known-spell swap', () => {
  it('is not offered while the class knows no spells to trade', () => {
    const c = char([{ classId: 'sorcerer', level: 1 }], [known('fire-bolt', { classId: 'sorcerer' })])
    expect(resolveSpellChange(sorcererSwap, c, rulepack, 2)).toBeUndefined()
  })

  it('offers the levelled spells the class knows, not its cantrips or granted spells', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [
      known('fire-bolt', { classId: 'sorcerer' }),
      known('magic-missile', { classId: 'sorcerer' }),
      known('shield', { classId: 'sorcerer' }),
      // Granted, with a free cast: a trait, not a spell the class chose to know
      known('burning-hands', { classId: 'sorcerer', alwaysPrepared: true, uses: { max: 1, remaining: 1, recharge: 'long' } }),
    ])
    const offer = resolveSpellChange(sorcererSwap, c, rulepack, 3)!
    expect(offer.current.map(s => s.spellId)).toEqual(['magic-missile', 'shield'])
  })

  it('offers only spells from the class list, up to the level being gained, and none already known', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [
      known('magic-missile', { classId: 'sorcerer' }),
      known('shield', { classId: 'sorcerer' }),
    ])
    const offer = resolveSpellChange(sorcererSwap, c, rulepack, 3)!
    // A sorcerer 3 casts 2nd-level spells, so misty step is on offer and fireball is not
    expect(offer.options).toContain('misty-step')
    expect(offer.options).toContain('sleep')
    expect(offer.options).not.toContain('fireball')
    // Not a sorcerer spell
    expect(offer.options).not.toContain('cure-wounds')
    // A cantrip is not traded for a levelled spell
    expect(offer.options).not.toContain('fire-bolt')
    // Already known
    expect(offer.options).not.toContain('shield')
  })

  it('reads the class list from addTo when the pack names none', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [known('magic-missile', { classId: 'sorcerer' })])
    const offer = resolveSpellChange({ type: 'CHANGE_SPELL', addTo: 'sorcerer', amount: 1 }, c, rulepack, 3)!
    expect(offer.options).toContain('misty-step')
    expect(offer.options).not.toContain('cure-wounds')
  })

  it('trades only spells filed under that class on a multiclass character', () => {
    const c = char(
      [{ classId: 'sorcerer', level: 2 }, { classId: 'wizard', level: 1 }],
      [known('magic-missile', { classId: 'sorcerer' }), known('shield', { classId: 'wizard' })],
    )
    const offer = resolveSpellChange(sorcererSwap, c, rulepack, 3)!
    expect(offer.current.map(s => s.spellId)).toEqual(['magic-missile'])
  })

  it('counts a spell stored without a class for a character with one class', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [known('magic-missile')])
    const offer = resolveSpellChange(sorcererSwap, c, rulepack, 3)!
    expect(offer.current.map(s => s.spellId)).toEqual(['magic-missile'])
  })

  it('trades cantrips instead when the pack asks for it', () => {
    const c = char([{ classId: 'sorcerer', level: 3 }], [
      known('fire-bolt', { classId: 'sorcerer' }),
      known('magic-missile', { classId: 'sorcerer' }),
    ])
    const offer = resolveSpellChange({ ...sorcererSwap, cantrip: true }, c, rulepack, 4)!
    expect(offer.current.map(s => s.spellId)).toEqual(['fire-bolt'])
    expect(offer.options.every(id => rulepack.spells.find(s => s.id === id)!.level === 0)).toBe(true)
  })

  it('narrows the replacements to the schools the pack names', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [known('magic-missile', { classId: 'sorcerer' })])
    const offer = resolveSpellChange({ ...sorcererSwap, classes: undefined, schools: ['enchantment'] }, c, rulepack, 3)!
    expect(offer.options).toContain('sleep')
    expect(offer.options).not.toContain('misty-step')
  })

  it('carries the pack’s label, with a default', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [known('magic-missile', { classId: 'sorcerer' })])
    expect(resolveSpellChange(sorcererSwap, c, rulepack, 3)!.label).toBe('Replace a spell')
    expect(resolveSpellChange({ ...sorcererSwap, label: 'Swap a sorcery' }, c, rulepack, 3)!.label)
      .toBe('Swap a sorcery')
  })
})

describe('applying a known-spell swap', () => {
  it('replaces the traded spell, so the count known never changes', () => {
    const c = char([{ classId: 'sorcerer', level: 3 }], [
      known('magic-missile', { classId: 'sorcerer' }),
      known('shield', { classId: 'sorcerer' }),
    ])
    const applied = applyResolvedChoices(c, [{
      type: 'RESOLVED_CHANGE_SPELL',
      classId: 'sorcerer',
      removedSpellId: 'magic-missile',
      spellId: 'misty-step',
    }], rulepack)
    expect(applied.spells.map(s => s.spellId)).toEqual(['shield', 'misty-step'])
    const learned = applied.spells.find(s => s.spellId === 'misty-step')!
    expect(learned.classId).toBe('sorcerer')
    expect(learned.level).toBe(2)
    expect(learned.name).toBe('Misty Step')
  })

  it('leaves the same spell known from another source alone', () => {
    const c = char(
      [{ classId: 'sorcerer', level: 3 }, { classId: 'bard', level: 1 }],
      [known('sleep', { classId: 'bard' }), known('sleep', { classId: 'sorcerer' })],
    )
    const applied = applyResolvedChoices(c, [{
      type: 'RESOLVED_CHANGE_SPELL',
      classId: 'sorcerer',
      removedSpellId: 'sleep',
      spellId: 'misty-step',
    }], rulepack)
    expect(applied.spells.map(s => [s.spellId, s.classId])).toEqual([
      ['sleep', 'bard'],
      ['misty-step', 'sorcerer'],
    ])
  })

  it('keeps the old spell when the new one cannot be found', () => {
    const c = char([{ classId: 'sorcerer', level: 3 }], [known('magic-missile', { classId: 'sorcerer' })])
    const applied = applyResolvedChoices(c, [{
      type: 'RESOLVED_CHANGE_SPELL',
      classId: 'sorcerer',
      removedSpellId: 'magic-missile',
      spellId: 'not-a-spell',
    }], rulepack)
    expect(applied.spells.map(s => s.spellId)).toEqual(['magic-missile'])
  })
})

describe('the SRD known-spell casters', () => {
  it.each(['bard', 'ranger', 'sorcerer', 'warlock'])('%s may swap a spell on every level from 2nd', (classId) => {
    const cls = rulepack.classes.find(c => c.id === classId)!
    for (const level of cls.levels) {
      const swaps = level.levelUpEvents.filter(e => e.type === 'CHANGE_SPELL')
      expect(swaps, `${classId} ${level.level}`).toHaveLength(level.level === 1 ? 0 : 1)
      for (const swap of swaps) {
        expect(swap).toMatchObject({ addTo: classId, amount: 1, classes: [classId] })
      }
    }
  })

  it('a wizard, who prepares, is never offered one', () => {
    const cls = rulepack.classes.find(c => c.id === 'wizard')!
    expect(cls.levels.flatMap(l => l.levelUpEvents).some(e => e.type === 'CHANGE_SPELL')).toBe(false)
  })

  it('raises the swap when a sorcerer levels up', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [known('magic-missile', { classId: 'sorcerer' })])
    const [offer] = swapOffers(c, 'sorcerer', 3)
    expect(offer).toBeDefined()
    expect(offer!.current.map(s => s.spellId)).toEqual(['magic-missile'])
  })

  it('caps a warlock’s replacements at the pact slot level', () => {
    const c = char([{ classId: 'warlock', level: 4 }], [known('charm-person', { classId: 'warlock' })])
    const [offer] = swapOffers(c, 'warlock', 5)
    expect(offer!.options).toContain('counterspell')
    expect(offer!.options).toContain('hold-person')
  })

  it('raises one swap per amount', () => {
    const c = char([{ classId: 'sorcerer', level: 2 }], [
      known('magic-missile', { classId: 'sorcerer' }),
      known('shield', { classId: 'sorcerer' }),
    ])
    const twice = {
      ...rulepack,
      classes: rulepack.classes.map(cls => cls.id !== 'sorcerer'
        ? cls
        : {
            ...cls,
            levels: cls.levels.map(l => l.level !== 3
              ? l
              : { ...l, levelUpEvents: [{ ...sorcererSwap, amount: 2 }] }),
          }),
    } as Rulepack
    const offers = getChoiceEvents(resolveLevelUpEvents(c, 'sorcerer', 3, twice))
      .filter(e => e.type === 'CHANGE_SPELL')
    expect(offers).toHaveLength(2)
  })
})

describe('the CHANGE_SPELL schema', () => {
  it('accepts a cantrip swap and a label', () => {
    const result = RulepackSchema.safeParse({
      id: 't',
      name: 't',
      version: '1',
      feats: [{
        id: 'f',
        name: 'f',
        description: 'f',
        levelUpEvents: [{ type: 'CHANGE_SPELL', addTo: 'wizard', amount: 1, cantrip: true, label: 'Cantrip Versatility' }],
      }],
    })
    expect(result.success).toBe(true)
    expect(result.data!.feats[0]!.levelUpEvents![0]).toMatchObject({ cantrip: true, label: 'Cantrip Versatility' })
  })
})
