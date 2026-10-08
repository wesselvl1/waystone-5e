/**
 * Which colours the app is painted in right now, and the player's default.
 *
 * The default is a per-device preference, so it lives in localStorage rather than in
 * IndexedDB beside the characters: it is not game data, nothing exports it, and losing it
 * costs one trip to the colour picker. A character's own colours are stored in the
 * character (`Character.theme`) and travel with an export.
 *
 * The pure half is `app/services/theme.ts`; this file is only the DOM and storage side.
 */
import type { Ref } from 'vue'
import type { Character, CharacterTheme } from '~/types/character'
import { compactTheme, resolveTheme, themeVariables } from '~/services/theme'

const STORAGE_KEY = 'waystone.theme'

function readDefault(): CharacterTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    // resolveTheme drops anything that is not a hex colour, so a hand-edited value is
    // harmless; compacting just keeps the junk out of the ref.
    return compactTheme(JSON.parse(raw)) ?? {}
  }
  catch {
    return {}
  }
}

/** Shared across every caller, so the sheet and the menu agree without a store. */
const defaultTheme = ref<CharacterTheme>(import.meta.client ? readDefault() : {})

/** Whichever `useCharacterTheme` caller painted the page last. */
let painter: symbol | undefined

/** Writes the resolved colours onto the document element, where Tailwind's classes read them. */
export function applyTheme(theme: CharacterTheme) {
  if (!import.meta.client) return
  const style = document.documentElement.style
  for (const [name, value] of Object.entries(themeVariables(theme)))
    style.setProperty(name, value)
}

export function useDefaultTheme() {
  function setDefaultTheme(theme: CharacterTheme) {
    defaultTheme.value = compactTheme(theme) ?? {}
    try {
      if (Object.keys(defaultTheme.value).length === 0) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTheme.value))
    }
    catch {
      // Private mode or blocked storage: the default holds for this session only.
    }
  }
  return { defaultTheme: readonly(defaultTheme), setDefaultTheme }
}

/**
 * Paints the page in a character's colours for as long as the calling component lives,
 * and hands back to the player's default when it unmounts.
 *
 * `preview` is a colour being dragged in a picker and not yet saved: it wins over the
 * character's, so the sheet moves with the picker without a write to IndexedDB on every
 * frame.
 */
export function useCharacterTheme(
  character: Ref<Character | null | undefined>,
  preview?: Ref<CharacterTheme | null | undefined>,
) {
  // Going from the sheet to the level-up page mounts one before the other unmounts, so
  // the page leaving must not repaint over the colours the page arriving has just set.
  const token = Symbol('character-theme')
  watchEffect(() => {
    painter = token
    applyTheme(resolveTheme(preview?.value, character.value?.theme, defaultTheme.value))
  })
  onUnmounted(() => {
    if (painter !== token) return
    painter = undefined
    applyDefaultTheme()
  })
}

/** Paints the page in the player's default — at boot, and on every page without a character. */
export function applyDefaultTheme() {
  applyTheme(resolveTheme(defaultTheme.value))
}
