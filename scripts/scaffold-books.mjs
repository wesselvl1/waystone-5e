#!/usr/bin/env node
/**
 * Scaffold one rulepack folder per sourcebook under app/data/, pre-populated with a stub
 * for every piece of content that book adds.
 *
 * The stubs carry only identity — id, name, and the link to what they patch (classId /
 * raceId) — plus whatever a stub needs to satisfy RulepackSchema. Rules text is left
 * empty for a human to fill in from their own copy of the book; nothing here reproduces
 * book content. Everything under app/data/ except srd/ is gitignored dev-only data.
 *
 * Re-running is safe: an entry that already exists keeps every field it has, and only
 * genuinely new ids are appended. So fill a stub in, re-run to pick up manifest
 * additions, and your work survives.
 *
 *   node scripts/scaffold-books.mjs            # write files
 *   node scripts/scaffold-books.mjs --dry-run  # report what would change
 *   node scripts/scaffold-books.mjs tcoe xge   # limit to given book abbreviations
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from './book-manifest.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'app', 'data')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const only = args.filter(a => !a.startsWith('--'))

/** "Gloom Stalker Conclave" -> "gloom-stalker-conclave" */
function slug(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Entries are written as either a bare name or [name, extra] so the manifest stays
 * readable — a subclass needs its classId, a subrace its raceId, an optional feature its
 * class and level.
 */
function normalize(entry) {
  return Array.isArray(entry) ? { name: entry[0], ...entry[1] } : { name: entry }
}

/**
 * The stub shapes. Each must satisfy RulepackSchema on its own, since the loader
 * validates every fragment and drops the whole file if one entry fails.
 *
 * `_todo` marks what still needs transcribing. Zod strips unknown keys, so it never
 * reaches the store — it exists purely as a marker in the file you are editing.
 */
const STUBS = {
  optionalFeatures: ({ name, classId, level, replaces }) => ({
    name,
    classId,
    level: level ?? 1,
    ...(replaces ? { replaces } : {}),
    description: '',
    _todo: true,
  }),
  classes: ({ name }) => ({
    name,
    hitDie: 'd8',
    primaryAbility: [],
    savingThrowProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillChoices: { count: 0, from: [] },
    levels: [],
    _todo: true,
  }),
  subclasses: ({ name, classId }) => ({
    name,
    classId,
    description: '',
    levels: [],
    _todo: true,
  }),
  feats: ({ name, prerequisite }) => ({
    name,
    description: '',
    ...(prerequisite ? { prerequisite } : {}),
    _todo: true,
  }),
  backgrounds: ({ name }) => ({
    name,
    description: '',
    skillProficiencies: [],
    toolProficiencies: [],
    languages: 0,
    equipment: [],
    feature: { name: '', description: '' },
    _todo: true,
  }),
  races: ({ name }) => ({
    name,
    size: 'medium',
    speeds: { walk: 30 },
    abilityScoreBonuses: {},
    traits: [],
    languages: [],
    _todo: true,
  }),
  subraces: ({ name, raceId }) => ({
    name,
    raceId,
    abilityScoreBonuses: {},
    traits: [],
    _todo: true,
  }),
  spells: ({ name }) => ({
    name,
    level: 0,
    school: '',
    castingTime: '',
    range: '',
    components: '',
    duration: '',
    concentration: false,
    ritual: false,
    description: '',
    classes: [],
    _todo: true,
  }),
}

/** Emitted in the order content is worked through: class features first, spells last. */
const CATEGORY_FILES = {
  optionalFeatures: 'optional-features.json',
  classes: 'classes.json',
  subclasses: 'subclasses.json',
  feats: 'feats.json',
  backgrounds: 'backgrounds.json',
  races: 'races.json',
  subraces: 'subraces.json',
  spells: 'spells.json',
}

/**
 * Every fragment of a book carries the same envelope. The description is deliberately
 * book-level rather than per-category: all fragments sharing an id merge into one
 * rulepack, and the last one to merge wins, so a per-category line would leave the pack
 * described by whichever filename happened to sort last.
 */
function envelope(book) {
  return {
    id: book.abbrev,
    name: book.name,
    version: book.version ?? '1.0',
    description:
      `Non-SRD content from ${book.name}. LOCAL DEV DATA — gitignored, never committed. `
      + 'Not covered by the CC-BY 4.0 licence the srd-5.1 pack ships under; the stubs are '
      + 'empty by design, to be filled in from your own copy of the book.',
    author: book.author ?? 'Wizards of the Coast',
  }
}

/** Ids of a category already present in other JSON files of the same book folder. */
function idsInFolder(dir, category, excludeFile) {
  const ids = new Set()
  if (!existsSync(dir)) return ids
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file === excludeFile) continue
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      for (const item of data?.[category] ?? []) ids.add(item.id)
    }
    catch {
      // A file being edited by hand may be mid-save; it is not this script's job to fail on that
    }
  }
  return ids
}

let created = 0
let added = 0
let kept = 0

for (const book of BOOKS) {
  if (only.length > 0 && !only.includes(book.abbrev)) continue

  const dir = join(DATA, book.abbrev)
  const summary = []

  for (const [category, file] of Object.entries(CATEGORY_FILES)) {
    const entries = book[category]
    if (!entries || entries.length === 0) continue

    const path = join(dir, file)
    const existing = existsSync(path)
      ? JSON.parse(readFileSync(path, 'utf8'))
      : null

    // Index what is already on disk so filled-in entries are never overwritten
    const byId = new Map((existing?.[category] ?? []).map(item => [item.id, item]))
    const before = byId.size

    // An id may already live in a differently-named file in this folder — a hand-written
    // fragment, or one from before these filenames settled. Emitting a stub for it anyway
    // would write a second copy of the id, and since fragments merge by id in filename
    // order, the empty stub could overwrite the filled-in entry. Skip those.
    const elsewhere = idsInFolder(dir, category, file)

    for (const raw of entries) {
      const entry = normalize(raw)
      const id = entry.id ?? `${book.abbrev}.${slug(entry.name)}`
      if (byId.has(id) || elsewhere.has(id)) continue
      byId.set(id, { id, ...STUBS[category](entry) })
    }

    const out = { ...envelope(book), [category]: [...byId.values()] }
    const newCount = byId.size - before
    added += newCount
    kept += before
    if (!existing) created++

    summary.push(`${category}: ${byId.size}${newCount ? ` (+${newCount})` : ''}`)

    if (!dryRun) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
    }
  }

  if (summary.length > 0) console.log(`${book.abbrev.padEnd(6)} ${book.name}\n         ${summary.join(' · ')}`)
}

console.log(
  `\n${dryRun ? '[dry run] ' : ''}${created} file(s) created, ${added} stub(s) added, `
  + `${kept} existing entr(ies) left untouched.`,
)
