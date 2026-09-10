/**
 * Substring search for the long pick-lists — races, backgrounds, spells, feats,
 * invocations. Every whitespace-separated term has to appear somewhere in the
 * item's searchable text, so "wiz evoc" narrows to evocation spells on the wizard
 * list rather than to nothing.
 *
 * Kept out of the components because both the creation wizard and the level-up
 * wizard filter the same kinds of list, and because pure functions are the only
 * part of a page that `node`-environment vitest can reach.
 */

/** Terms a query breaks down into. Empty query means "no filtering". */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Whether every term appears in any of the fields. Fields are joined rather than
 * tested one by one so a query can span them: "elf mordenkainen" matches a race
 * whose name gives one term and whose source name gives the other.
 */
export function matchesSearch(query: string, ...fields: Array<string | undefined | null>): boolean {
  const terms = searchTerms(query)
  if (terms.length === 0) return true
  const haystack = fields.filter(Boolean).join(' ').toLowerCase()
  return terms.every(t => haystack.includes(t))
}

/** `matchesSearch` over a list, with the fields pulled per item. */
export function filterBySearch<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => Array<string | undefined | null>,
): T[] {
  if (searchTerms(query).length === 0) return [...items]
  return items.filter(item => matchesSearch(query, ...fields(item)))
}
