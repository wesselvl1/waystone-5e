import { describe, it, expect } from 'vitest'
import {
  attackBonus,
  attackFromWeapon,
  compactBonusSet,
  damageBonus,
  defaultAbilityForWeapon,
  formatDamage,
  formatSigned,
  isProficientWithWeapon,
  sumBonusSet,
} from '~/services/attacks'
import { migrateCharacterShape } from '~/services/characterMigration'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { AttackEntry, Character } from '~/types/character'
import type { WeaponDefinition } from '~/types/rulepack'
import fragment from '~/data/srd/weapons.json'

const pack = RulepackSchema.parse(fragment)
const weapons = pack.weapons as WeaponDefinition[]

function weapon(id: string): WeaponDefinition {
  const found = weapons.find(w => w.id === id)
  if (!found) throw new Error(`no SRD weapon ${id}`)
  return found
}

const MODS = { str: 3, dex: 1, con: 2, int: 0, wis: -1, cha: 4 }
const ctx = { modifiers: MODS, proficiencyBonus: 3 }

function attack(partial: Partial<AttackEntry> = {}): AttackEntry {
  return {
    id: 'a1',
    name: 'Longsword',
    bonus: null,
    ability: 'str',
    proficient: true,
    damageAbility: 'str',
    damageDice: '1d8',
    damageType: 'slashing',
    ...partial,
  }
}

describe('the attack roll', () => {
  it('adds the chosen ability and the proficiency bonus', () => {
    expect(attackBonus(attack(), ctx)).toBe(6)
  })

  it('leaves proficiency out when the character has none with it', () => {
    expect(attackBonus(attack({ proficient: false }), ctx)).toBe(3)
  })

  it('rolls with whichever ability is chosen, not just str or dex', () => {
    expect(attackBonus(attack({ ability: 'cha' }), ctx)).toBe(7)
    expect(attackBonus(attack({ ability: 'wis' }), ctx)).toBe(2)
  })

  it("adds none at all for a 'none' attack", () => {
    expect(attackBonus(attack({ ability: 'none', proficient: false }), ctx)).toBe(0)
  })

  /** The point of three slots rather than one: they stack, and each is still visible. */
  it('stacks magic, feat and misc bonuses on top', () => {
    const entry = attack({ attackBonuses: { magic: 1, feat: 2, misc: -1 } })
    expect(attackBonus(entry, ctx)).toBe(8)
  })

  it('is overridden outright by a hand-entered total', () => {
    const entry = attack({ bonus: 11, attackBonuses: { magic: 1 } })
    expect(attackBonus(entry, ctx)).toBe(11)
  })
})

describe('the damage roll', () => {
  it('takes its own ability, which need not be the attack ability', () => {
    expect(damageBonus(attack({ damageAbility: 'dex' }), ctx)).toBe(1)
  })

  it('never adds the proficiency bonus', () => {
    expect(damageBonus(attack(), ctx)).toBe(3)
  })

  it('stacks its own bonus slots, separate from the attack roll', () => {
    const entry = attack({
      attackBonuses: { magic: 1 },
      damageBonuses: { magic: 1, misc: 2 },
    })
    expect(attackBonus(entry, ctx)).toBe(7)
    expect(damageBonus(entry, ctx)).toBe(6)
  })

  it('prints the dice and the modifier as one expression', () => {
    expect(formatDamage(attack(), ctx)).toBe('1d8 + 3')
    expect(formatDamage(attack({ damageAbility: 'wis' }), ctx)).toBe('1d8 − 1')
    expect(formatDamage(attack({ damageAbility: 'int' }), ctx)).toBe('1d8')
  })

  /** The net deals no damage, and neither dice nor modifier should be invented for it. */
  it('prints a dash for an attack with no damage at all', () => {
    expect(formatDamage(attack({ damageDice: '', damageAbility: 'none' }), ctx)).toBe('—')
  })
})

describe('bonus sets', () => {
  it('sums what is there and ignores what is not', () => {
    expect(sumBonusSet(undefined)).toBe(0)
    expect(sumBonusSet({ magic: 1, misc: -2 })).toBe(-1)
  })

  /** An untouched editor writes zeroes; storing them would make a plain club look magic. */
  it('drops zeroes on the way to storage', () => {
    expect(compactBonusSet({ magic: 0, feat: 0, misc: 0 })).toBeUndefined()
    expect(compactBonusSet({ magic: 1, feat: 0 })).toEqual({ magic: 1 })
  })
})

describe('signs', () => {
  it('always shows one on the attack bonus', () => {
    expect(formatSigned(0)).toBe('+0')
    expect(formatSigned(4)).toBe('+4')
    expect(formatSigned(-2)).toBe('-2')
  })
})

describe('what a weapon defaults to', () => {
  it('rolls a plain melee weapon with Strength', () => {
    expect(defaultAbilityForWeapon(weapon('longsword'), MODS)).toBe('str')
  })

  it('rolls a ranged weapon with Dexterity', () => {
    expect(defaultAbilityForWeapon(weapon('longbow'), MODS)).toBe('dex')
  })

  /** Finesse is the player's choice; taking the better modifier is how they would make it. */
  it('takes the better modifier for a finesse weapon', () => {
    expect(defaultAbilityForWeapon(weapon('rapier'), MODS)).toBe('str')
    expect(defaultAbilityForWeapon(weapon('rapier'), { ...MODS, dex: 5 })).toBe('dex')
  })

  it('still throws a javelin with Strength', () => {
    expect(defaultAbilityForWeapon(weapon('javelin'), MODS)).toBe('str')
  })
})

describe('proficiency with a weapon', () => {
  it('matches a whole category', () => {
    expect(isProficientWithWeapon(weapon('greatsword'), ['simple', 'martial'])).toBe(true)
    expect(isProficientWithWeapon(weapon('greatsword'), ['simple'])).toBe(false)
  })

  it('matches a single named weapon', () => {
    expect(isProficientWithWeapon(weapon('longsword'), ['dagger', 'longsword'])).toBe(true)
  })

  /** The rogue's list says "hand crossbow"; the equipment table says "Crossbow, Hand". */
  it('matches a name the class writes the other way round', () => {
    expect(isProficientWithWeapon(weapon('hand-crossbow'), ['hand crossbow'])).toBe(true)
  })

  it('does not match an unrelated proficiency', () => {
    expect(isProficientWithWeapon(weapon('longsword'), ["smith's tools", 'light armor'])).toBe(false)
  })
})

describe('building an attack from a weapon', () => {
  const character = { otherProficiencies: ['simple', 'martial'] } as Pick<Character, 'otherProficiencies'>

  it('carries the dice, type, range and properties across', () => {
    const built = attackFromWeapon(weapon('longbow'), character, MODS)
    expect(built).toMatchObject({
      name: 'Longbow',
      damageDice: '1d8',
      damageType: 'piercing',
      range: '150/600',
      weaponId: 'longbow',
      ability: 'dex',
      damageAbility: 'dex',
      proficient: true,
    })
    expect(built.properties).toContain('two-handed')
  })

  it('leaves the roll to be derived rather than fixing a total', () => {
    expect(attackFromWeapon(weapon('club'), character, MODS).bonus).toBeNull()
  })

  it('marks a weapon the character has no proficiency with', () => {
    const wizard = { otherProficiencies: ['dagger', 'dart', 'sling', 'quarterstaff'] }
    expect(attackFromWeapon(weapon('greataxe'), wizard, MODS).proficient).toBe(false)
    expect(attackFromWeapon(weapon('dagger'), wizard, MODS).proficient).toBe(true)
  })
})

describe('the SRD weapon list', () => {
  /** Unarmed Strike is not on the table; it is carried here because every character has one. */
  const table = weapons.filter(w => w.id !== 'unarmed-strike')

  it('has every weapon on the equipment table', () => {
    expect(table.filter(w => w.category === 'simple' && w.rangeType === 'melee')).toHaveLength(10)
    expect(table.filter(w => w.category === 'simple' && w.rangeType === 'ranged')).toHaveLength(4)
    expect(table.filter(w => w.category === 'martial' && w.rangeType === 'melee')).toHaveLength(18)
    expect(table.filter(w => w.category === 'martial' && w.rangeType === 'ranged')).toHaveLength(5)
  })

  it('carries an unarmed strike, which the table does not print', () => {
    expect(weapons.find(w => w.id === 'unarmed-strike')).toBeTruthy()
  })

  it('gives every weapon a unique id', () => {
    expect(new Set(weapons.map(w => w.id)).size).toBe(weapons.length)
  })

  /** `finesse` and `thrown` decide an attack's default ability, so casing matters. */
  it('writes every property in lower case', () => {
    for (const w of weapons) {
      for (const property of w.properties ?? []) expect(property).toBe(property.toLowerCase())
    }
  })

  it('gives every versatile weapon its two-handed dice', () => {
    for (const w of weapons) {
      if ((w.properties ?? []).includes('versatile')) expect(w.versatileDamage).toBeTruthy()
    }
  })

  it('gives every ranged or thrown weapon a range', () => {
    for (const w of weapons) {
      const thrown = (w.properties ?? []).includes('thrown')
      if (w.rangeType === 'ranged' || thrown) expect(w.range).toBeTruthy()
    }
  })
})

describe('attacks stored before any of this existed', () => {
  /**
   * The old sheet showed max(str, dex) + proficiency for a null bonus. The migration has
   * to land on the same number, or every character's to-hit moves the day they update.
   */
  it('keeps the number the old sheet showed', () => {
    const migrated = migrateCharacterShape({
      abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      abilityScoreOverrides: {},
      attacks: [{ id: 'a', name: 'Longsword', bonus: null, damageDice: '1d8+3', damageType: 'slashing' }],
    }) as { attacks: AttackEntry[] }

    const entry = migrated.attacks[0]!
    expect(entry.ability).toBe('str')
    expect(entry.proficient).toBe(true)
    expect(attackBonus(entry, { modifiers: { str: 3, dex: 1, con: 2, int: -1, wis: 0, cha: 0 }, proficiencyBonus: 2 })).toBe(5)
  })

  it('uses the spellcasting ability where the old sheet did', () => {
    const migrated = migrateCharacterShape({
      abilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      spellcastingAbility: 'int',
      attacks: [{ id: 'a', name: 'Fire Bolt', bonus: null, damageDice: '1d10', damageType: 'fire' }],
    }) as { attacks: AttackEntry[] }

    expect(migrated.attacks[0]!.ability).toBe('int')
  })

  /** A legacy "1d8+3" already carries the modifier; adding it again would double it. */
  it('does not add an ability modifier to damage already written into the dice', () => {
    const migrated = migrateCharacterShape({
      abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      attacks: [{ id: 'a', name: 'Longsword', bonus: null, damageDice: '1d8+3', damageType: 'slashing' }],
    }) as { attacks: AttackEntry[] }

    expect(migrated.attacks[0]!.damageAbility).toBe('none')
    expect(formatDamage(migrated.attacks[0]!, ctx)).toBe('1d8+3')
  })

  it('leaves a hand-entered total as the override it always was', () => {
    const migrated = migrateCharacterShape({
      abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      attacks: [{ id: 'a', name: 'Dagger', bonus: 7, damageDice: '1d4+2', damageType: 'piercing' }],
    }) as { attacks: AttackEntry[] }

    expect(attackBonus(migrated.attacks[0]!, ctx)).toBe(7)
    expect(migrated.attacks[0]!.ability).toBe('none')
  })

  it('leaves an attack that already has the new fields alone', () => {
    const entry = attack({ ability: 'cha', proficient: false, damageAbility: 'cha' })
    const migrated = migrateCharacterShape({ attacks: [entry] }) as { attacks: AttackEntry[] }
    expect(migrated.attacks[0]).toEqual(entry)
  })

  it('is idempotent', () => {
    const once = migrateCharacterShape({
      abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      attacks: [{ id: 'a', name: 'Longsword', bonus: null, damageDice: '1d8+3', damageType: 'slashing' }],
    })
    expect(migrateCharacterShape(once)).toEqual(once)
  })
})
