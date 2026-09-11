import type {
  AbilityKey,
  AttackAbility,
  AttackBonusSet,
  AttackEntry,
  Character,
} from '~/types/character'
import type { WeaponDefinition } from '~/types/rulepack'

/**
 * The kinds of bonus an attack carries, in the order the editor lists them.
 *
 * Three named slots rather than one total, because they change independently: the +1 goes
 * away when the weapon is sold, the fighting style when it is retrained, and the last one
 * is whatever the table ruled this session. A single number would force the player to
 * re-derive the other two every time one of them moved.
 */
export const ATTACK_BONUS_KINDS = ['magic', 'feat', 'misc'] as const

export type AttackBonusKind = (typeof ATTACK_BONUS_KINDS)[number]

export const ATTACK_BONUS_LABELS: Record<AttackBonusKind, string> = {
  magic: 'Magic',
  feat: 'Feat',
  misc: 'Misc',
}

/** What the maths needs off the character, so this file stays free of the sheet. */
export interface AttackContext {
  modifiers: Record<AbilityKey, number>
  proficiencyBonus: number
}

export function sumBonusSet(bonuses?: AttackBonusSet): number {
  if (!bonuses) return 0
  return ATTACK_BONUS_KINDS.reduce((sum, kind) => sum + (bonuses[kind] ?? 0), 0)
}

/** True when a bonus set has something in it — the sheet only lists non-zero parts. */
export function hasBonuses(bonuses?: AttackBonusSet): boolean {
  return ATTACK_BONUS_KINDS.some(kind => (bonuses?.[kind] ?? 0) !== 0)
}

/**
 * Drop the zeroes before storing. Every field the editor shows is bound to a number, so
 * an untouched form would otherwise persist `{ magic: 0, feat: 0, misc: 0 }` on every
 * attack and make an unadorned dagger look configured.
 */
export function compactBonusSet(bonuses?: AttackBonusSet): AttackBonusSet | undefined {
  if (!hasBonuses(bonuses)) return undefined
  const out: AttackBonusSet = {}
  for (const kind of ATTACK_BONUS_KINDS) {
    const value = bonuses?.[kind] ?? 0
    if (value !== 0) out[kind] = value
  }
  return out
}

function abilityValue(ability: AttackAbility | undefined, ctx: AttackContext): number {
  if (!ability || ability === 'none') return 0
  return ctx.modifiers[ability] ?? 0
}

/**
 * The number rolled with the d20.
 *
 * A hand-entered `bonus` wins outright: it is the escape hatch for a character whose
 * sheet says +9 for reasons no rulepack models. Everything else is ability + proficiency
 * + the three bonus slots.
 */
export function attackBonus(attack: AttackEntry, ctx: AttackContext): number {
  if (attack.bonus !== null && attack.bonus !== undefined) return attack.bonus
  return abilityValue(attack.ability, ctx)
    + (attack.proficient ? ctx.proficiencyBonus : 0)
    + sumBonusSet(attack.attackBonuses)
}

/** The flat number added to the damage roll, separate from the dice. */
export function damageBonus(attack: AttackEntry, ctx: AttackContext): number {
  return abilityValue(attack.damageAbility, ctx) + sumBonusSet(attack.damageBonuses)
}

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/**
 * The damage as the sheet prints it: "1d8 + 5", "2d6", "1d4 - 1", or "—" for a net.
 *
 * The dice and the modifier are kept apart in storage so the modifier can follow a
 * changed Strength score, and only joined here.
 */
export function formatDamage(attack: AttackEntry, ctx: AttackContext): string {
  const dice = attack.damageDice.trim()
  const mod = damageBonus(attack, ctx)
  if (!dice) return mod === 0 ? '—' : formatSigned(mod)
  if (mod === 0) return dice
  return `${dice} ${mod >= 0 ? '+' : '−'} ${Math.abs(mod)}`
}

/**
 * The ability a weapon would normally be attacked with.
 *
 * Ranged weapons use Dexterity, finesse weapons whichever of Strength and Dexterity is
 * higher — the choice the rules give the player, made the way they would make it. A
 * thrown melee weapon still defaults to Strength, because that is what throwing a javelin
 * uses; the editor lets them say otherwise.
 */
export function defaultAbilityForWeapon(
  weapon: Pick<WeaponDefinition, 'rangeType' | 'properties'>,
  modifiers: Record<AbilityKey, number>,
): AbilityKey {
  const properties = weapon.properties ?? []
  if (properties.includes('finesse')) {
    return modifiers.dex > modifiers.str ? 'dex' : 'str'
  }
  return weapon.rangeType === 'ranged' ? 'dex' : 'str'
}

/**
 * Whether the character's proficiency list covers this weapon.
 *
 * Proficiencies are stored as the strings the class prints — "simple", "martial",
 * "longsword" — so a category match and a name match are both real. Compared loosely:
 * the SRD writes "hand crossbow" where the equipment table says "Crossbow, Hand".
 */
export function isProficientWithWeapon(
  weapon: Pick<WeaponDefinition, 'name' | 'category'>,
  proficiencies: string[],
): boolean {
  const normalized = proficiencies.map(p => p.toLowerCase().replace(/[^a-z]+/g, ' ').trim())
  const words = weapon.name.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').sort().join(' ')
  return normalized.some((p) => {
    if (p === weapon.category || p === `${weapon.category} weapons`) return true
    return p.split(' ').sort().join(' ') === words
  })
}

/** A fresh attack built from a weapon, ready for the editor to adjust. */
export function attackFromWeapon(
  weapon: WeaponDefinition,
  character: Pick<Character, 'otherProficiencies'>,
  modifiers: Record<AbilityKey, number>,
): Omit<AttackEntry, 'id'> {
  const ability = defaultAbilityForWeapon(weapon, modifiers)
  return {
    name: weapon.name,
    bonus: null,
    ability,
    proficient: isProficientWithWeapon(weapon, character.otherProficiencies ?? []),
    damageAbility: ability,
    damageDice: weapon.damageDice,
    damageType: weapon.damageType,
    weaponId: weapon.id,
    properties: weapon.properties ? [...weapon.properties] : undefined,
    range: weapon.range,
  }
}
