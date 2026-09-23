import { describe, it, expect } from 'vitest'
import {
  classifyProficiency,
  dedupeProficiencies,
  groupProficiencies,
  isProficiencyPlaceholder,
  matchSkillKey,
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

  it('keeps a possessive inside the word it belongs to', () => {
    expect(proficiencyLabel("smith's tools")).toBe("Smith's Tools")
    expect(proficiencyLabel("brewer's supplies")).toBe("Brewer's Supplies")
    expect(proficiencyLabel("mason's tools")).toBe("Mason's Tools")
    expect(proficiencyLabel("tinker's tools")).toBe("Tinker's Tools")
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

describe('dedupeProficiencies', () => {
  it('keeps the first occurrence of a wording repeated later in the list', () => {
    // A rogue with a criminal background is granted thieves' tools twice.
    expect(dedupeProficiencies(["thieves' tools", 'light', "Thieves' Tools"]))
      .toEqual(["thieves' tools", 'light'])
  })

  it('keeps a race\'s language and a subrace\'s own apart', () => {
    // A drow's Undercommon joins the elf's Common and Elvish rather than replacing them.
    expect(dedupeProficiencies(['Common', 'Elvish', 'Undercommon']))
      .toEqual(['Common', 'Elvish', 'Undercommon'])
  })

  it('drops a subrace language that repeats one the race already grants', () => {
    expect(dedupeProficiencies(['Common', 'Elvish', 'Elvish'])).toEqual(['Common', 'Elvish'])
  })

  it('is empty for an empty list', () => {
    expect(dedupeProficiencies([])).toEqual([])
  })
})

describe('matchSkillKey', () => {
  it('matches the lowercase key a race writes', () => {
    expect(matchSkillKey('perception')).toBe('perception')
    expect(matchSkillKey('intimidation')).toBe('intimidation')
  })

  it('matches a multi-word skill by its printed name, any case', () => {
    expect(matchSkillKey('Animal Handling')).toBe('animalHandling')
    expect(matchSkillKey('sleight of hand')).toBe('sleightOfHand')
  })

  it('matches the bare camelCase key too, for a source that writes it that way', () => {
    expect(matchSkillKey('animalHandling')).toBe('animalHandling')
    expect(matchSkillKey('sleightOfHand')).toBe('sleightOfHand')
  })

  it('does not match a weapon, tool or armor category', () => {
    for (const name of ['longsword', 'battleaxe', "smith's tools", 'heavy', 'simple'])
      expect(matchSkillKey(name)).toBeUndefined()
  })

  it('is undefined for an empty or placeholder string', () => {
    expect(matchSkillKey('')).toBeUndefined()
    expect(matchSkillKey('   ')).toBeUndefined()
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
