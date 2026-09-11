import type { AbilityKey, Character, EquipmentEntry, Currency } from '~/types/character'

/**
 * What the pack weighs, and how much of it the character can carry.
 *
 * Weight is optional on every entry on purpose: most tables never weigh anything, and a
 * list that demands a number per line is a list nobody fills in. So the total is over
 * whatever has been weighed, and the sheet says how many entries were left blank rather
 * than pretending the total is complete.
 */

/** Words a title-cased item name leaves lowercase unless they lead it. */
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on',
  'or', 'per', 'the', 'to', 'vs', 'with',
])

/**
 * Turn a data reference into something a player would write.
 *
 * Book content names an item the way 5etools does — `fine clothes|phb`, sometimes with a
 * third part that is the display text (`shortsword|phb|short sword`). The source is a
 * disambiguator for the corpus, not part of the name, and it has no business on a
 * character sheet.
 *
 * Re-casing is deliberately confined to names that carried a source. A piped name came
 * out of a data file, where the convention is lowercase, so title-casing it restores what
 * the book prints; a name without one was typed by a player, and "Belt pouch containing
 * 15 gp" is theirs to capitalise however they like.
 */
export function cleanEquipmentName(raw: string): string {
  const name = String(raw ?? '').trim()
  // `{@item fine clothes|phb}` — a tag that reached the data whole.
  const untagged = name.replace(/^\{@\w+\s*(.*)\}$/, '$1').trim()
  if (!untagged.includes('|')) return untagged

  const parts = untagged.split('|').map(p => p.trim())
  // The third part is the display name where the reference gives one.
  const chosen = parts[2] || parts[0] || untagged
  return titleCaseItem(chosen)
}

function titleCaseItem(name: string): string {
  return name
    .split(/(\s+|-)/)
    .map((word, i) => {
      if (/^(\s+|-)$/.test(word)) return word
      const lower = word.toLowerCase()
      // A measurement or a coin keeps its own casing: 15 gp, 1d6, 10 ft.
      if (/\d/.test(word)) return word
      if (i > 0 && MINOR_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

/** Coins weigh something: fifty of any denomination make a pound. */
export const COINS_PER_POUND = 50

export function coinWeight(currency: Currency | undefined): number {
  if (!currency) return 0
  const coins = (['cp', 'sp', 'ep', 'gp', 'pp'] as const)
    .reduce((sum, k) => sum + (Number(currency[k]) || 0), 0)
  return coins / COINS_PER_POUND
}

/** One line's contribution: the weight of a single item times how many are carried. */
export function entryWeight(entry: EquipmentEntry): number {
  if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight)) return 0
  return entry.weight * (Number(entry.quantity) || 0)
}

export interface CarriedWeight {
  /** Pounds of equipment that has a weight recorded. */
  gear: number
  /** Pounds of coin. */
  coins: number
  total: number
  /** Entries carrying a quantity but no weight — what the total is missing. */
  unweighed: number
}

export function carriedWeight(character: Character): CarriedWeight {
  const equipment = character.equipment ?? []
  const gear = equipment.reduce((sum, e) => sum + entryWeight(e), 0)
  const unweighed = equipment.filter(
    e => (typeof e.weight !== 'number' || !Number.isFinite(e.weight)) && (e.quantity ?? 0) > 0,
  ).length
  const coins = coinWeight(character.currency)
  return { gear, coins, total: gear + coins, unweighed }
}

/**
 * Features that widen carrying capacity are found by what they say, not by a list of
 * names.
 *
 * Every one of them prints the same two ideas in the same sentence — Powerful Build
 * counts you "one size larger when determining your carrying capacity", the bear Aspect
 * of the Beast says your "carrying capacity ... is doubled" — and a book this app has
 * never heard of will phrase its own the same way. Matching the wording means a race or
 * a totem from any pack works without a code change, where a name list would only ever
 * know the ones written into it.
 *
 * A wording sniff is a guess, though, which is why `carryingCapacityMultiplier` exists:
 * the player can always say what the number is instead.
 */
const CAPACITY_MENTION = /carry(?:ing)?\s+capacity/i
const CAPACITY_WIDENS = /\b(?:doubl\w*|twice|one size larger)\b/i

function doublingFeatures(character: Character): string[] {
  return (character.features ?? [])
    .filter((f) => {
      const text = `${f?.name ?? ''} ${f?.description ?? ''}`
      return CAPACITY_MENTION.test(text) && CAPACITY_WIDENS.test(text)
    })
    .map(f => f.name)
}

/** Pounds per point of Strength, before any multiplier. */
export const CAPACITY_PER_STRENGTH = 15

export interface CarryingCapacity {
  /** Strength score the number was built from, overrides applied. */
  strength: number
  /** What the multiplier applies to: Strength × 15. */
  base: number
  multiplier: number
  /** Features the multiplier was read off, empty when the player set it by hand. */
  sources: string[]
  /** True where `character.carryingCapacityMultiplier` supplied the multiplier. */
  manual: boolean
  /** The number on the sheet. */
  capacity: number
  /** Push, drag or lift is twice what you can carry. */
  pushDragLift: number
}

/**
 * Carrying capacity: Strength × 15, doubled once per feature that doubles it.
 *
 * Two such features multiply rather than add — each says "doubled", and a goliath
 * barbarian who took the bear totem has taken both — but the sheet names every source
 * beside the number so a table that reads it differently can set the multiplier by hand.
 *
 * Size is not part of this. Nothing stores a character's size, and the only sizes that
 * change the number are ones no player character starts at.
 */
export function carryingCapacity(character: Character): CarryingCapacity {
  const strength = strengthScore(character)
  const base = strength * CAPACITY_PER_STRENGTH

  const override = character.carryingCapacityMultiplier
  const manual = typeof override === 'number' && Number.isFinite(override) && override > 0

  const sources = manual ? [] : doublingFeatures(character)
  const multiplier = manual ? override : 2 ** sources.length
  const capacity = base * multiplier

  return { strength, base, multiplier, sources, manual, capacity, pushDragLift: capacity * 2 }
}

function strengthScore(character: Character): number {
  const key: AbilityKey = 'str'
  const override = character.abilityScoreOverrides?.[key]
  const score = override ?? character.abilityScores?.[key]
  return typeof score === 'number' && Number.isFinite(score) ? score : 10
}
