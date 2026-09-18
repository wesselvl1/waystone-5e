/**
 * Filing the flat proficiency list into the groups a character sheet prints.
 *
 * `Character.otherProficiencies` is one list of strings covering four different things —
 * "simple", "light", "Common", "thieves' tools" — because that is how the classes and
 * races print them and because `isProficientWithWeapon` / `isProficientWithArmor` match
 * against the raw wording. Nothing in the data says which of the four a given string is,
 * so the group is worked out here from the wording and from the books that are loaded,
 * the way carrying capacity is worked out from feature text.
 *
 * A guess is still a guess, so `Character.proficiencyGroups` overrides it per entry —
 * the `armorClass` idiom again, and what lets the sheet's editor file a homebrew language
 * where the player put it rather than where the wording suggests.
 */

import type { ProficiencyGroup } from '~/types/character'

export const PROFICIENCY_GROUPS: { key: ProficiencyGroup; label: string }[] = [
  { key: 'weapons-armor', label: 'Weapons & Armor' },
  { key: 'languages', label: 'Languages' },
  { key: 'tools', label: 'Tools & Other' },
]

/**
 * The categories a class prints instead of a list, and how they read on a sheet.
 *
 * "simple" and "light" are what the books write in a class's proficiency line; on their
 * own they say nothing, which is the whole complaint — the sheet prints the noun too.
 */
const CATEGORY_LABELS: Record<string, string> = {
  'simple': 'Simple Weapons',
  'simple weapons': 'Simple Weapons',
  'martial': 'Martial Weapons',
  'martial weapons': 'Martial Weapons',
  'light': 'Light Armor',
  'light armor': 'Light Armor',
  'light armour': 'Light Armor',
  'medium': 'Medium Armor',
  'medium armor': 'Medium Armor',
  'medium armour': 'Medium Armor',
  'heavy': 'Heavy Armor',
  'heavy armor': 'Heavy Armor',
  'heavy armour': 'Heavy Armor',
  'all armor': 'All Armor',
  'all armour': 'All Armor',
  'shield': 'Shields',
  'shields': 'Shields',
}

/**
 * The languages the SRD prints, so a sheet files Sylvan under Languages even where no
 * loaded race happens to grant it, and so the editor has something to suggest. A book's
 * own language still lands here when a race grants it; anything else the player can move
 * by hand.
 */
export const STANDARD_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
  'Abyssal', 'Celestial', 'Deep Speech', 'Draconic', 'Infernal', 'Primordial',
  'Sylvan', 'Undercommon',
]

/** Wording that means "you still have to pick this" rather than naming a proficiency. */
const PLACEHOLDER = /your choice|choose|\bone type of\b|extra language|\b\d+$/i

/** Phrases, as opposed to names: a sentence gets a capital, a name gets title case. */
const PHRASE = /\s(?:of|or|and|your|the|a|an)\s/i

/** The key an entry is overridden and de-duplicated by: its wording, loosely compared. */
export function proficiencyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Words sorted, so "light crossbow" and "Crossbow, Light" are the same weapon. */
function sortedWords(name: string): string {
  return proficiencyKey(name).split(' ').sort().join(' ')
}

/**
 * The first occurrence of each entry's wording, in the order the sources were gathered.
 *
 * Character creation joins several sources onto one flat list — a class's tools, a
 * background's, a race's languages, then a subrace's own — and more than one can name the
 * same thing: a rogue with a criminal background is granted thieves' tools twice, a
 * subrace's language can repeat one the race already grants. Extracted so the join is
 * unit-testable on its own; `new.vue`'s `startingProficiencies()` is the one caller and is
 * not, since it lives in a page component.
 */
export function dedupeProficiencies(names: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const key = proficiencyKey(name)
    if (key && !byKey.has(key)) byKey.set(key, name)
  }
  return [...byKey.values()]
}

/** The names a classification can recognise, gathered from the loaded rulepacks. */
export interface ProficiencyVocabulary {
  weapons: Set<string>
  armor: Set<string>
  languages: Set<string>
}

export function proficiencyVocabulary(input: {
  weapons?: string[]
  armor?: string[]
  languages?: string[]
} = {}): ProficiencyVocabulary {
  return {
    weapons: new Set((input.weapons ?? []).map(sortedWords)),
    armor: new Set((input.armor ?? []).map(sortedWords)),
    languages: new Set([...STANDARD_LANGUAGES, ...(input.languages ?? [])].map(proficiencyKey)),
  }
}

const NO_VOCABULARY = proficiencyVocabulary()

/**
 * Which group an entry belongs to, read off its wording.
 *
 * Order matters: a class category ("martial") is decided before anything else, and a
 * string that merely mentions a language is a language even when it names none, so the
 * half-elf's "1 extra language of your choice" sits with Common and Elvish rather than
 * in the leftovers.
 */
export function classifyProficiency(
  name: string,
  vocab: ProficiencyVocabulary = NO_VOCABULARY,
): ProficiencyGroup {
  const key = proficiencyKey(name)
  if (key in CATEGORY_LABELS) return 'weapons-armor'
  if (vocab.languages.has(key) || /\blanguages?\b/i.test(name)) return 'languages'
  const words = sortedWords(name)
  if (vocab.weapons.has(words) || vocab.armor.has(words)) return 'weapons-armor'
  return 'tools'
}

/**
 * How an entry reads on the sheet.
 *
 * Re-cased only where it came out of a data file — those are written lowercase, and a
 * name a player typed is left exactly as typed, the way `cleanEquipmentName` leaves one
 * alone. A phrase keeps its sentence shape, since title-casing "1 extra language of your
 * choice" produces something no book prints.
 */
export function proficiencyLabel(name: string): string {
  const trimmed = name.trim()
  const category = CATEGORY_LABELS[proficiencyKey(trimmed)]
  if (category) return category
  if (/[A-Z]/.test(trimmed)) return trimmed
  if (PHRASE.test(trimmed)) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return trimmed.replace(/\b[a-z]/g, c => c.toUpperCase())
}

/** Whether the entry is a prompt to pick something rather than a proficiency. */
export function isProficiencyPlaceholder(name: string): boolean {
  return PLACEHOLDER.test(name.trim())
}

/** The categories a class prints, offered by the editor beside the named weapons. */
export const WEAPON_ARMOR_CATEGORIES = [
  'Simple Weapons', 'Martial Weapons',
  'Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields',
]

export interface ProficiencyEntry {
  /** The stored string, which is what every other lookup matches against. */
  name: string
  label: string
  placeholder: boolean
}

export interface ProficiencySection {
  key: ProficiencyGroup
  label: string
  entries: ProficiencyEntry[]
}

/**
 * The list split into the sheet's sections, each in the order the character gained them
 * — a class's armour before its weapons, a race's languages in the order it prints them.
 */
export function groupProficiencies(
  proficiencies: string[],
  overrides: Record<string, ProficiencyGroup> | undefined,
  vocab: ProficiencyVocabulary = NO_VOCABULARY,
): ProficiencySection[] {
  const sections = PROFICIENCY_GROUPS.map(g => ({ ...g, entries: [] as ProficiencyEntry[] }))
  for (const name of proficiencies) {
    if (typeof name !== 'string' || !name.trim()) continue
    const group = overrides?.[proficiencyKey(name)] ?? classifyProficiency(name, vocab)
    const section = sections.find(s => s.key === group) ?? sections[sections.length - 1]!
    section.entries.push({
      name,
      label: proficiencyLabel(name),
      placeholder: isProficiencyPlaceholder(name),
    })
  }
  return sections
}
