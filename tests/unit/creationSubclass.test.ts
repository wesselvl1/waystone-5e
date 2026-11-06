import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import {
  choosesSubclassAtFirstLevel,
  subclassProficienciesAt,
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getAutomaticEvents,
  getChoiceEvents,
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
 * A cleric, a sorcerer and a warlock pick their subclass at 1st level, so the creation
 * wizard asks for it on the class step rather than leaving it to the level-up wizard —
 * the equipment step after it has to know a Life cleric wears heavy armour. That moves
 * the subclass from a RESOLVED_SUBCLASS answer to a `subclassId` already on the class
 * entry when level 1 is resolved, and the two routes have to build the same character.
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

function classById(id: string): ClassDefinition {
  return classes.find(c => c.id === id)!
}

describe('choosesSubclassAtFirstLevel', () => {
  it('is true for SRD cleric, sorcerer, warlock and false for the other nine', () => {
    const picking = classes.filter(choosesSubclassAtFirstLevel).map(c => c.id).sort()
    expect(picking).toEqual(['cleric', 'sorcerer', 'warlock'])
    expect(classes).toHaveLength(12)
  })

  it('counts a homebrew class with CHOOSE_SUBCLASS at level 1', () => {
    const homebrew = {
      ...classById('fighter'),
      id: 'hb-oathsworn',
      name: 'Oathsworn',
      levels: [{ level: 1, features: [], levelUpEvents: [{ type: 'CHOOSE_SUBCLASS' }] }],
    } as unknown as ClassDefinition
    expect(choosesSubclassAtFirstLevel(homebrew)).toBe(true)
  })
})

describe('subclassProficienciesAt', () => {
  it('reads a Life domain\'s heavy armour off its 1st level', () => {
    const life = classById('cleric').subclasses!.find(s => s.id === 'life-domain')!
    expect(subclassProficienciesAt(life, 1)).toContain('heavy')
  })

  it('leaves out a grant hanging off an option', () => {
    const sub = {
      id: 'x', name: 'X', description: '',
      levels: [{
        level: 1,
        features: [],
        levelUpEvents: [
          { type: 'GAIN_PROFICIENCY', proficiency: 'shields' },
          { type: 'GAIN_PROFICIENCY', proficiency: 'heavy', whenOption: { choiceId: 'c', optionId: 'o' } },
        ],
      }],
    } as never
    expect(subclassProficienciesAt(sub, 1)).toEqual(['shields'])
  })
})

describe('a domain picked at creation', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  /** A cleric about to gain 1st level, the way new.vue hands one to the pipeline. */
  function newCleric(subclassId?: string): Character {
    return {
      ...validCharacter,
      classes: [{ classId: 'cleric', level: 1, ...(subclassId ? { subclassId } : {}) }],
      hp: { current: 0, max: 0, temp: 0 },
      hitDice: [],
      spells: [],
      features: [],
      otherProficiencies: [],
      classSpellcasting: {},
    } as Character
  }

  function firstLevel(before: Character, choices: ResolvedChoice[]): Character {
    const events = resolveLevelUpEvents(before, 'cleric', 1, rulepack)
    const updated = applyAutomaticEvents(before, getAutomaticEvents(events), 'max')
    return applyResolvedChoices(updated, choices, rulepack)
  }

  it('does not ask for the domain again once it is set', () => {
    const events = resolveLevelUpEvents(newCleric('life-domain'), 'cleric', 1, rulepack)
    expect(getChoiceEvents(events).map(e => e.type)).not.toContain('CHOOSE_SUBCLASS')
  })

  it('ends with the same features, otherProficiencies and spells as one who picks Life Domain in the level-up wizard', () => {
    const atCreation = firstLevel(newCleric('life-domain'), [])
    const inWizard = firstLevel(newCleric(), [
      { type: 'RESOLVED_SUBCLASS', classId: 'cleric', subclassId: 'life-domain' },
    ])

    const featureIds = (c: Character) => c.features.map(f => f.id).sort()
    const spellIds = (c: Character) => c.spells.map(s => s.spellId).sort()
    expect(featureIds(atCreation)).toEqual(featureIds(inWizard))
    expect([...atCreation.otherProficiencies].sort()).toEqual([...inWizard.otherProficiencies].sort())
    expect(spellIds(atCreation)).toEqual(spellIds(inWizard))
    expect(atCreation.otherProficiencies).toContain('heavy')
    expect(spellIds(atCreation)).toEqual(expect.arrayContaining(['bless', 'cure-wounds']))
  })
})
