import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  checkMulticlassEligibility,
  describeMulticlassPrerequisites,
  multiclassOptions,
  addHitDieForClass,
  multiclassProficiencies,
} from '~/services/multiclass'
import {
  baseSpellSlots,
  casterLevelFor,
  maxSpellLevelForClass,
  spellSlotMax,
  clampSpellSlots,
} from '~/services/spellcasting'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { AbilityScores, Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import { validCharacter } from '../fixtures'

import barbarian from '~/data/srd/barbarian.json'
import bard from '~/data/srd/bard.json'
import cleric from '~/data/srd/cleric.json'
import fighter from '~/data/srd/fighter.json'
import monk from '~/data/srd/monk.json'
import paladin from '~/data/srd/paladin.json'
import ranger from '~/data/srd/ranger.json'
import rogue from '~/data/srd/rogue.json'
import sorcerer from '~/data/srd/sorcerer.json'
import warlock from '~/data/srd/warlock.json'
import wizard from '~/data/srd/wizard.json'
import druid from '~/data/srd/druid.json'
import spells from '~/data/srd/spells.json'

/** All SRD class fragments merged, the way the store presents them. */
function pack(): Rulepack {
  const fragments = [barbarian, bard, cleric, druid, fighter, monk,
                     paladin, ranger, rogue, sorcerer, warlock, wizard]
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
const def = (id: string) => rulepack.classes.find(c => c.id === id)!

function scores(over: Partial<AbilityScores> = {}): AbilityScores {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...over }
}

describe('seeding', () => {
  it('gives every class multiclassing data', () => {
    // multiclassOptions filters on classDef.multiclassing, so a class missing it silently
    // disappears from the multiclass list rather than erroring.
    const without = rulepack.classes.filter(c => !c.multiclassing).map(c => c.id)
    expect(without).toEqual([])
  })

  it('has a seed revision high enough to reseed packs predating multiclassing', () => {
    // Adding the data without bumping the revision leaves existing users on a stored pack
    // with no multiclassing, which hides the feature entirely. That is invisible to every
    // other test here, because they read the JSON directly rather than IndexedDB.
    const loader = readFileSync('app/plugins/srd-loader.client.ts', 'utf8')
    const match = loader.match(/SRD_SEED_REVISION = (\d+)/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThanOrEqual(7)
  })
})

describe('multiclass prerequisites', () => {
  it('requires every listed minimum when there are several', () => {
    // Monk needs DEX 13 *and* WIS 13
    expect(checkMulticlassEligibility(def('monk'), scores({ dex: 13, wis: 13 })).eligible).toBe(true)
    expect(checkMulticlassEligibility(def('monk'), scores({ dex: 13 })).eligible).toBe(false)
    expect(checkMulticlassEligibility(def('monk'), scores({ wis: 13 })).eligible).toBe(false)
  })

  it('accepts any one option when the requirement is a choice', () => {
    // Fighter needs STR 13 *or* DEX 13
    expect(checkMulticlassEligibility(def('fighter'), scores({ str: 13 })).eligible).toBe(true)
    expect(checkMulticlassEligibility(def('fighter'), scores({ dex: 13 })).eligible).toBe(true)
    expect(checkMulticlassEligibility(def('fighter'), scores()).eligible).toBe(false)
  })

  it('reports every option when a choice requirement is unmet, since any one would do', () => {
    const result = checkMulticlassEligibility(def('fighter'), scores())
    expect(result.unmet.map(u => u.ability).sort()).toEqual(['dex', 'str'])
    for (const u of result.unmet) {
      expect(u.minimum).toBe(13)
      expect(u.actual).toBe(10)
    }
  })

  it('names the shortfall so the UI can explain it', () => {
    const result = checkMulticlassEligibility(def('wizard'), scores({ int: 11 }))
    expect(result.unmet).toEqual([{ ability: 'int', minimum: 13, actual: 11 }])
  })

  it('describes requirements the way the SRD phrases them', () => {
    expect(describeMulticlassPrerequisites(def('monk'))).toBe('Dexterity 13 and Wisdom 13')
    expect(describeMulticlassPrerequisites(def('fighter'))).toBe('Strength 13 or Dexterity 13')
    expect(describeMulticlassPrerequisites(def('wizard'))).toBe('Intelligence 13')
  })

  it('offers every class the character does not already have', () => {
    const char = {
      classes: [{ classId: 'fighter', level: 3 }],
      abilityScores: scores({ str: 15, int: 13 }),
      abilityScoreOverrides: {},
    }
    const options = multiclassOptions(char, rulepack)
    expect(options.some(o => o.classDef.id === 'fighter')).toBe(false)
    expect(options).toHaveLength(11)
    expect(options.find(o => o.classDef.id === 'wizard')!.eligibility.eligible).toBe(true)
    expect(options.find(o => o.classDef.id === 'monk')!.eligibility.eligible).toBe(false)
  })

  it('judges prerequisites on overridden scores', () => {
    const char = {
      classes: [{ classId: 'fighter', level: 1 }],
      abilityScores: scores(),
      abilityScoreOverrides: { int: 14 },
    }
    const wiz = multiclassOptions(char, rulepack).find(o => o.classDef.id === 'wizard')!
    expect(wiz.eligibility.eligible).toBe(true)
  })
})

describe('multiclass proficiencies', () => {
  it('grants the reduced SRD set, never saving throws', () => {
    // Full cleric gets light+medium+shields and WIS/CHA saves; multiclass omits the saves
    expect(multiclassProficiencies(def('cleric'))).toEqual(['light', 'medium', 'shields'])
    expect(def('cleric').savingThrowProficiencies).toEqual(['wis', 'cha'])
    expect(def('cleric').multiclassing?.skillChoices).toBeUndefined()
  })

  it('gives sorcerer and wizard nothing', () => {
    expect(multiclassProficiencies(def('sorcerer'))).toEqual([])
    expect(multiclassProficiencies(def('wizard'))).toEqual([])
  })

  it('gives rogue thieves tools and one skill instead of four', () => {
    expect(multiclassProficiencies(def('rogue'))).toEqual(['light', "thieves' tools"])
    expect(def('rogue').skillChoices.count).toBe(4)
    expect(def('rogue').multiclassing?.skillChoices?.count).toBe(1)
  })

  it('is emitted only when entering the class as an additional class', () => {
    const fighterOnly: Character = {
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 3 }],
    } as Character

    // Taking a first cleric level alongside fighter grants the reduced set
    const multi = resolveLevelUpEvents(fighterOnly, 'cleric', 1, rulepack)
    const granted = multi.filter(e => e.type === 'GAIN_PROFICIENCY')
      .map(e => e.type === 'GAIN_PROFICIENCY' ? e.proficiency : '')
    expect(granted).toEqual(['light', 'medium', 'shields'])

    // A character's very first level grants nothing here; creation handles it
    const fresh: Character = {
      ...validCharacter,
      classes: [{ classId: 'cleric', level: 0 }],
    } as Character
    const first = resolveLevelUpEvents(fresh, 'cleric', 1, rulepack)
    expect(first.filter(e => e.type === 'GAIN_PROFICIENCY')).toHaveLength(0)
  })

  it('offers the skill choice as a player choice, not an automatic grant', () => {
    const fighterOnly: Character = {
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 3 }],
    } as Character
    const events = resolveLevelUpEvents(fighterOnly, 'rogue', 1, rulepack)
    const skill = getChoiceEvents(events).find(e => e.type === 'CHOOSE_SKILL')
    expect(skill).toBeDefined()
    if (skill?.type === 'CHOOSE_SKILL') {
      expect(skill.count).toBe(1)
      expect(skill.from.length).toBeGreaterThan(5)
    }
    expect(getAutomaticEvents(events).some(e => e.type === 'CHOOSE_SKILL')).toBe(false)
  })
})

describe('multiclass spell slots', () => {
  it('counts full casters fully and half casters at half, rounded down', () => {
    expect(casterLevelFor({ classId: 'wizard', level: 5 }, rulepack)).toBe(5)
    expect(casterLevelFor({ classId: 'paladin', level: 5 }, rulepack)).toBe(2)
    expect(casterLevelFor({ classId: 'ranger', level: 3 }, rulepack)).toBe(1)
    expect(casterLevelFor({ classId: 'fighter', level: 5 }, rulepack)).toBe(0)
  })

  it('excludes warlock, whose pact slots are tracked separately', () => {
    expect(casterLevelFor({ classId: 'warlock', level: 5 }, rulepack)).toBe(0)
  })

  it('uses the class table when there is only one spellcasting class', () => {
    // A paladin 5 has four 1st and two 2nd level slots. A caster level of 2 would give
    // three 1st only, so the combined rule must not apply to a single caster.
    expect(baseSpellSlots([{ classId: 'paladin', level: 5 }], rulepack))
      .toEqual({ 1: 4, 2: 2 })
    expect(baseSpellSlots([{ classId: 'wizard', level: 3 }], rulepack))
      .toEqual({ 1: 4, 2: 2 })
  })

  it('fixes the case that was over-generous before: cleric 1 / paladin 2', () => {
    // Caster level 1 + 1 = 2, so three 1st-level slots. Summing per-class tables gave four.
    expect(baseSpellSlots(
      [{ classId: 'cleric', level: 1 }, { classId: 'paladin', level: 2 }],
      rulepack,
    )).toEqual({ 1: 3 })
  })

  it('combines two full casters on the shared table', () => {
    // Cleric 1 / wizard 1 = caster level 2 = three 1st-level slots
    expect(baseSpellSlots(
      [{ classId: 'cleric', level: 1 }, { classId: 'wizard', level: 1 }],
      rulepack,
    )).toEqual({ 1: 3 })
  })

  it('ignores non-casters in the total', () => {
    expect(baseSpellSlots(
      [{ classId: 'fighter', level: 10 }, { classId: 'wizard', level: 2 }],
      rulepack,
    )).toEqual(baseSpellSlots([{ classId: 'wizard', level: 2 }], rulepack))
  })

  it('gives a non-caster no slots at all', () => {
    expect(baseSpellSlots([{ classId: 'fighter', level: 20 }], rulepack)).toEqual({})
    expect(baseSpellSlots([{ classId: 'warlock', level: 5 }], rulepack)).toEqual({})
  })

  it('adds a manual bonus on top of the derived base', () => {
    const char = {
      classes: [{ classId: 'wizard', level: 1 }],
      spellSlots: { 1: { used: 0, bonus: 2 } },
    }
    expect(spellSlotMax(1, char, rulepack)).toBe(4)
  })

  it('clamps expenditure when the derived base shrinks', () => {
    const char = {
      classes: [{ classId: 'wizard', level: 1 }],
      spellSlots: { 1: { used: 9 }, 2: { used: 1 } },
    }
    const clamped = clampSpellSlots(char, rulepack)
    expect(clamped[1]!.used).toBe(2)
    expect(clamped[2]!.used).toBe(0)
  })
})

describe('max learnable spell level', () => {
  it('is capped by the class own level, not the shared slots', () => {
    const classes = [{ classId: 'cleric', level: 1 }, { classId: 'wizard', level: 1 }]
    // Two 1st-level classes share a 2nd-level slot but may only take 1st-level spells
    expect(baseSpellSlots(classes, rulepack)).toEqual({ 1: 3 })
    expect(maxSpellLevelForClass('cleric', classes, rulepack)).toBe(1)
    expect(maxSpellLevelForClass('wizard', classes, rulepack)).toBe(1)
  })

  it('rises with the individual class level', () => {
    expect(maxSpellLevelForClass('wizard', [{ classId: 'wizard', level: 1 }], rulepack)).toBe(1)
    expect(maxSpellLevelForClass('wizard', [{ classId: 'wizard', level: 3 }], rulepack)).toBe(2)
    expect(maxSpellLevelForClass('wizard', [{ classId: 'wizard', level: 20 }], rulepack)).toBe(9)
  })

  it('is zero for a non-caster', () => {
    expect(maxSpellLevelForClass('fighter', [{ classId: 'fighter', level: 20 }], rulepack)).toBe(0)
  })

  it('lags for a half caster, as the SRD intends', () => {
    // Paladin gains 1st-level spells at 2, not at 1
    expect(maxSpellLevelForClass('paladin', [{ classId: 'paladin', level: 1 }], rulepack)).toBe(0)
    expect(maxSpellLevelForClass('paladin', [{ classId: 'paladin', level: 2 }], rulepack)).toBe(1)
  })
})

describe('per-class hit dice', () => {
  it('creates a pool for a class that has none', () => {
    expect(addHitDieForClass([], 'fighter', 'd10'))
      .toEqual([{ classId: 'fighter', die: 'd10', total: 1, remaining: 1 }])
  })

  it('grows the right pool and leaves the others alone', () => {
    const pools = [
      { classId: 'fighter', die: 'd10', total: 3, remaining: 1 },
      { classId: 'wizard', die: 'd6', total: 2, remaining: 2 },
    ]
    expect(addHitDieForClass(pools, 'wizard', 'd6')).toEqual([
      { classId: 'fighter', die: 'd10', total: 3, remaining: 1 },
      { classId: 'wizard', die: 'd6', total: 3, remaining: 3 },
    ])
  })

  it('keeps a fighter and a wizard pool apart through a level-up', () => {
    const char: Character = {
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 1 }],
      hitDice: [{ classId: 'fighter', die: 'd10', total: 1, remaining: 1 }],
    } as Character
    const events = resolveLevelUpEvents(char, 'wizard', 1, rulepack)
    const applied = applyAutomaticEvents(char, getAutomaticEvents(events), 'average')
    expect(applied.hitDice).toEqual([
      { classId: 'fighter', die: 'd10', total: 1, remaining: 1 },
      { classId: 'wizard', die: 'd6', total: 1, remaining: 1 },
    ])
  })
})

describe('character migration', () => {
  it('moves a legacy single hit dice pool onto the first class', () => {
    const legacy = {
      ...validCharacter,
      classes: [{ classId: 'fighter', level: 3 }],
      hitDice: { total: 3, remaining: 2, die: 'd10' },
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(parsed.hitDice).toEqual([
      { classId: 'fighter', die: 'd10', total: 3, remaining: 2 },
    ])
  })

  it('drops stored slot maxima, keeping expenditure', () => {
    const legacy = {
      ...validCharacter,
      spellSlots: { 1: { max: 4, used: 2 } },
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(parsed.spellSlots[1]).toEqual({ used: 2 })
  })

  it('groups a flat spells array into per-source lists', () => {
    const legacy = {
      ...validCharacter,
      classes: [{ classId: 'cleric', level: 1 }, { classId: 'wizard', level: 1 }],
      spellcastingAbility: 'wis' as const,
      classSpellcasting: {},
      spells: [
        { id: 'a', spellId: 'bless', name: 'Bless', level: 1, prepared: true, classId: 'cleric' },
        { id: 'b', spellId: 'shield', name: 'Shield', level: 1, prepared: false, classId: 'wizard' },
      ],
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(Object.keys(parsed.classSpellcasting).sort()).toEqual(['cleric', 'wizard'])
    expect(parsed.classSpellcasting.cleric!.spells.map(s => s.spellId)).toEqual(['bless'])
    expect(parsed.classSpellcasting.wizard!.spells.map(s => s.spellId)).toEqual(['shield'])
  })

  it('attributes spells with no classId to the first class rather than losing them', () => {
    const legacy = {
      ...validCharacter,
      classes: [{ classId: 'bard', level: 2 }],
      classSpellcasting: {},
      spells: [
        { id: 'a', spellId: 'vicious-mockery', name: 'Vicious Mockery', level: 0, prepared: true },
      ],
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(parsed.classSpellcasting.bard!.spells).toHaveLength(1)
  })

  it('leaves already-grouped lists untouched', () => {
    const current = {
      ...validCharacter,
      classes: [{ classId: 'bard', level: 2 }],
      classSpellcasting: {
        bard: {
          ability: 'cha' as const,
          spells: [{ id: 'x', spellId: 'bless', name: 'Bless', level: 1, prepared: true }],
        },
      },
      spells: [],
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(current)))
    expect(parsed.classSpellcasting.bard!.spells).toHaveLength(1)
  })
})
