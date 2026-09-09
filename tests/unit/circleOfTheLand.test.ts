import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { SpellDefinition } from '~/types/rulepack'
import druidFragment from '~/data/srd/druid.json'
import spellFragment from '~/data/srd/spells.json'

const druid = RulepackSchema.parse(druidFragment).classes.find(c => c.id === 'druid')!
const land = (druid.subclasses ?? []).find(s => s.id === 'circle-of-the-land')!
const allSpells = RulepackSchema.parse(spellFragment).spells as SpellDefinition[]

const landChoice = land.levels
  .flatMap(l => l.levelUpEvents ?? [])
  .find(e => e.type === 'CHOOSE_OPTION')!

/** The SRD Circle of the Land spell table, by terrain then druid level. */
const SRD_CIRCLE_SPELLS: Record<string, Record<number, string[]>> = {
  arctic: {
    3: ['Hold Person', 'Spike Growth'],
    5: ['Sleet Storm', 'Slow'],
    7: ['Freedom of Movement', 'Ice Storm'],
    9: ['Commune with Nature', 'Cone of Cold'],
  },
  coast: {
    3: ['Mirror Image', 'Misty Step'],
    5: ['Water Breathing', 'Water Walk'],
    7: ['Control Water', 'Freedom of Movement'],
    9: ['Conjure Elemental', 'Scrying'],
  },
  desert: {
    3: ['Blur', 'Silence'],
    5: ['Create Food and Water', 'Protection from Energy'],
    7: ['Blight', 'Hallucinatory Terrain'],
    9: ['Insect Plague', 'Wall of Stone'],
  },
  forest: {
    3: ['Barkskin', 'Spider Climb'],
    5: ['Call Lightning', 'Plant Growth'],
    7: ['Divination', 'Freedom of Movement'],
    9: ['Commune with Nature', 'Tree Stride'],
  },
  grassland: {
    3: ['Invisibility', 'Pass without Trace'],
    5: ['Daylight', 'Haste'],
    7: ['Divination', 'Freedom of Movement'],
    9: ['Dream', 'Insect Plague'],
  },
  mountain: {
    3: ['Spider Climb', 'Spike Growth'],
    5: ['Lightning Bolt', 'Meld into Stone'],
    7: ['Stone Shape', 'Stoneskin'],
    9: ['Passwall', 'Wall of Stone'],
  },
  swamp: {
    3: ['Acid Arrow', 'Darkness'],
    5: ['Water Walk', 'Stinking Cloud'],
    7: ['Freedom of Movement', 'Locate Creature'],
    9: ['Insect Plague', 'Scrying'],
  },
}

const TERRAINS = Object.keys(SRD_CIRCLE_SPELLS)
const TIERS = [3, 5, 7, 9]

describe('Circle of the Land terrain choice', () => {
  it('offers the seven SRD lands', () => {
    expect(landChoice.type).toBe('CHOOSE_OPTION')
    if (landChoice.type !== 'CHOOSE_OPTION') return
    expect(landChoice.options.map(o => o.id)).toEqual(TERRAINS)
  })

  it('is asked once, at level 3', () => {
    const levels = land.levels
      .filter(l => (l.levelUpEvents ?? []).some(e => e.type === 'CHOOSE_OPTION'))
      .map(l => l.level)
    expect(levels).toEqual([3])
  })

  it('gives every land a distinct description', () => {
    // Regression: the upstream dataset repeats one generic blurb for all seven
    // terrains, which made the choice seven indistinguishable buttons.
    if (landChoice.type !== 'CHOOSE_OPTION') return
    const descriptions = landChoice.options.map(o => o.description)
    expect(new Set(descriptions).size).toBe(7)
    for (const d of descriptions) expect(d.length).toBeGreaterThan(80)
  })

  it('names the right circle spells for each land, at each tier', () => {
    if (landChoice.type !== 'CHOOSE_OPTION') return
    for (const option of landChoice.options) {
      const table = SRD_CIRCLE_SPELLS[option.id]!
      for (const tier of TIERS) {
        for (const spell of table[tier]!) {
          expect(option.description, `${option.id} should list ${spell}`).toContain(spell)
        }
      }
    }
  })

  it('does not name another land\'s exclusive spells', () => {
    if (landChoice.type !== 'CHOOSE_OPTION') return
    for (const option of landChoice.options) {
      const own = new Set(TIERS.flatMap(t => SRD_CIRCLE_SPELLS[option.id]![t]!))
      // Spells unique to exactly one other terrain, so they must not appear here
      const exclusiveElsewhere = TERRAINS
        .filter(t => t !== option.id)
        .flatMap(t => TIERS.flatMap(tier => SRD_CIRCLE_SPELLS[t]![tier]!))
        .filter(s => !own.has(s))
      for (const spell of new Set(exclusiveElsewhere)) {
        const sharedWithOwn = [...own].some(o => o.includes(spell) || spell.includes(o))
        if (!sharedWithOwn) {
          expect(option.description, `${option.id} should not list ${spell}`)
            .not.toContain(spell)
        }
      }
    }
  })

  it('every spell in the table exists in the SRD spell list', () => {
    const names = new Set(allSpells.map(s => s.name))
    const missing = [...new Set(TERRAINS.flatMap(t => TIERS.flatMap(tier => SRD_CIRCLE_SPELLS[t]![tier]!)))]
      .filter(n => !names.has(n))
    expect(missing).toEqual([])
  })
})

describe('Circle Spells features', () => {
  it('appears at every tier the SRD grants one', () => {
    // Levels 5, 7 and 9 previously had no entry at all, so nothing on the sheet
    // told the player a tier had arrived.
    const levels = land.levels
      .filter(l => l.features.some(f => f.name === 'Circle Spells'))
      .map(l => l.level)
    expect(levels).toEqual(TIERS)
  })

  it('lists every land at its own tier', () => {
    for (const tier of TIERS) {
      const feature = land.levels
        .find(l => l.level === tier)!
        .features.find(f => f.name === 'Circle Spells')!
      for (const terrain of TERRAINS) {
        expect(feature.description, `tier ${tier} should mention ${terrain}`)
          .toContain(terrain)
        for (const spell of SRD_CIRCLE_SPELLS[terrain]![tier]!) {
          expect(feature.description, `tier ${tier} ${terrain} ${spell}`).toContain(spell)
        }
      }
    }
  })

  it('says the spells are granted automatically', () => {
    // Was the opposite: GRANT_SPELLS could not be conditional on a CHOOSE_OPTION result,
    // so the text told the player to add them by hand. whenOption fixed that.
    for (const tier of TIERS) {
      const feature = land.levels
        .find(l => l.level === tier)!
        .features.find(f => f.name === 'Circle Spells')!
      expect(feature.description).toMatch(/added to your spell list automatically/i)
      expect(feature.description).not.toMatch(/not added to your spell list automatically/i)
    }
  })
})
