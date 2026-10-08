import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CharacterSchema } from '~/schemas/characterSchema'
import {
  compactTheme,
  DEFAULT_THEME,
  resolveTheme,
  themeShades,
  themeVariables,
} from '~/services/theme'
import { validCharacter } from '../fixtures'

describe('resolveTheme', () => {
  it('falls back to the built-in palette', () => {
    expect(resolveTheme()).toEqual(DEFAULT_THEME)
    expect(resolveTheme(undefined, null, {})).toEqual(DEFAULT_THEME)
  })

  it('resolves each colour from the first layer that sets it', () => {
    const character = { accent: '#38BDF8' }
    const playerDefault = { primary: '#10b981', accent: '#facc15' }
    expect(resolveTheme(character, playerDefault)).toEqual({ primary: '#10b981', accent: '#38bdf8' })
  })

  it('skips a value that is not a hex colour', () => {
    // Stored characters reach this without passing the schema.
    expect(resolveTheme({ primary: 'red; background: url(x)' }, { primary: '#123456' }).primary)
      .toBe('#123456')
  })
})

describe('themeShades', () => {
  it('reproduces the built-in palette exactly for the default swatch', () => {
    expect(themeShades('primary', '#8B5CF6')).toEqual({ 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' })
    expect(themeShades('accent', '#f59e0b')).toEqual({ 400: '#f59e0b', 500: '#d97706' })
  })

  it('keeps the picked swatch as the anchor shade and derives the rest', () => {
    const primary = themeShades('primary', '#3b82f6')
    expect(primary[500]).toBe('#3b82f6')
    expect(Object.keys(primary)).toEqual(['400', '500', '600'])
    // Lighter above, darker below
    expect(primary[400]).toBe('#6ca1f8')
    expect(primary[600]).toBe('#3472d8')

    const accent = themeShades('accent', '#38bdf8')
    expect(accent[400]).toBe('#38bdf8')
    expect(Object.keys(accent)).toEqual(['400', '500'])
  })
})

describe('themeVariables', () => {
  it('writes channels Tailwind can put an alpha on', () => {
    expect(themeVariables({})).toEqual({
      '--color-primary-400': '167 139 250',
      '--color-primary-500': '139 92 246',
      '--color-primary-600': '124 58 237',
      '--color-accent-400': '245 158 11',
      '--color-accent-500': '217 119 6',
    })
  })

  it('agrees with the defaults main.css puts on :root', () => {
    const css = readFileSync('app/assets/css/main.css', 'utf8')
    for (const [name, value] of Object.entries(themeVariables({})))
      expect(css).toContain(`${name}: ${value};`)
  })
})

describe('compactTheme', () => {
  it('drops unset colours, and the object when none is left', () => {
    expect(compactTheme({ primary: '#ABCDEF', accent: undefined })).toEqual({ primary: '#abcdef' })
    expect(compactTheme({})).toBeUndefined()
  })
})

describe('CharacterSchema theme', () => {
  it('keeps a valid theme and drops a colour that does not parse', () => {
    const parsed = CharacterSchema.parse({ ...validCharacter, theme: { primary: '#10b981', accent: 'yellow' } })
    expect(parsed.theme).toEqual({ primary: '#10b981' })
  })
})
