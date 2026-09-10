/**
 * Regressions for a round of review findings. Each of these was a real defect; most were
 * unreachable with the data as it ships, which is exactly why they need tests.
 */
import { describe, it, expect } from 'vitest'
import {
  applyResolvedChoices,
  chooseSpellEvent,
  getAutomaticEvents,
  resolveFeatEvents,
} from '~/services/levelUpService'
import { raceAbilityBonuses } from '~/services/multiclass'
import { baseSpellSlots } from '~/services/spellcasting'
import { isChoiceSetSatisfied, sumBonuses } from '~/services/abilityScoreChoice'
import { outstandingRacialChoices, racialChoicePatch } from '~/services/characterMigration'
import type { AbilityScores, Character } from '~/types/character'
import type { ClassDefinition, FeatDefinition, Race, Rulepack, Subrace } from '~/types/rulepack'

const SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function character(over: Partial<Character> = {}): Character {
  return {
    id: 'c',
    name: 'T',
    race: 'human',
    background: 'b',
    classes: [{ classId: 'fighter', level: 4 }],
    experiencePoints: 0,
    inspiration: false,
    abilityScores: { ...SCORES },
    abilityScoreOverrides: {},
    hp: { max: 30, current: 30, temp: 0 },
    armorClass: null,
    initiative: null,
    speeds: { walk: 30 },
    hitDice: [],
    spellSlots: {},
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficiencyBonusOverride: null,
    savingThrowProficiencies: [],
    skillProficiencies: {},
    otherProficiencies: [],
    features: [],
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spells: [],
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  } as Character
}

const KI_SPELL = {
  id: 'pass-without-trace',
  name: 'Pass without Trace',
  level: 2,
  school: 'abjuration',
  castingTime: '1 action',
  range: 'Self',
  components: 'V, S, M',
  duration: '1 hour',
  concentration: true,
  ritual: false,
  description: '',
  classes: ['druid'],
}

function pack(over: Partial<Rulepack> = {}): Rulepack {
  return {
    id: 'p',
    name: 'P',
    version: '1',
    races: [],
    classes: [],
    backgrounds: [],
    feats: [],
    spells: [KI_SPELL],
    optionalFeatures: [],
    ...over,
  } as Rulepack
}

describe('a feat that meters its spell by a class resource', () => {
  const FEAT: FeatDefinition = {
    id: 'ki-feat',
    name: 'Ki Feat',
    description: '',
    levelUpEvents: [{
      type: 'GRANT_SPELLS',
      addTo: 'ki-feat',
      spellIds: ['pass-without-trace'],
      cost: { resource: 'Ki Points', amount: 2 },
      origin: 'feat',
    }],
  }

  /** Every other call site forwarded `cost`; the feat path silently dropped it. */
  it('stores the price with the spell', () => {
    const out = applyResolvedChoices(
      character(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'ki-feat' }],
      pack({ feats: [FEAT] }),
      'fighter',
      5,
    )
    const entry = out.spells.find(s => s.spellId === 'pass-without-trace')!
    expect(entry.cost).toEqual({ resource: 'Ki Points', amount: 2 })
  })
})

describe('a feat that makes the character a caster', () => {
  const FEAT: FeatDefinition = {
    id: 'caster-feat',
    name: 'Caster Feat',
    description: '',
    levelUpEvents: [{
      type: 'GRANT_SPELLCASTING',
      addTo: 'caster-feat',
      ability: 'int',
      origin: 'feat',
      label: 'Caster Feat',
    }],
  }

  it('emits the event as an automatic one', () => {
    const events = getAutomaticEvents(resolveFeatEvents(character(), FEAT, pack()))
    expect(events.some(e => e.type === 'GRANT_SPELLCASTING')).toBe(true)
  })

  /** Feat events never reach applyAutomaticEvents, so the feat's own switch must cover it. */
  it('registers the source when the feat is taken', () => {
    const out = applyResolvedChoices(
      character(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'caster-feat' }],
      pack({ feats: [FEAT] }),
      'fighter',
      5,
    )
    expect(out.classSpellcasting?.['caster-feat']?.ability).toBe('int')
    expect(out.classSpellcasting?.['caster-feat']?.origin).toBe('feat')
  })
})

describe('an ability the player chose', () => {
  it('survives a later grant on the same source', () => {
    const chosen = character({
      classSpellcasting: {
        'magic-initiate': { ability: 'wis', abilityChosen: true, origin: 'feat', spells: [] },
      },
    })
    const FEAT: FeatDefinition = {
      id: 'magic-initiate',
      name: 'Magic Initiate',
      description: '',
      levelUpEvents: [{
        type: 'GRANT_SPELLS',
        addTo: 'magic-initiate',
        spellIds: ['pass-without-trace'],
        ability: 'cha',
        origin: 'feat',
      }],
    }
    const out = applyResolvedChoices(
      chosen,
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'magic-initiate' }],
      pack({ feats: [FEAT] }),
      'fighter',
      5,
    )
    // Not 'cha': the grant must not undo an answer, least of all silently — abilityChosen
    // stays set, so the player would never be asked again.
    expect(out.classSpellcasting?.['magic-initiate']?.ability).toBe('wis')
  })

  it('survives a chosen spell landing on the same source', () => {
    const chosen = character({
      classSpellcasting: {
        wizard: { ability: 'wis', abilityChosen: true, origin: 'class', spells: [] },
      },
    })
    const out = applyResolvedChoices(chosen, [{
      type: 'RESOLVED_CHOOSE_SPELL',
      spellIds: ['pass-without-trace'],
      removedSpellIds: [],
      classId: 'wizard',
      ability: 'int',
    }], pack(), 'wizard', 2)
    expect(out.classSpellcasting?.wizard?.ability).toBe('wis')
  })
})

describe('a guarded choice a subclass declares', () => {
  it('is withheld until its option is answered', () => {
    const def = {
      type: 'CHOOSE_SPELL' as const,
      addTo: 'sorcerer',
      count: 1,
      whenOption: { choiceId: 'affinity', optionId: 'good' },
    }
    expect(chooseSpellEvent(def, character())).toBeUndefined()
    const answered = character({ chosenOptions: { affinity: 'good' } })
    expect(chooseSpellEvent(def, answered)?.whenOption).toEqual(def.whenOption)
  })

  it('carries the free-cast terms through the translation', () => {
    const event = chooseSpellEvent({
      type: 'CHOOSE_SPELL',
      addTo: 'monk',
      count: 1,
      cost: { resource: 'Ki Points', amount: 2 },
      uses: { max: 1, recharge: 'long' },
    }, character())
    expect(event?.cost).toEqual({ resource: 'Ki Points', amount: 2 })
    expect(event?.uses).toEqual({ max: 1, recharge: 'long' })
  })
})

describe('an expansion that arrives later than the rule', () => {
  it('is not announced before it is in force', () => {
    // Reported at the level it applies, not the level it is declared
    const events = resolveFeatEvents(
      character({ classes: [{ classId: 'warlock', level: 3 }] }),
      {
        id: 'f',
        name: 'F',
        description: '',
        levelUpEvents: [{
          type: 'EXPAND_SPELL_LIST',
          addTo: 'warlock',
          spellIds: ['pass-without-trace'],
          minLevel: 9,
        }],
      } as FeatDefinition,
      pack(),
    )
    expect(events.some(e => e.type === 'EXPAND_SPELL_LIST')).toBe(false)
  })

  it('is announced once the level is reached', () => {
    const events = resolveFeatEvents(
      character({ classes: [{ classId: 'warlock', level: 9 }] }),
      {
        id: 'f',
        name: 'F',
        description: '',
        levelUpEvents: [{
          type: 'EXPAND_SPELL_LIST',
          addTo: 'warlock',
          spellIds: ['pass-without-trace'],
          minLevel: 9,
        }],
      } as FeatDefinition,
      pack(),
    )
    expect(events.some(e => e.type === 'EXPAND_SPELL_LIST')).toBe(true)
  })
})

describe('a fixed bonus and a pick on the same ability', () => {
  it('adds up rather than replacing', () => {
    expect(sumBonuses([{ cha: 2 }, { cha: 1, str: 1 }])).toEqual({ cha: 3, str: 1 })
  })

  const CHANGELING: Race = {
    id: 'changeling',
    name: 'Changeling',
    size: 'medium',
    speeds: { walk: 30 },
    // A pool that includes the ability the race already raises
    abilityScoreBonuses: { cha: 2 },
    abilityScoreChoice: { from: ['cha', 'dex'], distributions: [[1]] },
    traits: [],
    languages: [],
  }

  /**
   * Spreading the two instead let the pick replace the fixed bonus. The record of the
   * grant is what says the choice was answered, so under-reporting it made the sheet
   * prompt a brand-new character and apply the increase a second time.
   */
  it('leaves the choice answered', () => {
    const applied = sumBonuses([{ cha: 2 }, { cha: 1 }])
    expect(applied).toEqual({ cha: 3 })
    const c = character({ race: 'changeling', appliedRacialBonuses: applied })
    expect(outstandingRacialChoices(c, CHANGELING, undefined)).toEqual([])
  })

  it('would have re-prompted had it been spread', () => {
    const spread = { ...{ cha: 2 }, ...{ cha: 1 } }
    const c = character({ race: 'changeling', appliedRacialBonuses: spread })
    expect(outstandingRacialChoices(c, CHANGELING, undefined)).not.toEqual([])
  })

  it('sums when the sheet spends the choice too', () => {
    const c = character({ appliedRacialBonuses: { cha: 2 } })
    expect(racialChoicePatch(c, { cha: 1 }).appliedRacialBonuses).toEqual({ cha: 3 })
  })
})

describe('a race and a subrace that each offer a choice', () => {
  const HALF_ELF: Race = {
    id: 'half-elf',
    name: 'Half-Elf',
    size: 'medium',
    speeds: { walk: 30 },
    abilityScoreBonuses: { cha: 2 },
    abilityScoreChoice: { from: ['str', 'dex', 'con', 'int', 'wis'], distributions: [[1, 1]] },
    traits: [],
    languages: [],
  }
  /** A dragonmark that adds rather than replacing. */
  const MARK: Subrace = {
    id: 'mark',
    name: 'Mark of Passage',
    abilityScoreBonuses: { dex: 2 },
    abilityScoreChoice: { from: ['str', 'con', 'int', 'wis', 'cha'], distributions: [[1]] },
    traits: [],
  }

  it('offers both, since both were printed', () => {
    const { choices } = raceAbilityBonuses(HALF_ELF, MARK)
    expect(choices).toEqual([HALF_ELF.abilityScoreChoice, MARK.abilityScoreChoice])
  })

  it('still lets a replacing subrace take over entirely', () => {
    const replacing: Subrace = { ...MARK, replacesRaceAbilityBonuses: true }
    expect(raceAbilityBonuses(HALF_ELF, replacing).choices)
      .toEqual([replacing.abilityScoreChoice])
  })

  it('is answered only when both are spent', () => {
    const choices = [HALF_ELF.abilityScoreChoice!, MARK.abilityScoreChoice!]
    expect(isChoiceSetSatisfied(choices, { str: 1, dex: 1 })).toBe(false)
    expect(isChoiceSetSatisfied(choices, { str: 1, con: 1, int: 1 })).toBe(true)
  })

  it('treats no choice at all as answered', () => {
    expect(isChoiceSetSatisfied([], {})).toBe(true)
  })
})

describe('the multiclass slot table', () => {
  const fullCaster = (over: Partial<ClassDefinition>): ClassDefinition => ({
    id: 'wizard',
    name: 'Wizard',
    hitDie: 'd6',
    primaryAbility: ['int'],
    savingThrowProficiencies: ['int', 'wis'],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillChoices: { count: 2, from: [] },
    spellcastingAbility: 'int',
    levels: Array.from({ length: 20 }, (_, i) => ({
      level: i + 1,
      features: [],
      spellSlots: { 1: 2 },
      levelUpEvents: [],
    })),
    ...over,
  } as ClassDefinition)

  const cleric = fullCaster({ id: 'cleric', name: 'Cleric', isFullCaster: true })

  /** castingFor already preferred casterProgression; this table only read the boolean. */
  it('reads a class that declares only casterProgression', () => {
    const p = pack({ classes: [fullCaster({ casterProgression: 'full' }), cleric] })
    const slots = baseSpellSlots(
      [{ classId: 'wizard', level: 1 }, { classId: 'cleric', level: 1 }],
      p,
    )
    expect(Object.keys(slots).length).toBeGreaterThan(0)
  })

  it('still reads the boolean the SRD data uses', () => {
    const p = pack({ classes: [fullCaster({ isFullCaster: true }), cleric] })
    const slots = baseSpellSlots(
      [{ classId: 'wizard', level: 1 }, { classId: 'cleric', level: 1 }],
      p,
    )
    expect(Object.keys(slots).length).toBeGreaterThan(0)
  })
})
