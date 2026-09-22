/**
 * Editing a book's wording, and homebrew of one's own.
 *
 * Nothing here writes to the pack an entry came from. A book is a document — re-imported
 * whole, and in the bundled SRD's case re-seeded from the build whenever its data changes
 * — so an edit made in place would be lost the next time the app updated itself, silently
 * and with nothing on screen to say so. An edit instead *copies* the entry into a pack of
 * the player's own, which shadows the book's version by id wherever the app looks one up.
 *
 * The copy is what makes an edit survive an update, and it is also the thing an update
 * can leave behind: a forked class carries the level table as it was written the day it
 * was copied, missing every fix since. `ForkOrigin` is what keeps that visible — the hash
 * of the source entry at the moment it was copied, so the app can say the book's version
 * has moved on rather than quietly running a stale copy forever.
 *
 * What the editor exposes is deliberately narrow. Wording is what a table actually wants
 * to change — the SRD prints healing word as 1d4 where most tables read it as 2d4 — and
 * wording is safe: a description is text the sheet displays, and no amount of rewriting
 * it can break the level-up pipeline. Everything structural (level tables, levelUpEvents,
 * ability distributions) is left to the JSON editor, where the pack's own Zod schema is
 * the judge, because a form that got those half-right would be worse than no form.
 */
import type { ForkOrigin, OptionPoolPatch, Rulepack } from '~/types/rulepack'
import { EntrySchemas } from '~/schemas/rulepackSchema'

export const HOMEBREW_PACK_ID = 'homebrew'
export const HOMEBREW_PACK_NAME = 'Homebrew'

/** The Rulepack arrays an entry can live in. Also the key into `EntrySchemas`. */
export type EntryKind = keyof typeof EntrySchemas

/** How one field of an entry is edited in the details form. */
export type FieldKind = 'text' | 'multiline' | 'number' | 'boolean' | 'list'

export interface EntryField {
  key: string
  label: string
  kind: FieldKind
  /** Removed from the entry when left blank, for a field the schema does not require. */
  optional?: boolean
  placeholder?: string
  /** Shown under the input — what the pack's schema will accept. */
  help?: string
}

export interface EntryKindMeta {
  key: EntryKind
  /** Tab label. */
  label: string
  /** What one of them is called, for "New spell" and "Delete this feat". */
  singular: string
  /**
   * The fields the details form offers: the entry's own wording and the scalars beside
   * it. Nested prose is found by `proseBlocks` instead, and everything else is JSON.
   */
  fields: EntryField[]
  /** A schema-valid starting point for a brand-new entry. */
  blank: () => Record<string, unknown>
}

const NAME: EntryField = { key: 'name', label: 'Name', kind: 'text' }
const DESCRIPTION: EntryField = { key: 'description', label: 'Description', kind: 'multiline' }

/**
 * Ordered as the rulepack page lists them: what a player browses first, then equipment,
 * then the patch kinds a sourcebook uses to reach into another pack.
 */
export const ENTRY_KINDS: EntryKindMeta[] = [
  {
    key: 'races',
    label: 'Races',
    singular: 'race',
    fields: [
      NAME,
      { key: 'size', label: 'Size', kind: 'text', help: 'tiny, small, medium or large' },
      { key: 'languages', label: 'Languages', kind: 'list' },
    ],
    blank: () => ({
      id: '',
      name: '',
      size: 'medium',
      speeds: { walk: 30 },
      abilityScoreBonuses: {},
      traits: [{ name: 'New trait', description: '' }],
      languages: ['Common'],
    }),
  },
  {
    key: 'classes',
    label: 'Classes',
    singular: 'class',
    fields: [
      NAME,
      { key: 'hitDie', label: 'Hit die', kind: 'text', placeholder: 'd8' },
    ],
    blank: () => ({
      id: '',
      name: '',
      hitDie: 'd8',
      primaryAbility: [],
      savingThrowProficiencies: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillChoices: { count: 2, from: [] },
      levels: [{ level: 1, features: [], levelUpEvents: [] }],
      featureDefinitions: [],
    }),
  },
  {
    key: 'backgrounds',
    label: 'Backgrounds',
    singular: 'background',
    fields: [
      NAME,
      DESCRIPTION,
      { key: 'toolProficiencies', label: 'Tool proficiencies', kind: 'list' },
      { key: 'equipment', label: 'Equipment', kind: 'list' },
      { key: 'languages', label: 'Languages gained', kind: 'number' },
    ],
    blank: () => ({
      id: '',
      name: '',
      description: '',
      skillProficiencies: [],
      toolProficiencies: [],
      languages: 0,
      equipment: [],
      feature: { name: 'New feature', description: '' },
    }),
  },
  {
    key: 'feats',
    label: 'Feats',
    singular: 'feat',
    fields: [
      NAME,
      {
        key: 'prerequisite',
        label: 'Prerequisite',
        kind: 'text',
        optional: true,
        help: 'The printed wording; the machine-checked version lives in JSON',
      },
      DESCRIPTION,
    ],
    blank: () => ({ id: '', name: '', description: '' }),
  },
  {
    key: 'spells',
    label: 'Spells',
    singular: 'spell',
    fields: [
      NAME,
      { key: 'level', label: 'Level', kind: 'number', help: '0 for a cantrip' },
      { key: 'school', label: 'School', kind: 'text' },
      { key: 'castingTime', label: 'Casting time', kind: 'text' },
      { key: 'range', label: 'Range', kind: 'text' },
      { key: 'components', label: 'Components', kind: 'text' },
      { key: 'duration', label: 'Duration', kind: 'text' },
      { key: 'concentration', label: 'Concentration', kind: 'boolean' },
      { key: 'ritual', label: 'Ritual', kind: 'boolean' },
      { key: 'classes', label: 'Class lists', kind: 'list', help: 'Class ids, e.g. cleric, druid' },
      DESCRIPTION,
    ],
    blank: () => ({
      id: '',
      name: '',
      level: 0,
      school: 'evocation',
      castingTime: '1 action',
      range: 'Self',
      components: 'V, S',
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      description: '',
      classes: [],
    }),
  },
  {
    key: 'creatures',
    label: 'Creatures',
    singular: 'creature',
    fields: [
      NAME,
      { key: 'type', label: 'Type', kind: 'text', help: 'beast, fey, undead, …' },
      { key: 'size', label: 'Size', kind: 'text' },
      { key: 'challengeRating', label: 'Challenge rating', kind: 'number' },
      { key: 'armorClass', label: 'Armour class', kind: 'number' },
      { key: 'hitPoints', label: 'Hit points', kind: 'number' },
      { key: 'hitDice', label: 'Hit dice', kind: 'text', placeholder: '2d8' },
      { key: 'senses', label: 'Senses', kind: 'list', optional: true },
      { key: 'languages', label: 'Languages', kind: 'list', optional: true },
    ],
    blank: () => ({
      id: '',
      name: '',
      type: 'beast',
      size: 'medium',
      challengeRating: 0,
      armorClass: 10,
      hitPoints: 1,
      hitDice: '1d4',
      speeds: { walk: 30 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }),
  },
  {
    key: 'weapons',
    label: 'Weapons',
    singular: 'weapon',
    fields: [
      NAME,
      { key: 'category', label: 'Category', kind: 'text', help: 'simple or martial' },
      { key: 'rangeType', label: 'Melee or ranged', kind: 'text', help: 'melee or ranged' },
      { key: 'damageDice', label: 'Damage dice', kind: 'text', placeholder: '1d8' },
      { key: 'damageType', label: 'Damage type', kind: 'text', placeholder: 'slashing' },
      { key: 'versatileDamage', label: 'Versatile damage', kind: 'text', optional: true, placeholder: '1d10' },
      { key: 'range', label: 'Range', kind: 'text', optional: true, placeholder: '80/320' },
      {
        key: 'properties',
        label: 'Properties',
        kind: 'list',
        optional: true,
        help: 'finesse, light, thrown, … — these decide an attack’s default ability',
      },
      { key: 'cost', label: 'Cost', kind: 'text', optional: true },
      { key: 'weight', label: 'Weight (lb)', kind: 'number', optional: true },
    ],
    blank: () => ({
      id: '',
      name: '',
      category: 'simple',
      rangeType: 'melee',
      damageDice: '1d4',
      damageType: 'bludgeoning',
    }),
  },
  {
    key: 'armor',
    label: 'Armour',
    singular: 'armour',
    fields: [
      NAME,
      { key: 'category', label: 'Category', kind: 'text', help: 'unarmored, light, medium, heavy or shield' },
      { key: 'baseAC', label: 'Base AC', kind: 'number' },
      {
        key: 'maxDexBonus',
        label: 'Max Dex bonus',
        kind: 'number',
        optional: true,
        help: 'Blank means uncapped; 0 means none at all',
      },
      { key: 'strengthRequirement', label: 'Strength requirement', kind: 'number', optional: true },
      { key: 'stealthDisadvantage', label: 'Stealth disadvantage', kind: 'boolean' },
      { key: 'cost', label: 'Cost', kind: 'text', optional: true },
      { key: 'weight', label: 'Weight (lb)', kind: 'number', optional: true },
      { key: 'description', label: 'Description', kind: 'multiline', optional: true },
    ],
    blank: () => ({ id: '', name: '', category: 'light', baseAC: 11 }),
  },
  {
    key: 'optionalFeatures',
    label: 'Optional features',
    singular: 'optional feature',
    fields: [
      NAME,
      { key: 'classId', label: 'Class id', kind: 'text' },
      { key: 'level', label: 'Level', kind: 'number' },
      { key: 'replaces', label: 'Replaces', kind: 'text', optional: true },
      DESCRIPTION,
    ],
    blank: () => ({ id: '', name: '', description: '', classId: '', level: 1 }),
  },
  {
    key: 'subclasses',
    label: 'Subclasses',
    singular: 'subclass',
    fields: [
      NAME,
      { key: 'classId', label: 'Class id', kind: 'text', help: 'The class this attaches to, e.g. fighter' },
      DESCRIPTION,
    ],
    blank: () => ({ id: '', name: '', description: '', classId: '', levels: [] }),
  },
  {
    key: 'subraces',
    label: 'Subraces',
    singular: 'subrace',
    fields: [
      NAME,
      { key: 'raceId', label: 'Race id', kind: 'text', help: 'The race this attaches to, e.g. elf' },
    ],
    blank: () => ({ id: '', name: '', raceId: '', abilityScoreBonuses: {}, traits: [] }),
  },
  {
    key: 'optionPools',
    label: 'Pool options',
    singular: 'pool patch',
    fields: [
      {
        key: 'group',
        label: 'Pool group',
        kind: 'text',
        optional: true,
        help: 'eldritch-invocation, metamagic, fighting-style',
      },
      {
        key: 'choiceId',
        label: 'Choice id',
        kind: 'text',
        optional: true,
        help: 'For a choice that declares no group, e.g. pact-boon',
      },
    ],
    blank: () => ({ group: 'eldritch-invocation', options: [{ id: '', name: '', description: '' }] }),
  },
]

const BY_KIND = new Map(ENTRY_KINDS.map(meta => [meta.key, meta]))

export function entryKindMeta(kind: EntryKind): EntryKindMeta {
  const meta = BY_KIND.get(kind)
  if (!meta) throw new Error(`Unknown entry kind: ${kind}`)
  return meta
}

/**
 * What a pool patch is identified by.
 *
 * Every other kind has an id; a pool patch has only the pool it names, which is exactly
 * what `mergeOptionPools` already keys them by. Reusing that key means a homebrew patch
 * shadows the one it was copied from instead of arriving alongside it.
 */
export function poolKey(pool: Pick<OptionPoolPatch, 'group' | 'choiceId'>): string {
  return `${pool.group ?? ''}|${pool.choiceId ?? ''}`
}

/** The id an entry is stored and looked up under, whatever its kind. */
export function entryId(kind: EntryKind, entry: unknown): string {
  const record = (entry ?? {}) as Record<string, unknown>
  if (kind === 'optionPools') {
    return poolKey({
      group: typeof record.group === 'string' ? record.group : undefined,
      choiceId: typeof record.choiceId === 'string' ? record.choiceId : undefined,
    })
  }
  return typeof record.id === 'string' ? record.id : ''
}

/** What to call an entry on screen. A pool patch has no name, only the pool it widens. */
export function entryName(kind: EntryKind, entry: unknown): string {
  const record = (entry ?? {}) as Record<string, unknown>
  if (typeof record.name === 'string' && record.name) return record.name
  if (kind === 'optionPools') return String(record.group ?? record.choiceId ?? 'Unnamed pool')
  return entryId(kind, entry) || 'Unnamed'
}

export function listEntries(pack: Rulepack, kind: EntryKind): Record<string, unknown>[] {
  return ((pack as unknown as Record<string, unknown>)[kind] as Record<string, unknown>[]) ?? []
}

/** The key `Rulepack.forkedFrom` records an entry's provenance under. */
export function forkKey(kind: EntryKind, id: string): string {
  return `${kind}:${id}`
}

// ---------------------------------------------------------------------------
// Hashing — how a copy notices the book it came from has moved on
// ---------------------------------------------------------------------------

/** JSON with object keys in a fixed order, so two equal entries hash the same. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).filter(key => record[key] !== undefined).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

/**
 * A short digest of an entry. FNV-1a rather than a cryptographic hash: this answers "is
 * this still the text I copied", where a collision costs a missed notice, and
 * SubtleCrypto is async and absent outside a secure context.
 */
export function hashEntry(entry: unknown): string {
  const text = stableStringify(entry)
  let hash = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// ---------------------------------------------------------------------------
// Prose — every {name, description} pair in an entry, wherever it sits
// ---------------------------------------------------------------------------

export interface ProseBlock {
  /** Where the text lives inside the entry, e.g. ['traits', 0, 'description']. */
  path: Array<string | number>
  /** The `name` beside it, which is what the description is *of*. */
  name: string
  /** The rest of the way there, e.g. "Subclasses › Path of the Berserker › Level 3". */
  context: string
  value: string
}

const CONTAINER_LABELS: Record<string, string> = {
  traits: 'Traits',
  featureDefinitions: 'Features',
  subclasses: 'Subclasses',
  subraces: 'Subraces',
  levels: 'Levels',
  actions: 'Actions',
  options: 'Options',
  feature: 'Feature',
}

function containerLabel(key: string): string {
  return CONTAINER_LABELS[key]
    ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase())
}

/**
 * Every editable description in an entry, found by shape rather than by a list of places
 * to look.
 *
 * A race trait, a class feature, a subclass feature, a background's feature, a creature's
 * action and an invocation in a pool patch are all `{ name, description }` — so the rule
 * is simply that a named thing with a description has prose worth editing, at any depth.
 * A pack this app has never read gets the same treatment as the SRD, which is the whole
 * reason not to enumerate the paths.
 *
 * The entry's own top-level description is left out: it belongs to the details form,
 * where it sits beside the name it describes.
 */
export function proseBlocks(entry: unknown): ProseBlock[] {
  const blocks: ProseBlock[] = []
  walkProse(entry, [], [], blocks, true)
  return blocks
}

function walkProse(
  node: unknown,
  path: Array<string | number>,
  trail: string[],
  blocks: ProseBlock[],
  isRoot: boolean,
): void {
  if (Array.isArray(node)) {
    node.forEach((child, index) => walkProse(child, [...path, index], trail, blocks, false))
    return
  }
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>

  const name = typeof record.name === 'string' ? record.name : undefined
  if (!isRoot && name !== undefined && typeof record.description === 'string') {
    blocks.push({
      path: [...path, 'description'],
      name,
      context: trail.join(' › '),
      value: record.description,
    })
  }

  // The node's own label joins the trail for everything beneath it. The root's does not:
  // the reader already knows which entry they opened.
  const own = isRoot
    ? undefined
    : name ?? (typeof record.level === 'number' ? `Level ${record.level}` : undefined)
  const inner = own ? [...trail, own] : trail

  for (const [key, value] of Object.entries(record)) {
    if (key === 'description') continue
    walkProse(value, [...path, key], isRoot ? [containerLabel(key)] : inner, blocks, false)
  }
}

export function getAtPath(target: unknown, path: Array<string | number>): unknown {
  let node: unknown = target
  for (const step of path) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string | number, unknown>)[step]
  }
  return node
}

/** A copy of `target` with `path` set to `value`. Containers along the way are cloned. */
export function setAtPath<T>(target: T, path: Array<string | number>, value: unknown): T {
  if (path.length === 0) return value as T
  const [step, ...rest] = path
  if (Array.isArray(target)) {
    const copy = [...target]
    copy[step as number] = setAtPath(copy[step as number], rest, value)
    return copy as unknown as T
  }
  const copy = { ...(target as Record<string, unknown>) }
  copy[step as string] = setAtPath(copy[step as string], rest, value)
  return copy as T
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * An id for a new homebrew entry, prefixed the way a sourcebook prefixes its own.
 *
 * The prefix is what keeps a homebrew Fireball a second spell rather than an override of
 * the SRD's — overriding is what *copying* an entry does, and that keeps the original id
 * deliberately. Numbered only on a clash, so the usual id reads as written.
 */
export function mintEntryId(pack: Rulepack, kind: EntryKind, name: string): string {
  const base = `hb-${slugify(name) || entryKindMeta(kind).singular.replace(/\s+/g, '-')}`
  const taken = new Set(listEntries(pack, kind).map(entry => entryId(kind, entry)))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

// ---------------------------------------------------------------------------
// Reading and writing a pack
// ---------------------------------------------------------------------------

export function blankHomebrewPack(): Rulepack {
  return {
    id: HOMEBREW_PACK_ID,
    name: HOMEBREW_PACK_NAME,
    version: '1',
    description: 'Entries you wrote, and your edits to the books.',
    races: [],
    classes: [],
    backgrounds: [],
    feats: [],
    spells: [],
    creatures: [],
    weapons: [],
    armor: [],
    optionalFeatures: [],
    subclasses: [],
    subraces: [],
    optionPools: [],
    forkedFrom: {},
  }
}

/**
 * Put an entry into a pack, replacing the one it shares an id with.
 *
 * `origin` records what the entry was copied out of, and is absent for homebrew written
 * from scratch. Passing it again on a later save is what re-snapshots a copy the player
 * has decided to keep: the stale notice goes quiet until the book changes again.
 */
export function upsertEntry(
  pack: Rulepack,
  kind: EntryKind,
  entry: Record<string, unknown>,
  origin?: ForkOrigin,
): Rulepack {
  const id = entryId(kind, entry)
  const existing = listEntries(pack, kind)
  const index = existing.findIndex(candidate => entryId(kind, candidate) === id)
  const next = index >= 0
    ? existing.map((candidate, i) => (i === index ? entry : candidate))
    : [...existing, entry]

  const forkedFrom = { ...(pack.forkedFrom ?? {}) }
  if (origin) forkedFrom[forkKey(kind, id)] = origin

  return { ...pack, [kind]: next, forkedFrom } as Rulepack
}

/** Drop an entry, and the note saying what it was copied from. */
export function deleteEntry(pack: Rulepack, kind: EntryKind, id: string): Rulepack {
  const forkedFrom = { ...(pack.forkedFrom ?? {}) }
  delete forkedFrom[forkKey(kind, id)]
  return {
    ...pack,
    [kind]: listEntries(pack, kind).filter(entry => entryId(kind, entry) !== id),
    forkedFrom,
  } as Rulepack
}

/** How many entries a pack holds, across every kind. */
export function entryCount(pack: Rulepack): number {
  return ENTRY_KINDS.reduce((total, meta) => total + listEntries(pack, meta.key).length, 0)
}

// ---------------------------------------------------------------------------
// How the player's pack wins over the books
// ---------------------------------------------------------------------------

/**
 * The order lookups read packs in: the pack the player edits comes first.
 *
 * Every singular lookup returns the first pack holding the id, so being at the front is
 * the whole mechanism by which an edited entry wins. Sorting is stable, so the books keep
 * whatever order they arrived in.
 */
export function inLookupOrder(packs: Rulepack[]): Rulepack[] {
  return [...packs].sort((a, b) =>
    Number(b.id === HOMEBREW_PACK_ID) - Number(a.id === HOMEBREW_PACK_ID))
}

/**
 * Ids the player's own pack claims for a kind.
 *
 * An edit copies the entry keeping its original id, so a copy and its source are two
 * entries under one id. Everywhere a *list* is read the book's version is dropped —
 * otherwise a player who corrected healing word's dice would find two healing words in
 * every picker, told apart only by a source label they never asked for. Two *books*
 * sharing an id stay two entries, as they always have: that is a second take on the same
 * content, where this is one take that has been edited.
 */
export function claimedIds(packs: Rulepack[], kind: EntryKind): Set<string> {
  const pack = packs.find(candidate => candidate.id === HOMEBREW_PACK_ID)
  if (!pack) return new Set()
  return new Set(listEntries(pack, kind).map(entry => entryId(kind, entry)))
}

/** A pack's entries of one kind, minus whatever the player's own pack has claimed. */
export function unshadowed<T>(
  pack: Rulepack,
  kind: EntryKind,
  entries: T[],
  claimed: Set<string>,
): T[] {
  if (pack.id === HOMEBREW_PACK_ID || claimed.size === 0) return entries
  return entries.filter(entry => !claimed.has(entryId(kind, entry)))
}

// ---------------------------------------------------------------------------
// Whether a copy has fallen behind the book it came from
// ---------------------------------------------------------------------------

export type ForkState = 'current' | 'changed' | 'source-missing'

export interface ForkStatus {
  kind: EntryKind
  id: string
  /** The copy's own name, for the notice. */
  name: string
  origin: ForkOrigin
  state: ForkState
}

/**
 * Which copies have fallen behind, given a way to find the entry each was copied from.
 *
 * This is the whole reason `ForkOrigin` stores a hash. The app's rules data is still
 * being written: a class gains a level-up event, a spell's wording is corrected, and a
 * copy taken before that keeps shadowing the fixed version with no sign on screen. A
 * changed hash is not "your copy is wrong" — it is "the book moved, come and look".
 *
 * `source-missing` is the other half: the book was removed, so nothing can be compared
 * and the copy is now the only version of that entry the app has.
 */
export function forkStatuses(
  pack: Rulepack,
  findSource: (packId: string, kind: EntryKind, id: string) => unknown,
): ForkStatus[] {
  const statuses: ForkStatus[] = []
  for (const [key, origin] of Object.entries(pack.forkedFrom ?? {})) {
    const separator = key.indexOf(':')
    const kind = key.slice(0, separator) as EntryKind
    const id = key.slice(separator + 1)
    if (!BY_KIND.has(kind)) continue

    const copy = listEntries(pack, kind).find(entry => entryId(kind, entry) === id)
    if (!copy) continue

    const source = findSource(origin.packId, kind, id)
    const state: ForkState = source === undefined
      ? 'source-missing'
      : hashEntry(source) === origin.hash ? 'current' : 'changed'

    statuses.push({ kind, id, name: entryName(kind, copy), origin, state })
  }
  return statuses
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type EntryValidation =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; issues: string[] }

/**
 * One entry against its own schema.
 *
 * Deliberately not `RulepackSchema`: a player fixing a spell's wording should be told
 * what is wrong with that spell, not handed the issue list of the book around it. The
 * parsed value is what gets stored, so the schema's own normalisations apply — a weapon's
 * properties come back lowercased, and unknown keys are dropped exactly as on import.
 */
export function validateEntry(kind: EntryKind, value: unknown): EntryValidation {
  const result = EntrySchemas[kind].safeParse(value)
  if (result.success) return { ok: true, value: result.data as Record<string, unknown> }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const where = issue.path.join('.')
      return where ? `${where}: ${issue.message}` : issue.message
    }),
  }
}

/**
 * Whether two entries of a kind say the same thing.
 *
 * Both sides are normalised through the kind's own schema before comparing, so a
 * difference the schema itself would erase — a weapon property's casing, an absent
 * `levelUpEvents` against an empty one, a key order — does not read as an edit. Where a
 * side will not validate, it is compared as given: that is an entry the editor could not
 * have produced, and claiming it matches would be a guess.
 *
 * This is what keeps opening a book's entry and pressing Save from copying it. A copy
 * that says exactly what the book says is worse than none — it shadows the book without
 * changing anything, and then reports itself stale the first time the book is corrected.
 */
export function entriesEqual(kind: EntryKind, a: unknown, b: unknown): boolean {
  const normalised = (value: unknown) => {
    const result = validateEntry(kind, value)
    return result.ok ? result.value : value
  }
  return hashEntry(normalised(a)) === hashEntry(normalised(b))
}

/** Parse JSON and validate in one step, so the editor has one error channel. */
export function parseEntryJson(kind: EntryKind, text: string): EntryValidation {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch (error) {
    return { ok: false, issues: [(error as Error).message] }
  }
  return validateEntry(kind, parsed)
}

// ---------------------------------------------------------------------------
// The details form
// ---------------------------------------------------------------------------

/** What the form shows for a field: always a string or a boolean, never undefined. */
export function fieldValue(entry: Record<string, unknown>, field: EntryField): string | boolean {
  const raw = entry[field.key]
  if (field.kind === 'boolean') return raw === true
  if (field.kind === 'list') return Array.isArray(raw) ? raw.join(', ') : ''
  if (raw === undefined || raw === null) return ''
  return String(raw)
}

/**
 * Write a form field back into the entry.
 *
 * An emptied optional field is *removed* rather than stored as `''` or `0`: the schemas
 * lean on absence to mean something — armour with no `maxDexBonus` adds the whole
 * modifier where a `maxDexBonus` of 0 adds none — so writing a blank in would change the
 * rules rather than leave them alone. A required field keeps whatever was typed, so the
 * schema is the one that objects, with a message naming the field.
 */
export function applyField(
  entry: Record<string, unknown>,
  field: EntryField,
  input: string | boolean,
): Record<string, unknown> {
  const next = { ...entry }
  if (field.kind === 'boolean') {
    next[field.key] = input === true
    return next
  }

  const text = String(input)
  if (field.kind === 'list') {
    const items = text.split(',').map(part => part.trim()).filter(Boolean)
    if (items.length === 0 && field.optional) delete next[field.key]
    else next[field.key] = items
    return next
  }

  if (text.trim() === '' && field.optional) {
    delete next[field.key]
    return next
  }

  if (field.kind === 'number') {
    const parsed = Number(text)
    // A half-typed "-" or "1." is left as the string it is, so the schema reports it
    // rather than the field silently snapping back to zero under the cursor.
    next[field.key] = text.trim() === '' || Number.isNaN(parsed) ? text : parsed
    return next
  }

  next[field.key] = text
  return next
}
