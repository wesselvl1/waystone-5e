import type {
  ClassDefinition,
  OptionPoolPatch,
  Race,
  SubclassPatchEntry,
  SubracePatchEntry,
} from '~/types/rulepack'

/** Merge two arrays by id — incoming items overwrite existing ones with the same id. */
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map(item => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

/**
 * Distribute subclass patch entries into the classes they name.
 *
 * Returns the entries that found no home *in this set of classes*. Those leftovers are
 * not an error: a sourcebook fragment legitimately patches classes that live in another
 * rulepack. The caller keeps them on the pack that supplied them and resolves them across
 * all loaded packs at lookup time, so a book stays a separate, individually removable
 * rulepack instead of having to masquerade as the pack it extends.
 *
 * `classes` is mutated in place, matching how the store threads it through a merge.
 */
export function distributeSubclasses(
  classes: ClassDefinition[],
  patches: SubclassPatchEntry[],
): SubclassPatchEntry[] {
  const unresolved: SubclassPatchEntry[] = []
  for (const entry of patches) {
    const { classId, ...subclassDef } = entry
    const cls = classes.find(c => c.id === classId)
    if (cls) cls.subclasses = mergeById(cls.subclasses ?? [], [subclassDef])
    else unresolved.push(entry)
  }
  return unresolved
}

/** As distributeSubclasses, for subraces onto races. */
export function distributeSubraces(
  races: Race[],
  patches: SubracePatchEntry[],
): SubracePatchEntry[] {
  const unresolved: SubracePatchEntry[] = []
  for (const entry of patches) {
    const { raceId, ...subraceDef } = entry
    const race = races.find(r => r.id === raceId)
    if (race) race.subraces = mergeById(race.subraces ?? [], [subraceDef])
    else unresolved.push(entry)
  }
  return unresolved
}

/**
 * Merge option-pool patches, one entry per pool, options within a pool merged by id.
 *
 * Not `mergeById`: a pool patch has no id of its own, and two fragments of the same book
 * legitimately both widen `eldritch-invocation` — Xanathar's warlock invocations could
 * arrive in one file and its pact boons in another. Replacing wholesale would drop the
 * first file's work, so the pools are keyed by what they name and their options unioned.
 */
export function mergeOptionPools(
  existing: OptionPoolPatch[],
  incoming: OptionPoolPatch[],
): OptionPoolPatch[] {
  const key = (pool: OptionPoolPatch) => `${pool.group ?? ''}|${pool.choiceId ?? ''}`
  const map = new Map<string, OptionPoolPatch>()
  for (const pool of [...existing, ...incoming]) {
    const seen = map.get(key(pool))
    if (!seen) map.set(key(pool), { ...pool, options: [...pool.options] })
    else seen.options = mergeById(seen.options, pool.options)
  }
  return [...map.values()]
}
