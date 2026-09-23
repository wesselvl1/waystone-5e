import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'
import type { ResolvedChoice } from '~/types/events'
import { validCharacter } from '../fixtures'
import druidFragment from '~/data/srd/druid.json'
import monkFragment from '~/data/srd/monk.json'
import sorcererFragment from '~/data/srd/sorcerer.json'
import fighterFragment from '~/data/srd/fighter.json'
import beastFragment from '~/data/srd/beasts.json'
import spellFragment from '~/data/srd/spells.json'

/**
 * The level at which a subclass is *confirmed* is the one level resolveLevelUpEvents
 * cannot see it at: the subclass was still unchosen when it ran. RESOLVED_SUBCLASS is
 * what makes up for that, and it used to replay three event types by name — so a
 * subclass declaring anything else on that level had it silently dropped.
 *
 * The subclasses below stand in for app/data/phb and app/data/xge, which are gitignored
 * dev data: a test sourcing them would pass only on a machine that owns the book. Each
 * mirrors the real entry's shape at the level its class picks a subclass.
 */

/** phb.circle-of-the-moon, level 2 — a druid picks the circle at exactly this level. */
const MOON = {
  id: 'book.circle-of-the-moon',
  name: 'Circle of the Moon',
  description: 'Fiercer shapes.',
  classId: 'druid',
  levels: [{
    level: 2,
    features: [{ name: 'Combat Wild Shape', description: '' }],
    levelUpEvents: [
      { type: 'SET_WILD_SHAPE_LIMITS' as const, types: ['beast'], maxCR: 1, allowSwim: false, allowFly: false },
    ],
  }],
}

/**
 * A subclass raising the uses of a feature its class just granted — the shape a domain
 * or an oath uses to turn one Channel Divinity into two. Wild Shape is the SRD druid
 * feature with a `usesMax`, so it stands in here.
 */
const KEEPER = {
  id: 'book.circle-of-the-keeper',
  name: 'Circle of the Keeper',
  description: 'One more shape a day.',
  classId: 'druid',
  levels: [{
    level: 2,
    features: [{ name: 'Keeper of Shapes', description: '' }],
    levelUpEvents: [
      { type: 'UPDATE_FEATURE_USES' as const, featureName: 'Wild Shape', usesMax: 4 },
    ],
  }],
}

/** phb.way-of-shadow, level 3 — Ki-metered spells granted on the level it is picked. */
const SHADOW = {
  id: 'book.way-of-shadow',
  name: 'Way of Shadow',
  description: 'Shadow Arts.',
  classId: 'monk',
  levels: [{
    level: 3,
    features: [{ name: 'Shadow Arts', description: '' }],
    levelUpEvents: [
      {
        type: 'GRANT_SPELLS' as const,
        addTo: 'monk',
        spellIds: ['darkness', 'pass-without-trace', 'silence'],
        alwaysPrepared: true,
        origin: 'class' as const,
        label: 'Way of Shadow',
        ability: 'wis' as const,
        cost: { resource: 'Ki', amount: 2 },
      },
      // The same grant without a label, so the fallback to the subclass's own name is
      // exercised rather than only the explicit label above.
      {
        type: 'GRANT_SPELLS' as const,
        addTo: 'monk',
        spellIds: ['minor-illusion'],
        alwaysPrepared: true,
        origin: 'class' as const,
        ability: 'wis' as const,
      },
    ],
  }],
}

/**
 * xge.divine-soul, level 1 — a sorcerer's origin is picked at 1st, and every affinity's
 * grant hangs off that one answer. Replaying guarded grants at the confirmation level
 * handed out all five at once.
 */
const SOUL = {
  id: 'book.divine-soul',
  name: 'Divine Soul',
  description: 'Divine magic in the blood.',
  classId: 'sorcerer',
  levels: [{
    level: 1,
    features: [{ name: 'Divine Magic', description: '' }],
    levelUpEvents: [
      {
        type: 'CHOOSE_OPTION' as const,
        id: 'book.divine-soul-option',
        label: 'Choose your Divine Soul',
        options: [
          { id: 'good', name: 'Good', description: '' },
          { id: 'evil', name: 'Evil', description: '' },
        ],
      },
      {
        type: 'GRANT_SPELLS' as const,
        addTo: 'sorcerer',
        spellIds: ['cure-wounds'],
        alwaysPrepared: true,
        origin: 'class' as const,
        label: 'Divine Soul: Good',
        whenOption: { choiceId: 'book.divine-soul-option', optionId: 'good' },
      },
      {
        type: 'GRANT_SPELLS' as const,
        addTo: 'sorcerer',
        spellIds: ['inflict-wounds'],
        alwaysPrepared: true,
        origin: 'class' as const,
        label: 'Divine Soul: Evil',
        whenOption: { choiceId: 'book.divine-soul-option', optionId: 'evil' },
      },
    ],
  }],
}

/** phb.eldritch-knight, level 3 — slots begin on the level the archetype is chosen. */
const KNIGHT = {
  id: 'book.eldritch-knight',
  name: 'Eldritch Knight',
  description: 'A fighter who casts.',
  classId: 'fighter',
  spellcasting: { ability: 'int' as const, progression: 'third' as const, list: 'wizard' },
  levels: [{
    level: 3,
    features: [{ name: 'Weapon Bond', description: '' }],
    spellSlots: { 1: 2 },
    levelUpEvents: [
      {
        type: 'GRANT_SPELLCASTING' as const,
        addTo: 'fighter',
        ability: 'int' as const,
        list: 'wizard',
        origin: 'class' as const,
      },
    ],
  }],
}

function pack(): Rulepack {
  const built = RulepackSchema.parse({
    id: 'p',
    name: 'Test',
    version: '1',
    classes: [
      ...RulepackSchema.parse(druidFragment).classes,
      ...RulepackSchema.parse(monkFragment).classes,
      ...RulepackSchema.parse(sorcererFragment).classes,
      ...RulepackSchema.parse(fighterFragment).classes,
    ],
    spells: RulepackSchema.parse(spellFragment).spells,
    creatures: RulepackSchema.parse(beastFragment).creatures,
    subclasses: [MOON, KEEPER, SHADOW, SOUL, KNIGHT],
  }) as unknown as Rulepack
  // Distribute the patch entries into their classes, the way the store does at merge time
  for (const patch of built.subclasses ?? []) {
    const { classId, ...rest } = patch as never as { classId: string }
    const cls = built.classes.find(c => c.id === classId)
    if (cls) cls.subclasses = [...(cls.subclasses ?? []), rest as never]
  }
  return built
}

const rulepack = pack()

function char(classId: string, level: number, over: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId, level }],
    spells: [],
    features: [],
    classSpellcasting: {},
    ...over,
  } as Character
}

/**
 * One level-up through the whole pipeline, in the order the wizard runs it: automatic
 * events, then the class level bumped, then the answers. A subclass confirmed here is
 * only ever confirmed by RESOLVED_SUBCLASS, since resolveLevelUpEvents ran before it
 * was known.
 */
function levelUpWith(
  before: Character,
  classId: string,
  newLevel: number,
  choices: ResolvedChoice[],
): Character {
  const events = resolveLevelUpEvents(before, classId, newLevel, rulepack)
  let updated = applyAutomaticEvents(before, getAutomaticEvents(events), 'average')
  updated = {
    ...updated,
    classes: updated.classes.map(c => (c.classId === classId ? { ...c, level: newLevel } : c)),
  }
  return applyResolvedChoices(updated, choices, rulepack)
}

describe('a subclass confirmed at a level it declares events on', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  it('applies a Moon druid\'s wider wild shape on the very level the circle is picked', () => {
    // The druid class itself sets CR 1/4 at 2nd, and the circle replaces it with CR 1 —
    // on the same level, because druid 2 is where the circle is chosen.
    const result = levelUpWith(char('druid', 1), 'druid', 2, [
      { type: 'RESOLVED_SUBCLASS', classId: 'druid', subclassId: 'book.circle-of-the-moon' },
    ])
    expect(result.wildShape!.limits).toEqual({
      maxCR: 1, allowSwim: false, allowFly: false, types: ['beast'],
    })
  })

  it('applies an UPDATE_FEATURE_USES the subclass declares at its confirmation level', () => {
    const before = char('druid', 1, {
      features: [{
        id: 'wild-shape', name: 'Wild Shape', source: 'Druid',
        description: '', usesMax: 2, usesRemaining: 2,
      }],
    } as Partial<Character>)
    const result = levelUpWith(before, 'druid', 2, [
      { type: 'RESOLVED_SUBCLASS', classId: 'druid', subclassId: 'book.circle-of-the-keeper' },
    ])
    const wildShape = result.features.find(f => f.name === 'Wild Shape')!
    expect(wildShape.usesMax).toBe(4)
    expect(wildShape.usesRemaining).toBe(4)
  })

  it('leaves a guarded grant to RESOLVED_OPTION rather than handing out every arm', () => {
    // Divine Soul: five affinities behind one answer. Replaying them at the confirmation
    // level granted all of them at once.
    const result = levelUpWith(char('sorcerer', 0), 'sorcerer', 1, [
      { type: 'RESOLVED_SUBCLASS', classId: 'sorcerer', subclassId: 'book.divine-soul' },
      { type: 'RESOLVED_OPTION', choiceId: 'book.divine-soul-option', optionId: 'good' },
    ])
    expect(result.spells.map(s => s.spellId)).toContain('cure-wounds')
    expect(result.spells.map(s => s.spellId)).not.toContain('inflict-wounds')
  })

  it('applies no guarded grant at all when the option is left unanswered', () => {
    const result = levelUpWith(char('sorcerer', 0), 'sorcerer', 1, [
      { type: 'RESOLVED_SUBCLASS', classId: 'sorcerer', subclassId: 'book.divine-soul' },
    ])
    expect(result.spells.map(s => s.spellId)).not.toContain('cure-wounds')
    expect(result.spells.map(s => s.spellId)).not.toContain('inflict-wounds')
  })

  it('keeps a Way of Shadow grant\'s cost, ability and label', () => {
    const result = levelUpWith(char('monk', 2), 'monk', 3, [
      { type: 'RESOLVED_SUBCLASS', classId: 'monk', subclassId: 'book.way-of-shadow' },
    ])
    const darkness = result.spells.find(s => s.spellId === 'darkness')!
    expect(darkness.cost).toEqual({ resource: 'Ki', amount: 2 })
    expect(darkness.alwaysPrepared).toBe(true)
    // The ability rides on the source, which is what gives the spells a DC
    expect(result.classSpellcasting.monk).toMatchObject({
      ability: 'wis', origin: 'class', label: 'Way of Shadow',
    })
  })

  it('registers an Eldritch Knight\'s spellcasting, labelled with the subclass', () => {
    const result = levelUpWith(char('fighter', 2), 'fighter', 3, [
      { type: 'RESOLVED_SUBCLASS', classId: 'fighter', subclassId: 'book.eldritch-knight' },
    ])
    expect(result.classSpellcasting.fighter).toMatchObject({
      ability: 'int', origin: 'class', label: 'Eldritch Knight',
    })
  })

  it('adds the subclass\'s own features exactly once', () => {
    const result = levelUpWith(char('druid', 1), 'druid', 2, [
      { type: 'RESOLVED_SUBCLASS', classId: 'druid', subclassId: 'book.circle-of-the-moon' },
    ])
    expect(result.features.filter(f => f.name === 'Combat Wild Shape')).toHaveLength(1)
  })

  it('does not re-apply the confirmation level\'s events on the next level-up', () => {
    const at2 = levelUpWith(char('druid', 1), 'druid', 2, [
      { type: 'RESOLVED_SUBCLASS', classId: 'druid', subclassId: 'book.circle-of-the-moon' },
    ])
    const at3 = levelUpWith(at2, 'druid', 3, [])
    // Level 3 declares nothing, so the circle's level-2 limits stand unchanged
    expect(at3.wildShape!.limits).toEqual(at2.wildShape!.limits)
    expect(at3.features.filter(f => f.name === 'Combat Wild Shape')).toHaveLength(1)
  })
})
