import type { Config } from 'tailwindcss'

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
        primary: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        accent: {
          400: '#f59e0b',
          500: '#d97706',
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
