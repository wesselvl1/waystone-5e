/**
 * Pack every non-SRD rulepack fragment under app/data/ into a single zip in out/.
 *
 * Everything under app/data/ except srd/ is gitignored dev data — a book filled in from
 * your own copy of it stays on your machine. This is how you move it: one zip you can
 * hand to another browser through the rulepack importer, which reads zips as well as
 * bare JSON (app/services/zip.ts).
 *
 * srd/ is excluded on purpose. It ships inside the build and is re-seeded from there on
 * startup, so a copy in the zip would merge a second, staler version over it.
 *
 *   node scripts/pack-rulepacks.mjs                  # -> out/rulepacks.zip
 *   node scripts/pack-rulepacks.mjs tce xge          # only those book folders
 *   node scripts/pack-rulepacks.mjs --out /tmp/a.zip
 *
 * out/ rather than dist/: after a build, dist/ is Nuxt's link to .output/public, the
 * directory the deploy workflow uploads. Writing there would put deliberately-gitignored
 * book content into a public deploy artifact, and the next build would wipe it anyway.
 *
 * The zip is deterministic: fixed timestamps and a fixed entry order, so re-running over
 * unchanged data produces byte-identical output.
 *
 * No `#!/usr/bin/env node` line, unlike the other scripts here: this one is also imported
 * by tests/unit/rulepackZipImport.test.ts, and vitest fails to load a module whose source
 * starts with a shebang (`SyntaxError: Invalid or unexpected token`, before any test
 * runs). package.json invokes it as `node scripts/pack-rulepacks.mjs` and the file is not
 * executable, so the line bought nothing.
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync, crc32 } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'app', 'data')

/**
 * A fragment carrying a top-level `subclasses` or `subraces` array patches a class or
 * race defined elsewhere, and is dropped if it merges before its target exists. Sorting
 * patches last mirrors SRD_FRAGMENT_ORDER in the loader. The importer applies the same
 * rule to whatever order it finds, so this is belt and braces — it also keeps the zip
 * usable for anyone who unpacks it and imports the files by hand.
 */
function isPatchFragment(data) {
  return Array.isArray(data?.subclasses) || Array.isArray(data?.subraces)
}

/*
 * ── zip writing ─────────────────────────────────────────────────────────────
 *
 * A zip is small enough to spell out: a local header plus data per entry, a central
 * directory repeating those headers, and an end-of-central-directory record pointing at
 * it. No dependency earns its place here.
 */

// 1980-01-01 00:00, the zero point of the DOS timestamp format. Fixed rather than taken
// from mtime so the output is reproducible.
const DOS_DATE = 0x0021
const DOS_TIME = 0x0000

function localHeader(entry) {
  const name = Buffer.from(entry.path, 'utf8')
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034B50, 0) // signature
  head.writeUInt16LE(20, 4) // version needed
  head.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
  head.writeUInt16LE(entry.method, 8)
  head.writeUInt16LE(DOS_TIME, 10)
  head.writeUInt16LE(DOS_DATE, 12)
  head.writeUInt32LE(entry.crc, 14)
  head.writeUInt32LE(entry.body.length, 18)
  head.writeUInt32LE(entry.size, 22)
  head.writeUInt16LE(name.length, 26)
  head.writeUInt16LE(0, 28) // extra field length
  return Buffer.concat([head, name])
}

function centralHeader(entry) {
  const name = Buffer.from(entry.path, 'utf8')
  const head = Buffer.alloc(46)
  head.writeUInt32LE(0x02014B50, 0) // signature
  head.writeUInt16LE(20, 4) // version made by
  head.writeUInt16LE(20, 6) // version needed
  head.writeUInt16LE(0x0800, 8) // flags: UTF-8 names
  head.writeUInt16LE(entry.method, 10)
  head.writeUInt16LE(DOS_TIME, 12)
  head.writeUInt16LE(DOS_DATE, 14)
  head.writeUInt32LE(entry.crc, 16)
  head.writeUInt32LE(entry.body.length, 20)
  head.writeUInt32LE(entry.size, 24)
  head.writeUInt16LE(name.length, 28)
  head.writeUInt16LE(0, 30) // extra field length
  head.writeUInt16LE(0, 32) // comment length
  head.writeUInt16LE(0, 34) // disk number
  head.writeUInt16LE(0, 36) // internal attributes
  // External attributes: unix mode in the high 16 bits — regular file, rw-r--r--.
  // `>>> 0` because the shift alone overflows into a negative 32-bit int.
  head.writeUInt32LE((0o100644 << 16) >>> 0, 38)
  head.writeUInt32LE(entry.offset, 42)
  return Buffer.concat([head, name])
}

/**
 * Build a zip from `[{ path, content }]`, where content is a string or Buffer.
 * Exported so tests can feed the app's zip reader something this script produced.
 */
export function createZip(files) {
  const entries = []
  const chunks = []
  let offset = 0

  for (const file of files) {
    const raw = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8')
    const deflated = deflateRawSync(raw, { level: 9 })
    // Deflate grows tiny or already-dense files; store those instead.
    const useDeflate = deflated.length < raw.length
    const entry = {
      path: file.path,
      method: useDeflate ? 8 : 0,
      body: useDeflate ? deflated : raw,
      size: raw.length,
      crc: crc32(raw),
      offset,
    }
    const head = localHeader(entry)
    chunks.push(head, entry.body)
    offset += head.length + entry.body.length
    entries.push(entry)
  }

  const central = entries.map(centralHeader)
  const centralSize = central.reduce((n, b) => n + b.length, 0)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0) // signature
  end.writeUInt16LE(0, 4) // this disk
  end.writeUInt16LE(0, 6) // disk holding the central directory
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...chunks, ...central, end])
}

/* ── collecting fragments ──────────────────────────────────────────────────── */

function collect(only) {
  if (!existsSync(DATA)) return []

  const found = []
  for (const folder of readdirSync(DATA).sort()) {
    if (folder === 'srd') continue
    if (only.length > 0 && !only.includes(folder)) continue
    const dir = join(DATA, folder)
    if (!statSync(dir).isDirectory()) continue

    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue
      const text = readFileSync(join(dir, file), 'utf8')
      let data
      try {
        data = JSON.parse(text)
      }
      catch (err) {
        // A half-saved file would land in the zip as an unimportable fragment; better to
        // stop and name it than to ship it.
        throw new Error(`${folder}/${file} is not valid JSON: ${err.message}`)
      }
      found.push({ path: `${folder}/${file}`, content: text, patch: isPatchFragment(data) })
    }
  }

  return found.sort((a, b) => Number(a.patch) - Number(b.patch) || a.path.localeCompare(b.path))
}

/* ── cli ───────────────────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2)
  const outFlag = args.indexOf('--out')
  if (outFlag !== -1 && !args[outFlag + 1]) {
    console.error('--out needs a path')
    process.exit(1)
  }
  const out = outFlag === -1
    ? join(ROOT, 'out', 'rulepacks.zip')
    : resolve(args[outFlag + 1])
  // Everything that is not a flag, nor the path belonging to --out
  const only = args.filter((a, i) => !a.startsWith('-') && !(outFlag !== -1 && i === outFlag + 1))

  const files = collect(only)
  if (files.length === 0) {
    console.error(
      only.length > 0
        ? `No JSON found under app/data/ for: ${only.join(', ')}`
        : 'No non-SRD JSON found under app/data/. Run scripts/scaffold-books.mjs first.',
    )
    process.exit(1)
  }

  const zip = createZip(files)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, zip)

  for (const file of files) console.log(`  ${file.path}`)
  const packs = new Set(files.map(f => f.path.split('/')[0]))
  console.log(
    `\n${files.length} fragment(s) from ${packs.size} pack(s) -> ${out} `
    + `(${(zip.length / 1024).toFixed(1)} kB)`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
