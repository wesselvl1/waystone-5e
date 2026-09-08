import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  getAutomaticEvents,
} from '~/services/levelUpService'
import type { Rulepack } from '~/types/rulepack'
import type { Character } from '~/types/character'
import { validCharacter } from '../fixtures'

import clericFragment from '~/data/srd/cleric.json'
import spells from '~/data/srd/spells.json'

/**
 * Merge the cleric fragment with the spell list the way the srd-loader plugin does.
 * The fragment carries its subclasses nested, so no patch distribution is needed.
 */
function srdPack(): Rulepack {
  const cls = RulepackSchema.parse(clericFragment)
  const spl = RulepackSchema.parse(spells)
  const merged = structuredClone(cls) as unknown as Rulepack
  merged.spells = spl.spells as Rulepack['spells']
  return merged
}

const pack = srdPack()

function cleric(level: number, overrides: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'cleric', level, name: 'Cleric' }],
    spells: [],
    spellSlots: {},
    ...overrides,
  } as Character
}

describe('SRD cleric data', () => {
  it('is a wisdom full caster', () => {
    const c = pack.classes.find(x => x.id === 'cleric')!
    expect(c.spellcastingAbility).toBe('wis')
    expect(c.isFullCaster).toBe(true)
    expect(c.hitDie).toBe('d8')
  })

  it('has a 20-row spell slot table that survives Zod parsing', () => {
    const c = pack.classes.find(x => x.id === 'cleric')!
    expect(c.levels).toHaveLength(20)
    expect(c.levels.every(l => l.spellSlots && Object.keys(l.spellSlots).length > 0)).toBe(true)
    expect(c.levels[0]!.spellSlots).toEqual({ 1: 2 })
    expect(c.levels[19]!.spellSlots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 })
  })

  it('grants two 1st-level slots when a cleric reaches level 1', () => {
    const events = resolveLevelUpEvents(cleric(0), 'cleric', 1, pack)
    const applied = applyAutomaticEvents(cleric(0), getAutomaticEvents(events), 'average')
    expect(applied.spellSlots[1]?.max).toBe(2)
  })

  it('applies slots as a delta from level 4 to level 5', () => {
    // L4 = {1:4, 2:3}; L5 = {1:4, 2:3, 3:2} → only a +2 delta on 3rd level
    const before = cleric(4, { spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } } })
    const events = resolveLevelUpEvents(before, 'cleric', 5, pack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spellSlots[1]?.max).toBe(4)
    expect(applied.spellSlots[2]?.max).toBe(3)
    expect(applied.spellSlots[3]?.max).toBe(2)
  })

  it('preserves a manual slot override when levelling', () => {
    const before = cleric(4, { spellSlots: { 1: { max: 5, used: 0 }, 2: { max: 3, used: 0 } } })
    const events = resolveLevelUpEvents(before, 'cleric', 5, pack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spellSlots[1]?.max).toBe(5)
  })

  it('offers a Divine Domain choice at level 1, not level 3', () => {
    const l1 = resolveLevelUpEvents(cleric(0), 'cleric', 1, pack)
    expect(l1.some(e => e.type === 'CHOOSE_SUBCLASS')).toBe(true)
    // The choice is declared only on level 1, so no later level re-offers it
    const l3 = resolveLevelUpEvents(cleric(2), 'cleric', 3, pack)
    expect(l3.some(e => e.type === 'CHOOSE_SUBCLASS')).toBe(false)
  })

  it('offers three cantrips at level 1 and one more at 4 and 10', () => {
    for (const [from, to, count] of [[0, 1, 3], [3, 4, 1], [9, 10, 1]] as const) {
      const events = resolveLevelUpEvents(cleric(from), 'cleric', to, pack)
      const cantrip = events.find(e => e.type === 'CHOOSE_SPELL' && e.cantrip)
      expect(cantrip, `level ${to}`).toBeDefined()
      if (cantrip?.type === 'CHOOSE_SPELL') expect(cantrip.count).toBe(count)
    }
  })

  it('never offers leveled spell choices — cleric is a prepared caster', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      const events = resolveLevelUpEvents(cleric(lvl - 1), 'cleric', lvl, pack)
      const leveled = events.filter(e => e.type === 'CHOOSE_SPELL' && !e.cantrip)
      expect(leveled, `level ${lvl}`).toHaveLength(0)
    }
  })
})

describe('Life Domain', () => {
  const withDomain = (level: number) =>
    cleric(level, { classes: [{ classId: 'cleric', level, name: 'Cleric', subclassId: 'life-domain' }] } as Partial<Character>)

  it('is the only cleric subclass and is attached to the cleric', () => {
    const c = pack.classes.find(x => x.id === 'cleric')!
    expect(c.subclasses?.map(s => s.id)).toEqual(['life-domain'])
  })

  it('grants its 3rd-level domain spells as always-prepared', () => {
    const before = withDomain(2)
    const events = resolveLevelUpEvents(before, 'cleric', 3, pack)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')
    expect(grant).toBeDefined()
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    const ids = applied.spells.map(s => s.spellId)
    expect(ids).toContain('lesser-restoration')
    expect(ids).toContain('spiritual-weapon')
    for (const s of applied.spells) {
      expect(s.alwaysPrepared).toBe(true)
      expect(s.prepared).toBe(true)
      expect(s.classId).toBe('cleric')
    }
  })

  it('does not duplicate a domain spell the cleric already knows', () => {
    const before = withDomain(2)
    before.spells = [{
      id: 'x', spellId: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, prepared: false,
    }]
    const events = resolveLevelUpEvents(before, 'cleric', 3, pack)
    const applied = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
    expect(applied.spells.filter(s => s.spellId === 'spiritual-weapon')).toHaveLength(1)
    expect(applied.spells.find(s => s.spellId === 'spiritual-weapon')!.alwaysPrepared).toBe(true)
  })

  it('every granted domain spell id resolves to a real spell', () => {
    const life = pack.classes.flatMap(c => c.subclasses ?? []).find(s => s.id === 'life-domain')!
    const granted = life.levels.flatMap(l =>
      (l.levelUpEvents ?? []).flatMap(e => e.type === 'GRANT_SPELLS' ? e.spellIds : []))
    expect(granted).toHaveLength(10)
    for (const id of granted) {
      expect(pack.spells.some(s => s.id === id), id).toBe(true)
    }
  })
})
