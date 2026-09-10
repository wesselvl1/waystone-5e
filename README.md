# Waystone

An offline-first, mobile-friendly D&D 5e character builder and digital character sheet — runs entirely in the browser as a Progressive Web App. No backend, no account required; all characters and game data are stored locally on your device.

## Features

- **Character Creation Wizard** — 7-step guided builder covering race, class, background, ability scores (standard array, point buy, or manual), skill proficiencies, starting equipment, and a final review.
- **Digital Character Sheet** — tabbed interface with swipe navigation:
  - *Combat* — ability scores, saving throws, skills, HP/AC/speed/initiative, attacks
  - *Spells* — spell slots (including Warlock pact magic), prepared spells
  - *Features* — race, class, and background features with use tracking
  - *Items* — equipment quantities and full currency tracking (cp/sp/ep/gp/pp)
  - *Notes* — conditions, free-text notes, appearance
- **Level Up Wizard** — contextual wizard that resolves HP gains, new spell slots, ability score improvements, feat choices, spell choices, and subclass selection at each level.
- **Rulepacks** — pluggable JSON rule sets for races, classes, backgrounds, feats, and spells. The SRD 5.1 ruleset ships built-in; custom packs can be imported from a local file or a URL.
- **Import / Export** — characters can be exported to JSON and re-imported on any device.
- **Fully offline** — PWA service worker caches all assets so the app works without a network connection after the first load.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 (static SPA) |
| UI | Vue 3 (Composition API) |
| Styling | Tailwind CSS |
| State | Pinia |
| Persistence | Dexie (IndexedDB) |
| PWA | @vite-pwa/nuxt (Workbox) |
| Validation | Zod |
| Language | TypeScript |
| Package manager | pnpm |

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server at `http://localhost:3000`:

```bash
pnpm dev
```

## Building for Production

Generate a fully static build (recommended — no server required):

```bash
pnpm generate
```

Or build for a Node server:

```bash
pnpm build
```

Preview a production build locally:

```bash
pnpm preview
```

## Rulepacks

Waystone uses a rulepack system to keep game rules separate from character data. A rulepack is a JSON file that defines races, classes, backgrounds, feats, and spells.

The **SRD 5.1** rulepack is bundled as a set of fragment files in `app/data/srd/` (`races.json`, `subraces.json`, `classes.json`, `subclasses.json`, `backgrounds.json`, `feats.json`, `spells.json`) which are merged and loaded automatically on startup. Additional rulepacks can be added through the **Rulepacks** page in the app — either by uploading a local `.json` file or by providing a URL.

Rulepack files are validated with Zod against the schema in `app/schemas/rulepackSchema.ts`.

### Entry ids

Ids are the merge key: an incoming entry whose id matches an existing one **replaces** it. The SRD uses bare ids (`satyr`, `fighter`), so a custom pack should prefix its own ids with a short source abbreviation — `mpmm-satyr`, `tce-artificer` — and reuse a bare id only when overriding the SRD deliberately (or when a patch entry's `classId` / `raceId` points at an SRD class or race on purpose).

Two books' takes on the same race are meant to coexist: prefixed ids keep both, and the pickers list each with the name of the pack it came from.

## Project Structure

```
app/
  components/sheet/   # Character sheet tab components
  composables/        # useCharacterStats — derived stat calculations
  data/srd/           # Bundled SRD 5.1 rulepack JSON fragments
  db/                 # Dexie database definition
  pages/              # File-based routing (index, characters, rulepacks)
  plugins/            # SRD auto-loader (client-side)
  schemas/            # Zod schemas for character and rulepack validation
  services/           # characterIO (export/import), levelUpService, rulepackImport
  stores/             # Pinia stores (characters, rulepacks)
  types/              # TypeScript types (Character, Rulepack, LevelUpEvent)
tests/                # Vitest unit tests + shared fixtures
```
