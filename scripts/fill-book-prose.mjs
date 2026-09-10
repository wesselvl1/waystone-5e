#!/usr/bin/env node
/**
 * Fill the empty `description` fields under app/data/<book>/ from a local copy of the
 * 5etools data you already have.
 *
 * `scaffold-books.mjs` writes the stubs and the mechanical fields get filled from the
 * manifest, but rules text is left empty on purpose — nothing in this repo reproduces
 * book content. This script is the other half of that bargain: it reads prose from a
 * corpus on YOUR machine and writes it into YOUR gitignored dev data. The text never
 * enters the repository, and the `/app/data/*` allow-list in .gitignore keeps it that
 * way — only `app/data/srd/` may be committed, and this script refuses to touch it.
 *
 * Point it at the directory holding 5etools' JSON (the one containing races.json,
 * feats.json, spells/ and class/):
 *
 *   node scripts/fill-book-prose.mjs --five ~/5etools-src/data
 *   node scripts/fill-book-prose.mjs --five <path> --dry-run   # report, write nothing
 *   node scripts/fill-book-prose.mjs --five <path> bgg tce     # only these books
 *   FIVETOOLS_DATA=<path> node scripts/fill-book-prose.mjs     # or set it once
 *
 * Re-running is safe and additive: a description that is already filled is never
 * overwritten, so hand-written text survives. `_todo` is cleared from an entry once
 * every description it carries is non-empty, which is what makes the marker meaningful.
 *
 * Entries are matched on the `_source` the fill recorded plus the name, so a race
 * reprinted in several books takes the text of the printing it was actually taken from.
 * Anything it cannot match is listed at the end rather than silently skipped.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'app', 'data')

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const fiveFlag = argv.findIndex(a => a === '--five')
const FIVE = fiveFlag >= 0 ? argv[fiveFlag + 1] : process.env.FIVETOOLS_DATA
const only = argv.filter((a, i) => !a.startsWith('--') && i !== fiveFlag + 1)

if (!FIVE) {
  console.error('Need a 5etools data directory: --five <path>, or set FIVETOOLS_DATA.')
  console.error('That is the folder containing races.json, feats.json, spells/ and class/.')
  process.exit(1)
}
if (!existsSync(join(FIVE, 'races.json'))) {
  console.error(`No races.json under ${FIVE} — is that the 5etools "data" directory?`)
  process.exit(1)
}

const rd = p => JSON.parse(readFileSync(p, 'utf8'))
const norm = s => String(s ?? '')
  .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Order-insensitive, so "Winged Tiefling" also finds "Tiefling (Winged)". */
const tokens = s => norm(s).split(' ').filter(Boolean).sort().join(' ')
const src = s => String(s ?? '').toLowerCase()

/**
 * Every name a stub might be looking for, because the repo names things the way a
 * player says them and 5etools the way the book indexes them:
 *
 *   "Dark Elf (Drow)"            the parenthetical is the real name
 *   "Bloodline of Asmodeus"      a prefix on the subrace's own name
 *   "Gray Dwarf (Duergar)"       both at once
 *   "Harness Divine Power"       filed under "Channel Divinity: …"
 */
function aliases(name) {
  const out = new Set()
  const add = (n) => { const t = String(n ?? '').trim(); if (t) out.add(t) }
  add(name)
  for (const n of [...out]) {
    add(n.replace(/^Bloodline of\s+/i, ''))
    add(n.replace(/^Channel Divinity:\s*/i, ''))
    add(`Channel Divinity: ${n}`)
    const paren = /\(([^)]+)\)/.exec(n)
    if (paren) {
      add(paren[1])
      add(n.replace(/\s*\([^)]*\)/, ''))
    }
  }
  return [...out]
}

// ── rendering 5etools entries as plain text ───────────────────────────────────

/**
 * Strip 5etools' inline markup.
 *
 * `{@tag name|source|display}` shows `display` when it is given and `name` otherwise, so
 * "{@spell fireball|phb|fire ball}" has to read "fire ball" rather than "fireball". A few
 * tags carry meaning in the tag itself and would lose it if only the argument survived.
 */
/** `{@filter Gaming Set|items|source=phb}` shows its FIRST part; the rest is the query. */
const DISPLAY_FIRST = new Set(['filter', 'book', 'adventure', 'footnote', 'area', 'color'])
/** `{@dice 1d20+5|+5}` shows its second. */
const DISPLAY_SECOND = new Set(['dice', 'damage', 'scaledice', 'scaledamage', 'autodice'])

function detag(text) {
  let out = String(text)
  const pass = s => s.replace(/\{@(\w+)\s*([^{}]*)\}/g, (whole, tag, body) => {
    const parts = body.split('|')
    const first = (parts[0] ?? '').trim()
    const display = (parts[2] ?? '').trim()
    if (DISPLAY_FIRST.has(tag)) return first
    if (DISPLAY_SECOND.has(tag)) return (parts[1] ?? '').trim() || first
    // {@quickref Cover|3|0|cover} names its display last.
    if (tag === 'quickref') return (parts.at(-1) ?? '').trim() || first
    switch (tag) {
      case 'dc': return `DC ${first}`
      case 'hit': return Number(first) >= 0 ? `+${first}` : first
      case 'h': return 'Hit: '
      case 'chance': return `${first} percent`
      case 'recharge': return first ? `(Recharge ${first}-6)` : '(Recharge 6)'
      case 'note': return first
      default: return display || first
    }
  })
  // Tags nest: {@i see {@spell x}} needs a second sweep.
  for (let i = 0; i < 4 && /\{@/.test(out); i++) out = pass(out)
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * The labels of the stat block every background and race prints above its prose. The
 * stub already carries all of it as structured fields, so repeating it as sentences
 * would put "Skill Proficiencies. History, Persuasion" in a description.
 */
const STAT_BLOCK_LABELS = new Set([
  'skill proficiencies', 'tool proficiencies', 'weapon proficiencies',
  'armor proficiencies', 'languages', 'equipment', 'ability score increase',
  'age', 'alignment', 'size', 'speed',
])
const isStatBlockLabel = name =>
  STAT_BLOCK_LABELS.has(norm(String(name ?? '').replace(/:\s*$/, '')))

/**
 * Flatten an `entries` array into paragraphs.
 *
 * Tables are dropped: they are the "roll d8 for a characteristic" suggestions, and a
 * tab-separated dump of one in a description field reads as noise on the sheet.
 */
function render(entries, depth = 0) {
  const parts = []
  for (const e of entries ?? []) {
    if (e == null) continue
    if (typeof e === 'string' || typeof e === 'number') {
      parts.push(detag(e))
      continue
    }
    if (e.type === 'table') continue
    if (e.type === 'list') {
      for (const item of e.items ?? []) {
        if (typeof item === 'object' && isStatBlockLabel(item?.name)) continue
        const text = typeof item === 'string'
          ? detag(item)
          : [item.name ? `${label(item.name)}` : '', render(
              item.entries ?? (item.entry != null ? [item.entry] : []),
              depth + 1,
            )].filter(Boolean).join(' ')
        if (text) parts.push(`• ${text}`)
      }
      continue
    }
    if (isStatBlockLabel(e.name)) continue
    const body = render(e.entries ?? (e.entry != null ? [e.entry] : []), depth + 1)
    if (!body) continue
    parts.push(e.name ? `${label(e.name)} ${body}` : body)
  }
  return parts.filter(Boolean).join(depth > 0 ? ' ' : '\n\n')
}

/** A heading, punctuated once: "Fairy Magic." even when the book wrote "Fairy Magic:". */
const label = name => `${detag(name).replace(/[.:]\s*$/, '')}.`

/** The named sub-block of an entries array, e.g. a background's feature. */
function namedBlock(entries, name) {
  const want = tokens(String(name).replace(/^Feature:\s*/i, ''))
  for (const e of entries ?? []) {
    if (!e || typeof e !== 'object' || !e.name) continue
    if (tokens(String(e.name).replace(/^Feature:\s*/i, '')) === want) return e
  }
  return undefined
}

/** Everything except the named blocks, for a description that excludes its own feature. */
function entriesExcept(entries, names) {
  const skip = new Set(names.map(n => tokens(String(n).replace(/^Feature:\s*/i, ''))))
  return (entries ?? []).filter(e => !(
    e && typeof e === 'object' && e.name
    && skip.has(tokens(String(e.name).replace(/^Feature:\s*/i, '')))
  ))
}

// ── the corpus ────────────────────────────────────────────────────────────────

/**
 * Resolve 5etools' `_copy` reprints, which is where most of the prose hides.
 *
 * A reprint stores only what changed: Baldur's Gate's thirteen backgrounds are the
 * PHB's with one feature swapped, and Eberron's goblin is Volo's verbatim. Their own
 * `entries` are empty, so without this they match by name and then fill nothing.
 *
 * `_mod` is applied for `entries` alone — that is where a reprint puts its new feature,
 * and it is the only field this script reads.
 */
function resolveCopies(entries, sameThing = () => true) {
  const applyMods = (base, mods) => {
    let out = [...(base ?? [])]
    for (const mod of Array.isArray(mods) ? mods : [mods]) {
      if (!mod || typeof mod !== 'object') continue
      const items = Array.isArray(mod.items) ? mod.items : mod.items ? [mod.items] : []
      if (mod.mode === 'appendArr') out.push(...items)
      else if (mod.mode === 'prependArr') out.unshift(...items)
      else if (mod.mode === 'insertArr') out.splice(mod.index ?? out.length, 0, ...items)
      else if (mod.mode === 'replaceArr') {
        const target = tokens(
          typeof mod.replace === 'string' ? mod.replace : mod.replace?.index ?? '',
        )
        const at = out.findIndex(e => tokens(e?.name) === target)
        if (at >= 0) out.splice(at, 1, ...items)
        else out.push(...items)
      }
      else if (mod.mode === 'removeArr') {
        const names = new Set(
          (Array.isArray(mod.names) ? mod.names : [mod.names]).map(tokens),
        )
        out = out.filter(e => !names.has(tokens(e?.name)))
      }
    }
    return out
  }

  const resolve = (e, seen = new Set()) => {
    if (!e?._copy || e.__resolved) return e
    seen.add(e)
    const spec = e._copy
    const base = entries.find(cand =>
      tokens(cand.name) === tokens(spec.name)
      && src(cand.source) === src(spec.source)
      && sameThing(cand, spec))
    if (!base || seen.has(base)) return e
    const merged = { ...resolve(base, seen), ...e, __resolved: true }
    delete merged._copy
    merged.entries = applyMods(resolve(base, seen).entries, spec._mod?.entries ?? [])
    return merged
  }

  return entries.map(e => resolve(e))
}

function loadCorpus() {
  const races = rd(join(FIVE, 'races.json'))
  const klass = []
  const subclass = []
  const classFeature = []
  const subclassFeature = []
  const classDir = join(FIVE, 'class')
  for (const f of existsSync(classDir) ? readdirSync(classDir) : []) {
    if (!f.startsWith('class-')) continue
    const j = rd(join(classDir, f))
    klass.push(...(j.class ?? []))
    subclass.push(...(j.subclass ?? []))
    classFeature.push(...(j.classFeature ?? []))
    subclassFeature.push(...(j.subclassFeature ?? []))
  }
  const spell = []
  const spellDir = join(FIVE, 'spells')
  for (const f of existsSync(spellDir) ? readdirSync(spellDir) : []) {
    if (!f.startsWith('spells-')) continue
    spell.push(...(rd(join(spellDir, f)).spell ?? []))
  }
  const optionalfeature = existsSync(join(FIVE, 'optionalfeatures.json'))
    ? rd(join(FIVE, 'optionalfeatures.json')).optionalfeature ?? []
    : []
  return {
    race: resolveCopies(races.race ?? []),
    // Two books can each print a "Variant" subrace of different races, so a copy has
    // to agree on the parent race and not just the name.
    subrace: resolveCopies(
      races.subrace ?? [],
      (cand, spec) => !spec.raceName || tokens(cand.raceName) === tokens(spec.raceName),
    ),
    feat: resolveCopies(rd(join(FIVE, 'feats.json')).feat ?? []),
    background: resolveCopies(rd(join(FIVE, 'backgrounds.json')).background ?? []),
    klass, subclass, classFeature, subclassFeature, spell, optionalfeature,
  }
}

const C = loadCorpus()

/**
 * name+source -> entry, plus a name-only fallback.
 *
 * The source is tried first so a race printed in three books takes the text of the one
 * the mechanics came from; the fallback covers a stub whose `_source` was never recorded.
 */
function index(entries, keysOf = e => [e.name]) {
  const bySrc = new Map()
  const byName = new Map()
  for (const e of entries) {
    for (const k of keysOf(e)) {
      if (!k) continue
      const t = tokens(k)
      if (!bySrc.has(`${src(e.source)}|${t}`)) bySrc.set(`${src(e.source)}|${t}`, [])
      bySrc.get(`${src(e.source)}|${t}`).push(e)
      if (!byName.has(t)) byName.set(t, [])
      byName.get(t).push(e)
    }
  }
  /**
   * The printing the stub came from wins, then any printing of the name. `classId`
   * separates the copies of a feature printed once per class — Harness Divine Power
   * is worded differently for a cleric and a paladin.
   */
  return {
    get(name, source, classId) {
      for (const alias of aliases(name)) {
        const t = tokens(alias)
        for (const bucket of [bySrc.get(`${src(source)}|${t}`), byName.get(t)]) {
          if (!bucket?.length) continue
          if (classId) {
            const scoped = bucket.find(e => norm(e.className) === norm(classId))
            if (scoped) return scoped
          }
          return bucket[0]
        }
      }
      return undefined
    },
  }
}

/** A subrace is named by its variant plus its race, and sidebar variants are prefixed. */
const subraceKeys = (e) => {
  if (!e.name) return []
  const bare = String(e.name).replace(/^Variant;?\s+/i, '')
  const names = bare === e.name ? [e.name] : [e.name, bare]
  if (!e.raceName) return names
  return names.flatMap(n => [
    n, `${n} ${e.raceName}`, `${e.raceName} ${n}`, `${e.raceName} (${n})`, `Bloodline of ${n}`,
  ])
}

const IDX = {
  race: index(C.race),
  subrace: index(C.subrace, subraceKeys),
  feat: index(C.feat),
  background: index(C.background),
  spell: index(C.spell),
  subclass: index(C.subclass, e => [e.name, `${e.name} ${e.className}`]),
  optionalfeature: index([
    ...C.optionalfeature,
    ...C.classFeature.filter(f => f.isClassFeatureVariant),
    ...C.subclassFeature.filter(f => f.isClassFeatureVariant),
  ]),
}

/** classFeature and subclassFeature, keyed by the class and level that own them. */
const featureIdx = new Map()
for (const f of C.classFeature) {
  const k = `${norm(f.className)}|${f.level}|${tokens(f.name)}`
  if (!featureIdx.has(k)) featureIdx.set(k, [])
  featureIdx.get(k).push(f)
}
const subFeatureIdx = new Map()
for (const f of C.subclassFeature) {
  const k = `${norm(f.className)}|${norm(f.subclassShortName)}|${f.level}|${tokens(f.name)}`
  if (!subFeatureIdx.has(k)) subFeatureIdx.set(k, [])
  subFeatureIdx.get(k).push(f)
}
/** A feature the stub records without a level: search every level for the name. */
function anySubFeature(className, shortName, name) {
  for (const [k, v] of subFeatureIdx) {
    const [c, s, , n] = k.split('|')
    if (c === norm(className) && s === norm(shortName) && n === tokens(name)) return v[0]
  }
  return undefined
}

// ── filling ───────────────────────────────────────────────────────────────────

const stats = new Map()
const misses = []
const bump = (kind, field) => {
  const s = stats.get(kind) ?? { filled: 0, missed: 0 }
  s[field] += 1
  stats.set(kind, s)
}

const empty = s => typeof s !== 'string' || s.trim() === ''

/** Fill `holder.description` if empty. Returns true when anything was written. */
function fill(holder, text, kind, label) {
  if (!holder || !empty(holder.description)) return false
  const body = (text ?? '').trim()
  if (!body) {
    bump(kind, 'missed')
    misses.push(`${kind}: ${label}`)
    return false
  }
  holder.description = body
  bump(kind, 'filled')
  return true
}

function missing(kind, label) {
  bump(kind, 'missed')
  misses.push(`${kind}: ${label}`)
}

/** Every description an entry owns, so `_todo` can be cleared once none are empty. */
function remainingEmpty(entry) {
  let n = 0
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    if ('description' in o && empty(o.description)) n += 1
    for (const [k, v] of Object.entries(o)) {
      if (k === 'levelUpEvents') continue // options carry their own prose; not book text
      walk(v)
    }
  }
  walk(entry)
  return n
}

function fillTraits(entry, found, kind, book) {
  for (const trait of entry.traits ?? []) {
    if (!empty(trait.description)) continue
    const block = namedBlock(found?.entries, trait.name)
    fill(trait, render(block?.entries ?? []), kind, `${book}/${entry.name} — ${trait.name}`)
  }
}

const FILL = {
  races(entry, book) {
    const found = IDX.race.get(entry.name, entry._source)
    if (!found) return missing('race', `${book}/${entry.name}`)
    fillTraits(entry, found, 'race trait', book)
    for (const sub of entry.subraces ?? []) FILL.subraces(sub, book)
  },
  subraces(entry, book) {
    const found = IDX.subrace.get(entry.name, entry._source)
    if (!found) return missing('subrace', `${book}/${entry.name}`)
    fillTraits(entry, found, 'subrace trait', book)
  },
  feats(entry, book) {
    const found = IDX.feat.get(entry.name, entry._source)
    if (!found) return missing('feat', `${book}/${entry.name}`)
    fill(entry, render(found.entries), 'feat', `${book}/${entry.name}`)
  },
  backgrounds(entry, book) {
    const found = IDX.background.get(entry.name, entry._source)
    if (!found) return missing('background', `${book}/${entry.name}`)
    // A reprint renames it — "Baldur's Gate Feature: Patriar" replaces "Feature:
    // Position of Privilege" — which is also why some stubs have no feature name to
    // match on. Fall back to whatever block the book labels as the feature, and fill
    // the name too rather than leaving a nameless one behind.
    const labelled = (found.entries ?? []).find(e =>
      e && typeof e === 'object' && /feature:/i.test(String(e.name ?? '')))
    if (entry.feature && empty(entry.feature.name) && labelled) {
      entry.feature.name = detag(String(labelled.name)).replace(/^.*?Feature:\s*/i, '').trim()
    }
    const featureName = entry.feature?.name
    fill(
      entry,
      render(entriesExcept(found.entries, [
        ...(featureName ? [featureName, `Feature: ${featureName}`] : []),
        ...(labelled?.name ? [labelled.name] : []),
      ])),
      'background',
      `${book}/${entry.name}`,
    )
    if (featureName) {
      const block = namedBlock(found.entries, featureName) ?? labelled
      fill(entry.feature, render(block?.entries ?? []), 'background feature',
        `${book}/${entry.name} — ${featureName}`)
    }
  },
  spells(entry, book) {
    const found = IDX.spell.get(entry.name, entry._source)
    if (!found) return missing('spell', `${book}/${entry.name}`)
    const body = [render(found.entries)]
    if (found.entriesHigherLevel?.length) body.push(render(found.entriesHigherLevel))
    fill(entry, body.filter(Boolean).join('\n\n'), 'spell', `${book}/${entry.name}`)
  },
  optionalFeatures(entry, book) {
    const found = IDX.optionalfeature.get(entry.name, entry._source, entry.classId)
    if (!found) return missing('optional feature', `${book}/${entry.name}`)
    fill(entry, render(found.entries), 'optional feature', `${book}/${entry.name}`)
  },
  subclasses(entry, book) {
    const found = IDX.subclass.get(entry.name, entry._source)
    const className = found?.className ?? entry.classId
    const shortName = found?.shortName ?? entry.name
    // 5etools files a subclass's own blurb as a feature named after the subclass.
    const intro = anySubFeature(className, shortName, entry.name)
    fill(entry, render(intro?.entries ?? []), 'subclass', `${book}/${entry.name}`)
    for (const lvl of entry.levels ?? []) {
      for (const feature of lvl.features ?? []) {
        if (!empty(feature.description)) continue
        const key = `${norm(className)}|${norm(shortName)}|${lvl.level}|${tokens(feature.name)}`
        const hit = subFeatureIdx.get(key)?.[0]
          ?? anySubFeature(className, shortName, feature.name)
        fill(feature, render(hit?.entries ?? []), 'subclass feature',
          `${book}/${entry.name} — ${feature.name}`)
      }
    }
  },
  classes(entry, book) {
    for (const def of entry.featureDefinitions ?? []) {
      if (!empty(def.description)) continue
      let hit
      for (const [k, v] of featureIdx) {
        const [c, , n] = k.split('|')
        if (c === norm(entry.name) && n === tokens(def.name)) { hit = v[0]; break }
      }
      fill(def, render(hit?.entries ?? []), 'class feature', `${book}/${entry.name} — ${def.name}`)
    }
    for (const sub of entry.subclasses ?? []) FILL.subclasses(sub, book)
  },
}

let changedFiles = 0
for (const book of readdirSync(DATA)) {
  // srd/ is committed content and is not this script's business.
  if (book === 'srd') continue
  if (only.length && !only.includes(book)) continue
  const dir = join(DATA, book)
  if (!statSync(dir).isDirectory()) continue

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const path = join(dir, file)
    const before = readFileSync(path, 'utf8')
    const json = JSON.parse(before)

    for (const [category, filler] of Object.entries(FILL)) {
      for (const entry of json[category] ?? []) filler(entry, book)
    }
    // A marker that outlives the work it marks is worse than none.
    for (const arr of Object.values(json)) {
      if (!Array.isArray(arr)) continue
      for (const entry of arr) {
        if (entry?._todo && remainingEmpty(entry) === 0) delete entry._todo
      }
    }

    const after = `${JSON.stringify(json, null, 2)}\n`
    if (after === before) continue
    changedFiles += 1
    if (!dryRun) writeFileSync(path, after)
  }
}

const rows = [...stats.entries()].sort((a, b) => b[1].filled - a[1].filled)
let filled = 0
let missed = 0
console.log('kind                      filled   unmatched')
for (const [kind, s] of rows) {
  filled += s.filled
  missed += s.missed
  console.log(`${kind.padEnd(24)} ${String(s.filled).padStart(6)} ${String(s.missed).padStart(11)}`)
}
console.log(`\n${filled} description(s) filled, ${missed} unmatched, ${changedFiles} file(s) ${dryRun ? 'would change' : 'written'}`)
if (misses.length) {
  console.log('\nUnmatched (left empty):')
  for (const m of misses.slice(0, 40)) console.log(`  ${m}`)
  if (misses.length > 40) console.log(`  … and ${misses.length - 40} more`)
}
if (dryRun) console.log('\n--dry-run: nothing was written.')
