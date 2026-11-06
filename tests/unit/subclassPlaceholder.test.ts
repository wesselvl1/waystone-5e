import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  isSubclassPlaceholder,
  resolveLevelUpEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { ClassDefinition, Rulepack } from '~/types/rulepack'
import type { ResolvedChoice } from '~/types/events'
import { validCharacter } from '../fixtures'
import barbarian from '~/data/srd/barbarian.json'
import bard from '~/data/srd/bard.json'
import cleric from '~/data/srd/cleric.json'
import druid from '~/data/srd/druid.json'
import fighter from '~/data/srd/fighter.json'
import monk from '~/data/srd/monk.json'
import paladin from '~/data/srd/paladin.json'
import ranger from '~/data/srd/ranger.json'
import rogue from '~/data/srd/rogue.json'
import sorcerer from '~/data/srd/sorcerer.json'
import warlock from '~/data/srd/warlock.json'
import wizard from '~/data/srd/wizard.json'
import spells from '~/data/srd/spells.json'

/**
 * A class table names the level its subclass is picked at with a placeholder ("Martial
 * Archetype", "Sorcerous Origin") that the subclass's own features replace. Missing one
 * leaves the sheet promising a feature it does not have; matching a real feature drops
 * something the character was granted.
 */

const classes: ClassDefinition[] = [
  barbarian, bard, cleric, druid, fighter, monk,
  paladin, ranger, rogue, sorcerer, warlock, wizard,
].flatMap(fragment => RulepackSchema.parse(fragment).classes as unknown as ClassDefinition[])

const rulepack = RulepackSchema.parse({
  id: 'p',
  name: 'Test',
  version: '1',
  classes,
  spells: RulepackSchema.parse(spells).spells,
}) as unknown as Rulepack

/** The class-table features on the level that declares CHOOSE_SUBCLASS. */
function pickLevelFeatures(cls: ClassDefinition): string[] {
  return cls.levels.find(l => l.levelUpEvents?.some(e => e.type === 'CHOOSE_SUBCLASS'))?.features ?? []
}

describe('isSubclassPlaceholder', () => {
  it('recognises the subclass-pick placeholder of every SRD class', () => {
    const found = Object.fromEntries(classes.map(cls =>
      [cls.id, pickLevelFeatures(cls).filter(isSubclassPlaceholder)]))
    expect(found).toEqual({
      barbarian: ['Primal Path'],
      bard: ['Bard College'],
      cleric: ['Divine Domain'],
      druid: ['Druid Circle'],
      fighter: ['Martial Archetype'],
      monk: ['Monastic Tradition'],
      paladin: ['Sacred Oath'],
      ranger: ['Ranger Archetype'],
      rogue: ['Roguish Archetype'],
      sorcerer: ['Sorcerous Origin'],
      warlock: ['Otherworldly Patron'],
      wizard: ['Arcane Tradition'],
    })
  })

  it('recognises the artificer\'s placeholder and the later "… Feature" rows', () => {
    expect(isSubclassPlaceholder('Artificer Specialist')).toBe(true)
    expect(isSubclassPlaceholder('Monastic Tradition Feature')).toBe(true)
    expect(isSubclassPlaceholder('Sorcerous Origin Feature')).toBe(true)
  })

  it('does not match real 1st- to 3rd-level features', () => {
    const real = [
      'Arcane Recovery', 'Oath Spells', 'Channel Divinity', 'Channel Divinity (1/rest)',
      'Ki', 'Martial Arts', 'Unarmored Defense', 'Deflect Missiles', 'Spellcasting',
      'Pact Magic', 'Font of Magic', 'Metamagic', 'Divine Sense', 'Divine Smite',
      'Divine Health', 'Lay on Hands', 'Fighting Style', 'Second Wind', 'Action Surge (1 use)',
      'Expertise', 'Sneak Attack (2d6)', 'Cunning Action', 'Wild Shape', 'Druidic',
      'Rage', 'Reckless Attack', 'Danger Sense', 'Primeval Awareness', 'Favored Enemy',
      'Natural Explorer', 'Jack of All Trades', 'Song of Rest (d6)', 'Eldritch Invocations',
      'Pact Boon', 'Bardic Inspiration (d6)', 'Tradition of the Monastery',
    ]
    expect(real.filter(isSubclassPlaceholder)).toEqual([])
  })
})

describe('RESOLVED_SUBCLASS at the pick level', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  /** Level 3 the wizard's way: automatic events first (placeholder included), then the answer. */
  function levelUpTo3(classId: string, subclassId: string): { before: string[]; after: string[] } {
    const start = {
      ...validCharacter,
      classes: [{ classId, level: 2 }],
      spells: [],
      features: [],
      classSpellcasting: {},
    } as Character
    const events = resolveLevelUpEvents(start, classId, 3, rulepack)
    let updated = applyAutomaticEvents(start, getAutomaticEvents(events), 'average')
    updated = { ...updated, classes: updated.classes.map(c => ({ ...c, level: 3 })) }
    const choices: ResolvedChoice[] = [{ type: 'RESOLVED_SUBCLASS', classId, subclassId }]
    return {
      before: updated.features.map(f => f.name),
      after: applyResolvedChoices(updated, choices, rulepack).features.map(f => f.name),
    }
  }

  it('drops Martial Archetype for a Champion and keeps the rest of fighter 3', () => {
    const { before, after } = levelUpTo3('fighter', 'champion')
    expect(before).toContain('Martial Archetype')
    expect(after).not.toContain('Martial Archetype')
    expect(after).toContain('Improved Critical')
    expect(after).toEqual(expect.arrayContaining(before.filter(n => n !== 'Martial Archetype')))
  })

  it('drops Roguish Archetype for a Thief and keeps Sneak Attack', () => {
    const { before, after } = levelUpTo3('rogue', 'thief')
    expect(before).toEqual(expect.arrayContaining(['Roguish Archetype', 'Sneak Attack (2d6)']))
    expect(after).not.toContain('Roguish Archetype')
    expect(after).toContain('Sneak Attack (2d6)')
  })
})
