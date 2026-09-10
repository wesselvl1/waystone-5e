/**
 * Reading and answering an `AbilityScoreChoice`.
 *
 * A choice offers one or more *distributions*, each a list of bonuses handed to that many
 * distinct abilities. A player's answer is the map from ability to the bonus it received,
 * which is the same shape a resolved ASI uses, so nothing downstream needs to know a
 * choice was involved.
 */
import type { AbilityKey } from '~/types/character'
import type { AbilityScoreChoice } from '~/types/rulepack'

export type AbilityPicks = Partial<Record<AbilityKey, number>>

/**
 * Add up several maps of ability bonuses.
 *
 * Spreading them instead would let a later map replace a bonus rather than add to it,
 * which matters wherever a fixed increase and a distributed one can land on the same
 * ability — the total would be understated and, since the record of the grant is what
 * says the choice was answered, the player would be asked for it again.
 */
export function sumBonuses(maps: Array<AbilityPicks | undefined>): AbilityPicks {
  const out: AbilityPicks = {}
  for (const map of maps) {
    for (const [k, v] of Object.entries(map ?? {})) {
      const key = k as AbilityKey
      out[key] = (out[key] ?? 0) + (v ?? 0)
    }
  }
  return out
}

/** Largest first, so a "+2 and +1" is spent in the order a player would expect. */
export function orderedAmounts(distribution: number[]): number[] {
  return [...distribution].sort((a, b) => b - a)
}

/**
 * Multiset comparison, not a set one: "+1 to three abilities" and "+1 to two" are
 * different answers even though both are made only of ones.
 */
function sameAmounts(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const x = [...a].sort((m, n) => m - n)
  const y = [...b].sort((m, n) => m - n)
  return x.every((v, i) => v === y[i])
}

/** The distribution `picks` spends, if it exactly spends one. */
export function matchedDistribution(
  choice: AbilityScoreChoice,
  picks: AbilityPicks,
): number[] | undefined {
  const spent = Object.entries(picks)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([, v]) => v as number)
  const inPool = Object.entries(picks)
    .filter(([, v]) => (v ?? 0) > 0)
    .every(([k]) => choice.from.includes(k as AbilityKey))
  if (!inPool) return undefined
  return choice.distributions.find(d => sameAmounts(d, spent))
}

/** Whether `picks` is a complete, legal answer to `choice`. */
export function isChoiceSatisfied(
  choice: AbilityScoreChoice | undefined,
  picks: AbilityPicks,
): boolean {
  if (!choice) return true
  return matchedDistribution(choice, picks) !== undefined
}

/**
 * Whether `picks` answers every choice in a set.
 *
 * A race and its subrace can each print one, and the answers arrive summed into a
 * single map — which cannot be attributed back to one choice or the other. So for more
 * than one choice the test is whether the picks spend exactly one distribution from
 * each, taken together. A single choice keeps the stricter check, which also verifies
 * the abilities came from that choice's own pool.
 */
export function isChoiceSetSatisfied(
  choices: AbilityScoreChoice[],
  picks: AbilityPicks,
): boolean {
  if (choices.length === 0) return true
  if (choices.length === 1) return isChoiceSatisfied(choices[0], picks)
  const spent = Object.values(picks).filter((v): v is number => (v ?? 0) > 0)
  const combos = choices.reduce<number[][]>(
    (acc, c) => acc.flatMap(a => c.distributions.map(d => [...a, ...d])),
    [[]],
  )
  return combos.some(combo => sameAmounts(combo, spent))
}

/** "+2/+1", or "+1 ×3" where every bonus is the same size. Largest first. */
export function distributionLabel(distribution: number[]): string {
  const amounts = orderedAmounts(distribution)
  const first = amounts[0] ?? 0
  if (amounts.length > 1 && amounts.every(a => a === first)) return `+${first} \u00d7${amounts.length}`
  return amounts.map(n => `+${n}`).join('/')
}

/** Every shape a choice offers, for a card that has room for one line. */
export function choiceSummary(choice: AbilityScoreChoice): string {
  return choice.distributions.map(distributionLabel).join(' or ')
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

/**
 * How to ask for a distribution in a sentence. The all-equal case keeps the wording the
 * feat picker has always used, since every feat hands out one size of bonus.
 */
export function distributionPrompt(distribution: number[]): string {
  const amounts = orderedAmounts(distribution)
  const n = amounts.length
  if (amounts.every(a => a === amounts[0])) {
    const bonus = amounts[0] ?? 0
    return n === 1
      ? `Choose an ability score to increase by +${bonus}:`
      : `Choose ${n} ability scores to increase by +${bonus} each:`
  }
  const parts = amounts.map(a => `+${a}`)
  const listed = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `Distribute ${listed} among ${COUNT_WORDS[n] ?? n} different ability scores:`
}
