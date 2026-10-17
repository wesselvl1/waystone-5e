/**
 * One search box over every loaded pack: "which book has the Satyr, and what does it say".
 *
 * The rulepack pages are browsed one pack at a time, which is no help to a player who
 * knows a name and not the book it is in. This walks every entry kind a pack can hold,
 * plus the two things that live *inside* another entry and are looked for by name just as
 * often — a subclass inside its class, a subrace inside its race — and, a tier below, the
 * named prose inside an entry (a class feature, a race trait, an inline invocation), so
 * "agonizing" finds the warlock that prints it.
 *
 * Matching is by name only, through `matchesSearch`, so every term has to appear in the
 * name and "fire bo" finds Fire Bolt. Searching descriptions as well would bury the spell
 * called Fireball under every entry that mentions one.
 *
 * Kept pure (packs in, hits out) so it runs under the `node` vitest environment.
 */
import type { Rulepack } from '~/types/rulepack'
import type { EntryKind, ProseBlock } from '~/services/homebrew'
import {
  ENTRY_KINDS,
  claimedIds,
  entryId,
  entryKindMeta,
  entryName,
  fieldValue,
  inLookupOrder,
  listEntries,
  proseBlocks,
  unshadowed,
} from '~/services/homebrew'
import { searchTerms } from '~/services/searchFilter'

export interface RulepackSearchHit {
  /** Unique within one result list, for `:key` and for which card is open. */
  key: string
  packId: string
  packName: string
  /** The tab on the pack page the hit is filed under. */
  kind: EntryKind
  /** The id of the top-level entry on that tab — the class, for a subclass or a feature. */
  entryId: string
  /** "spell", "subclass", "feature" — what the hit is, for its chip. */
  label: string
  name: string
  /** What it belongs to: "Fighter" for a subclass, "Warlock › Levels › Level 2" for a feature. */
  parent?: string
  /** The one-line scalars ("3 · evocation · 1 action …"), where the kind declares any. */
  summary: string
  description: string
  /** Named prose inside the hit — traits, features, actions. Empty for a feature hit. */
  prose: ProseBlock[]
}

/** How well a name answers the query; lower is better, `undefined` is no match. */
function nameRank(name: string, query: string, terms: string[]): number | undefined {
  const lower = name.toLowerCase()
  if (!terms.every(term => lower.includes(term))) return undefined
  const whole = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (lower === whole) return 0
  if (lower.startsWith(whole)) return 1
  // A term opening a word ("bolt" in "Fire Bolt") beats one buried inside it.
  const words = lower.split(/[^a-z0-9']+/)
  if (terms.every(term => words.some(word => word.startsWith(term)))) return 2
  return 3
}

function summaryOf(kind: EntryKind, entry: Record<string, unknown>): string {
  return entryKindMeta(kind).fields
    .filter(field => field.key !== 'name' && field.kind !== 'multiline')
    .map((field) => {
      const value = fieldValue(entry, field)
      // "Ritual", not "true".
      if (typeof value === 'boolean') return value ? field.label : ''
      if (kind === 'spells' && field.key === 'level') return value === '0' ? 'Cantrip' : `Level ${value}`
      return value
    })
    .filter(Boolean)
    .join(' · ')
}

function descriptionOf(entry: Record<string, unknown>): string {
  return typeof entry.description === 'string' ? entry.description : ''
}

/** Feature-tier hits are capped per entry, so "attack" does not list one class forty times. */
const FEATURES_PER_ENTRY = 5

/**
 * Every entry, nested subclass, nested subrace and named piece of prose whose name holds
 * all the query's terms, best match first.
 *
 * The player's own pack shadows by id here exactly as in every list getter, so an edited
 * spell is one hit, not two.
 */
export function searchRulepacks(packs: Rulepack[], query: string): RulepackSearchHit[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return []

  const ranked: Array<{ hit: RulepackSearchHit; rank: number; order: number }> = []
  const push = (hit: RulepackSearchHit, rank: number) =>
    ranked.push({ hit, rank, order: ranked.length })

  const ordered = inLookupOrder(packs)
  const claimedSubclasses = claimedIds(ordered, 'subclasses')
  const claimedSubraces = claimedIds(ordered, 'subraces')
  for (const meta of ENTRY_KINDS) {
    const claimed = claimedIds(ordered, meta.key)

    for (const pack of ordered) {
      for (const entry of unshadowed(pack, meta.key, listEntries(pack, meta.key), claimed)) {
        const id = entryId(meta.key, entry)
        const name = entryName(meta.key, entry)
        const key = `${pack.id}:${meta.key}:${id}`
        const prose = proseBlocks(entry)

        const rank = nameRank(name, query, terms)
        if (rank !== undefined) {
          push({
            key,
            packId: pack.id,
            packName: pack.name,
            kind: meta.key,
            entryId: id,
            label: meta.singular,
            name,
            parent: parentOf(entry),
            summary: summaryOf(meta.key, entry),
            description: descriptionOf(entry),
            prose,
          }, rank)
        }

        // A subclass or subrace printed inside its class or race is still its own thing.
        const nested: Array<[EntryKind, string, Set<string>]> = [
          ['subclasses', 'subclasses', claimedSubclasses],
          ['subraces', 'subraces', claimedSubraces],
        ]
        const nestedNames = new Set<string>()
        for (const [nestedKind, field, nestedClaimed] of nested) {
          if (meta.key === nestedKind) continue
          const children = Array.isArray(entry[field]) ? entry[field] as Record<string, unknown>[] : []
          for (const child of unshadowed(pack, nestedKind, children, nestedClaimed)) {
            const childName = entryName(nestedKind, child)
            nestedNames.add(childName)
            const childRank = nameRank(childName, query, terms)
            if (childRank === undefined) continue
            push({
              key: `${key}:${nestedKind}:${entryId(nestedKind, child)}`,
              packId: pack.id,
              packName: pack.name,
              kind: meta.key,
              entryId: id,
              label: entryKindMeta(nestedKind).singular,
              name: childName,
              parent: name,
              summary: '',
              description: descriptionOf(child),
              prose: proseBlocks(child),
            }, childRank)
          }
        }

        // Named prose, a tier below any entry. A feature printed on its level and again in
        // `featureDefinitions` is one hit, and a nested subclass already has its own.
        const seen = new Set<string>()
        let features = 0
        for (const block of prose) {
          if (features >= FEATURES_PER_ENTRY) break
          const lower = block.name.toLowerCase()
          if (seen.has(lower) || nestedNames.has(block.name) || !block.value) continue
          const blockRank = nameRank(block.name, query, terms)
          if (blockRank === undefined) continue
          seen.add(lower)
          features++
          push({
            key: `${key}:prose:${block.path.join('.')}`,
            packId: pack.id,
            packName: pack.name,
            kind: meta.key,
            entryId: id,
            label: 'feature',
            name: block.name,
            parent: block.context ? `${name} › ${block.context}` : name,
            summary: '',
            description: block.value,
            prose: [],
          }, 10 + blockRank)
        }
      }
    }
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.hit.name.localeCompare(b.hit.name) || a.order - b.order)
    .map(entry => entry.hit)
}

/** What a patch entry attaches to, named by id since the target may be in another pack. */
function parentOf(entry: Record<string, unknown>): string | undefined {
  if (typeof entry.classId === 'string' && entry.classId) return entry.classId
  if (typeof entry.raceId === 'string' && entry.raceId) return entry.raceId
  return undefined
}
