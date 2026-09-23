import type { AbilityKey, Character } from '~/types/character'

/**
 * Half a proficiency bonus on the checks that carry none, derived the way initiative is.
 *
 * A bard's Jack of All Trades adds half their proficiency bonus, rounded down, to any
 * ability check that does not already include it; a Champion's Remarkable Athlete does
 * the same for Strength, Dexterity and Constitution, rounded *up*. Both print the rule in
 * one sentence, so reading the sentence gets a book this app has never seen right —
 * including the half that is scoped to three abilities and the half that rounds the other
 * way, neither of which a list of feature names would know to distinguish.
 *
 * Nothing about this is stored. It is not a proficiency level: a skill the character is
 * proficient in is untouched, which is what "that doesn't already include your
 * proficiency bonus" means, so the half can never stack with the whole. That also makes
 * it move on its own when a skill proficiency is added or a level is gained.
 *
 * A wording sniff is a guess, so `character.halfProficiencyChecks` overrides it — the
 * `carryingCapacityMultiplier` idiom: absent or null derives it, false switches a misread
 * feature off, true turns it on for all six rounded down, for the homebrew the sniff
 * cannot see.
 */

const MENTIONS_HALF_PROFICIENCY = /half\s+(?:of\s+)?your\s+proficiency\s+bonus/i
/** The roll it lands on. A half that goes to a saving throw or to damage is not this. */
const MENTIONS_CHECK = /\bchecks?\b/i
/** Remarkable Athlete rounds up where Jack of All Trades rounds down. */
const ROUNDS_UP = /round(?:ed|s)?\s+up/i

const ABILITY_WORDS: Record<string, AbilityKey> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

/** Every ability the sentence names, in the order it names them. */
const ABILITY_MENTION = /\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/gi

/** One feature that grants it, and the shape its wording gives it. */
export interface HalfProficiencySource {
  name: string
  /**
   * The abilities the sentence scopes it to. Undefined is every check — "any ability
   * check" names no ability, where Remarkable Athlete names three.
   */
  abilities?: AbilityKey[]
  roundUp: boolean
}

export interface HalfProficiency {
  /** Features it was read off. Empty where nothing grants it, or the player said so. */
  sources: HalfProficiencySource[]
  /** True where `character.halfProficiencyChecks` supplied the answer. */
  manual: boolean
}

/**
 * The one sentence that carries the rule, rather than the whole feature — the same cut
 * `initiativeParts` makes, and for the same reason.
 */
function sentences(text: string): string[] {
  return String(text ?? '').split(/[.!?]\s+|\n+/)
}

function halfProficiencySource(name: string, description: string): HalfProficiencySource | undefined {
  for (const sentence of sentences(`${name}. ${description}`)) {
    if (!MENTIONS_HALF_PROFICIENCY.test(sentence)) continue
    if (!MENTIONS_CHECK.test(sentence)) continue

    const abilities: AbilityKey[] = []
    for (const match of sentence.matchAll(ABILITY_MENTION)) {
      const key = ABILITY_WORDS[match[1]!.toLowerCase()]
      if (key && !abilities.includes(key)) abilities.push(key)
    }

    return {
      name,
      abilities: abilities.length ? abilities : undefined,
      roundUp: ROUNDS_UP.test(sentence),
    }
  }
  return undefined
}

/** What the character's features say about half a proficiency bonus on ability checks. */
export function halfProficiency(character: Character | null): HalfProficiency {
  if (!character) return { sources: [], manual: false }

  const override = character.halfProficiencyChecks
  if (typeof override === 'boolean') {
    return {
      sources: override ? [{ name: 'Half proficiency', roundUp: false }] : [],
      manual: true,
    }
  }

  const sources: HalfProficiencySource[] = []
  // By name, not by id, the way initiative counts its features: the same feature reaching
  // the list twice must not be read as two grants.
  const seen = new Set<string>()
  for (const feature of character.features ?? []) {
    const name = feature?.name ?? ''
    if (seen.has(name)) continue
    const source = halfProficiencySource(name, feature?.description ?? '')
    if (!source) continue
    seen.add(name)
    sources.push(source)
  }
  return { sources, manual: false }
}

/**
 * What it adds to an unproficient check under `ability`, and the feature that said so.
 *
 * Two features covering the same check do not stack — each is the same half of the same
 * bonus — so the better rounding wins, which is what a Champion bard would take.
 */
export function halfProficiencyBonus(
  half: HalfProficiency,
  ability: AbilityKey,
  proficiencyBonus: number,
): { value: number; source: string | null } {
  let best: { value: number; source: string | null } = { value: 0, source: null }
  for (const source of half.sources) {
    if (source.abilities && !source.abilities.includes(ability)) continue
    const value = source.roundUp
      ? Math.ceil(proficiencyBonus / 2)
      : Math.floor(proficiencyBonus / 2)
    if (value > best.value) best = { value, source: source.name }
  }
  return best
}
