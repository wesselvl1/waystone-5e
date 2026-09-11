/**
 * Press-and-hold on a row of a pick-list, for reading what you are about to pick.
 *
 * A picker's rows commit on tap, so the tap itself cannot also open a description —
 * which leaves a player choosing a spell by its name alone. Holding the row opens it
 * instead, the gesture a phone already spells "tell me more", and the click that ends
 * the hold is swallowed so reading a spell never also picks it.
 *
 * The handlers belong on an element *wrapping* the pick control, not on the control
 * itself: the swallow is a capture-phase click listener, and only an ancestor's capture
 * listener runs before the target's own `@click`.
 *
 * `vue` is imported explicitly rather than left to Nuxt's auto-imports so the gesture is
 * unit-testable under the `node` vitest environment.
 */
import { getCurrentInstance, onUnmounted, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'

/** How long a row must be held before it opens. Long enough not to fire on a tap. */
const HOLD_MS = 400

/** A press that wanders further than this is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 10

export interface LongPressOptions {
  holdMs?: number
  moveTolerancePx?: number
}

/** The listeners to spread onto the row wrapper with `v-bind`. */
export interface LongPressHandlers {
  onPointerdown: (e: PointerEvent) => void
  onPointermove: (e: PointerEvent) => void
  onPointerup: () => void
  onPointerleave: () => void
  onPointercancel: () => void
  onClickCapture: (e: MouseEvent) => void
  onContextmenu: (e: Event) => void
}

export interface LongPress<T> {
  /** The row being held, for press feedback; null once the hold fires or is cancelled. */
  pressing: Ref<T | null>
  /** Listeners for one row, identified by the value handed back on a completed hold. */
  bind: (value: T) => LongPressHandlers
  /** Abandon a press in progress — when the list itself changes underneath it. */
  cancel: () => void
}

export function useLongPress<T>(
  onLongPress: (value: T) => void,
  options: LongPressOptions = {},
): LongPress<T> {
  const holdMs = options.holdMs ?? HOLD_MS
  const tolerance = options.moveTolerancePx ?? MOVE_TOLERANCE_PX

  const pressing = shallowRef<T | null>(null)
  const timer = ref<ReturnType<typeof setTimeout>>()
  let origin: { x: number, y: number } | null = null

  /** Set when a hold fires, and cleared by the click that lifting the finger sends. */
  let swallowClick = false

  function cancel() {
    if (timer.value !== undefined) clearTimeout(timer.value)
    timer.value = undefined
    origin = null
    pressing.value = null
  }

  function start(value: T, e: PointerEvent) {
    // A second button, or a pen's barrel — not the press this is about
    if (e.button !== 0) return
    cancel()
    swallowClick = false
    origin = { x: e.clientX, y: e.clientY }
    pressing.value = value
    timer.value = setTimeout(() => {
      timer.value = undefined
      origin = null
      pressing.value = null
      swallowClick = true
      onLongPress(value)
    }, holdMs)
  }

  function move(e: PointerEvent) {
    if (timer.value === undefined || !origin) return
    if (Math.abs(e.clientX - origin.x) > tolerance || Math.abs(e.clientY - origin.y) > tolerance)
      cancel()
  }

  function bind(value: T): LongPressHandlers {
    return {
      onPointerdown: (e: PointerEvent) => start(value, e),
      onPointermove: move,
      onPointerup: cancel,
      onPointerleave: cancel,
      onPointercancel: cancel,
      onClickCapture: (e: MouseEvent) => {
        if (!swallowClick) return
        swallowClick = false
        e.preventDefault()
        e.stopPropagation()
      },
      // A held row on Android otherwise raises the text-selection menu over the preview
      onContextmenu: (e: Event) => {
        if (swallowClick || timer.value !== undefined) e.preventDefault()
      },
    }
  }

  // Composables are called from components here, but a test may call this bare
  if (getCurrentInstance()) onUnmounted(cancel)

  return { pressing, bind, cancel }
}
