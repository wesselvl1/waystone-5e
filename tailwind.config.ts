import type { Config } from 'tailwindcss'

/** A colour read from a custom property, so Tailwind can still apply its own alpha. */
function themed(color: string, shade: number) {
  return `rgb(var(--color-${color}-${shade}) / <alpha-value>)`
}

export default {
  content: [
    './app/**/*.{vue,ts}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Waystone dark theme palette
        surface: {
          950: '#0b0f19',
          900: '#111827',
          800: '#1a2236',
          750: '#1e2a40',
          700: '#243044',
          600: '#2e3d55',
        },
        // Primary and accent are player-chosen (app/services/theme.ts): the built-in
        // values are the defaults on :root in main.css, and a theme overrides them.
        primary: {
          400: themed('primary', 400),
          500: themed('primary', 500),
          600: themed('primary', 600),
        },
        accent: {
          400: themed('accent', 400),
          500: themed('accent', 500),
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
        },
        success: {
          400: '#4ade80',
          500: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
