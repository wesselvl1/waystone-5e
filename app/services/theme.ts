/**
 * The two colours a player may choose: `primary` (violet — proficiency dots, buttons, the
 * active tab) and `accent` (amber — expertise, inspiration, temporary hit points, a
 * short-rest recharge). The sheet calls the accent "secondary"; the Tailwind token keeps
 * its old name so no component had to change.
 *
 * Tailwind reads both palettes from CSS custom properties (`tailwind.config.ts`), the
 * built-in values sit on `:root` in `main.css`, and `applyTheme()` overrides them on the
 * document element. A theme is stored as one hex per colour; the neighbouring shades are
 * derived from it, so a player picks one swatch rather than a ramp.
 */
import type { CharacterTheme } from '~/types/character'

export type ThemeColor = keyof CharacterTheme

export const THEME_COLORS: readonly ThemeColor[] = ['primary', 'accent']

/**
 * The shade each palette defines, and which one is the swatch the player picks: the shade
 * a proficient skill's dot is drawn in (primary 500) and an expertise dot (accent 400).
 * Only these shades exist — `text-primary-300` and the like generate no CSS and never
 * have, so a theme does not add them.
 */
const SHADES: Record<ThemeColor, { anchor: number, shades: Record<number, number> }> = {
  // How far each shade sits from the anchor: positive mixes in white, negative black.
  primary: { anchor: 500, shades: { 400: 0.25, 500: 0, 600: -0.12 } },
  accent: { anchor: 400, shades: { 400: 0, 500: -0.12 } },
}

/** The palette as shipped. Picking these exact values reproduces it shade for shade. */
const BUILT_IN: Record<ThemeColor, Record<number, string>> = {
  primary: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
  accent: { 400: '#f59e0b', 500: '#d97706' },
}

export const DEFAULT_THEME: Required<CharacterTheme> = {
  primary: BUILT_IN.primary[SHADES.primary.anchor]!,
  accent: BUILT_IN.accent[SHADES.accent.anchor]!,
}

export const THEME_LABELS: Record<ThemeColor, { label: string, hint: string }> = {
  primary: { label: 'Primary', hint: 'Proficiency, buttons, the active tab' },
  accent: { label: 'Secondary', hint: 'Expertise, inspiration, temporary hit points' },
}

/** A few starting points, so a phone's colour wheel is not the only way in. */
export const THEME_PRESETS: Record<ThemeColor, string[]> = {
  primary: ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#ef4444', '#ec4899', '#f97316', '#64748b'],
  accent: ['#f59e0b', '#facc15', '#fb7185', '#34d399', '#38bdf8', '#c084fc', '#f97316', '#e2e8f0'],
}

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function toRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`
}

/** Mixes towards white (amount > 0) or black (amount < 0). */
function mix(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return toHex(toRgb(hex).map(c => Math.round(c + (target - c) * t)) as [number, number, number])
}

/**
 * Each colour from the first layer that sets a valid one — a character's own, then the
 * player's default, then the built-in. Per colour, so a character can change only its
 * accent and still follow the default primary. Stored characters reach this without
 * passing the schema, hence the hex check rather than trusting the type.
 */
export function resolveTheme(...layers: (CharacterTheme | null | undefined)[]): Required<CharacterTheme> {
  const pick = (color: ThemeColor) =>
    layers.map(l => l?.[color]).find(isHexColor)?.toLowerCase() ?? DEFAULT_THEME[color]
  return { primary: pick('primary'), accent: pick('accent') }
}

/** Every shade a palette defines, worked out from the one swatch the player picked. */
export function themeShades(color: ThemeColor, hex: string): Record<number, string> {
  const swatch = hex.toLowerCase()
  if (swatch === DEFAULT_THEME[color]) return { ...BUILT_IN[color] }
  return Object.fromEntries(
    Object.entries(SHADES[color].shades).map(([shade, amount]) => [shade, mix(swatch, amount)]),
  )
}

/**
 * The custom properties `tailwind.config.ts` reads, as space-separated channels so
 * Tailwind can put its own alpha on them (`bg-primary-500/20`).
 */
export function themeVariables(theme: CharacterTheme): Record<string, string> {
  const resolved = resolveTheme(theme)
  const vars: Record<string, string> = {}
  for (const color of THEME_COLORS) {
    for (const [shade, hex] of Object.entries(themeShades(color, resolved[color])))
      vars[`--color-${color}-${shade}`] = toRgb(hex).join(' ')
  }
  return vars
}

/** Drops the colours left unset, and the whole object when none is set. */
export function compactTheme(theme: CharacterTheme): CharacterTheme | undefined {
  const kept = Object.fromEntries(
    THEME_COLORS.filter(c => isHexColor(theme[c])).map(c => [c, theme[c]!.toLowerCase()]),
  ) as CharacterTheme
  return Object.keys(kept).length > 0 ? kept : undefined
}
