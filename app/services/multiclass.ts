import type { AbilityKey, AbilityScores, Character, ClassEntry, HitDicePool } from '~/types/character'
import type { ClassDefinition, Race, Rulepack, Subrace } from '~/types/rulepack'

export interface UnmetRequirement {
  ability: AbilityKey
  minimum: number
  actual: number
}

export interface MulticlassEligibility {
  /** False when at least one prerequisite is unmet. Advisory: the UI warns, it does not block. */
  eligible: boolean
  /** Every minimum the character falls short of, for explaining why. */
  unmet: UnmetRequirement[]
  /** Set when the class declares no multiclassing rules at all. */
  noRules?: boolean
}

const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

/**
 * Check a class's multiclass ability minimums against a set of scores.
 *
 * Two kinds coexist: `prerequisites` must all be met (monk needs DEX 13 *and* WIS 13),
 * while `prerequisiteOptions` needs any `choose` of its entries (fighter needs STR 13
 * *or* DEX 13). A class with no rules is reported via `noRules` rather than as ineligible,
 * so callers can distinguish "not allowed to multiclass" from "scores too low".
 */
export function checkMulticlassEligibility(
  classDef: ClassDefinition,
  scores: AbilityScores,
): MulticlassEligibility {
  const rules = classDef.multiclassing
  if (!rules) return { eligible: false, unmet: [], noRules: true }

  const unmet: UnmetRequirement[] = []

  for (const [ability, minimum] of Object.entries(rules.prerequisites ?? {})) {
    const key = ability as AbilityKey
    const actual = scores[key]
    if (minimum !== undefined && actual < minimum) unmet.push({ ability: key, minimum, actual })
  }

  const options = rules.prerequisiteOptions
  if (options) {
    const satisfied = options.from.filter(o => scores[o.ability] >= o.minimum)
    if (satisfied.length < options.choose) {
      // Report every option, since any one of them would do and the player needs to see all
      for (const o of options.from) {
        unmet.push({ ability: o.ability, minimum: o.minimum, actual: scores[o.ability] })
      }
    }
  }

  return { eligible: unmet.length === 0, unmet }
}

/** Human-readable prerequisite line, e.g. "Dexterity 13 and Wisdom 13" or "Strength 13 or Dexterity 13". */
export function describeMulticlassPrerequisites(classDef: ClassDefinition): string {
  const rules = classDef.multiclassing
  if (!rules) return 'Cannot be multiclassed into'

  const all = Object.entries(rules.prerequisites ?? {})
    .map(([a, m]) => `${ABILITY_LABEL[a as AbilityKey]} ${m}`)
  const any = (rules.prerequisiteOptions?.from ?? [])
    .map(o => `${ABILITY_LABEL[o.ability]} ${o.minimum}`)

  const parts: string[] = []
  if (all.length > 0) parts.push(all.join(' and '))
  if (any.length > 0) parts.push(any.join(' or '))
  return parts.join(', ') || 'No requirements'
}

/**
 * Classes the character could take a level in, each with its eligibility.
 *
 * Classes already on the character are excluded — levelling those is the ordinary path.
 * Classes without multiclassing rules are excluded entirely, since the rulepack is saying
 * they may not be multiclassed into.
 */
export function multiclassOptions(
  character: Pick<Character, 'classes' | 'abilityScores' | 'abilityScoreOverrides'>,
  rulepack: Rulepack,
): Array<{ classDef: ClassDefinition; eligibility: MulticlassEligibility }> {
  const held = new Set(character.classes.map(c => c.classId))
  const scores = effectiveScores(character)
  return rulepack.classes
    .filter(c => !held.has(c.id) && c.multiclassing)
    .map(classDef => ({ classDef, eligibility: checkMulticlassEligibility(classDef, scores) }))
    .sort((a, b) => a.classDef.name.localeCompare(b.classDef.name))
}

/** Ability scores with manual overrides applied, which is what prerequisites are judged on. */
export function effectiveScores(
  character: Pick<Character, 'abilityScores' | 'abilityScoreOverrides'>,
): AbilityScores {
  return { ...character.abilityScores, ...character.abilityScoreOverrides }
}

/**
 * The ability bonuses a race and subrace together grant, and the distributable ones
 * still to be assigned.
 *
 * A subrace normally adds to its race — a mountain dwarf's +2 Strength on top of the
 * dwarf's +2 Constitution. One that sets `replacesRaceAbilityBonuses` restates the whole
 * line instead, and the race's contributes nothing: a Draconblood dragonborn is INT +2
 * and CHA +1, not that plus the dragonborn's STR +2.
 */
export function raceAbilityBonuses(
  race: Pick<Race, 'abilityScoreBonuses' | 'abilityScoreChoice'> | undefined,
  subrace: Pick<Subrace, 'abilityScoreBonuses' | 'abilityScoreChoice' | 'replacesRaceAbilityBonuses'> | undefined,
): { bonuses: Partial<Record<AbilityKey, number>>; choice?: Race['abilityScoreChoice'] } {
  const replaces = subrace?.replacesRaceAbilityBonuses === true
  const bonuses: Partial<Record<AbilityKey, number>> = {}
  for (const source of replaces ? [subrace] : [race, subrace]) {
    for (const [k, v] of Object.entries(source?.abilityScoreBonuses ?? {})) {
      const key = k as AbilityKey
      bonuses[key] = (bonuses[key] ?? 0) + (v ?? 0)
    }
  }
  return {
    bonuses,
    choice: replaces
      ? subrace?.abilityScoreChoice
      : subrace?.abilityScoreChoice ?? race?.abilityScoreChoice,
  }
}

/**
 * Add a level to a class's hit dice pool, creating the pool when the class is new.
 *
 * `remaining` increases with `total` so a fresh level arrives spendable, matching how the
 * single-pool version behaved.
 */
export function addHitDieForClass(
  pools: HitDicePool[],
  classId: string,
  die: string,
): HitDicePool[] {
  const existing = pools.find(p => p.classId === classId)
  if (!existing) return [...pools, { classId, die, total: 1, remaining: 1 }]
  return pools.map(p =>
    p.classId === classId
      ? { ...p, die, total: p.total + 1, remaining: Math.min(p.remaining + 1, p.total + 1) }
      : p)
}

/**
 * The class list as it will be once `classId` sits at `level` — appending the entry when
 * the character does not have that class yet.
 *
 * A brand-new class has no entry to `map()` over, so anything asking "what will this class
 * be able to do at the level being gained?" has to be handed the projected list rather than
 * the stored one. The level-up wizard needs it before the level is applied, to work out
 * which spells the class may learn.
 */
export function projectClassLevel(
  classes: ClassEntry[],
  classId: string,
  level: number,
): ClassEntry[] {
  if (classes.some(c => c.classId === classId)) {
    return classes.map(c => (c.classId === classId ? { ...c, level } : c))
  }
  return [...classes, { classId, level }]
}

/** Total hit dice across every class, for features that scale on it. */
export function totalHitDice(pools: HitDicePool[]): number {
  return pools.reduce((sum, p) => sum + p.total, 0)
}

/**
 * Proficiencies a class grants when taken as an additional class. The SRD grants a reduced
 * set, and never saving throws — those come only from the class taken at level 1.
 */
export function multiclassProficiencies(classDef: ClassDefinition): string[] {
  const rules = classDef.multiclassing
  if (!rules) return []
  return [
    ...(rules.armorProficiencies ?? []),
    ...(rules.weaponProficiencies ?? []),
    ...(rules.toolProficiencies ?? []),
  ]
}
