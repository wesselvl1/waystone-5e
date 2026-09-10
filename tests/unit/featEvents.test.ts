import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveFeatEvents,
  resolveUnlockedChoices,
  resolveLevelUpEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack, FeatDefinition } from '~/types/rulepack'
import { validCharacter } from '../fixtures'
import fighter from '~/data/srd/fighter.json'
import wizard from '~/data/srd/wizard.json'
import spells from '~/data/srd/spells.json'

/**
 * Feats standing in for the shapes the books actually use: a fixed grant with a free
 * cast (Fey Touched's misty step), a pick from a class list (Magic Initiate), and a
 * proficiency hand-out (Moderately Armored).
 */
const FEATS: FeatDefinition[] = [
  {
    id: 'fey-touched',
    name: 'Fey Touched',
    description: '',
    abilityScoreChoice: { from: ['int', 'wis', 'cha'], distributions: [[1]] },
    levelUpEvents: [
      {
        type: 'GRANT_SPELLS',
        addTo: '',
        spellIds: ['misty-step'],
        alwaysPrepared: true,
        ability: 'int',
        uses: { max: 1, recharge: 'long' },
      },
      { type: 'CHOOSE_SPELL', addTo: '', count: 1, schools: ['divination', 'enchantment'] },
    ],
  },
  {
    id: 'magic-initiate',
    name: 'Magic Initiate',
    description: '',
    levelUpEvents: [
      { type: 'CHOOSE_SPELL', addTo: '', count: 2, cantrip: true, classes: ['wizard'], ability: 'int' },
      { type: 'CHOOSE_SPELL', addTo: '', count: 1, classes: ['wizard'], ability: 'int' },
    ],
  },
  {
    id: 'moderately-armored',
    name: 'Moderately Armored',
    description: '',
    levelUpEvents: [
      { type: 'GAIN_PROFICIENCY', proficiency: 'shields' },
      // Meaningless on a feat: there is no class whose subclass this could pick.
      { type: 'CHOOSE_SUBCLASS', label: 'Nonsense' },
    ],
  },
  {
    id: 'legacy-feat',
    name: 'Legacy Feat',
    description: '',
    grantedSpells: ['fire-bolt'],
  },
]

function pack(): Rulepack {
  const built = RulepackSchema.parse(fighter) as unknown as Rulepack
  built.classes = [
    ...RulepackSchema.parse(fighter).classes,
    ...RulepackSchema.parse(wizard).classes,
  ] as Rulepack['classes']
  built.spells = RulepackSchema.parse(spells).spells as Rulepack['spells']
  built.feats = FEATS
  return built
}

const rulepack = pack()
const feat = (id: string) => rulepack.feats.find(f => f.id === id)!

function char(over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'fighter', level: 4 }],
    spells: [],
    classSpellcasting: {},
    otherProficiencies: [],
    ...over,
  } as Character
}

describe('FeatDefinition.levelUpEvents — schema', () => {
  it('accepts a feat carrying level-up events', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      feats: [FEATS[0], FEATS[1], FEATS[2]],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.feats[0]!.levelUpEvents).toHaveLength(2)
  })

  it('rejects an event type that is not in the union', () => {
    const result = RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      feats: [{ id: 'x', name: 'X', description: '', levelUpEvents: [{ type: 'NOT_AN_EVENT' }] }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts maxLevel on a CHOOSE_SPELL and rejects one above 9th', () => {
    const withCap = (maxLevel: number) => RulepackSchema.safeParse({
      id: 'p', name: 'P', version: '1',
      feats: [{
        id: 'x', name: 'X', description: '',
        levelUpEvents: [{ type: 'CHOOSE_SPELL', addTo: 'x', count: 1, maxLevel }],
      }],
    }).success
    expect(withCap(1)).toBe(true)
    expect(withCap(10)).toBe(false)
  })
})

describe('resolveFeatEvents', () => {
  it('defaults addTo to the feat id and tags the source as a feat', () => {
    const events = resolveFeatEvents(char(), feat('fey-touched'), rulepack)
    const grant = events.find(e => e.type === 'GRANT_SPELLS')!
    expect(grant).toMatchObject({
      addTo: 'fey-touched',
      origin: 'feat',
      label: 'Fey Touched',
      alwaysPrepared: true,
      uses: { max: 1, recharge: 'long' },
    })
    expect(grant.type === 'GRANT_SPELLS' && grant.spells.map(s => s.spellId)).toEqual(['misty-step'])
  })

  it('caps a chosen spell at 1st level by default, and cantrips at 0', () => {
    const events = resolveFeatEvents(char(), feat('magic-initiate'), rulepack)
    const choices = getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL')
    expect(choices).toHaveLength(2)
    expect(choices.map(c => c.type === 'CHOOSE_SPELL' && [c.cantrip, c.maxLevel, c.count]))
      .toEqual([[true, 0, 2], [false, 1, 1]])
  })

  it('honours an explicit maxLevel', () => {
    const custom: FeatDefinition = {
      id: 'f', name: 'F', description: '',
      levelUpEvents: [{ type: 'CHOOSE_SPELL', addTo: '', count: 1, maxLevel: 4 }],
    }
    const [choice] = getChoiceEvents(resolveFeatEvents(char(), custom, rulepack))
    expect(choice!.type === 'CHOOSE_SPELL' && choice.maxLevel).toBe(4)
  })

  it('splits automatic events from choices', () => {
    const events = resolveFeatEvents(char(), feat('fey-touched'), rulepack)
    expect(getAutomaticEvents(events).map(e => e.type)).toEqual(['GRANT_SPELLS'])
    expect(getChoiceEvents(events).map(e => e.type)).toEqual(['CHOOSE_SPELL'])
  })

  it('ignores event types that presuppose a class', () => {
    const events = resolveFeatEvents(char(), feat('moderately-armored'), rulepack)
    expect(events.map(e => e.type)).toEqual(['GAIN_PROFICIENCY'])
  })

  it('yields nothing for a feat that declares no events', () => {
    expect(resolveFeatEvents(char(), feat('legacy-feat'), rulepack)).toEqual([])
  })
})

describe('applying a chosen feat', () => {
  it('grants the feat spells and registers the feat as its own spellcasting source', () => {
    const result = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'fey-touched', abilityBonus: { int: 1 } }],
      rulepack,
    )
    const misty = result.spells.find(s => s.spellId === 'misty-step')!
    expect(misty).toMatchObject({ alwaysPrepared: true, classId: 'fey-touched' })
    expect(misty.uses).toEqual({ max: 1, recharge: 'long', remaining: 1 })
    // Its own ability, rather than one borrowed from whichever class came first
    expect(result.classSpellcasting?.['fey-touched']).toMatchObject({
      ability: 'int',
      origin: 'feat',
      label: 'Fey Touched',
    })
    expect(result.abilityScores.int).toBe(char().abilityScores.int + 1)
  })

  it('adds a proficiency the feat hands out', () => {
    const result = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'moderately-armored' }],
      rulepack,
    )
    expect(result.otherProficiencies).toContain('shields')
  })

  it('does not grant a spell twice when the feat is applied over an existing one', () => {
    const start = char({
      spells: [{ id: 'x', spellId: 'misty-step', name: 'Misty Step', level: 2, prepared: false }],
    } as Partial<Character>)
    const result = applyResolvedChoices(
      start,
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'fey-touched' }],
      rulepack,
    )
    expect(result.spells.filter(s => s.spellId === 'misty-step')).toHaveLength(1)
  })

  it('leaves a feat with only grantedSpells working as before', () => {
    const result = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'legacy-feat' }],
      rulepack,
    )
    expect(result.spells.map(s => s.spellId)).toEqual(['fire-bolt'])
    expect(result.classSpellcasting).toEqual({})
  })

  it('applies the choices a feat raised, which arrive after it in the same run', () => {
    // The wizard appends the feat's choices to the run, so they land later in this list
    const result = applyResolvedChoices(
      char(),
      [
        { type: 'RESOLVED_CHOOSE_FEAT', featId: 'magic-initiate' },
        {
          type: 'RESOLVED_CHOOSE_SPELL',
          spellIds: ['light'],
          removedSpellIds: [],
          classId: 'magic-initiate',
          ability: 'int',
          origin: 'feat',
          label: 'Magic Initiate',
        },
      ],
      rulepack,
    )
    expect(result.spells.map(s => s.spellId)).toEqual(['light'])
    expect(result.classSpellcasting?.['magic-initiate']).toMatchObject({
      ability: 'int',
      origin: 'feat',
    })
  })
})

describe('maxLevel does not leak into class spell choices', () => {
  it('leaves a class CHOOSE_SPELL uncapped so the class level still decides', () => {
    const events = resolveLevelUpEvents(
      char({ classes: [{ classId: 'wizard', level: 3 }] }),
      'wizard',
      4, // the level the SRD wizard picks up another cantrip
      rulepack,
    )
    const choices = getChoiceEvents(events).filter(e => e.type === 'CHOOSE_SPELL')
    expect(choices.length).toBeGreaterThan(0)
    for (const c of choices) {
      expect(c.type === 'CHOOSE_SPELL' && c.maxLevel).toBeUndefined()
    }
  })
})

/**
 * Scion of the Outer Planes: one plane out of five, each granting a different cantrip.
 * A feat's guard is harder than a subclass's — the feat is applied by
 * RESOLVED_CHOOSE_FEAT, which runs *before* the option it raises has been answered.
 */
const PLANE_OPTION = 'scion-option'
const PLANE_GRANTS: Record<string, string> = {
  'chaotic-outer-plane': 'minor-illusion',
  'evil-outer-plane': 'chill-touch',
  'good-outer-plane': 'sacred-flame',
  'lawful-outer-plane': 'guidance',
}

const SCION: FeatDefinition = {
  id: 'scion-of-the-outer-planes',
  name: 'Scion of the Outer Planes',
  description: '',
  levelUpEvents: [
    {
      type: 'CHOOSE_OPTION',
      id: PLANE_OPTION,
      label: 'Scion of the Outer Planes',
      options: Object.keys(PLANE_GRANTS).map(id => ({ id, name: id, description: '' })),
    },
    ...Object.entries(PLANE_GRANTS).map(([id, spellId]) => ({
      type: 'GRANT_SPELLS' as const,
      addTo: 'scion-of-the-outer-planes',
      spellIds: [spellId],
      alwaysPrepared: true,
      whenOption: { choiceId: PLANE_OPTION, optionId: id },
      ability: 'cha' as const,
      label: 'Scion of the Outer Planes',
    })),
  ],
}

describe('a feat whose grant is gated on a choice', () => {
  const scionPack = { ...rulepack, feats: [...rulepack.feats, SCION] } as Rulepack
  const scionChar = (chosen?: string) => char({
    chosenOptions: chosen ? { [PLANE_OPTION]: chosen } : {},
  } as Partial<Character>)

  it('raises the choice when the feat is taken', () => {
    const events = resolveFeatEvents(scionChar(), SCION, scionPack)
    const choices = getChoiceEvents(events)
    expect(choices).toHaveLength(1)
    expect(choices[0]!.type === 'CHOOSE_OPTION' && choices[0].options.map(o => o.id))
      .toEqual(Object.keys(PLANE_GRANTS))
  })

  it('grants nothing while the plane is unanswered', () => {
    expect(getAutomaticEvents(resolveFeatEvents(scionChar(), SCION, scionPack))).toEqual([])
  })

  it('grants only the chosen plane once answered', () => {
    for (const [plane, spellId] of Object.entries(PLANE_GRANTS)) {
      const grants = getAutomaticEvents(resolveFeatEvents(scionChar(plane), SCION, scionPack))
        .filter(e => e.type === 'GRANT_SPELLS')
      expect(grants, plane).toHaveLength(1)
      expect(grants[0]!.type === 'GRANT_SPELLS' && grants[0].spells.map(s => s.spellId))
        .toEqual([spellId])
    }
  })

  /**
   * The real path: the feat resolves first and grants nothing, then the option it raised
   * is answered later in the same run and RESOLVED_OPTION applies the grant.
   */
  it('applies the grant from RESOLVED_OPTION, after the feat', () => {
    const result = applyResolvedChoices(
      char(),
      [
        { type: 'RESOLVED_CHOOSE_FEAT', featId: 'scion-of-the-outer-planes' },
        { type: 'RESOLVED_OPTION', choiceId: PLANE_OPTION, optionId: 'good-outer-plane' },
      ],
      scionPack,
    )
    expect(result.spells.map(s => s.spellId)).toEqual(['sacred-flame'])
    expect(result.classSpellcasting?.['scion-of-the-outer-planes']).toMatchObject({
      ability: 'cha',
      origin: 'feat',
    })
  })

  it('grants nothing if the feat is taken and the option skipped', () => {
    const result = applyResolvedChoices(
      char(),
      [{ type: 'RESOLVED_CHOOSE_FEAT', featId: 'scion-of-the-outer-planes' }],
      scionPack,
    )
    expect(result.spells).toEqual([])
  })

  it('never leaks another plane in', () => {
    const result = applyResolvedChoices(
      char(),
      [
        { type: 'RESOLVED_CHOOSE_FEAT', featId: 'scion-of-the-outer-planes' },
        { type: 'RESOLVED_OPTION', choiceId: PLANE_OPTION, optionId: 'evil-outer-plane' },
      ],
      scionPack,
    )
    expect(result.spells.map(s => s.spellId)).toEqual(['chill-touch'])
    for (const [plane, spellId] of Object.entries(PLANE_GRANTS)) {
      if (plane === 'evil-outer-plane') continue
      expect(result.spells.some(s => s.spellId === spellId), plane).toBe(false)
    }
  })

  it('names the chosen plane on the feat feature', () => {
    const result = applyResolvedChoices(
      char(),
      [
        { type: 'RESOLVED_CHOOSE_FEAT', featId: 'scion-of-the-outer-planes' },
        { type: 'RESOLVED_OPTION', choiceId: PLANE_OPTION, optionId: 'lawful-outer-plane' },
      ],
      scionPack,
    )
    expect(result.features.map(f => f.name))
      .toContain('Scion of the Outer Planes (lawful-outer-plane)')
  })

  it('ignores an option belonging to something else', () => {
    const result = applyResolvedChoices(
      char(),
      [
        { type: 'RESOLVED_CHOOSE_FEAT', featId: 'scion-of-the-outer-planes' },
        { type: 'RESOLVED_OPTION', choiceId: 'land-circle', optionId: 'arctic' },
      ],
      scionPack,
    )
    expect(result.spells).toEqual([])
  })
})

/**
 * Magic Initiate: pick a class, then pick that class's spells. The second stage exists
 * for exactly this — a guarded *question* cannot be replayed after the fact the way a
 * guarded grant can, so the answer has to reopen the run.
 */
const CLASS_OPTION = 'magic-initiate-option'

const MAGIC_INITIATE_GATED: FeatDefinition = {
  id: 'magic-initiate-gated',
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
    ...(['wizard', 'cleric'] as const).flatMap(cls => [
      {
        type: 'CHOOSE_SPELL' as const,
        addTo: 'magic-initiate-gated',
        count: 2,
        cantrip: true,
        classes: [cls],
        maxLevel: 0,
        whenOption: { choiceId: CLASS_OPTION, optionId: `${cls}-spells` },
      },
      {
        type: 'CHOOSE_SPELL' as const,
        addTo: 'magic-initiate-gated',
        count: 1,
        classes: [cls],
        maxLevel: 1,
        whenOption: { choiceId: CLASS_OPTION, optionId: `${cls}-spells` },
      },
    ]),
  ],
}

describe('a feat whose spell choices are gated on a choice', () => {
  const miPack = { ...rulepack, feats: [...rulepack.feats, MAGIC_INITIATE_GATED] } as Rulepack
  const miChar = (chosen?: string) => char({
    chosenOptions: chosen ? { [CLASS_OPTION]: chosen } : {},
  } as Partial<Character>)

  it('asks only the class question up front', () => {
    const choices = getChoiceEvents(resolveFeatEvents(miChar(), MAGIC_INITIATE_GATED, miPack))
    expect(choices.map(c => c.type)).toEqual(['CHOOSE_OPTION'])
  })

  it('asks the spell questions once the class is answered', () => {
    const choices = getChoiceEvents(
      resolveFeatEvents(miChar('wizard-spells'), MAGIC_INITIATE_GATED, miPack),
    ).filter(c => c.type === 'CHOOSE_SPELL')
    expect(choices).toHaveLength(2)
    expect(choices.map(c => c.type === 'CHOOSE_SPELL' && [c.count, c.cantrip, c.classes]))
      .toEqual([[2, true, ['wizard']], [1, false, ['wizard']]])
  })

  it('never asks another class\'s questions', () => {
    const choices = getChoiceEvents(
      resolveFeatEvents(miChar('cleric-spells'), MAGIC_INITIATE_GATED, miPack),
    ).filter(c => c.type === 'CHOOSE_SPELL')
    for (const c of choices) {
      expect(c.type === 'CHOOSE_SPELL' && c.classes).toEqual(['cleric'])
    }
  })
})

describe('resolveUnlockedChoices — the second stage', () => {
  const miPack = { ...rulepack, feats: [...rulepack.feats, MAGIC_INITIATE_GATED] } as Rulepack

  it('returns the questions an answer unlocks, for a feat taken in this run', () => {
    const unlocked = resolveUnlockedChoices(
      char(),
      { choiceId: CLASS_OPTION, optionId: 'wizard-spells' },
      'fighter',
      5,
      miPack,
      { feats: [MAGIC_INITIATE_GATED] },
    )
    expect(unlocked.map(c => c.type)).toEqual(['CHOOSE_SPELL', 'CHOOSE_SPELL'])
    expect(unlocked.every(c => c.type === 'CHOOSE_SPELL' && c.addTo === 'magic-initiate-gated'))
      .toBe(true)
    // The feat's own cap travels with the question, so a fighter can still take a 1st-level spell
    expect(unlocked.map(c => c.type === 'CHOOSE_SPELL' && c.maxLevel)).toEqual([0, 1])
  })

  it('returns nothing for an option that unlocks nothing', () => {
    expect(resolveUnlockedChoices(
      char(),
      { choiceId: CLASS_OPTION, optionId: 'cleric-spells' },
      'fighter',
      5,
      miPack,
      { feats: [] },
    )).toEqual([])
  })

  it('returns nothing for an unrelated answer', () => {
    expect(resolveUnlockedChoices(
      char(),
      { choiceId: 'land-circle', optionId: 'arctic' },
      'fighter',
      5,
      miPack,
      { feats: [MAGIC_INITIATE_GATED] },
    )).toEqual([])
  })

  it('does not re-ask a question that was never guarded', () => {
    // Fey Touched's unguarded choice belongs to the first stage, not this one
    const unlocked = resolveUnlockedChoices(
      char(),
      { choiceId: CLASS_OPTION, optionId: 'wizard-spells' },
      'fighter',
      5,
      miPack,
      { feats: [feat('fey-touched')] },
    )
    expect(unlocked).toEqual([])
  })
})
