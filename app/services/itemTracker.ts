import type { Character, EquipmentEntry } from '~/types/character'

/**
 * The item tracker under Attacks: arrows, potions, javelins — anything the player wants a
 * − and + for in the middle of a fight.
 *
 * The count is the inventory line's own `quantity`. Nothing here stores a second number,
 * so firing an arrow and buying twenty more on the Items tab are the same edit, and the two
 * can never disagree. What the character does store is presentation only: the order of the
 * rows (`trackedItemIds`) and which ammunition the player took off the tracker
 * (`untrackedItemIds`). Both point at inventory ids rather than names, so a renamed line
 * stays tracked and a deleted one simply drops out.
 */

/**
 * Ammunition is tracked without being asked, which is what makes a character created
 * before this existed — a fighter with twenty bolts — get the row too. Read off the name,
 * since an inventory line carries nothing else; the words are specific enough that a quiver,
 * a bolt of cloth or a needle and thread are left alone.
 */
const AMMUNITION_PATTERN = /\b(?:arrows?|bolts|crossbow bolts?|sling bullets?|blowgun needles?)\b/i

export function isAmmunition(name: string): boolean {
  return AMMUNITION_PATTERN.test(name)
}

/**
 * The rows in display order: the stored order first, then any ammunition nobody has placed
 * yet, in inventory order. An id whose line is gone is skipped.
 */
export function trackedItems(character: Character): EquipmentEntry[] {
  const byId = new Map(character.equipment.map(e => [e.id, e]))
  const placed = (character.trackedItemIds ?? [])
    .map(id => byId.get(id))
    .filter((e): e is EquipmentEntry => e !== undefined)
  const seen = new Set(placed.map(e => e.id))
  const removed = new Set(character.untrackedItemIds ?? [])
  const automatic = character.equipment
    .filter(e => !seen.has(e.id) && !removed.has(e.id) && isAmmunition(e.name))
  return [...placed, ...automatic]
}

/** Inventory lines the edit mode can still add. */
export function trackableItems(character: Character): EquipmentEntry[] {
  const tracked = new Set(trackedItems(character).map(e => e.id))
  return character.equipment.filter(e => !tracked.has(e.id))
}

/**
 * Add a line to the bottom. The current order is written out whole, so automatic rows keep
 * their place above it rather than jumping below the new one.
 */
export function trackItem(character: Character, id: string): Pick<Character, 'trackedItemIds' | 'untrackedItemIds'> {
  const order = trackedItems(character).map(e => e.id).filter(other => other !== id)
  return {
    trackedItemIds: [...order, id],
    untrackedItemIds: (character.untrackedItemIds ?? []).filter(other => other !== id),
  }
}

/**
 * Take a row off the tracker. The inventory line is untouched. Ammunition is remembered as
 * removed, or the automatic rule would put it straight back.
 */
export function untrackItem(character: Character, id: string): Pick<Character, 'trackedItemIds' | 'untrackedItemIds'> {
  const trackedItemIds = (character.trackedItemIds ?? []).filter(other => other !== id)
  const line = character.equipment.find(e => e.id === id)
  const untracked = (character.untrackedItemIds ?? []).filter(other => other !== id)
  return {
    trackedItemIds,
    untrackedItemIds: line && isAmmunition(line.name) ? [...untracked, id] : untracked,
  }
}

/** Move the row at `from` to `to`, storing the whole order. Out-of-range moves change nothing. */
export function moveTrackedItem(character: Character, from: number, to: number): Pick<Character, 'trackedItemIds'> {
  const order = trackedItems(character).map(e => e.id)
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return { trackedItemIds: order }
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved!)
  return { trackedItemIds: order }
}

/** Spend or regain one, on the inventory line itself. Never below zero, and the line stays. */
export function adjustTrackedQuantity(character: Character, id: string, delta: number): Pick<Character, 'equipment'> {
  return {
    equipment: character.equipment.map(e =>
      e.id === id ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e),
  }
}
