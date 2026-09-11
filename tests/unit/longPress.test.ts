import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLongPress } from '~/composables/useLongPress'

/** Pointer events, reduced to the three fields the gesture actually reads. */
function press(x = 0, y = 0, button = 0) {
  return { clientX: x, clientY: y, button } as PointerEvent
}

function click() {
  const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
  return e as unknown as MouseEvent & { preventDefault: ReturnType<typeof vi.fn>, stopPropagation: ReturnType<typeof vi.fn> }
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens after the row is held, and swallows the click that ends the hold', () => {
    const opened = vi.fn()
    const { bind } = useLongPress<string>(opened)
    const row = bind('fireball')

    row.onPointerdown(press())
    expect(opened).not.toHaveBeenCalled()

    vi.advanceTimersByTime(400)
    expect(opened).toHaveBeenCalledWith('fireball')

    const ended = click()
    row.onClickCapture(ended)
    expect(ended.stopPropagation).toHaveBeenCalled()
  })

  it('leaves a tap alone, so the row still picks', () => {
    const opened = vi.fn()
    const { bind } = useLongPress<string>(opened)
    const row = bind('fireball')

    row.onPointerdown(press())
    vi.advanceTimersByTime(120)
    row.onPointerup()
    vi.advanceTimersByTime(1000)

    expect(opened).not.toHaveBeenCalled()

    const tap = click()
    row.onClickCapture(tap)
    expect(tap.stopPropagation).not.toHaveBeenCalled()
  })

  it('treats a press that wanders as a scroll', () => {
    const opened = vi.fn()
    const { bind, pressing } = useLongPress<string>(opened)
    const row = bind('fireball')

    row.onPointerdown(press(100, 100))
    expect(pressing.value).toBe('fireball')
    row.onPointermove(press(100, 140))
    expect(pressing.value).toBeNull()

    vi.advanceTimersByTime(1000)
    expect(opened).not.toHaveBeenCalled()
  })

  it('rides out the jitter of a finger that stays put', () => {
    const opened = vi.fn()
    const { bind } = useLongPress<string>(opened)
    const row = bind('fireball')

    row.onPointerdown(press(100, 100))
    row.onPointermove(press(103, 96))
    vi.advanceTimersByTime(400)

    expect(opened).toHaveBeenCalledWith('fireball')
  })

  it('ignores a press that is not the primary button', () => {
    const opened = vi.fn()
    const { bind } = useLongPress<string>(opened)

    bind('fireball').onPointerdown(press(0, 0, 2))
    vi.advanceTimersByTime(1000)

    expect(opened).not.toHaveBeenCalled()
  })

  it('abandons a press in progress when the list moves on', () => {
    const opened = vi.fn()
    const { bind, cancel } = useLongPress<string>(opened)

    bind('fireball').onPointerdown(press())
    cancel()
    vi.advanceTimersByTime(1000)

    expect(opened).not.toHaveBeenCalled()
  })
})
