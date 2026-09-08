import { useRulepacksStore } from '~/stores/rulepacks'
import { RulepackSchema } from '~/schemas/rulepackSchema'

/**
 * Fragment load order. A fragment that patches a class or race (subclasses.json,
 * subraces.json) only merges if the fragment defining its target has already been
 * added, so order is explicit rather than left to the glob's alphabetical keys.
 * Files not listed here load last, alphabetically, and warn in dev.
 */
const SRD_FRAGMENT_ORDER = [
  'races',
  'subraces',
  'classes',
  'subclasses',
  'backgrounds',
  'feats',
  'spells',
]

/** SRD content ships in every build, so this glob is eager — equivalent to static imports. */
const srdFragments = import.meta.glob<{ default: unknown }>('../data/srd/*.json', { eager: true })

/**
 * Untracked non-SRD fragments, for local development only.
 *
 * Matches any JSON in any subdirectory of app/data except srd/, so a new folder
 * (homebrew/, playtest/, ...) is picked up with no loader change. .gitignore is an
 * allow-list over the same boundary, so any such folder is untracked automatically.
 *
 * Being untracked, these files cannot be statically imported — that would fail the
 * build wherever they are absent, CI included. import.meta.glob resolves at
 * build time and yields {} on no match, so a clean checkout compiles fine.
 *
 * Lazy (non-eager) on purpose: combined with the import.meta.dev guard below, the whole
 * branch is dead code in a production build, so non-SRD content is never bundled into a
 * deployed artifact even when a developer runs `pnpm generate` from a working copy that
 * has these files.
 */
const nonSrdFragments = import.meta.glob<{ default: unknown }>([
  '../data/**/*.json',
  '!../data/srd/**',
])

/**
 * Increment this when bundled SRD data changes in a way that requires re-seeding,
 * without changing the official SRD version number.
 */
const SRD_SEED_REVISION = 4

function fragmentName(path: string): string {
  return path.split('/').pop()!.replace(/\.json$/, '')
}

function inLoadOrder(paths: string[]): string[] {
  const rank = (p: string) => {
    const i = SRD_FRAGMENT_ORDER.indexOf(fragmentName(p))
    return i === -1 ? SRD_FRAGMENT_ORDER.length : i
  }
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export default defineNuxtPlugin(async () => {
  const rulepackStore = useRulepacksStore()

  // Ensure Dexie data is loaded before checking
  await rulepackStore.loadAll()

  const srdPaths = inLoadOrder(Object.keys(srdFragments))

  if (import.meta.dev) {
    const unknown = srdPaths.filter(p => !SRD_FRAGMENT_ORDER.includes(fragmentName(p)))
    if (unknown.length > 0) {
      console.warn(
        `[Waystone] SRD fragment(s) not in SRD_FRAGMENT_ORDER, loading last: ${unknown.join(', ')}. `
        + 'Add them to the order list if they patch a class or race.',
      )
    }
  }

  // All fragments share the same id/version — races.json drives the version check
  const racesPath = srdPaths.find(p => fragmentName(p) === 'races')
  const racesFragment = racesPath
    ? RulepackSchema.safeParse(srdFragments[racesPath]!.default)
    : undefined

  if (!racesFragment?.success) {
    console.error('[Waystone] Could not read app/data/srd/races.json — SRD not seeded.')
    return
  }

  const { id: packId, version } = racesFragment.data
  const seedRevisionKey = `waystone-srd-seed-revision-${packId}`
  const existing = rulepackStore.getById(packId)
  const storedRevision = Number(localStorage.getItem(seedRevisionKey) ?? 0)

  // Re-seed if the bundled version is newer or the internal seed revision has changed
  const needsSeeding = existing?.version !== version || storedRevision < SRD_SEED_REVISION

  if (needsSeeding) {
    for (const path of srdPaths) {
      const result = RulepackSchema.safeParse(srdFragments[path]!.default)
      if (!result.success) {
        console.error(`[Waystone] Failed to validate SRD fragment ${path}:`, result.error.issues)
        continue
      }
      if (import.meta.dev && result.data.version !== version) {
        console.warn(
          `[Waystone] ${path} declares version "${result.data.version}" but races.json `
          + `declares "${version}". Version is read from races.json only, so a mismatch `
          + 'silently changes re-seed behaviour for existing users.',
        )
      }
      await rulepackStore.add(result.data)
    }

    localStorage.setItem(seedRevisionKey, String(SRD_SEED_REVISION))
    console.info(`[Waystone] SRD ${version} rulepack loaded.`)
  }

  // Non-SRD development fragments merge on top, after the SRD pack exists
  if (!import.meta.dev) return

  for (const path of inLoadOrder(Object.keys(nonSrdFragments))) {
    const mod = await nonSrdFragments[path]!()
    const result = RulepackSchema.safeParse(mod.default)
    if (!result.success) {
      console.error(`[Waystone] Non-SRD fragment ${path} failed validation:`, result.error.issues)
      continue
    }
    await rulepackStore.add(result.data)
    console.warn(
      `[Waystone] Loaded NON-SRD fragment ${path} (dev only). It is merged into the stored `
      + 'rulepack in IndexedDB and will persist there even after the file is removed — '
      + 'clear site data to undo.',
    )
  }
})
