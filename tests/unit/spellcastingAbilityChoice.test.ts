import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  resolveFeatEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, FeatDefinition } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'
import spells from '~/data/srd/spells.json'

/**
 * A Monsters of the Multiverse-shaped race: it grants a cantrip and leaves the casting
 * ability to the player, then hands out levelled spells at 3rd and 5th.
 */
const RACE = {
  id: 'fairy',
  name: 'Fairy',
  size: 'small' as const,
  speeds: { walk: 30, fly: 30 },
  abilityScoreBonuses: {},
  traits: [],
  languages: [],
  levelUpEvents: [
    {
      level: 1,
      levelUpEvents: [
        {
          type: 'CHOOSE_SPELLCASTING_ABILITY' as const,
          addTo: 'fairy',
          from: ['int', 'wis', 'cha'] as const,
          origin: 'race' as const,
          label: 'Fairy Magic',
        },
        {
          type: 'GRANT_SPELLS' as const,
          addTo: 'fairy',
          spellIds: ['druidcraft'],
          alwaysPrepared: true,
          origin: 'race' as const,
          label: 'Fairy Magic',
        },
      ],
    },
    {
      level: 3,
      levelUpEvents: [
        {
          type: 'CHOOSE_SPELLCASTING_ABILITY' as const,
          addTo: 'fairy',
          from: ['int', 'wis', 'cha'] as const,
          origin: 'race' as const,
          label: 'Fairy Magic',
        },
        {
          type: 'GRANT_SPELLS' as const,
          addTo: 'fairy',
          spellIds: ['faerie-fire'],
          alwaysPrepared: true,
          origin: 'race' as const,
          label: 'Fairy Magic',
          uses: { max: 1, recharge: 'long' as const },
        },
      ],
    },
  ],
}

const INITIATE: FeatDefinition = {
  id: 'magic-initiate',
  name: 'Magic Initiate',
  description: '',
  levelUpEvents: [
    { type: 'CHOOSE_SPELLCASTING_ABILITY', addTo: '', from: ['int', 'wis', 'cha'] },
    { type: 'CHOOSE_SPELL', addTo: '', count: 1, classes: ['wizard'] },
  ],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p', name: 'Test', version: '1',
    races: [RACE],
    classes: RulepackSchema.parse(fighter).classes,
    spells: RulepackSchema.parse(spells).spells,
    feats: [INITIATE],
  }) as unknown as Rulepack
  return built
}

const rulepack = pack()

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    race: 'fairy',
    subrace: undefined,
    classes: [{ classId: 'fighter', level: 0 }],
    spells: [],
    classSpellcasting: {},
    ...over,
  } as Character
}

describe('CHOOSE_SPELLCASTING_ABILITY — schema', () => {
  it('round-trips through RulepackSchema', () => {
    const race = rulepack.races.find(r => r.id === 'fairy')!
    expect(race.levelUpEvents?.[0]!.levelUpEvents[0]).toEqual({
      type: 'CHOOSE_SPELLCASTING_ABILITY',
      addTo: 'fairy',
      from: ['int', 'wis', 'cha'],
      origin: 'race',
      label: 'Fairy Magic',
    })
  })

  it('rejects an empty ability list', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      feats: [{
        id: 'x', name: 'X', description: '',
        levelUpEvents: [{ type: 'CHOOSE_SPELLCASTING_ABILITY', addTo: 'x', from: [] }],
      }],
    })
    expect(result.success).toBe(false)
  })
})

describe('resolving the choice from a race', () => {
  it('asks at the level the source first grants spells', () => {
    const events = resolveLevelUpEvents(char(), 'fighter', 1, rulepack)
    const choice = getChoiceEvents(events).find(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')
    expect(choice).toMatchObject({
      addTo: 'fairy',
      from: ['int', 'wis', 'cha'],
      origin: 'race',
      label: 'Fairy Magic',
    })
  })

  it('is a choice event, not an automatic one', () => {
    const events = resolveLevelUpEvents(char(), 'fighter', 1, rulepack)
    expect(getAutomaticEvents(events).some(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')).toBe(false)
  })

  it('does not ask again once the player has answered', () => {
    // The Fairy declares the same choice at 3rd; abilityChosen is what silences it, so a
    // DC the player already set is not quietly reset on the next level-up.
    const answered = char({
      classes: [{ classId: 'fighter', level: 2 }],
      classSpellcasting: {
        fairy: { ability: 'cha', origin: 'race', label: 'Fairy Magic', abilityChosen: true, spells: [] },
      },
    })
    const events = resolveLevelUpEvents(answered, 'fighter', 3, rulepack)
    expect(getChoiceEvents(events).some(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')).toBe(false)
    // The spell grant at that level still fires
    expect(getAutomaticEvents(events).some(e => e.type === 'GRANT_SPELLS')).toBe(true)
  })

  it('asks again if a stored entry has an ability the source dictated, not the player', () => {
    const dictated = char({
      classSpellcasting: {
        fairy: { ability: 'cha', origin: 'race', spells: [] },
      },
    })
    const events = resolveLevelUpEvents(dictated, 'fighter', 1, rulepack)
    expect(getChoiceEvents(events).some(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')).toBe(true)
  })

  it('copies the ability list rather than aliasing the rulepack', () => {
    const events = resolveLevelUpEvents(char(), 'fighter', 1, rulepack)
    const choice = getChoiceEvents(events).find(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')!
    expect(choice.type === 'CHOOSE_SPELLCASTING_ABILITY' && choice.from)
      .not.toBe(rulepack.races.find(r => r.id === 'fairy')!.levelUpEvents![0]!.levelUpEvents[0]!.from)
  })
})

describe('resolving the choice from a feat', () => {
  it('defaults addTo to the feat id and origin to feat', () => {
    const events = resolveFeatEvents(char(), INITIATE, rulepack)
    const choice = events.find(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')
    expect(choice).toMatchObject({
      addTo: 'magic-initiate',
      from: ['int', 'wis', 'cha'],
      origin: 'feat',
      label: 'Magic Initiate',
    })
  })

  it('is skipped when the feat source already has a chosen ability', () => {
    const answered = char({
      classSpellcasting: {
        'magic-initiate': { ability: 'int', origin: 'feat', abilityChosen: true, spells: [] },
      },
    })
    expect(resolveFeatEvents(answered, INITIATE, rulepack)
      .some(e => e.type === 'CHOOSE_SPELLCASTING_ABILITY')).toBe(false)
  })
})

describe('applying the answer', () => {
  it('records the ability against the source and marks it as the player’s', () => {
    const result = applyResolvedChoices(
      char(),
      [{
        type: 'RESOLVED_SPELLCASTING_ABILITY',
        sourceId: 'fairy',
        ability: 'wis',
        origin: 'race',
        label: 'Fairy Magic',
      }],
      rulepack,
    )
    expect(result.classSpellcasting.fairy).toEqual({
      ability: 'wis',
      origin: 'race',
      label: 'Fairy Magic',
      abilityChosen: true,
      spells: [],
    })
  })

  it('keeps spells already recorded against the source', () => {
    const start = char({
      classSpellcasting: {
        fairy: { ability: 'cha', origin: 'race', spells: [{ id: 'a', spellId: 'druidcraft', name: 'Druidcraft', level: 0, prepared: true }] },
      },
    } as Partial<Character>)
    const result = applyResolvedChoices(
      start,
      [{ type: 'RESOLVED_SPELLCASTING_ABILITY', sourceId: 'fairy', ability: 'int' }],
      rulepack,
    )
    expect(result.classSpellcasting.fairy!.ability).toBe('int')
    expect(result.classSpellcasting.fairy!.spells).toHaveLength(1)
    // origin and label survive a choice that does not restate them
    expect(result.classSpellcasting.fairy!.origin).toBe('race')
  })

  it('gives the granted spells a DC source, applied after the automatic grant', () => {
    // The real order: applyAutomaticEvents runs first and cannot know the ability, then
    // the resolved choice supplies it.
    const events = resolveLevelUpEvents(char(), 'fighter', 1, rulepack)
    const afterAuto = applyAutomaticEvents(char(), getAutomaticEvents(events), 'average')
    expect(afterAuto.spells.map(s => s.spellId)).toContain('druidcraft')
    expect(afterAuto.classSpellcasting.fairy).toBeUndefined()

    const final = applyResolvedChoices(
      afterAuto,
      [{ type: 'RESOLVED_SPELLCASTING_ABILITY', sourceId: 'fairy', ability: 'cha', origin: 'race', label: 'Fairy Magic' }],
      rulepack,
    )
    expect(final.classSpellcasting.fairy).toMatchObject({ ability: 'cha', abilityChosen: true })
    expect(final.spells.find(s => s.spellId === 'druidcraft')?.classId).toBe('fairy')
  })
})

describe('surviving the import boundary', () => {
  it('keeps origin, label and abilityChosen through CharacterSchema', async () => {
    const { CharacterSchema } = await import('~/schemas/characterSchema')
    const source = {
      ability: 'cha' as const,
      origin: 'race' as const,
      label: 'Fairy Magic',
      abilityChosen: true,
      spells: [],
    }
    const parsed = CharacterSchema.parse({
      ...validCharacter,
      classSpellcasting: { 'mpmm.fairy': source },
    })
    // Zod strips undeclared keys, so a missing field here means an imported character
    // would be re-asked for an ability it had already chosen.
    expect(parsed.classSpellcasting['mpmm.fairy']).toEqual(source)
  })
})
