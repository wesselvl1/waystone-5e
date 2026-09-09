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
import druidFragment from '~/data/srd/druid.json'
import spellFragment from '~/data/srd/spells.json'

function pack(): Rulepack {
  const merged = structuredClone(RulepackSchema.parse(druidFragment)) as unknown as Rulepack
  merged.spells = RulepackSchema.parse(spellFragment).spells as Rulepack['spells']
  return merged
}

const rulepack = pack()
const land = (rulepack.classes[0]!.subclasses ?? []).find(s => s.id === 'circle-of-the-land')!

const TIERS = [3, 5, 7, 9]
const CHOICE = 'land-circle'

/** The SRD Circle of the Land table, by terrain then druid level. */
const TABLE: Record<string, Record<number, string[]>> = {
  arctic: { 3: ['hold-person', 'spike-growth'], 5: ['sleet-storm', 'slow'], 7: ['freedom-of-movement', 'ice-storm'], 9: ['commune-with-nature', 'cone-of-cold'] },
  coast: { 3: ['mirror-image', 'misty-step'], 5: ['water-breathing', 'water-walk'], 7: ['control-water', 'freedom-of-movement'], 9: ['conjure-elemental', 'scrying'] },
  desert: { 3: ['blur', 'silence'], 5: ['create-food-and-water', 'protection-from-energy'], 7: ['blight', 'hallucinatory-terrain'], 9: ['insect-plague', 'wall-of-stone'] },
  forest: { 3: ['barkskin', 'spider-climb'], 5: ['call-lightning', 'plant-growth'], 7: ['divination', 'freedom-of-movement'], 9: ['commune-with-nature', 'tree-stride'] },
  grassland: { 3: ['invisibility', 'pass-without-trace'], 5: ['daylight', 'haste'], 7: ['divination', 'freedom-of-movement'], 9: ['dream', 'insect-plague'] },
  mountain: { 3: ['spider-climb', 'spike-growth'], 5: ['lightning-bolt', 'meld-into-stone'], 7: ['stone-shape', 'stoneskin'], 9: ['passwall', 'wall-of-stone'] },
  swamp: { 3: ['acid-arrow', 'darkness'], 5: ['water-walk', 'stinking-cloud'], 7: ['freedom-of-movement', 'locate-creature'], 9: ['insect-plague', 'scrying'] },
}

const TERRAINS = Object.keys(TABLE)

function druid(level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'druid', level, subclassId: 'circle-of-the-land' }],
    spells: [],
    spellSlots: {},
    ...over,
  } as Character
}

describe('the guarded grants in the data', () => {
  it('declares one per terrain at every tier', () => {
    for (const tier of TIERS) {
      const grants = (land.levels.find(l => l.level === tier)?.levelUpEvents ?? [])
        .filter(e => e.type === 'GRANT_SPELLS')
      expect(grants, `tier ${tier}`).toHaveLength(7)
      const guarded = grants.filter(e => e.type === 'GRANT_SPELLS' && e.whenOption?.choiceId === CHOICE)
      expect(guarded, `tier ${tier} all guarded`).toHaveLength(7)
    }
  })

  it('matches the SRD table exactly', () => {
    for (const tier of TIERS) {
      for (const terrain of TERRAINS) {
        const grant = (land.levels.find(l => l.level === tier)?.levelUpEvents ?? [])
          .find(e => e.type === 'GRANT_SPELLS' && e.whenOption?.optionId === terrain)
        expect(grant, `${terrain} at ${tier}`).toBeDefined()
        if (grant?.type === 'GRANT_SPELLS') {
          expect(grant.spellIds).toEqual(TABLE[terrain]![tier])
          expect(grant.alwaysPrepared).toBe(true)
        }
      }
    }
  })

  it('guards against option ids the choice actually offers', () => {
    const choice = (land.levels.find(l => l.level === 3)?.levelUpEvents ?? [])
      .find(e => e.type === 'CHOOSE_OPTION')
    expect(choice?.type).toBe('CHOOSE_OPTION')
    if (choice?.type !== 'CHOOSE_OPTION') return
    const offered = new Set(choice.options.map(o => o.id))
    for (const tier of TIERS) {
      for (const e of land.levels.find(l => l.level === tier)!.levelUpEvents!) {
        if (e.type === 'GRANT_SPELLS' && e.whenOption) {
          expect(offered.has(e.whenOption.optionId), e.whenOption.optionId).toBe(true)
        }
      }
    }
  })

  it('no longer tells the player to add them by hand', () => {
    for (const tier of TIERS) {
      const feature = land.levels.find(l => l.level === tier)!
        .features.find(f => f.name === 'Circle Spells')!
      expect(feature.description).not.toMatch(/not added to your spell list automatically/i)
      expect(feature.description).toMatch(/added to your spell list automatically/i)
    }
  })
})

describe('a guarded grant waits for its option', () => {
  it('grants nothing while no terrain has been chosen', () => {
    const events = resolveLevelUpEvents(druid(4), 'druid', 5, rulepack)
    expect(events.filter(e => e.type === 'GRANT_SPELLS')).toHaveLength(0)
  })

  it('grants only the chosen terrain at a later level', () => {
    const char = druid(4, { chosenOptions: { [CHOICE]: 'forest' } })
    const events = resolveLevelUpEvents(char, 'druid', 5, rulepack)
    const grants = events.filter(e => e.type === 'GRANT_SPELLS')
    expect(grants).toHaveLength(1)

    const applied = applyAutomaticEvents(char, getAutomaticEvents(events), 'average')
    expect(applied.spells.map(s => s.spellId).sort())
      .toEqual(['call-lightning', 'plant-growth'])
    for (const spell of applied.spells) {
      expect(spell.alwaysPrepared).toBe(true)
      expect(spell.prepared).toBe(true)
      expect(spell.classId).toBe('druid')
    }
  })

  it('never leaks another terrain in', () => {
    for (const terrain of TERRAINS) {
      const char = druid(6, { chosenOptions: { [CHOICE]: terrain } })
      const events = resolveLevelUpEvents(char, 'druid', 7, rulepack)
      const applied = applyAutomaticEvents(char, getAutomaticEvents(events), 'average')
      expect(applied.spells.map(s => s.spellId).sort(), terrain)
        .toEqual([...TABLE[terrain]![7]!].sort())
    }
  })

  it('accumulates the right list across every tier', () => {
    let char = druid(2, { chosenOptions: { [CHOICE]: 'swamp' } })
    for (const tier of TIERS) {
      char = { ...char, classes: [{ classId: 'druid', level: tier - 1, subclassId: 'circle-of-the-land' }] } as Character
      const events = resolveLevelUpEvents(char, 'druid', tier, rulepack)
      char = applyAutomaticEvents(char, getAutomaticEvents(events), 'average')
      char = { ...char, classes: [{ classId: 'druid', level: tier, subclassId: 'circle-of-the-land' }] } as Character
    }
    const expected = TIERS.flatMap(t => TABLE.swamp![t]!)
    // water-walk appears once even though swamp and coast both list it
    expect(new Set(char.spells.map(s => s.spellId))).toEqual(new Set(expected))
  })
})

describe('choosing the terrain grants that level immediately', () => {
  it('applies the level-3 grant when the option is resolved', () => {
    // At level 3 the option is still unanswered when resolveLevelUpEvents runs, so the
    // grant cannot be emitted there. RESOLVED_OPTION has to apply it.
    const char = druid(3)
    const events = resolveLevelUpEvents(druid(2), 'druid', 3, rulepack)
    expect(events.filter(e => e.type === 'GRANT_SPELLS')).toHaveLength(0)

    const applied = applyResolvedChoices(
      char,
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'mountain' }],
      rulepack,
    )
    expect(applied.spells.map(s => s.spellId).sort())
      .toEqual(['spider-climb', 'spike-growth'])
    expect(applied.chosenOptions?.[CHOICE]).toBe('mountain')
  })

  it('records the choice so the next level can act on it', () => {
    const applied = applyResolvedChoices(
      druid(3),
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'coast' }],
      rulepack,
    )
    const next = { ...applied, classes: [{ classId: 'druid', level: 4, subclassId: 'circle-of-the-land' }] } as Character
    const events = resolveLevelUpEvents(next, 'druid', 5, rulepack)
    const grants = events.filter(e => e.type === 'GRANT_SPELLS')
    expect(grants).toHaveLength(1)
    if (grants[0]?.type === 'GRANT_SPELLS') {
      expect(grants[0].spells.map(s => s.spellId).sort())
        .toEqual(['water-breathing', 'water-walk'])
    }
  })

  it('does not apply a grant for an option that was not chosen', () => {
    const applied = applyResolvedChoices(
      druid(3),
      [{ type: 'RESOLVED_OPTION', choiceId: CHOICE, optionId: 'desert' }],
      rulepack,
    )
    const granted = applied.spells.map(s => s.spellId)
    expect(granted.sort()).toEqual(['blur', 'silence'])
    expect(granted).not.toContain('hold-person')
  })

  it('ignores an unrelated option choice', () => {
    const applied = applyResolvedChoices(
      druid(3),
      [{ type: 'RESOLVED_OPTION', choiceId: 'totem-spirit', optionId: 'bear' }],
      rulepack,
    )
    expect(applied.spells).toHaveLength(0)
    expect(applied.chosenOptions?.['totem-spirit']).toBe('bear')
  })
})

describe('chosenOptions on the schema', () => {
  it('round-trips', () => {
    const c = { ...validCharacter, chosenOptions: { [CHOICE]: 'forest' } }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(c)))
    expect(parsed.chosenOptions).toEqual({ [CHOICE]: 'forest' })
  })

  it('is optional, so characters predating it still validate', () => {
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(validCharacter)))
    expect(parsed.chosenOptions).toBeUndefined()
  })
})
