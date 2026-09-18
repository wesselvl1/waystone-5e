import { describe, it, expect } from 'vitest'
import {
  savingThrowBreakdown,
  savingThrowParts,
  savingThrowTotals,
} from '~/services/savingThrows'
import { validCharacter } from '../fixtures'
import type { AbilityKey, Character, Feature } from '~/types/character'

const MODS: Record<AbilityKey, number> = { str: 3, dex: 2, con: 2, int: 4, wis: 1, cha: -1 }
const ctx = { modifiers: MODS, proficiencyBonus: 3 }

function feature(name: string, description: string): Feature {
  return { id: name.toLowerCase(), name, source: 'Test', description }
}

function character(extra: Partial<Character> = {}): Character {
  return { ...validCharacter, features: [], savingThrowProficiencies: [], ...extra }
}

/** The SRD's wording, verbatim, since the sniff is reading exactly this. */
const AURA_OF_PROTECTION = feature(
  'Aura of Protection',
  'Starting at 6th level, whenever you or a friendly creature within 10 feet of you must'
  + ' make a saving throw, the creature gains a bonus to the saving throw equal to your'
  + ' Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this'
  + ' bonus.',
)

describe('a save is the ability, the proficiency and what is added to it', () => {
  it('is the ability modifier on its own', () => {
    const result = savingThrowBreakdown(character(), 'wis', ctx)
    expect(result.total).toBe(1)
    expect(result.parts).toEqual([{ label: 'Wisdom', value: 1 }])
  })

  it('adds the proficiency bonus where the class grants it', () => {
    const c = character({ savingThrowProficiencies: ['con'] })
    expect(savingThrowBreakdown(c, 'con', ctx).total).toBe(5)
    expect(savingThrowBreakdown(c, 'int', ctx).total).toBe(4)
  })

  it('adds the three hand-entered slots to every save', () => {
    const c = character({ savingThrowBonuses: { magic: 1, misc: -1, feat: 2 } })
    const totals = savingThrowTotals(c, ctx)
    expect(totals.str).toBe(5)
    expect(totals.cha).toBe(1)
  })

  it('lists each slot on its own line, so the modal shows where it came from', () => {
    const c = character({ savingThrowBonuses: { magic: 1, misc: 2 } })
    const { parts } = savingThrowBreakdown(c, 'dex', ctx)
    expect(parts).toContainEqual({ label: 'Magic', value: 1 })
    expect(parts).toContainEqual({ label: 'Misc', value: 2 })
  })

  it('leaves a slot of zero out of the working', () => {
    const c = character({ savingThrowBonuses: { magic: 0, misc: 2 } })
    const { parts } = savingThrowBreakdown(c, 'dex', ctx)
    expect(parts.map(p => p.label)).not.toContain('Magic')
  })
})

describe('the aura a paladin grants, read off the feature', () => {
  it('adds the Charisma modifier to every save', () => {
    const c = character({ features: [AURA_OF_PROTECTION] })
    const totals = savingThrowTotals({ ...c, features: [AURA_OF_PROTECTION] }, {
      ...ctx,
      modifiers: { ...MODS, cha: 4 },
    })
    expect(totals.str).toBe(7)
    expect(totals.wis).toBe(5)
  })

  it('honours the feature\'s own minimum when the modifier is lower', () => {
    // Charisma -1 in the fixture context: the aura still grants its floor of +1.
    const c = character({ features: [AURA_OF_PROTECTION] })
    const { parts, total } = savingThrowBreakdown(c, 'wis', ctx)
    expect(parts).toContainEqual({ label: 'Aura of Protection (Charisma)', value: 1 })
    expect(total).toBe(2)
  })

  it('counts a feature once when a backfill has granted it twice', () => {
    const c = character({ features: [AURA_OF_PROTECTION, { ...AURA_OF_PROTECTION, id: 'other' }] })
    expect(savingThrowParts(c, ctx)).toHaveLength(1)
  })

  it('stacks with the hand-entered slots', () => {
    const c = character({
      features: [AURA_OF_PROTECTION],
      savingThrowBonuses: { magic: 1 },
      savingThrowProficiencies: ['wis'],
    })
    // Wisdom 1 + proficiency 3 + aura 1 + cloak 1
    expect(savingThrowBreakdown(c, 'wis', ctx).total).toBe(6)
  })
})

describe('a flat bonus a feature spells out', () => {
  it('adds it to every save', () => {
    const c = character({
      features: [feature('Blessed Warding', 'You have a +1 bonus to saving throws.')],
    })
    expect(savingThrowTotals(c, ctx).int).toBe(5)
  })

  it('adds it to only the save the feature names', () => {
    const c = character({
      features: [feature('Iron Gut', 'You gain a +2 bonus to Constitution saving throws.')],
    })
    const totals = savingThrowTotals(c, ctx)
    expect(totals.con).toBe(4)
    expect(totals.str).toBe(3)
  })
})

describe('what the sniff refuses to read as a save bonus', () => {
  it('ignores an ability named in a sentence that is not about the save', () => {
    const careful = feature(
      'Careful Spell',
      'You spend 1 sorcery point and choose a number of those creatures up to your Charisma'
      + ' modifier (minimum of one). A chosen creature automatically succeeds on its saving'
      + ' throw against the spell.',
    )
    expect(savingThrowParts(character({ features: [careful] }), ctx)).toEqual([])
  })

  it('ignores a bonus that lands on something other than a save', () => {
    const rage = feature(
      'Rage',
      'While raging, you gain advantage on Strength checks and Strength saving throws, a'
      + ' bonus to melee weapon damage rolls using Strength, and resistance to damage.',
    )
    expect(savingThrowParts(character({ features: [rage] }), ctx)).toEqual([])
  })

  it('ignores advantage, which is not a number', () => {
    const resilience = feature(
      'Dwarven Resilience',
      'You have advantage on saving throws against poison, and you have resistance against'
      + ' poison damage.',
    )
    expect(savingThrowParts(character({ features: [resilience] }), ctx)).toEqual([])
  })

  it('ignores a save a monster forces, which a sheet can carry as a feature', () => {
    const breath = feature(
      'Breath Weapon',
      'Each creature in the area must make a Dexterity saving throw. The DC for this saving'
      + ' throw equals 8 + your Constitution modifier + your proficiency bonus.',
    )
    expect(savingThrowParts(character({ features: [breath] }), ctx)).toEqual([])
  })
})

describe('the hand-set ability bonus overrides what was read', () => {
  it('replaces a derived aura rather than stacking with it', () => {
    const c = character({
      features: [AURA_OF_PROTECTION],
      savingThrowAbilityBonus: { ability: 'int' },
    })
    const { parts, total } = savingThrowBreakdown(c, 'wis', ctx)
    expect(parts.map(p => p.label)).not.toContain('Aura of Protection (Charisma)')
    expect(parts).toContainEqual({ label: 'Intelligence modifier', value: 4 })
    expect(total).toBe(5)
  })

  it("switches a misread aura off with 'none'", () => {
    const c = character({
      features: [AURA_OF_PROTECTION],
      savingThrowAbilityBonus: { ability: 'none' },
    })
    expect(savingThrowBreakdown(c, 'wis', ctx).total).toBe(1)
  })

  it('applies its own minimum when the modifier is lower', () => {
    const c = character({ savingThrowAbilityBonus: { ability: 'cha', minimum: 1 } })
    expect(savingThrowBreakdown(c, 'wis', ctx).total).toBe(2)
  })

  it('leaves a flat feature bonus in place, since it answers another question', () => {
    const c = character({
      features: [
        AURA_OF_PROTECTION,
        feature('Blessed Warding', 'You have a +1 bonus to saving throws.'),
      ],
      savingThrowAbilityBonus: { ability: 'none' },
    })
    expect(savingThrowBreakdown(c, 'wis', ctx).total).toBe(2)
  })

  it('derives again once the setting is cleared', () => {
    const c = character({ features: [AURA_OF_PROTECTION], savingThrowAbilityBonus: null })
    expect(savingThrowBreakdown(c, 'wis', ctx).total).toBe(2)
  })
})
