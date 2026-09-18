import { describe, it, expect } from 'vitest'
import {
  classifyProficiency,
  groupProficiencies,
  isProficiencyPlaceholder,
  proficiencyKey,
  proficiencyLabel,
  proficiencyVocabulary,
} from '~/services/proficiencies'
import { isProficientWithWeapon } from '~/services/attacks'
import { isProficientWithArmor } from '~/services/armorClass'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import weaponsFragment from '~/data/srd/weapons.json'
import armorFragment from '~/data/srd/armor.json'
import racesFragment from '~/data/srd/races.json'
import type { ArmorDefinition, Race, WeaponDefinition } from '~/types/rulepack'

const weapons = RulepackSchema.parse(weaponsFragment).weapons as WeaponDefinition[]
const armor = RulepackSchema.parse(armorFragment).armor as ArmorDefinition[]
const races = RulepackSchema.parse(racesFragment).races as Race[]

const vocab = proficiencyVocabulary({
  weapons: weapons.map(w => w.name),
  armor: armor.map(a => a.name),
  languages: races.flatMap(r => r.languages ?? []),
})

describe('classifyProficiency', () => {
  it('files the categories a class prints under weapons and armor', () => {
    for (const category of ['simple', 'martial', 'light', 'medium', 'heavy', 'shields'])
      expect(classifyProficiency(category, vocab)).toBe('weapons-armor')
  })

  it('files a named weapon under weapons, however the table spells it', () => {
    expect(classifyProficiency('light crossbow', vocab)).toBe('weapons-armor')
    expect(classifyProficiency('quarterstaff', vocab)).toBe('weapons-armor')
    expect(classifyProficiency('Chain Mail', vocab)).toBe('weapons-armor')
  })

  it('files a language by name and by wording', () => {
    expect(classifyProficiency('Common', vocab)).toBe('languages')
    expect(classifyProficiency('Sylvan', vocab)).toBe('languages')
    expect(classifyProficiency('1 extra language of your choice', vocab)).toBe('languages')
    expect(classifyProficiency('2 languages of your choice', vocab)).toBe('languages')
  })

  it('leaves everything else in the tools group', () => {
    expect(classifyProficiency("thieves' tools", vocab)).toBe('tools')
    expect(classifyProficiency('herbalism kit', vocab)).toBe('tools')
    expect(classifyProficiency('One gaming set', vocab)).toBe('tools')
  })

  it('knows the SRD languages without any pack loaded', () => {
    expect(classifyProficiency('Undercommon')).toBe('languages')
  })
})

describe('proficiencyLabel', () => {
  it('names the noun a bare category leaves out', () => {
    expect(proficiencyLabel('simple')).toBe('Simple Weapons')
    expect(proficiencyLabel('martial')).toBe('Martial Weapons')
    expect(proficiencyLabel('light')).toBe('Light Armor')
    expect(proficiencyLabel('medium')).toBe('Medium Armor')
    expect(proficiencyLabel('shields')).toBe('Shields')
  })

  it('title-cases a name that came out of a data file', () => {
    expect(proficiencyLabel('light crossbow')).toBe('Light Crossbow')
    expect(proficiencyLabel("thieves' tools")).toBe("Thieves' Tools")
  })

  it('leaves a name the player typed exactly as typed', () => {
    expect(proficiencyLabel('Common')).toBe('Common')
    expect(proficiencyLabel('Zemnian')).toBe('Zemnian')
  })

  it('keeps a phrase reading as a phrase', () => {
    expect(proficiencyLabel('1 extra language of your choice'))
      .toBe('1 extra language of your choice')
    expect(proficiencyLabel('one type of artisan\'s tools or one musical instrument'))
      .toBe('One type of artisan\'s tools or one musical instrument')
  })
})

describe('isProficiencyPlaceholder', () => {
  it('spots an entry that is still a prompt', () => {
    expect(isProficiencyPlaceholder('1 extra language of your choice')).toBe(true)
    expect(isProficiencyPlaceholder('music instrument 1')).toBe(true)
    expect(isProficiencyPlaceholder('one type of artisan\'s tools')).toBe(true)
  })

  it('leaves an answered proficiency alone', () => {
    expect(isProficiencyPlaceholder('Elvish')).toBe(false)
    expect(isProficiencyPlaceholder("thieves' tools")).toBe(false)
  })
})

describe('groupProficiencies', () => {
  const list = ['light', 'medium', 'shields', 'simple', 'martial', 'Common', 'Elvish',
    '1 extra language of your choice', "thieves' tools"]

  it('splits a class-and-race list into the sheet"s three sections', () => {
    const [weaponsArmor, languages, tools] = groupProficiencies(list, undefined, vocab)
    expect(weaponsArmor!.entries.map(e => e.label))
      .toEqual(['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons'])
    expect(languages!.entries.map(e => e.label))
      .toEqual(['Common', 'Elvish', '1 extra language of your choice'])
    expect(tools!.entries.map(e => e.label)).toEqual(["Thieves' Tools"])
  })

  it('honours a stored override over the guess', () => {
    const overrides = { [proficiencyKey('Zemnian')]: 'languages' as const }
    const [, languages] = groupProficiencies(['Zemnian'], overrides, vocab)
    expect(languages!.entries.map(e => e.name)).toEqual(['Zemnian'])
  })

  it('skips the empty strings a hand-edited list can carry', () => {
    const sections = groupProficiencies(['', '  '], undefined, vocab)
    expect(sections.flatMap(s => s.entries)).toEqual([])
  })
})

describe('the labels stay things the matchers recognise', () => {
  it('keeps a weapon category proficient after being relabelled', () => {
    const longsword = weapons.find(w => w.id === 'longsword')!
    expect(isProficientWithWeapon(longsword, [proficiencyLabel('martial')])).toBe(true)
  })

  it('keeps an armor category proficient after being relabelled', () => {
    const chainMail = armor.find(a => a.category === 'heavy')!
    expect(isProficientWithArmor(chainMail, [proficiencyLabel('heavy')])).toBe(true)
    const shield = armor.find(a => a.category === 'shield')!
    expect(isProficientWithArmor(shield, [proficiencyLabel('shields')])).toBe(true)
  })
})
