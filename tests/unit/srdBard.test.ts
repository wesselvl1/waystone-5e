import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import classes from '~/data/srd/bard.json'

const bard = RulepackSchema.parse(classes).classes.find(c => c.id === 'bard')!

/** Spells Known / Cantrips Known columns of the SRD 5.1 Bard table. */
const SPELLS_KNOWN = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22]
const CANTRIPS_KNOWN = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]

describe('SRD bard table', () => {
  it('is a charisma full caster with a complete slot table', () => {
    expect(bard.spellcastingAbility).toBe('cha')
    expect(bard.isFullCaster).toBe(true)
    expect(bard.hitDie).toBe('d8')
    expect(bard.levels).toHaveLength(20)
    expect(bard.levels[0]!.spellSlots).toEqual({ 1: 2 })
    expect(bard.levels[19]!.spellSlots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 })
    expect(bard.levels.every(l => l.spellSlots && Object.keys(l.spellSlots).length > 0)).toBe(true)
  })

  it('CHOOSE_SPELL counts accumulate to the Spells Known column', () => {
    let total = 0
    bard.levels.forEach((lvl, i) => {
      total += lvl.levelUpEvents
        .filter(e => e.type === 'CHOOSE_SPELL' && !e.cantrip)
        .reduce((s, e) => s + (e.type === 'CHOOSE_SPELL' ? e.count : 0), 0)
      expect(total, `level ${i + 1}`).toBe(SPELLS_KNOWN[i])
    })
  })

  it('cantrip CHOOSE_SPELL counts accumulate to the Cantrips Known column', () => {
    let total = 0
    bard.levels.forEach((lvl, i) => {
      total += lvl.levelUpEvents
        .filter(e => e.type === 'CHOOSE_SPELL' && e.cantrip)
        .reduce((s, e) => s + (e.type === 'CHOOSE_SPELL' ? e.count : 0), 0)
      expect(total, `level ${i + 1}`).toBe(CANTRIPS_KNOWN[i])
    })
  })

  it('declared spellsKnown/cantripsKnown match what the events grant', () => {
    bard.levels.forEach((lvl, i) => {
      expect(lvl.spellsKnown, `level ${i + 1} spellsKnown`).toBe(SPELLS_KNOWN[i])
      expect(lvl.cantripsKnown, `level ${i + 1} cantripsKnown`).toBe(CANTRIPS_KNOWN[i])
    })
  })

  it('places each feature on its SRD level', () => {
    const at = (n: number) => bard.levels.find(l => l.level === n)!.features
    expect(at(3)).toContain('Expertise')
    expect(at(6)).toContain('Countercharm')
    expect(at(7)).not.toContain('Countercharm')
    expect(at(10)).toContain('Expertise')
    expect(at(10)).toContain('Magical Secrets')
    expect(at(11)).toEqual([])
    expect(at(14)).toContain('Magical Secrets')
    expect(at(15)).not.toContain('Superior Inspiration')
    expect(at(18)).toContain('Magical Secrets')
    expect(at(20)).toContain('Superior Inspiration')
  })

  it('claims a Bard College feature only at 3, 6 and 14', () => {
    const collegeLevels = bard.levels
      .filter(l => l.features.some(f => /bard college/i.test(f)))
      .map(l => l.level)
    expect(collegeLevels).toEqual([3, 6, 14])
  })

  it('ships College of Lore as its only subclass', () => {
    expect(bard.subclasses?.map(s => s.id)).toEqual(['college-of-lore'])
    expect(bard.subclasses![0]!.levels.map(l => l.level)).toEqual([3, 6, 14])
  })

  it('grants Additional Magical Secrets at college level 6, outside Spells Known', () => {
    // The SRD says these two spells do not count against the number of spells you know,
    // so the choice is unrestricted by class and lives on the subclass, not the class table.
    const lvl6 = bard.subclasses![0]!.levels.find(l => l.level === 6)!
    const choice = lvl6.levelUpEvents!.find(e => e.type === 'CHOOSE_SPELL')!
    expect(choice.type).toBe('CHOOSE_SPELL')
    if (choice.type === 'CHOOSE_SPELL') {
      expect(choice.count).toBe(2)
      expect(choice.cantrip).toBeFalsy()
      expect(choice.classes).toBeUndefined()
    }
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of bard.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })
  it('defines every feature it grants, except the subclass placeholder', () => {
    const defined = (bard.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(bard.levels.flatMap(l => l.features))]
    const undefinedNames = used.filter(n => !defined.includes(n))
    expect(undefinedNames).toEqual(['Bard College Feature'])
  })
})
