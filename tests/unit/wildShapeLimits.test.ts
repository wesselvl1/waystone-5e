import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  getAutomaticEvents,
  getChoiceEvents,
} from '~/services/levelUpService'
import type { Rulepack, SubclassDefinition } from '~/types/rulepack'
import type { Character } from '~/types/character'
import { validCharacter } from '../fixtures'
import druidFragment from '~/data/srd/druid.json'
import beastFragment from '~/data/srd/beasts.json'

function pack(): Rulepack {
  const merged = structuredClone(RulepackSchema.parse(druidFragment)) as unknown as Rulepack
  merged.creatures = RulepackSchema.parse(beastFragment).creatures as Rulepack['creatures']
  return merged
}

const rulepack = pack()
const druid = rulepack.classes.find(c => c.id === 'druid')!

function druidChar(level: number, overrides: Partial<Character> = {}): Character {
  return {
    ...validCharacter,
    classes: [{ classId: 'druid', level, name: 'Druid' }],
    spells: [],
    spellSlots: {},
    ...overrides,
  } as Character
}

/** Level a druid from `from` to `to`, applying only the automatic events. */
function levelTo(from: number, to: number, start?: Character): Character {
  let c = start ?? druidChar(from)
  for (let n = from + 1; n <= to; n++) {
    c = { ...c, classes: [{ classId: 'druid', level: n - 1, name: 'Druid' }] } as Character
    const events = resolveLevelUpEvents(c, 'druid', n, rulepack)
    c = applyAutomaticEvents(c, getAutomaticEvents(events), 'average')
    c = { ...c, classes: [{ classId: 'druid', level: n, name: 'Druid' }] } as Character
  }
  return c
}

describe('SET_WILD_SHAPE_LIMITS through the level-up pipeline', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  it('is declared on the SRD druid at levels 2, 4 and 8 only', () => {
    const levels = druid.levels
      .filter(l => l.levelUpEvents.some(e => e.type === 'SET_WILD_SHAPE_LIMITS'))
      .map(l => l.level)
    expect(levels).toEqual([2, 4, 8])
  })

  it('is an automatic event, never a player choice', () => {
    const events = resolveLevelUpEvents(druidChar(1), 'druid', 2, rulepack)
    expect(getAutomaticEvents(events).some(e => e.type === 'SET_WILD_SHAPE_LIMITS')).toBe(true)
    expect(getChoiceEvents(events).some(e => e.type === 'SET_WILD_SHAPE_LIMITS')).toBe(false)
  })

  it('grants no forms before level 2', () => {
    expect(druidChar(1).wildShape).toBeUndefined()
  })

  it('follows the SRD progression as the druid levels', () => {
    expect(levelTo(1, 2).wildShape!.limits)
      .toEqual({ maxCR: 0.25, allowSwim: false, allowFly: false, types: ['beast'] })
    expect(levelTo(1, 4).wildShape!.limits)
      .toEqual({ maxCR: 0.5, allowSwim: true, allowFly: false, types: ['beast'] })
    expect(levelTo(1, 8).wildShape!.limits)
      .toEqual({ maxCR: 1, allowSwim: true, allowFly: true, types: ['beast'] })
  })

  it('replaces the limits rather than accumulating them', () => {
    // Absolute, not a delta - otherwise a subclass could never narrow anything and
    // maxCR would climb by addition instead of being set.
    const at20 = levelTo(1, 20)
    expect(at20.wildShape!.limits.maxCR).toBe(1)
  })

  it('keeps an active form when the limits change', () => {
    // Narrowing limits mid-session must not eject the player from a form they are in.
    const before = levelTo(1, 3)
    before.wildShape!.active = {
      creatureId: 'wolf', name: 'Wolf', hp: { max: 11, current: 4 },
    }
    const after = levelTo(3, 4, before)
    expect(after.wildShape!.active).toEqual({
      creatureId: 'wolf', name: 'Wolf', hp: { max: 11, current: 4 },
    })
    expect(after.wildShape!.limits.maxCR).toBe(0.5)
  })

  it('defaults an omitted gate to unrestricted', () => {
    // This is what lets a future Circle of the Moon fragment raise maxCR without
    // restating the movement gates.
    const moonish = { type: 'SET_WILD_SHAPE_LIMITS' as const, maxCR: 6 }
    const parsed = RulepackSchema.parse({
      id: 'x', name: 'x', version: '1',
      classes: [{
        ...druid,
        levels: druid.levels.map(l => l.level === 2 ? { ...l, levelUpEvents: [moonish] } : l),
      }],
    })
    const cls = parsed.classes[0]!
    const evt = cls.levels.find(l => l.level === 2)!.levelUpEvents[0]!
    expect(evt.type).toBe('SET_WILD_SHAPE_LIMITS')

    const custom = structuredClone(rulepack)
    custom.classes = [cls as unknown as typeof custom.classes[number]]
    const events = resolveLevelUpEvents(druidChar(1), 'druid', 2, custom)
    const resolved = events.find(e => e.type === 'SET_WILD_SHAPE_LIMITS')!
    if (resolved.type === 'SET_WILD_SHAPE_LIMITS') {
      expect(resolved.maxCR).toBe(6)
      expect(resolved.allowSwim).toBe(true)
      expect(resolved.allowFly).toBe(true)
    }
  })

  it('lets a subclass override the class limits at the same level', () => {
    // Circle of the Moon raises the ceiling at the level it is chosen. Subclass events
    // are translated after class events, so the later one wins.
    const moon: SubclassDefinition = {
      id: 'circle-of-the-moon',
      name: 'Circle of the Moon',
      description: 'Test fixture standing in for the PHB subclass.',
      levels: [{
        level: 2,
        features: [],
        levelUpEvents: [{ type: 'SET_WILD_SHAPE_LIMITS', maxCR: 1, types: ['beast'] }],
      }],
    }
    const custom = structuredClone(rulepack)
    custom.classes[0]!.subclasses = [moon]

    const c = druidChar(1, {
      classes: [{ classId: 'druid', level: 1, subclassId: 'circle-of-the-moon', name: 'Druid' }],
    } as Partial<Character>)
    const events = resolveLevelUpEvents(c, 'druid', 2, custom)
    const applied = applyAutomaticEvents(c, getAutomaticEvents(events), 'average')

    expect(applied.wildShape!.limits.maxCR).toBe(1)
    expect(applied.wildShape!.limits.allowSwim).toBe(true)
    expect(applied.wildShape!.limits.allowFly).toBe(true)
  })
})

describe('wildShape on the character schema', () => {
  it('round-trips through CharacterSchema', () => {
    const c = {
      ...validCharacter,
      wildShape: {
        limits: { maxCR: 0.5, allowSwim: true, allowFly: false, types: ['beast'] },
        active: { creatureId: 'wolf', name: 'Wolf', hp: { max: 11, current: 7, temp: 0 } },
      },
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(c)))
    expect(parsed.wildShape).toEqual(c.wildShape)
  })

  it('defaults temp hit points on a form stored before the field existed', () => {
    // Forms written by the first Wild Shape release have no temp value.
    const legacy = {
      ...validCharacter,
      wildShape: {
        limits: { maxCR: 1, allowSwim: true, allowFly: true },
        active: { creatureId: 'wolf', name: 'Wolf', hp: { max: 11, current: 11 } },
      },
    }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(parsed.wildShape!.active!.hp).toEqual({ max: 11, current: 11, temp: 0 })
  })
  it('is optional, so characters without forms still validate', () => {
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(validCharacter)))
    expect(parsed.wildShape).toBeUndefined()
  })
})
