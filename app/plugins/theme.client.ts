import { applyDefaultTheme } from '~/composables/useTheme'

/** Paints the app in the player's default colours before the first page renders. */
export default defineNuxtPlugin(() => {
  applyDefaultTheme()
})
