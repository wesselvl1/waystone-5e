import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  resolveFeatEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
  isChoiceEvent,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, FeatDefinition, Background, Race } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'

/**
 * A dozen backgrounds and two races say "you gain the X feat" and grant nothing today —
 * GRANT_FEAT is the event that lets them. These feats stand in for the shapes the real
 * books use: a flat bonus, an hpBonusPerLevel feat, and a feat that asks its own question
 * the way Magic Initiate does.
 *
 * Every one of them is declared here rather than imported. Only `app/data/srd/` is
 * committed — every other book directory is gitignored (CLAUDE.md, "Non-SRD books") — so
 * a test that imports one cannot resolve that import in a CI clone and takes the whole
 * suite down with it. This file used to read the real `phb.tough` for the case below.
 */
const FLAT_BONUS_FEAT: FeatDefinition = {
  id: 'test.flat-bonus',
  name: 'Flat Bonus Feat',
  description: '',
  abilityScoreBonus: { str: 1 },
}

/**
 * Tough's shape, field for field as `phb.tough` writes it: a flat hit-point grant per
 * level, no ability bonus and no question of its own. It is the one feat here whose
 * numbers the assertions depend on, so the +2 per level is the book's, not an invention.
 */
const TOUGH_FEAT: FeatDefinition = {
  id: 'test.tough',
  name: 'Tough',
  description: 'Your hit point maximum increases by an amount equal to twice your level when you gain this feat. Whenever you gain a level thereafter, your hit point maximum increases by an additional 2 hit points.',
  hpBonusPerLevel: 2,
}

const CLASS_OPTION = 'test.magic-initiate-option'

/** Magic Initiate's shape: pick a class, then that class's cantrips and a 1st-level spell. */
const MAGIC_INITIATE: FeatDefinition = {
  id: 'test.magic-initiate',
  name: 'Magic Initiate',
  description: '',
  levelUpEvents: [
    {
      type: 'CHOOSE_OPTION',
      id: CLASS_OPTION,
      label: 'Magic Initiate',
      options: [
        { id: 'wizard-spells', name: 'Wizard Spells', description: '' },
        { id: 'cleric-spells', name: 'Cleric Spells', description: '' },
      ],
    },
    {
      type: 'CHOOSE_SPELL',
      addTo: 'test.magic-initiate',
      count: 2,
      cantrip: true,
      classes: ['wizard'],
      maxLevel: 0,
      whenOption: { choiceId: CLASS_OPTION, optionId: 'wizard-spells' },
    },
  ],
}

/** A feat gated on its own CHOOSE_OPTION, but with an automatic grant behind the guard. */
const PLANE_OPTION = 'test.plane-option'
const SCION: FeatDefinition = {
  id: 'test.scion',
  name: 'Scion of the Outer Planes',
  description: '',
  levelUpEvents: [
    {
      type: 'CHOOSE_OPTION',
      id: PLANE_OPTION,
      label: 'Scion of the Outer Planes',
      options: [
        { id: 'good-outer-plane', name: 'Good', description: '' },
        { id: 'evil-outer-plane', name: 'Evil', description: '' },
      ],
    },
    {
      type: 'GRANT_SPELLS',
      addTo: 'test.scion',
      spellIds: ['sacred-flame'],
      alwaysPrepared: true,
      whenOption: { choiceId: PLANE_OPTION, optionId: 'good-outer-plane' },
      ability: 'cha',
    },
  ],
}

/** A feat that itself grants another feat outright — recursion two levels deep. */
const GRANTS_ANOTHER_FEAT: FeatDefinition = {
  id: 'test.grants-another',
  name: 'Grants Another',
  description: '',
  levelUpEvents: [{ type: 'GRANT_FEAT', featId: 'test.flat-bonus' }],
}

const ABILITY_CHOICE_FEAT: FeatDefinition = {
  id: 'test.ability-choice',
  name: 'Ability Choice Feat',
  description: '',
  abilityScoreChoice: { from: ['str', 'dex'], distributions: [[1]] },
}

/**
 * The "Touched" shape (Fey Touched, Shadow Touched, Gift of the Chromatic/Metallic
 * Dragon): a free spell whose casting ability is whichever ability the feat's own
 * abilityScoreChoice increased, not known until the player answers that choice.
 */
const TOUCHED_FEAT: FeatDefinition = {
  id: 'test.touched',
  name: 'Test Touched',
  description: '',
  abilityScoreChoice: { from: ['int', 'wis', 'cha'], distributions: [[1]] },
  levelUpEvents: [{
    type: 'GRANT_SPELLS',
    addTo: 'test.touched',
    spellIds: ['sacred-flame'],
    alwaysPrepared: true,
    ability: 'increased',
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse(fighter) as unknown as Rulepack
  built.feats = [
    TOUGH_FEAT,
    FLAT_BONUS_FEAT,
    MAGIC_INITIATE,
    SCION,
    GRANTS_ANOTHER_FEAT,
    ABILITY_CHOICE_FEAT,
    TOUCHED_FEAT,
  ]
  // Only what SCION's guarded GRANT_SPELLS needs to resolve to something real.
  built.spells = [{
    id: 'sacred-flame', name: 'Sacred Flame', level: 0, school: 'evocation',
    castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous',
    concentration: false, ritual: false, description: '', classes: ['cleric'],
  }]
  return built
}

const rulepack = pack()

/** A background whose only job is to name a feat at total level 1 — the real shape. */
function backgroundGranting(featId: string, withOption?: { choiceId: string; optionId: string }): Background {
  return {
    id: 'test-bg',
    name: 'Test Background',
    description: '',
    skillProficiencies: [],
    toolProficiencies: [],
    languages: 0,
    equipment: [],
    feature: { name: '', description: '' },
    levelUpEvents: [{ level: 1, levelUpEvents: [{ type: 'GRANT_FEAT', featId, ...(withOption ? { withOption } : {}) }] }],
  }
}

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'fighter', level: 0 }],
    background: 'test-bg',
    spells: [],
    features: [],
    chosenOptions: {},
    ...over,
  } as Character
}

describe('GRANT_FEAT — resolving a background\'s feat grant', () => {
  it('emits an automatic GRANT_FEAT event with the flat ability bonus denormalized', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.flat-bonus')] }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    const grant = events.find(e => e.type === 'GRANT_FEAT')
    expect(grant).toMatchObject({
      type: 'GRANT_FEAT',
      featId: 'test.flat-bonus',
      name: 'Flat Bonus Feat',
      abilityScoreBonus: { str: 1 },
    })
    expect(getAutomaticEvents(events)).toContainEqual(grant)
  })

  it('skips the grant entirely when the character already has the feat', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.flat-bonus')] }
    const already = char({ features: [{ id: 'test.flat-bonus', name: 'Flat Bonus Feat', source: 'Feat', description: '' }] })
    const events = resolveLevelUpEvents(already, 'fighter', 1, packWithBg)
    expect(events.some(e => e.type === 'GRANT_FEAT')).toBe(false)
  })

  it('degrades without throwing for a featId the pack does not have', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.does-not-exist')] }
    expect(() => resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)).not.toThrow()
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    expect(events.some(e => e.type === 'GRANT_FEAT')).toBe(false)
  })
})

describe('GRANT_FEAT — applying the flat ability bonus', () => {
  it('adds the feature under the feat\'s own name and applies the bonus', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.flat-bonus')] }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    const updated = applyAutomaticEvents(char(), getAutomaticEvents(events), 'average')
    expect(updated.features.some(f => f.id === 'test.flat-bonus' && f.name === 'Flat Bonus Feat')).toBe(true)
    expect(updated.abilityScores.str).toBe(char().abilityScores.str + 1)
  })
})

describe('GRANT_FEAT — Tough\'s shape, HP applies retroactively', () => {
  it('adds twice the character\'s total level to max HP, not just +2', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.tough')] }
    // Already 4 levels in when the grant lands, so the retroactive math has something to prove.
    const veteran = char({ classes: [{ classId: 'fighter', level: 4 }] })
    const events = resolveLevelUpEvents(veteran, 'fighter', 1, packWithBg)
    const grant = events.find(e => e.type === 'GRANT_FEAT')
    expect(grant).toMatchObject({ featId: 'test.tough', hpBonusPerLevel: 2 })

    // Isolate the feat's own effect from this level's ADD_HP by applying it alone.
    const updated = applyAutomaticEvents(veteran, [grant!], 'average')
    expect(updated.hp.max).toBe(veteran.hp.max + 2 * 4)
    expect(updated.hp.current).toBe(veteran.hp.current + 2 * 4)
    expect(updated.hpBonusPerLevel).toBe(2)
  })
})

describe('GRANT_FEAT — a feat carrying its own levelUpEvents (Magic Initiate\'s shape)', () => {
  it('with withOption pre-answering the class, unlocks the gated CHOOSE_SPELL immediately', () => {
    const packWithBg = {
      ...rulepack,
      backgrounds: [backgroundGranting('test.magic-initiate', { choiceId: CLASS_OPTION, optionId: 'wizard-spells' })],
    }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)

    const grant = events.find(e => e.type === 'GRANT_FEAT')
    expect(grant).toMatchObject({
      featId: 'test.magic-initiate',
      withOption: { choiceId: CLASS_OPTION, optionId: 'wizard-spells', optionName: 'Wizard Spells' },
    })

    // The feat's own CHOOSE_OPTION is answered already, so it never reaches the wizard —
    // fighter 1 still asks its own Fighting Style, but the feat's question is gone from
    // the list — while the CHOOSE_SPELL it was gating does, because the answer unlocked it.
    const choices = getChoiceEvents(events)
    expect(choices.some(c => c.type === 'CHOOSE_OPTION' && c.id === CLASS_OPTION)).toBe(false)
    const spellChoice = choices.find(c => c.type === 'CHOOSE_SPELL')
    expect(spellChoice).toMatchObject({ addTo: 'test.magic-initiate', count: 2, cantrip: true, classes: ['wizard'] })
  })

  it('without withOption, the CHOOSE_OPTION itself is the choice event', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.magic-initiate')] }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    const choices = getChoiceEvents(events)
    expect(choices.some(c => c.type === 'CHOOSE_OPTION' && c.id === CLASS_OPTION)).toBe(true)
    // No answer yet, so the gated CHOOSE_SPELL cannot appear until the wizard's second stage.
    expect(choices.some(c => c.type === 'CHOOSE_SPELL' && c.addTo === 'test.magic-initiate')).toBe(false)
  })

  it('recursively unlocks an automatic guarded grant too, not just a guarded question', () => {
    const packWithBg = {
      ...rulepack,
      backgrounds: [backgroundGranting('test.scion', { choiceId: PLANE_OPTION, optionId: 'good-outer-plane' })],
    }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    const spellGrant = events.find(e => e.type === 'GRANT_SPELLS')
    expect(spellGrant).toMatchObject({ addTo: 'test.scion', spells: [{ spellId: 'sacred-flame' }] })
  })

  it('applying the pre-answered feat records the answer and renames the feature', () => {
    const packWithBg = {
      ...rulepack,
      backgrounds: [backgroundGranting('test.magic-initiate', { choiceId: CLASS_OPTION, optionId: 'wizard-spells' })],
    }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    const updated = applyAutomaticEvents(char(), getAutomaticEvents(events), 'average')
    expect(updated.chosenOptions?.[CLASS_OPTION]).toBe('wizard-spells')
    expect(updated.features.find(f => f.id === 'test.magic-initiate')?.name)
      .toBe('Magic Initiate (Wizard Spells)')
  })

  it('a feat granting another feat resolves the grant two levels deep', () => {
    const events = resolveFeatEvents(char(), GRANTS_ANOTHER_FEAT, rulepack)
    const nested = events.find(e => e.type === 'GRANT_FEAT')
    expect(nested).toMatchObject({ featId: 'test.flat-bonus', abilityScoreBonus: { str: 1 } })
  })
})

describe('GRANT_FEAT — an ability score choice the feat itself leaves to the player', () => {
  it('raises CHOOSE_FEAT_ABILITY alongside the automatic grant', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.ability-choice')] }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)
    expect(events.some(e => e.type === 'GRANT_FEAT')).toBe(true)
    const choice = getChoiceEvents(events).find(c => c.type === 'CHOOSE_FEAT_ABILITY')
    expect(choice).toMatchObject({ featId: 'test.ability-choice' })
    expect(isChoiceEvent({ type: 'CHOOSE_FEAT_ABILITY', featId: 'x', label: 'x', choice: { from: ['str'], distributions: [[1]] } })).toBe(true)
  })

  it('RESOLVED_FEAT_ABILITY applies the bonus the player picked', () => {
    const updated = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_FEAT_ABILITY', featId: 'test.ability-choice', bonuses: { dex: 1 } }],
      rulepack,
    )
    expect(updated.abilityScores.dex).toBe(char().abilityScores.dex + 1)
  })

  it('a spell keyed to \'increased\' resolves with no ability until the choice is answered, then gets fixed up', () => {
    const packWithBg = { ...rulepack, backgrounds: [backgroundGranting('test.touched')] }
    const events = resolveLevelUpEvents(char(), 'fighter', 1, packWithBg)

    // Resolved before anyone has answered the ability choice: the grant is there, but
    // nothing says which ability it casts with yet.
    const spellGrant = events.find(e => e.type === 'GRANT_SPELLS')
    expect(spellGrant).toMatchObject({ addTo: 'test.touched', spells: [{ spellId: 'sacred-flame' }] })
    expect(spellGrant && 'ability' in spellGrant ? spellGrant.ability : undefined).toBeUndefined()

    let updated = applyAutomaticEvents(char(), getAutomaticEvents(events), 'average')
    expect(updated.spells.map(s => s.spellId)).toEqual(['sacred-flame'])
    // Nothing to register a DC against yet — the point of this test.
    expect(updated.classSpellcasting?.['test.touched']).toBeUndefined()

    // The wizard asks CHOOSE_FEAT_ABILITY, the player picks Wisdom, and that answer has to
    // reach back into the grant that already landed.
    updated = applyResolvedChoices(
      updated,
      [{ type: 'RESOLVED_FEAT_ABILITY', featId: 'test.touched', bonuses: { wis: 1 } }],
      packWithBg,
    )
    expect(updated.classSpellcasting?.['test.touched']).toMatchObject({ ability: 'wis', origin: 'feat' })
    // Fixed up in place — not granted a second time.
    expect(updated.spells.map(s => s.spellId)).toEqual(['sacred-flame'])
  })
})

describe('GRANT_FEAT — a nested grant survives the CHOOSE_FEAT path too', () => {
  it('applies a feat picked at ASI that itself grants another feat outright', () => {
    const result = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'test.grants-another' }],
      rulepack,
    )
    expect(result.features.some(f => f.id === 'test.grants-another')).toBe(true)
    // The nested grant — dropped before this fix, silently, with no error.
    const nested = result.features.find(f => f.id === 'test.flat-bonus')
    expect(nested).toMatchObject({ name: 'Flat Bonus Feat', source: 'Feat' })
    expect(result.abilityScores.str).toBe(char().abilityScores.str + 1)
  })
})

/**
 * A race asking for a feat rather than naming one. The variant human's Feat trait and
 * Custom Lineage both write it as a bare `CHOOSE_FEAT` in a level-1 group, and the
 * race/subrace/background switch in resolveLevelUpEvents had no case for it — so the
 * trait showed on the sheet and the player was never asked. Declared here rather than
 * imported from `app/data/phb/`: only `app/data/srd/` is committed.
 */
function raceChoosingFeat(): Race {
  return {
    id: 'test-race',
    name: 'Test Race',
    size: 'medium',
    speeds: { walk: 30 },
    abilityScoreBonuses: {},
    traits: [{ name: 'Feat', description: 'You gain one feat of your choice.' }],
    languages: ['Common'],
    levelUpEvents: [{ level: 1, trait: 'Feat', levelUpEvents: [{ type: 'CHOOSE_FEAT' }] }],
  }
}

describe('CHOOSE_FEAT declared by a race', () => {
  const packWithRace = { ...rulepack, races: [raceChoosingFeat()] }
  const human = () => char({ race: 'test-race' })

  it('raises the choice at the total level the group names', () => {
    const events = resolveLevelUpEvents(human(), 'fighter', 1, packWithRace)
    expect(getChoiceEvents(events)).toContainEqual({ type: 'CHOOSE_FEAT' })
  })

  it('applies the picked feat\'s own ability increase and granted spell', () => {
    const choice = getChoiceEvents(resolveLevelUpEvents(human(), 'fighter', 1, packWithRace))
      .find(e => e.type === 'CHOOSE_FEAT')
    expect(choice).toBeDefined()

    const result = applyResolvedChoices(
      human(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'test.touched', abilityBonus: { wis: 1 } }],
      packWithRace,
    )
    expect(result.features.some(f => f.id === 'test.touched')).toBe(true)
    expect(result.abilityScores.wis).toBe(human().abilityScores.wis + 1)
    // The feat's own levelUpEvents, keyed to the ability it just increased.
    expect(result.spells.map(s => s.spellId)).toContain('sacred-flame')
    expect(result.classSpellcasting?.['test.touched']).toMatchObject({ ability: 'wis', origin: 'feat' })
  })
})
