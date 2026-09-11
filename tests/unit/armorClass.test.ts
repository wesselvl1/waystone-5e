import { describe, it, expect } from 'vitest'
import {
  armorClassBreakdown,
  armorClassTotal,
  armorWarnings,
  cappedDex,
  characterArmorClass,
  compactAcBonuses,
  configFromArmor,
  defaultArmorClassConfig,
  isProficientWithArmor,
  previewArmorClass,
  shieldAllowed,
} from '~/services/armorClass'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { CharacterSchema } from '~/schemas/characterSchema'
import type { ArmorClassConfig, Character } from '~/types/character'
import type { ArmorDefinition } from '~/types/rulepack'
import fragment from '~/data/srd/armor.json'
import { validCharacter } from '../fixtures'

const pack = RulepackSchema.parse(fragment)
const srdArmor = pack.armor as ArmorDefinition[]

function armor(id: string): ArmorDefinition {
  const found = srdArmor.find(a => a.id === id)
  if (!found) throw new Error(`no SRD armor ${id}`)
  return found
}

/** DEX +3, CON +2, WIS +1 — enough to tell the three unarmored bases apart. */
const MODS = { str: 1, dex: 3, con: 2, int: 0, wis: 1, cha: -1 }
const ctx = { modifiers: MODS }

function config(partial: Partial<ArmorClassConfig> = {}): ArmorClassConfig {
  return { ...defaultArmorClassConfig(), ...partial }
}

describe('the SRD armor table', () => {
  it('prints every row of the equipment table plus the shield', () => {
    expect(srdArmor.filter(a => a.category === 'light')).toHaveLength(3)
    expect(srdArmor.filter(a => a.category === 'medium')).toHaveLength(5)
    expect(srdArmor.filter(a => a.category === 'heavy')).toHaveLength(4)
    expect(srdArmor.filter(a => a.category === 'shield')).toHaveLength(1)
  })

  it('caps Dexterity the way each category does', () => {
    expect(armor('studded-leather').maxDexBonus).toBeUndefined()
    expect(armor('half-plate').maxDexBonus).toBe(2)
    expect(armor('plate').maxDexBonus).toBe(0)
  })
})

describe('armorClassTotal', () => {
  it('adds the whole Dexterity modifier in light armor', () => {
    // Studded leather 12 + 3
    expect(armorClassTotal(configFromArmor(armor('studded-leather')), ctx)).toBe(15)
  })

  it('caps Dexterity at 2 in medium armor', () => {
    // Half plate 15 + 2, not 15 + 3
    expect(armorClassTotal(configFromArmor(armor('half-plate')), ctx)).toBe(17)
  })

  it('adds no Dexterity at all in heavy armor', () => {
    expect(armorClassTotal(configFromArmor(armor('plate')), ctx)).toBe(18)
  })

  it('adds a second ability for Unarmored Defense', () => {
    // Barbarian: 10 + DEX 3 + CON 2
    expect(armorClassTotal(configFromArmor(armor('unarmored-defense-barbarian')), ctx)).toBe(15)
    // Monk: 10 + DEX 3 + WIS 1
    expect(armorClassTotal(configFromArmor(armor('unarmored-defense-monk')), ctx)).toBe(14)
  })

  it('reads Draconic Resilience as a raised base with full Dexterity', () => {
    expect(armorClassTotal(configFromArmor(armor('draconic-resilience')), ctx)).toBe(16)
  })

  it('takes a hand-set base and cap for natural armor', () => {
    // A tortle's shell: 17 flat, no Dexterity at all.
    const shell = config({ armorId: 'natural-armor', armorName: 'Natural Armor', baseValue: 17, dexCap: 0 })
    expect(armorClassTotal(shell, ctx)).toBe(17)
  })

  it('sums the shield and the three bonus slots', () => {
    const plate = configFromArmor(armor('plate'))
    plate.shield = { equipped: true, name: 'Shield', bonus: 2 }
    plate.bonuses = { magic: 1, feat: 1, misc: -1 }
    expect(armorClassTotal(plate, ctx)).toBe(21)
  })

  it('leaves an unequipped shield out', () => {
    const plate = configFromArmor(armor('plate'))
    plate.shield = { equipped: false, name: 'Shield', bonus: 2 }
    expect(armorClassTotal(plate, ctx)).toBe(18)
  })
})

describe('shield eligibility', () => {
  it("allows one with a barbarian's Unarmored Defense", () => {
    const barbarian = configFromArmor(armor('unarmored-defense-barbarian'))
    barbarian.shield = { equipped: true, bonus: 2 }
    expect(shieldAllowed(barbarian)).toBe(true)
    expect(armorClassTotal(barbarian, ctx)).toBe(17)
  })

  it("refuses one with a monk's, and does not count it even if equipped", () => {
    const monk = configFromArmor(armor('unarmored-defense-monk'))
    monk.shield = { equipped: true, bonus: 2 }
    expect(shieldAllowed(monk)).toBe(false)
    expect(armorClassTotal(monk, ctx)).toBe(14)
    expect(armorClassBreakdown(monk, ctx).warnings).toHaveLength(1)
  })

  it('drops the refusal again when the character changes into armor', () => {
    const monk = configFromArmor(armor('unarmored-defense-monk'))
    monk.shield = { equipped: true, bonus: 2 }
    const changed = configFromArmor(armor('breastplate'), monk)
    expect(shieldAllowed(changed)).toBe(true)
    // Breastplate 14 + DEX 2 (capped) + shield 2
    expect(armorClassTotal(changed, ctx)).toBe(18)
  })
})

describe('configFromArmor', () => {
  it('keeps the shield and bonuses when the armor changes', () => {
    const previous = config({
      shield: { equipped: true, bonus: 2 },
      bonuses: { magic: 1 },
    })
    const next = configFromArmor(armor('chain-mail'), previous)
    expect(next.shield).toEqual({ equipped: true, bonus: 2 })
    expect(next.bonuses).toEqual({ magic: 1 })
    expect(next.baseValue).toBe(16)
    expect(next.dexCap).toBe(0)
  })
})

describe('armorClassBreakdown', () => {
  it('shows a capped Dexterity as the clipped number, with a note', () => {
    const parts = armorClassBreakdown(configFromArmor(armor('half-plate')), ctx).parts
    const dex = parts.find(p => p.label === 'Dex')!
    expect(dex.value).toBe(2)
    expect(dex.note).toContain('+3')
  })

  it('leaves an untouched bonus slot out of the sum', () => {
    const parts = armorClassBreakdown(config({ bonuses: { magic: 0, feat: 2 } }), ctx).parts
    expect(parts.map(p => p.label)).toEqual(['Unarmored', 'Dex', 'Feat'])
  })

  it('totals the same as the calculator', () => {
    const plate = configFromArmor(armor('plate'))
    plate.shield = { equipped: true, bonus: 2 }
    plate.bonuses = { magic: 1 }
    expect(armorClassBreakdown(plate, ctx).total).toBe(armorClassTotal(plate, ctx))
  })
})

describe('cappedDex', () => {
  it('treats null as uncapped and 0 as none', () => {
    expect(cappedDex(config({ dexCap: null }), MODS)).toBe(3)
    expect(cappedDex(config({ dexCap: 0 }), MODS)).toBe(0)
    expect(cappedDex(config({ dexCap: 2 }), MODS)).toBe(2)
  })

  it('does not raise a modifier below the cap', () => {
    expect(cappedDex(config({ dexCap: 2 }), { ...MODS, dex: -1 })).toBe(-1)
  })
})

describe('previewArmorClass', () => {
  it('is the number the sheet shows once the row is picked', () => {
    const worn = config({ shield: { equipped: true, bonus: 2 }, bonuses: { magic: 1 } })
    const preview = previewArmorClass(armor('half-plate'), worn, ctx)
    expect(preview).toBe(armorClassTotal(configFromArmor(armor('half-plate'), worn), ctx))
    // 15 + 2 (capped) + 2 shield + 1 magic
    expect(preview).toBe(20)
  })

  it('shows the monk base without the shield it forbids', () => {
    const worn = config({ shield: { equipped: true, bonus: 2 } })
    expect(previewArmorClass(armor('unarmored-defense-monk'), worn, ctx)).toBe(14)
  })
})

describe('characterArmorClass', () => {
  it('falls back to plain unarmored for a character with no configuration', () => {
    expect(characterArmorClass({ armorClass: null }, ctx)).toBe(13)
  })

  it('lets a hand-entered override win outright', () => {
    const config = configFromArmor(armor('plate'))
    expect(characterArmorClass({ armorClass: 16, armorClassConfig: config }, ctx)).toBe(16)
  })

  it('uses the configuration once the override is cleared', () => {
    const config = configFromArmor(armor('plate'))
    expect(characterArmorClass({ armorClass: null, armorClassConfig: config }, ctx)).toBe(18)
  })
})

describe('isProficientWithArmor', () => {
  it('matches a class proficiency however it is spelled', () => {
    expect(isProficientWithArmor(armor('half-plate'), ['medium armor'])).toBe(true)
    expect(isProficientWithArmor(armor('half-plate'), ['Medium Armor'])).toBe(true)
    expect(isProficientWithArmor(armor('plate'), ['all armor'])).toBe(true)
    expect(isProficientWithArmor(armor('shield'), ['shields'])).toBe(true)
  })

  it('does not read light armor as medium', () => {
    expect(isProficientWithArmor(armor('half-plate'), ['light armor'])).toBe(false)
  })

  it('never gates an unarmored base behind a proficiency', () => {
    expect(isProficientWithArmor(armor('unarmored-defense-monk'), [])).toBe(true)
  })
})

describe('armorWarnings', () => {
  it('warns about the speed penalty only below the requirement', () => {
    const scores = { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }
    expect(armorWarnings(armor('plate'), scores).some(w => w.includes('Strength 15'))).toBe(true)
    expect(armorWarnings(armor('plate'), { ...scores, str: 15 }).some(w => w.includes('Strength'))).toBe(false)
  })

  it('warns about Stealth where the table prints it', () => {
    const scores = { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    expect(armorWarnings(armor('half-plate'), scores)).toContain('Disadvantage on Stealth checks.')
    expect(armorWarnings(armor('breastplate'), scores)).toEqual([])
  })
})

describe('compactAcBonuses', () => {
  it('drops the zeroes an untouched editor leaves behind', () => {
    expect(compactAcBonuses({ magic: 0, feat: 0, misc: 0 })).toBeUndefined()
    expect(compactAcBonuses({ magic: 0, feat: 2 })).toEqual({ feat: 2 })
    expect(compactAcBonuses(undefined)).toBeUndefined()
  })
})

describe('the storage round trip', () => {
  it('survives CharacterSchema', () => {
    const worn = configFromArmor(armor('half-plate'))
    worn.shield = { equipped: true, armorId: 'shield', name: 'Shield', bonus: 2 }
    worn.bonuses = { magic: 1 }
    const character: Character = { ...validCharacter, armorClass: null, armorClassConfig: worn }

    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(character)))
    expect(parsed.armorClassConfig).toEqual(worn)
    expect(characterArmorClass(parsed, ctx)).toBe(20)
  })

  it('leaves a character stored before the calculator alone', () => {
    const { armorClassConfig: _none, ...legacy } = { ...validCharacter, armorClass: 16 }
    const parsed = CharacterSchema.parse(JSON.parse(JSON.stringify(legacy)))
    expect(parsed.armorClassConfig).toBeUndefined()
    expect(characterArmorClass(parsed, ctx)).toBe(16)
  })
})
