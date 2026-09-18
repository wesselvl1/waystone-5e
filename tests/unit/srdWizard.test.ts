import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { resolveLevelUpEvents, getChoiceEvents } from '~/services/levelUpService'
import type { Rulepack } from '~/types/rulepack'
import type { Character } from '~/types/character'
import { validCharacter } from '../fixtures'
import fragment from '~/data/srd/wizard.json'
import spells from '~/data/srd/spells.json'

const pack = RulepackSchema.parse(fragment)
const wizard = pack.classes.find(c => c.id === 'wizard')!

/** Wizard fragment plus the spell list, the way the srd-loader plugin merges them. */
function srdPack(): Rulepack {
  const merged = structuredClone(pack) as unknown as Rulepack
  merged.spells = RulepackSchema.parse(spells).spells as Rulepack['spells']
  return merged
}

function wizardChar(level: number): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'wizard', level, name: 'Wizard' }],
    spells: [],
  } as Character
}

/** Non-cantrip spells the level's events offer, i.e. what goes into the spellbook. */
function spellbookPicks(level: number): number {
  return wizard.levels.find(l => l.level === level)!.levelUpEvents
    .filter(e => e.type === 'CHOOSE_SPELL' && !e.cantrip)
    .reduce((sum, e) => sum + (e.type === 'CHOOSE_SPELL' ? e.count : 0), 0)
}

describe('SRD wizard', () => {
  it('validates against RulepackSchema and declares the SRD pack id', () => {
    expect(pack.id).toBe('srd-5.1')
    expect(pack.version).toBe('5.1')
    expect(pack.classes).toHaveLength(1)
  })

  it('has the SRD chassis', () => {
    expect(wizard.hitDie).toBe('d6')
    expect(wizard.savingThrowProficiencies).toEqual(["int", "wis"])
    expect(wizard.skillChoices.count).toBe(2)
    expect(wizard.skillChoices.from).toHaveLength(6)
    expect(wizard.levels).toHaveLength(20)
    expect(wizard.levels.map(l => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('is set up for spellcasting with a complete slot table', () => {
    expect(wizard.spellcastingAbility).toBe('int')
    expect(wizard.isFullCaster).toBe(true)
    expect(wizard.levels[0]!.spellSlots).toEqual({"1": 2})
    expect(wizard.levels[19]!.spellSlots).toEqual({"1": 4, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1})
  })

  it('declares the Cantrips Known column', () => {
    expect(wizard.levels.map(l => l.cantripsKnown)).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])
  })

  it('fills the spellbook with six spells at 1st level and two at every level after', () => {
    // A wizard prepares from a spellbook rather than knowing a fixed list, so the class
    // table names no Spells Known column — the free spells come only from these events.
    expect(spellbookPicks(1)).toBe(6)
    for (let level = 2; level <= 20; level++) {
      expect(spellbookPicks(level), `level ${level}`).toBe(2)
    }
  })

  it('draws every spellbook pick from the wizard list alone', () => {
    const picks = wizard.levels
      .flatMap(l => l.levelUpEvents)
      .filter(e => e.type === 'CHOOSE_SPELL' && !e.cantrip)
    for (const pick of picks) {
      if (pick.type !== 'CHOOSE_SPELL') continue
      expect(pick.addTo).toBe('wizard')
      expect(pick.classes).toEqual(['wizard'])
    }
  })

  it('offers an ASI on the SRD levels', () => {
    const levels = wizard.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'ABILITY_SCORE_IMPROVEMENT'))
      .map(l => l.level)
    expect(levels).toEqual([4, 8, 12, 16, 19])
  })

  it('offers the subclass choice at level 2 only', () => {
    const levels = wizard.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'CHOOSE_SUBCLASS'))
      .map(l => l.level)
    expect(levels).toEqual([2])
  })

  it('ships School of Evocation as its only subclass', () => {
    expect(wizard.subclasses?.map(s => s.id)).toEqual(['school-of-evocation'])
    const levels = wizard.subclasses![0]!.levels.map(l => l.level)
    expect(levels).toEqual([2, 6, 10, 14])
  })

  it('gives every subclass feature a description', () => {
    for (const lvl of wizard.subclasses![0]!.levels) {
      for (const f of lvl.features) {
        expect(f.description.length, f.name).toBeGreaterThan(20)
      }
    }
  })

  it('defines every feature it grants, apart from subclass placeholders', () => {
    const defined = (wizard.featureDefinitions ?? []).map(f => f.name)
    const used = [...new Set(wizard.levels.flatMap(l => l.features))]
    const missing = used.filter(n => !defined.includes(n) && !/ Feature$/.test(n))
    expect(missing).toEqual([])
  })

  it('gives every feature definition a non-empty description', () => {
    for (const f of wizard.featureDefinitions ?? []) {
      expect(f.description.length, f.name).toBeGreaterThan(20)
    }
  })

  it('raises the spellbook choice on a level that grants nothing else', () => {
    // Regression: levels 3, 5-7, 9 and so on declared no events at all, so levelling a
    // wizard through them asked nothing and the spellbook never grew.
    const events = getChoiceEvents(resolveLevelUpEvents(wizardChar(2), 'wizard', 3, srdPack()))
    const pick = events.find(e => e.type === 'CHOOSE_SPELL' && !e.cantrip)
    expect(pick).toBeDefined()
    expect(pick!.type === 'CHOOSE_SPELL' && pick!.count).toBe(2)
  })

  it('points every replaces reference at a real feature', () => {
    const names = (wizard.featureDefinitions ?? []).map(f => f.name)
    for (const f of wizard.featureDefinitions ?? []) {
      if (f.replaces) expect(names, f.name).toContain(f.replaces)
    }
  })
})
