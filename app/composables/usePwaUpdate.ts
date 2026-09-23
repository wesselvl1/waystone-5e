/**
 * Whether a new build may take over, and the one place that decides.
 *
 * The service worker is registered with `registerType: 'prompt'` (nuxt.config.ts), so a
 * new deploy downloads and precaches in the background and then *waits*. Until something
 * calls `updateServiceWorker()`, the tab keeps being served the build it launched with —
 * its JS, its schemas, and its `SRD_SEED_REVISION`. That last one is the point: the SRD
 * re-seed in `app/plugins/srd-loader.client.ts` runs at boot and drops the stored pack
 * before rebuilding it, so gating the worker is what gives a player the chance to export
 * before a release rewrites what is in IndexedDB.
 *
 * `describeUpdateState` and `updateStatusLabel` are pure so they are unit-testable under
 * the `node` vitest environment; `usePwaUpdate` itself needs Nuxt, the way
 * `useCharacterStats` does.
 */
import { computed, ref } from 'vue'

export type UpdateStatus =
  /** No service worker runtime — the dev server, or a prerender pass. */
  | 'unsupported'
  /** The first worker is still precaching; the app is not offline-ready yet. */
  | 'installing'
  | 'up-to-date'
  /** A new build is precached and waiting for the player to say when. */
  | 'update-available'
  | 'error'

/** The parts of `$pwa` this decision reads. Narrow on purpose, so a test can stand one up. */
export interface PwaUpdateFlags {
  needRefresh: boolean
  registrationError: boolean
  swActivated: boolean
}

export function describeUpdateState(flags: PwaUpdateFlags | undefined): UpdateStatus {
  if (!flags) return 'unsupported'
  // A waiting update is checked first: it cannot exist unless registration succeeded, so
  // an error flag alongside it is stale, and hiding an applicable update behind it would
  // leave the player stuck on an old build with no button to press.
  if (flags.needRefresh) return 'update-available'
  if (flags.registrationError) return 'error'
  if (!flags.swActivated) return 'installing'
  return 'up-to-date'
}

export function updateStatusLabel(status: UpdateStatus): string {
  switch (status) {
    case 'unsupported': return 'Offline copy not available'
    case 'installing': return 'Preparing offline copy…'
    case 'up-to-date': return 'Up to date'
    case 'update-available': return 'A new version is ready'
    case 'error': return 'Could not check for updates'
  }
}

/**
 * The warning, shared by the banner and the About page so one wording covers both.
 *
 * Applying an update is not undoable from inside the app: the new build migrates stored
 * characters on load and may re-seed the SRD pack. The player is told to export first
 * rather than being walked through one — the gate is the point, and the time to act on it
 * is what it buys.
 */
export const UPDATE_CONFIRM_TITLE = 'Update Waystone?'
export const UPDATE_CONFIRM_MESSAGE
  = 'The app will reload onto the new version. A new version can migrate your characters '
    + 'and rebuild the bundled SRD rulepack, and that cannot be undone from inside the app — '
    + 'export anything you would hate to lose first.'

export function usePwaUpdate() {
  const pwa = usePWA()

  const status = computed(() => describeUpdateState(pwa
    ? {
        needRefresh: pwa.needRefresh,
        registrationError: pwa.registrationError,
        swActivated: pwa.swActivated,
      }
    : undefined))

  const label = computed(() => updateStatusLabel(status.value))
  const updateAvailable = computed(() => status.value === 'update-available')

  /**
   * Set by "Later", and deliberately not persisted.
   *
   * A dismissal kept in localStorage is how a player ends up three releases behind with
   * no way back; a fresh launch should offer the update again.
   */
  const dismissed = ref(false)

  function dismiss() {
    dismissed.value = true
  }

  /** True only while this tab has an update the player has not waved off. */
  const showBanner = computed(() => updateAvailable.value && !dismissed.value)

  /** Activates the waiting worker and reloads onto it. Resolves as the page goes away. */
  async function applyUpdate() {
    await pwa?.updateServiceWorker(true)
  }

  const version = computed(() => useRuntimeConfig().public.appVersion)

  return { status, label, updateAvailable, showBanner, dismiss, applyUpdate, version }
}
