import type { AbilityKey, Character, InitiativeBonuses } from '~/types/character'
import { sumBonusSet } from '~/services/attacks'

/**
 * Initiative, derived the way carrying capacity is.
 *
 * The roll is Dexterity for almost everyone, and the exceptions are all features that say
 * so in one sentence: a Chronurgy wizard's Temporal Awareness adds Intelligence, a Gloom
 * Stalker's Dread Ambusher adds Wisdom, a Swashbuckler's Rakish Audacity adds Charisma,
 * a harengon adds its proficiency bonus, the Alert feat adds a flat +5. Matching what the
 * feature *says* means a subclass out of a book this app has never read works without a
 * code change, where a list of feature names would only ever know the ones written into
 * it.
 *
 * A wording sniff is a guess, which is why `character.initiative` still overrides the
 * lot — the same "null = derive it" idiom as `armorClass`. Between the two sit the three
 * bonus slots an attack and an armour class already keep: a headband of intellect, a
 * feat, and whatever the table ruled tonight.
 */

/** Display order for the editor, mirroring an attack's and an armour class's slots. */
export const INITIATIVE_BONUS_KINDS = ['magic', 'feat', 'misc'] as const

export type InitiativeBonusKind = (typeof INITIATIVE_BONUS_KINDS)[number]

export const INITIATIVE_BONUS_LABELS: Record<InitiativeBonusKind, { label: string; hint: string }> = {
  magic: { label: 'Magic', hint: 'A cloak of elvenkind, a potion of speed' },
  feat: { label: 'Feat', hint: 'Anything a feat adds that the feat text does not spell out' },
  misc: { label: 'Misc', hint: 'Anything else, including a penalty' },
}

/** What the sum needs off the sheet, so this file stays free of the composable. */
export interface InitiativeContext {
  modifiers: Record<AbilityKey, number>
  proficiencyBonus: number
}

/** One line of the sum, as the sheet prints it. */
export interface InitiativePart {
  label: string
  value: number
}

export interface InitiativeBreakdown {
  total: number
  parts: InitiativePart[]
  /** True where `character.initiative` supplied the total and nothing was derived. */
  manual: boolean
}

const ABILITY_WORDS: Record<string, { key: AbilityKey; label: string }> = {
  strength: { key: 'str', label: 'Strength' },
  dexterity: { key: 'dex', label: 'Dexterity' },
  constitution: { key: 'con', label: 'Constitution' },
  intelligence: { key: 'int', label: 'Intelligence' },
  wisdom: { key: 'wis', label: 'Wisdom' },
  charisma: { key: 'cha', label: 'Charisma' },
}

const MENTIONS_INITIATIVE = /\binitiative\b/i
const ADDS_ABILITY = /add(?:ing)?\s+your\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+modifier/i
const ADDS_PROFICIENCY = /add(?:ing)?\s+your\s+proficiency\s+bonus/i
/** Half a proficiency bonus is Jack of All Trades, which is not an initiative feature. */
const HALF_PROFICIENCY = /half\s+your\s+proficiency/i
const FLAT_BONUS = /([+-]\s*\d+)\s+bonus\s+to\s+(?:your\s+)?initiative/i

/**
 * The one sentence that carries the rule, rather than the whole feature.
 *
 * A subclass blurb runs to paragraphs, and "you add your Intelligence modifier" somewhere
 * in it has nothing to do with the word "initiative" three sentences later. Requiring
 * both in the same sentence is what keeps the sniff honest.
 */
function sentences(text: string): string[] {
  return String(text ?? '').split(/[.!?]\s+|\n+/)
}

function initiativePart(
  name: string,
  description: string,
  ctx: InitiativeContext,
): InitiativePart | undefined {
  for (const sentence of sentences(`${name}. ${description}`)) {
    if (!MENTIONS_INITIATIVE.test(sentence)) continue

    const flat = FLAT_BONUS.exec(sentence)
    if (flat?.[1]) {
      const value = Number(flat[1].replace(/\s+/g, ''))
      if (Number.isFinite(value) && value !== 0) return { label: name, value }
    }

    const ability = ADDS_ABILITY.exec(sentence)
    if (ability?.[1]) {
      const found = ABILITY_WORDS[ability[1].toLowerCase()]
      // Dexterity is already the base; a feature restating it adds nothing.
      if (found && found.key !== 'dex') {
        return { label: `${name} (${found.label})`, value: ctx.modifiers[found.key] ?? 0 }
      }
      return undefined
    }

    if (ADDS_PROFICIENCY.test(sentence) && !HALF_PROFICIENCY.test(sentence)) {
      return { label: `${name} (proficiency)`, value: ctx.proficiencyBonus }
    }
  }
  return undefined
}

/** The features that move the roll, in the order the sheet stores them. */
export function initiativeParts(character: Character, ctx: InitiativeContext): InitiativePart[] {
  const parts: InitiativePart[] = []
  // By name, not by id: the same feature reaching the list twice — a backfill meeting a
  // level-up that already granted it — must not double the modifier.
  const seen = new Set<string>()
  for (const feature of character.features ?? []) {
    const name = feature?.name ?? ''
    if (seen.has(name)) continue
    const part = initiativePart(name, feature?.description ?? '', ctx)
    if (!part) continue
    seen.add(name)
    parts.push(part)
  }
  return parts
}

export function initiativeBreakdown(
  character: Character | null,
  ctx: InitiativeContext,
): InitiativeBreakdown {
  const dex = ctx.modifiers.dex ?? 0
  if (!character) return { total: dex, parts: [{ label: 'Dexterity', value: dex }], manual: false }

  if (character.initiative !== null && character.initiative !== undefined) {
    return { total: character.initiative, parts: [], manual: true }
  }

  const parts = [
    { label: 'Dexterity', value: dex },
    ...initiativeParts(character, ctx),
    ...bonusParts(character.initiativeBonuses),
  ]
  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts, manual: false }
}

/** The hand-entered slots, listed one per line so the sheet shows where each came from. */
function bonusParts(bonuses?: InitiativeBonuses): InitiativePart[] {
  return INITIATIVE_BONUS_KINDS
    .filter(kind => (bonuses?.[kind] ?? 0) !== 0)
    .map(kind => ({ label: INITIATIVE_BONUS_LABELS[kind].label, value: bonuses![kind]! }))
}

/** The slots alone, for anything that wants the number without the working. */
export function initiativeBonusTotal(character: Character): number {
  return sumBonusSet(character.initiativeBonuses)
}
