import type {
  AbilityKey,
  Character,
  SavingThrowAbilityBonus,
  SavingThrowBonuses,
} from '~/types/character'
import { sumBonusSet } from '~/services/attacks'

/**
 * A saving throw, derived the way initiative is.
 *
 * The roll is the ability modifier plus the proficiency bonus where the class grants it,
 * and then everything else a sheet has to account for. That "everything else" is found by
 * wording rather than by a list of feature names: a paladin's Aura of Protection says the
 * creature "gains a bonus to the saving throw equal to your Charisma modifier (with a
 * minimum bonus of +1)", and matching the sentence means a book this app has never read
 * gets the same treatment without a code change.
 *
 * A wording sniff is a guess, so `character.savingThrowAbilityBonus` overrides that one
 * reading — the `carryingCapacityMultiplier` idiom, down to `'none'` meaning "off" the
 * way an attack's `damageAbility` does. Underneath sit the three bonus slots an attack,
 * an armour class and an initiative roll already keep apart, for the cloak and the ruling
 * no rulepack models.
 *
 * There is deliberately one set of slots rather than six. Nearly everything that adds a
 * number to a save adds it to all of them, and six sets would mean entering a cloak of
 * protection six times over to get one +1.
 */

/** Display order for the editor, mirroring an attack's and an initiative roll's slots. */
export const SAVING_THROW_BONUS_KINDS = ['magic', 'feat', 'misc'] as const

export type SavingThrowBonusKind = (typeof SAVING_THROW_BONUS_KINDS)[number]

export const SAVING_THROW_BONUS_LABELS: Record<
  SavingThrowBonusKind,
  { label: string; hint: string }
> = {
  magic: { label: 'Magic', hint: 'A cloak of protection, a stone of good luck' },
  feat: { label: 'Feat', hint: 'Anything a feat adds that the feat text does not spell out' },
  misc: { label: 'Misc', hint: 'Anything else, including a penalty' },
}

/** What the sum needs off the sheet, so this file stays free of the composable. */
export interface SavingThrowContext {
  modifiers: Record<AbilityKey, number>
  proficiencyBonus: number
}

/** One line of the sum, as the modal prints it. */
export interface SavingThrowPart {
  label: string
  value: number
}

export interface SavingThrowBreakdown {
  total: number
  parts: SavingThrowPart[]
}

const ABILITY_WORDS: Record<string, { key: AbilityKey; label: string }> = {
  strength: { key: 'str', label: 'Strength' },
  dexterity: { key: 'dex', label: 'Dexterity' },
  constitution: { key: 'con', label: 'Constitution' },
  intelligence: { key: 'int', label: 'Intelligence' },
  wisdom: { key: 'wis', label: 'Wisdom' },
  charisma: { key: 'cha', label: 'Charisma' },
}

export const SAVING_THROW_ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const ABILITY_NAMES = Object.keys(ABILITY_WORDS).join('|')
/** Whatever sits between "bonus to" and the roll itself. */
const ARTICLES = '(?:the|a|an|your|its|their|all|that|each)'

const MENTIONS_SAVE = /\bsaving throws?\b/i
/**
 * Aura of Protection and anything worded like it. The ability has to follow the roll
 * inside one sentence, which is what keeps Careful Spell — "up to your Charisma modifier"
 * in one sentence, "succeeds on its saving throw" in the next — out of the sum.
 */
const ABILITY_BONUS = new RegExp(
  `bonus to (?:${ARTICLES}\\s+)*(?:(${ABILITY_NAMES})\\s+)?saving throws?`
  + `\\s+equal to your\\s+(${ABILITY_NAMES})\\s+modifier`,
  'i',
)
const MINIMUM_BONUS = /minimum (?:bonus )?of\s*\+?(\d+)/i
/** A flat "+1 bonus to saving throws", optionally singling out one ability. */
const FLAT_BONUS = new RegExp(
  `([+-]\\s*\\d+)\\s+bonus to (?:${ARTICLES}\\s+)*(?:(${ABILITY_NAMES})\\s+)?saving throws?`,
  'i',
)

/**
 * The one sentence that carries the rule, rather than the whole feature — the same reason
 * initiative splits: a paragraph mentioning Charisma somewhere and a saving throw three
 * sentences later is not a bonus to the roll.
 */
function sentences(text: string): string[] {
  return String(text ?? '').split(/[.!?]\s+|\n+/)
}

/** A derived part, plus what the breakdown needs to know about where it came from. */
export interface DerivedSavingThrowPart extends SavingThrowPart {
  /** Set where the feature singles out one ability; absent means every save. */
  ability?: AbilityKey
  /** True for an Aura of Protection reading, which a hand-set bonus replaces. */
  fromAbilityModifier?: boolean
}

function derivedPart(
  name: string,
  description: string,
  ctx: SavingThrowContext,
): DerivedSavingThrowPart | undefined {
  for (const sentence of sentences(`${name}. ${description}`)) {
    if (!MENTIONS_SAVE.test(sentence)) continue

    const aura = ABILITY_BONUS.exec(sentence)
    if (aura?.[2]) {
      const found = ABILITY_WORDS[aura[2].toLowerCase()]
      if (found) {
        const scope = aura[1] ? ABILITY_WORDS[aura[1].toLowerCase()]?.key : undefined
        const minimum = Number(MINIMUM_BONUS.exec(sentence)?.[1] ?? 0)
        return {
          label: `${name} (${found.label})`,
          value: Math.max(ctx.modifiers[found.key] ?? 0, minimum),
          ability: scope,
          fromAbilityModifier: true,
        }
      }
    }

    const flat = FLAT_BONUS.exec(sentence)
    if (flat?.[1]) {
      const value = Number(flat[1].replace(/\s+/g, ''))
      if (Number.isFinite(value) && value !== 0) {
        const scope = flat[2] ? ABILITY_WORDS[flat[2].toLowerCase()]?.key : undefined
        return { label: name, value, ability: scope }
      }
    }
  }
  return undefined
}

/** The features that move a save, in the order the sheet stores them. */
export function savingThrowParts(
  character: Character,
  ctx: SavingThrowContext,
): DerivedSavingThrowPart[] {
  const parts: DerivedSavingThrowPart[] = []
  // By name, not by id: the same feature reaching the list twice — a backfill meeting a
  // level-up that already granted it — must not double the bonus.
  const seen = new Set<string>()
  for (const feature of character.features ?? []) {
    const name = feature?.name ?? ''
    if (seen.has(name)) continue
    const part = derivedPart(name, feature?.description ?? '', ctx)
    if (!part) continue
    seen.add(name)
    parts.push(part)
  }
  return parts
}

/** The hand-set ability bonus, as a part, or undefined where it is switched off. */
function manualAbilityPart(
  setting: SavingThrowAbilityBonus,
  ctx: SavingThrowContext,
): SavingThrowPart | undefined {
  if (setting.ability === 'none') return undefined
  const value = Math.max(ctx.modifiers[setting.ability] ?? 0, setting.minimum ?? 0)
  if (value === 0) return undefined
  return { label: `${SAVING_THROW_ABILITY_LABELS[setting.ability]} modifier`, value }
}

/** The hand-entered slots, one per line so the modal shows where each came from. */
function bonusParts(bonuses?: SavingThrowBonuses): SavingThrowPart[] {
  return SAVING_THROW_BONUS_KINDS
    .filter(kind => (bonuses?.[kind] ?? 0) !== 0)
    .map(kind => ({ label: SAVING_THROW_BONUS_LABELS[kind].label, value: bonuses![kind]! }))
}

/**
 * One save, shown working: the ability, proficiency where the class grants it, whatever
 * the features say, and the three slots.
 */
export function savingThrowBreakdown(
  character: Character | null,
  ability: AbilityKey,
  ctx: SavingThrowContext,
): SavingThrowBreakdown {
  const mod = ctx.modifiers[ability] ?? 0
  const label = SAVING_THROW_ABILITY_LABELS[ability]
  if (!character) return { total: mod, parts: [{ label, value: mod }] }

  const parts: SavingThrowPart[] = [{ label, value: mod }]

  if ((character.savingThrowProficiencies ?? []).includes(ability)) {
    parts.push({ label: 'Proficiency', value: ctx.proficiencyBonus })
  }

  // A hand-set ability bonus replaces what the features were read as saying rather than
  // stacking with it: the two are answering the same question.
  const setting = character.savingThrowAbilityBonus
  for (const part of savingThrowParts(character, ctx)) {
    if (part.ability && part.ability !== ability) continue
    if (setting && part.fromAbilityModifier) continue
    parts.push({ label: part.label, value: part.value })
  }
  const manual = setting ? manualAbilityPart(setting, ctx) : undefined
  if (manual) parts.push(manual)

  parts.push(...bonusParts(character.savingThrowBonuses))

  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts }
}

/** Every save at once, which is what the sheet's six rows want. */
export function savingThrowTotals(
  character: Character | null,
  ctx: SavingThrowContext,
): Record<AbilityKey, number> {
  const out = {} as Record<AbilityKey, number>
  for (const ability of Object.keys(SAVING_THROW_ABILITY_LABELS) as AbilityKey[]) {
    out[ability] = savingThrowBreakdown(character, ability, ctx).total
  }
  return out
}

/** The slots alone, for anything that wants the number without the working. */
export function savingThrowBonusTotal(character: Character): number {
  return sumBonusSet(character.savingThrowBonuses)
}
