import type { AbilityKey, AttackEntry, Currency, EquipmentEntry } from '~/types/character'
import type {
  ArmorDefinition,
  EquipmentPack,
  StartingEquipmentChoice,
  StartingItem,
  StartingWealth,
  WeaponDefinition,
} from '~/types/rulepack'
import { attackFromWeapon, isProficientWithWeapon } from '~/services/attacks'
import { isProficientWithArmor } from '~/services/armorClass'
import { cleanEquipmentName } from '~/services/equipment'

/** What the kit needs off the loaded books, so this file stays free of the store. */
export interface EquipmentLookup {
  getWeapon(id: string): WeaponDefinition | undefined
  getArmor(id: string): ArmorDefinition | undefined
  getEquipmentPack(id: string): EquipmentPack | undefined
}

/** One answer per choice, same index. `picks[i]` answers `items[i]` of the chosen option: a weapon id or an item name. */
export interface EquipmentPick { option: number; picks: Record<number, string> }
export type EquipmentSelection = EquipmentPick[]

export interface StartingKit {
  /** Everything, weapons and armour included, merged by name. */
  items: Omit<EquipmentEntry, 'id'>[]
  /** Merged by weapon id. */
  weapons: { weapon: WeaponDefinition; quantity: number }[]
  /** Body armour and shields as picked. */
  armor: ArmorDefinition[]
}

type WeaponChoiceItem = Extract<StartingItem, { kind: 'weaponChoice' }>

/**
 * The options of a bullet the player may take. A "(if proficient)" option is offered only
 * when every weapon and armour in it is covered; an id the books do not know cannot be
 * shown to be, so that option is not offered.
 */
export function availableOptions(
  choice: StartingEquipmentChoice,
  proficiencies: string[],
  lookup: EquipmentLookup,
): number[] {
  const offered: number[] = []
  choice.options.forEach((option, index) => {
    if (option.requiresProficiency) {
      const proficient = option.items.every((item) => {
        if (item.kind === 'weapon') {
          const weapon = lookup.getWeapon(item.id)
          return !!weapon && isProficientWithWeapon(weapon, proficiencies)
        }
        if (item.kind === 'armor') {
          const armor = lookup.getArmor(item.id)
          return !!armor && isProficientWithArmor(armor, proficiencies)
        }
        return true
      })
      if (!proficient) return
    }
    offered.push(index)
  })
  return offered
}

/** The weapons "any simple weapon" or "any martial melee weapon" may stand for. */
export function weaponsForChoice(item: WeaponChoiceItem, all: WeaponDefinition[]): WeaponDefinition[] {
  return all.filter(weapon =>
    weapon.id !== 'unarmed-strike'
    && (!item.category || weapon.category === item.category)
    && (!item.rangeType || weapon.rangeType === item.rangeType),
  )
}

/**
 * Whether every bullet has an answer the player may give: the right number of them, each
 * option actually offered, and every "any weapon" or free-text slot of the chosen option
 * filled in. A bullet offering nothing — every option "(if proficient)" and the character
 * proficient with none — is answered by being skipped, or Next could never be pressed.
 */
export function isSelectionComplete(
  choices: StartingEquipmentChoice[],
  selection: EquipmentSelection,
  proficiencies: string[],
  lookup: EquipmentLookup,
): boolean {
  if (selection.length !== choices.length) return false
  return choices.every((choice, index) => {
    const pick = selection[index]
    if (!pick) return false
    const offered = availableOptions(choice, proficiencies, lookup)
    if (offered.length === 0) return true
    if (!offered.includes(pick.option)) return false
    const option = choice.options[pick.option]
    if (!option) return false
    return option.items.every((item, itemIndex) => {
      if (item.kind === 'weaponChoice') {
        const answer = pick.picks[itemIndex]
        return !!answer && !!lookup.getWeapon(answer)
      }
      if (item.kind === 'itemChoice') return !!pick.picks[itemIndex]?.trim()
      return true
    })
  })
}

/**
 * The picks expanded into things to carry. An id the books do not know is skipped rather
 * than thrown on, so one missing pack cannot take the rest of the kit with it.
 *
 * Given the proficiencies, a pick of an option not on offer contributes nothing — the
 * wizard pre-answers a one-option bullet, and when that one option is "(if proficient)"
 * and the character is not, the bullet is skipped rather than handed over anyway.
 */
export function resolveStartingKit(
  choices: StartingEquipmentChoice[],
  selection: EquipmentSelection,
  lookup: EquipmentLookup,
  proficiencies?: string[],
): StartingKit {
  const items = new Map<string, Omit<EquipmentEntry, 'id'>>()
  const weapons = new Map<string, { weapon: WeaponDefinition; quantity: number }>()
  const armor: ArmorDefinition[] = []

  const addItem = (name: string, quantity: number, weight?: number) => {
    const key = name.toLowerCase()
    const existing = items.get(key)
    if (existing) {
      existing.quantity += quantity
      if (existing.weight === undefined && weight !== undefined) existing.weight = weight
      return
    }
    items.set(key, { name, quantity, ...(weight !== undefined ? { weight } : {}) })
  }
  const addWeapon = (weapon: WeaponDefinition, quantity: number) => {
    const existing = weapons.get(weapon.id)
    if (existing) existing.quantity += quantity
    else weapons.set(weapon.id, { weapon, quantity })
    addItem(weapon.name, quantity, weapon.weight)
  }

  choices.forEach((choice, index) => {
    const pick = selection[index]
    const option = pick ? choice.options[pick.option] : undefined
    if (!pick || !option) return
    if (proficiencies && !availableOptions(choice, proficiencies, lookup).includes(pick.option)) return
    option.items.forEach((item, itemIndex) => {
      switch (item.kind) {
        case 'weapon': {
          const weapon = lookup.getWeapon(item.id)
          if (weapon) addWeapon(weapon, item.quantity ?? 1)
          break
        }
        case 'weaponChoice': {
          const id = pick.picks[itemIndex]
          const weapon = id ? lookup.getWeapon(id) : undefined
          if (weapon) addWeapon(weapon, 1)
          break
        }
        case 'armor': {
          const found = lookup.getArmor(item.id)
          if (!found) break
          armor.push(found)
          addItem(item.name ?? found.name, 1, found.weight)
          break
        }
        case 'pack': {
          const found = lookup.getEquipmentPack(item.id)
          found?.contents.forEach(c => addItem(c.name, c.quantity, c.weight))
          break
        }
        case 'item':
          addItem(item.name, item.quantity ?? 1, item.weight)
          break
        // A pick off a list names only the kind ("Amulet"), so it is stored under what it
        // is — "Holy symbol (amulet)". A free-text answer is the player's own words.
        case 'itemChoice': {
          const name = pick.picks[itemIndex]?.trim()
          if (!name) break
          addItem(item.options?.length ? `${item.label} (${name.toLowerCase()})` : name, 1)
          break
        }
      }
    })
  })

  return { items: [...items.values()], weapons: [...weapons.values()], armor }
}

const COIN = /^(\d+)\s+(cp|sp|ep|gp|pp)$/i
const CONTAINING = /^(.+?)\s+containing\s+(\d+)\s+(cp|sp|ep|gp|pp)$/i

/**
 * A background's equipment lines, as printed: coin goes to the purse, "a pouch containing
 * 15 gp" leaves the pouch as an item, and a leading count ("5 sticks of incense") becomes
 * the quantity.
 */
export function backgroundKit(lines: string[]): { items: Omit<EquipmentEntry, 'id'>[]; currency: Partial<Currency> } {
  const items: Omit<EquipmentEntry, 'id'>[] = []
  const currency: Partial<Currency> = {}
  const addCoin = (amount: string, unit: string) => {
    const key = unit.toLowerCase() as keyof Currency
    currency[key] = (currency[key] ?? 0) + Number.parseInt(amount)
  }

  for (const line of lines) {
    const coin = line.match(COIN)
    if (coin?.[1] && coin[2]) {
      addCoin(coin[1], coin[2])
      continue
    }
    const container = line.match(CONTAINING)
    const text = container?.[1] ?? line
    if (container?.[2] && container[3]) addCoin(container[2], container[3])

    const match = text.match(/^(\d+)\s+(.+)$/)
    items.push({
      // A book may write its list as data references; the sheet wants the name alone.
      name: cleanEquipmentName((match ? match[2] : text) ?? text),
      quantity: match?.[1] ? Number.parseInt(match[1]) : 1,
    })
  }
  return { items, currency }
}

/** One attack per distinct weapon in the kit, proficiency read off the class's list. */
export function attacksFromKit(
  kit: StartingKit,
  proficiencies: string[],
  modifiers: Record<AbilityKey, number>,
): Omit<AttackEntry, 'id'>[] {
  return kit.weapons.map(({ weapon }) =>
    attackFromWeapon(weapon, { otherProficiencies: proficiencies }, modifiers))
}

/** "5d4 × 10 gp", or "5d4 gp" when nothing multiplies it. */
export function startingWealthLabel(w: StartingWealth): string {
  return w.multiplier === 1 ? `${w.dice} gp` : `${w.dice} × ${w.multiplier} gp`
}

/** Rolls the wealth dice; `rng` is injectable so a test can pin the dice. */
export function rollStartingWealth(
  w: StartingWealth,
  rng: () => number = Math.random,
): { rolls: number[]; total: number } {
  const match = w.dice.match(/^(\d+)d(\d+)$/i)
  const count = match?.[1] ? Number.parseInt(match[1]) : 0
  const sides = match?.[2] ? Number.parseInt(match[2]) : 0
  const rolls = Array.from({ length: count }, () => Math.floor(rng() * sides) + 1)
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) * w.multiplier }
}

/** A roll shown as the sum it was: "(1 + 4 + 3 + 4 + 2) × 10 = 140 gp", unbracketed at × 1. */
export function wealthRollLabel(roll: { rolls: number[]; total: number }, multiplier: number): string {
  const sum = roll.rolls.join(' + ')
  return multiplier === 1 ? `${sum} = ${roll.total} gp` : `(${sum}) × ${multiplier} = ${roll.total} gp`
}

/** A gold figure typed into a field: a whole number of at least zero, else null. */
export function parseGoldAmount(raw: string | number | null): number | null {
  if (raw === null) return null
  const text = String(raw).trim()
  if (!/^\d+$/.test(text)) return null
  return Number.parseInt(text)
}
