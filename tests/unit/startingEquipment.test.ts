import { describe, it, expect } from 'vitest'
import {
  attacksFromKit,
  availableOptions,
  backgroundKit,
  isSelectionComplete,
  parseGoldAmount,
  resolveStartingKit,
  rollStartingWealth,
  startingWealthLabel,
  weaponsForChoice,
  type EquipmentLookup,
  type EquipmentSelection,
} from '~/services/startingEquipment'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { AbilityKey } from '~/types/character'
import type { ClassDefinition, StartingEquipmentChoice } from '~/types/rulepack'
import clericJson from '~/data/srd/cleric.json'
import fighterJson from '~/data/srd/fighter.json'
import monkJson from '~/data/srd/monk.json'
import weaponsJson from '~/data/srd/weapons.json'
import armorJson from '~/data/srd/armor.json'
import packsJson from '~/data/srd/equipment-packs.json'

const weapons = RulepackSchema.parse(weaponsJson).weapons
const armor = RulepackSchema.parse(armorJson).armor
const packs = RulepackSchema.parse(packsJson).equipmentPacks

const lookup: EquipmentLookup = {
  getWeapon: id => weapons.find(w => w.id === id),
  getArmor: id => armor.find(a => a.id === id),
  getEquipmentPack: id => packs.find(p => p.id === id),
}

function classOf(json: unknown): ClassDefinition {
  return RulepackSchema.parse(json).classes[0] as ClassDefinition
}
const cleric = classOf(clericJson)
const fighter = classOf(fighterJson)
const monk = classOf(monkJson)

const mods: Record<AbilityKey, number> = { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 }
const clericProf = ['light', 'medium', 'shields', 'simple']

describe('availableOptions', () => {
  it('hides an "(if proficient)" option without the proficiency', () => {
    const [weaponBullet, armorBullet] = cleric.startingEquipment as StartingEquipmentChoice[]
    expect(availableOptions(weaponBullet!, clericProf, lookup)).toEqual([0])
    expect(availableOptions(armorBullet!, clericProf, lookup)).toEqual([0, 1])
    expect(availableOptions(armorBullet!, [...clericProf, 'heavy'], lookup)).toEqual([0, 1, 2])
  })

  it('does not offer a proficiency-gated option naming an unknown id', () => {
    const choice: StartingEquipmentChoice = {
      options: [
        { label: 'a', items: [{ kind: 'item', name: 'Rope' }] },
        { label: 'b', items: [{ kind: 'weapon', id: 'nope' }], requiresProficiency: true },
      ],
    }
    expect(availableOptions(choice, ['simple', 'martial'], lookup)).toEqual([0])
  })
})

describe('resolveStartingKit', () => {
  it('expands a pack into its contents', () => {
    const choices: StartingEquipmentChoice[] = [
      { options: [{ label: 'pack', items: [{ kind: 'pack', id: 'explorers-pack' }] }] },
    ]
    const kit = resolveStartingKit(choices, [{ option: 0, picks: {} }], lookup)
    expect(kit.items).toContainEqual(expect.objectContaining({ name: 'Torch', quantity: 10 }))
  })

  it('merges two handaxes into one weapon of quantity 2', () => {
    const kit = resolveStartingKit(
      fighter.startingEquipment!,
      [{ option: 0, picks: {} }, { option: 0, picks: { 0: 'longsword' } }, { option: 1, picks: {} }, { option: 0, picks: {} }],
      lookup,
    )
    const axes = kit.weapons.filter(w => w.weapon.id === 'handaxe')
    expect(axes).toHaveLength(1)
    expect(axes[0]!.quantity).toBe(2)
    expect(kit.items.find(i => i.name === 'Handaxe')?.quantity).toBe(2)
  })

  it('merges two picked longswords into one', () => {
    const kit = resolveStartingKit(
      fighter.startingEquipment!,
      [{ option: 0, picks: {} }, { option: 1, picks: { 0: 'longsword', 1: 'longsword' } }, { option: 0, picks: {} }, { option: 0, picks: {} }],
      lookup,
    )
    expect(kit.weapons.filter(w => w.weapon.id === 'longsword')).toEqual([
      expect.objectContaining({ quantity: 2 }),
    ])
  })

  it('takes weight from the weapon or armour definition and names a shield as printed', () => {
    const choices: StartingEquipmentChoice[] = [
      { options: [{ label: 'x', items: [{ kind: 'armor', id: 'shield', name: 'Wooden shield' }, { kind: 'weapon', id: 'handaxe' }] }] },
    ]
    const kit = resolveStartingKit(choices, [{ option: 0, picks: {} }], lookup)
    expect(kit.armor.map(a => a.id)).toEqual(['shield'])
    expect(kit.items.find(i => i.name === 'Wooden shield')?.weight).toBe(armor.find(a => a.id === 'shield')!.weight)
    expect(kit.items.find(i => i.name === 'Handaxe')?.weight).toBe(2)
  })

  it('skips unknown ids', () => {
    const choices: StartingEquipmentChoice[] = [
      {
        options: [{
          label: 'mixed',
          items: [{ kind: 'weapon', id: 'nope' }, { kind: 'pack', id: 'nope' }, { kind: 'item', name: 'Rope', quantity: 2 }],
        }],
      },
    ]
    const kit = resolveStartingKit(choices, [{ option: 0, picks: {} }], lookup)
    expect(kit.items).toEqual([{ name: 'Rope', quantity: 2 }])
    expect(kit.weapons).toEqual([])
  })
})

describe('weaponsForChoice', () => {
  it('filters by category and range and never offers an unarmed strike', () => {
    const all = weaponsForChoice({ kind: 'weaponChoice', category: 'martial', rangeType: 'melee' }, weapons)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every(w => w.category === 'martial' && w.rangeType === 'melee')).toBe(true)
    expect(weaponsForChoice({ kind: 'weaponChoice' }, weapons).some(w => w.id === 'unarmed-strike')).toBe(false)
  })
})

describe('isSelectionComplete', () => {
  const choices = monk.startingEquipment!
  const good: EquipmentSelection = [{ option: 1, picks: { 0: 'club' } }, { option: 0, picks: {} }, { option: 0, picks: {} }]
  const prof = ['simple']

  it('is true for a full selection', () => {
    expect(isSelectionComplete(choices, good, prof, lookup)).toBe(true)
  })

  it('is false with a missing pick, an out-of-range option, or a selection sized for another class', () => {
    expect(isSelectionComplete(choices, [{ option: 1, picks: {} }, good[1]!, good[2]!], prof, lookup)).toBe(false)
    expect(isSelectionComplete(choices, [{ option: 1, picks: { 0: 'nope' } }, good[1]!, good[2]!], prof, lookup)).toBe(false)
    expect(isSelectionComplete(choices, [good[0]!, { option: 5, picks: {} }, good[2]!], prof, lookup)).toBe(false)
    expect(isSelectionComplete(choices, good.slice(0, 2), prof, lookup)).toBe(false)
    expect(isSelectionComplete(fighter.startingEquipment!, good, prof, lookup)).toBe(false)
  })

  it('needs a non-empty answer for a free-text item', () => {
    const free: StartingEquipmentChoice[] = [
      { options: [{ label: 'x', items: [{ kind: 'itemChoice', label: 'Tool' }] }] },
    ]
    expect(isSelectionComplete(free, [{ option: 0, picks: { 0: ' ' } }], [], lookup)).toBe(false)
    expect(isSelectionComplete(free, [{ option: 0, picks: { 0: 'Flute' } }], [], lookup)).toBe(true)
  })
})

describe('backgroundKit', () => {
  it('splits "Belt pouch containing 15 gp"', () => {
    const kit = backgroundKit(['Belt pouch containing 15 gp'])
    expect(kit.items).toEqual([{ name: 'Belt pouch', quantity: 1 }])
    expect(kit.currency).toEqual({ gp: 15 })
  })

  it('moves a bare coin line into currency', () => {
    expect(backgroundKit(['10 gp', '5 sp'])).toEqual({ items: [], currency: { gp: 10, sp: 5 } })
  })

  it('keeps "Prayer book or prayer wheel" as printed and reads a leading count', () => {
    const kit = backgroundKit(['Prayer book or prayer wheel', '5 sticks of incense'])
    expect(kit.items).toEqual([
      { name: 'Prayer book or prayer wheel', quantity: 1 },
      { name: 'sticks of incense', quantity: 5 },
    ])
  })
})

describe('attacksFromKit', () => {
  it('marks a warhammer not proficient without martial', () => {
    const choices: StartingEquipmentChoice[] = [
      { options: [{ label: 'w', items: [{ kind: 'weapon', id: 'warhammer' }] }] },
    ]
    const kit = resolveStartingKit(choices, [{ option: 0, picks: {} }], lookup)
    expect(attacksFromKit(kit, ['simple'], mods)[0]!.proficient).toBe(false)
    expect(attacksFromKit(kit, ['simple', 'martial'], mods)[0]!.proficient).toBe(true)
  })

  it('excludes arrows', () => {
    const kit = resolveStartingKit(
      fighter.startingEquipment!,
      [{ option: 1, picks: {} }, { option: 1, picks: { 0: 'longsword', 1: 'rapier' } }, { option: 0, picks: {} }, { option: 0, picks: {} }],
      lookup,
    )
    expect(kit.items.some(i => i.name === 'Arrows')).toBe(true)
    const names = attacksFromKit(kit, ['simple', 'martial'], mods).map(a => a.name)
    expect(names).toContain('Longbow')
    expect(names).not.toContain('Arrows')
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('starting wealth', () => {
  it('labels fighter and monk', () => {
    expect(startingWealthLabel(fighter.startingWealth!)).toBe('5d4 × 10 gp')
    expect(startingWealthLabel(monk.startingWealth!)).toBe('5d4 gp')
  })

  it('rolls with an injected rng', () => {
    expect(rollStartingWealth(fighter.startingWealth!, () => 0)).toEqual({ rolls: [1, 1, 1, 1, 1], total: 50 })
    expect(rollStartingWealth(monk.startingWealth!, () => 0).total).toBe(5)
    const high = rollStartingWealth(monk.startingWealth!, () => 0.999)
    expect(high.rolls).toEqual([4, 4, 4, 4, 4])
  })
})

describe('parseGoldAmount', () => {
  it('accepts a whole number of at least zero', () => {
    expect(parseGoldAmount('120')).toBe(120)
    expect(parseGoldAmount(0)).toBe(0)
  })

  it('rejects everything else', () => {
    for (const raw of ['', '-3', '2.5', 'abc', null]) expect(parseGoldAmount(raw)).toBeNull()
  })
})
