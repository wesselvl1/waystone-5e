import type {
  AbilityKey,
  ArmorClassBonuses,
  ArmorClassConfig,
  Character,
} from '~/types/character'
import type { ArmorDefinition } from '~/types/rulepack'
import { sumBonusSet } from '~/services/attacks'

/**
 * Armour class, derived the way an attack roll is.
 *
 * The base number, the Dexterity it admits, a second ability, the shield and three bonus
 * slots are all kept apart rather than folded into one total, so a player can change the
 * armour without re-deriving the ring of protection — and so the sheet can show its
 * working, which is the whole point of a calculator over a number box.
 *
 * Deliberately outside the scope of this file: anything switched on and off mid-fight.
 * Shield, Blade Song, Haste and a barkskin all move the number for a minute at a time,
 * and a stored configuration is the wrong place for them — the sheet's AC is what the
 * character walks around with.
 */

/** Display order and labels for the bonus editor, mirroring an attack's three slots. */
export const AC_BONUS_KINDS = ['magic', 'feat', 'misc'] as const

export type AcBonusKind = (typeof AC_BONUS_KINDS)[number]

export const AC_BONUS_LABELS: Record<AcBonusKind, { label: string; hint: string }> = {
  magic: { label: 'Magic', hint: 'A ring or cloak of protection, an enchanted armour' },
  feat: { label: 'Feat', hint: 'The Defense fighting style, Dual Wielder' },
  misc: { label: 'Misc', hint: 'Anything else, including a penalty' },
}

/** What the maths needs off the character, so this file stays free of the sheet. */
export interface ArmorClassContext {
  modifiers: Record<AbilityKey, number>
}

/** One line of the sum, as the calculator prints it. */
export interface ArmorClassPart {
  label: string
  value: number
  /** Set where a number was clipped, e.g. a +3 Dexterity capped to +2 by medium armour. */
  note?: string
}

export interface ArmorClassBreakdown {
  total: number
  parts: ArmorClassPart[]
  /** Consequences of the choice that are not arithmetic: Stealth, a Strength shortfall. */
  warnings: string[]
}

/** Plain unarmored: what a character with no configuration has always been shown. */
export function defaultArmorClassConfig(): ArmorClassConfig {
  return {
    armorId: 'unarmored',
    armorName: 'Unarmored',
    baseValue: 10,
    dexCap: null,
  }
}

/** True when the base leaves room for a shield — a monk's Unarmored Defense does not. */
export function shieldAllowed(config: ArmorClassConfig): boolean {
  return config.shieldAllowed !== false
}

/** The shield's contribution, which is nothing unless it is both allowed and held. */
export function shieldValue(config: ArmorClassConfig): number {
  if (!shieldAllowed(config) || !config.shield?.equipped) return 0
  return config.shield.bonus
}

/** The Dexterity actually admitted, after the armour's cap. */
export function cappedDex(config: ArmorClassConfig, modifiers: Record<AbilityKey, number>): number {
  const dex = modifiers.dex ?? 0
  return config.dexCap === null || config.dexCap === undefined ? dex : Math.min(dex, config.dexCap)
}

/**
 * The sum and its parts.
 *
 * Zero-valued parts are kept in the list: a heavy-armour wearer needs to see "Dex +0
 * (max +0)" to understand why their 18 Dexterity is doing nothing, where a missing line
 * would just look like an omission. Bonus slots left at zero are dropped, since an empty
 * slot is genuinely nothing rather than a clipped something.
 */
export function armorClassBreakdown(
  config: ArmorClassConfig,
  ctx: ArmorClassContext,
): ArmorClassBreakdown {
  const parts: ArmorClassPart[] = []
  const warnings: string[] = []

  parts.push({ label: config.armorName || 'Base', value: config.baseValue })

  const dex = cappedDex(config, ctx.modifiers)
  const rawDex = ctx.modifiers.dex ?? 0
  parts.push({
    label: 'Dex',
    value: dex,
    note: dex !== rawDex ? `${formatSigned(rawDex)} capped at ${formatSigned(config.dexCap ?? 0)}` : undefined,
  })

  if (config.extraAbility) {
    parts.push({
      label: ABILITY_NAMES[config.extraAbility],
      value: ctx.modifiers[config.extraAbility] ?? 0,
    })
  }

  if (config.shield?.equipped) {
    if (shieldAllowed(config)) {
      parts.push({ label: config.shield.name || 'Shield', value: config.shield.bonus })
    }
    else {
      warnings.push(`${config.armorName} applies only while you wield no shield, so the shield is not counted.`)
    }
  }

  for (const kind of AC_BONUS_KINDS) {
    const value = config.bonuses?.[kind] ?? 0
    if (value !== 0) parts.push({ label: AC_BONUS_LABELS[kind].label, value })
  }

  return {
    total: parts.reduce((sum, part) => sum + part.value, 0),
    parts,
    warnings,
  }
}

/** The number alone. */
export function armorClassTotal(config: ArmorClassConfig, ctx: ArmorClassContext): number {
  return config.baseValue
    + cappedDex(config, ctx.modifiers)
    + (config.extraAbility ? ctx.modifiers[config.extraAbility] ?? 0 : 0)
    + shieldValue(config)
    + sumBonusSet(config.bonuses)
}

/**
 * A character's armour class: the hand-entered override if there is one, otherwise the
 * configuration, otherwise plain unarmored.
 *
 * The override is the same escape hatch an attack's `bonus` is, and predates the
 * calculator — a sheet transcribed from paper says 16 and owes nobody an explanation.
 */
export function characterArmorClass(
  character: Pick<Character, 'armorClass' | 'armorClassConfig'>,
  ctx: ArmorClassContext,
): number {
  if (character.armorClass !== null && character.armorClass !== undefined) return character.armorClass
  return armorClassTotal(character.armorClassConfig ?? defaultArmorClassConfig(), ctx)
}

/**
 * Build a configuration from a rulepack armour entry, keeping the parts of the old one
 * that are not the armour: the shield stays on the arm and the ring stays on the finger
 * when a character changes into plate.
 */
export function configFromArmor(
  armor: ArmorDefinition,
  previous?: ArmorClassConfig,
): ArmorClassConfig {
  return {
    armorId: armor.id,
    armorName: armor.name,
    baseValue: armor.baseAC,
    dexCap: armor.maxDexBonus ?? null,
    extraAbility: armor.extraAbility,
    shieldAllowed: armor.shieldAllowed === false ? false : undefined,
    shield: previous?.shield,
    bonuses: previous?.bonuses,
  }
}

/**
 * What the AC would come to with this armour on, for the picker's per-row preview.
 *
 * Computed through the same configuration the pick would produce, so the number in the
 * list is the number the sheet shows afterwards — including the shield being dropped by
 * an entry that forbids one.
 */
export function previewArmorClass(
  armor: ArmorDefinition,
  previous: ArmorClassConfig | undefined,
  ctx: ArmorClassContext,
): number {
  return armorClassTotal(configFromArmor(armor, previous), ctx)
}

/**
 * Whether the character's proficiency list covers this armour.
 *
 * Proficiencies are stored as the strings a class prints — "light armor", "shields",
 * "all armor" — so a category match is what there is to go on. Compared loosely, since
 * "medium armour" and "Medium Armor" are the same proficiency.
 */
export function isProficientWithArmor(
  armor: Pick<ArmorDefinition, 'category'>,
  proficiencies: string[],
): boolean {
  if (armor.category === 'unarmored') return true
  const normalized = proficiencies.map(p => p.toLowerCase().replace(/[^a-z]+/g, ' ').trim())
  return normalized.some((p) => {
    if (p === 'all armor' || p === 'all armour') return true
    if (armor.category === 'shield') return p === 'shield' || p === 'shields'
    return p === armor.category
      || p === `${armor.category} armor`
      || p === `${armor.category} armour`
  })
}

/**
 * The non-arithmetic consequences of what is worn: the Stealth penalty, and the ten feet
 * of speed lost to armour heavier than the wearer's Strength. Separate from the
 * breakdown's warnings because these follow from the armour rather than the sum, and the
 * picker wants them before a choice is made.
 */
export function armorWarnings(
  armor: ArmorDefinition,
  scores: Record<AbilityKey, number>,
): string[] {
  const warnings: string[] = []
  if (armor.strengthRequirement && (scores.str ?? 10) < armor.strengthRequirement) {
    warnings.push(`Strength ${armor.strengthRequirement} required — your speed drops by 10 feet.`)
  }
  if (armor.stealthDisadvantage) warnings.push('Disadvantage on Stealth checks.')
  return warnings
}

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
}

/**
 * Drop the zeroes before storing, so an untouched editor does not persist
 * `{ magic: 0, feat: 0, misc: 0 }` and make an ordinary breastplate look configured.
 */
export function compactAcBonuses(bonuses?: ArmorClassBonuses): ArmorClassBonuses | undefined {
  const out: ArmorClassBonuses = {}
  for (const kind of AC_BONUS_KINDS) {
    const value = bonuses?.[kind] ?? 0
    if (value !== 0) out[kind] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}
