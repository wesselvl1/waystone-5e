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
- **Rulepacks** — pluggable JSON rule sets for races, classes, subclasses, backgrounds, feats, spells, weapons, armour and more. The SRD 5.1 ruleset ships built-in; custom packs can be imported from a JSON file, a zip, or a URL, and any entry can be edited in the app into your own Homebrew pack.
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

Waystone keeps game rules separate from character data. A rulepack is JSON that defines races, subraces, classes, subclasses, backgrounds, feats, spells, optional class features, weapons, armour and creatures. Level-up behaviour is data too: each class level, race, feat and so on declares *level-up events* (grant these spells, ask for a skill, offer a subclass) that the level-up wizard carries out.

**To write your own pack, see [docs/rulepacks.md](docs/rulepacks.md).** It covers the file format, every content kind and event type, worked examples, how to test a pack, and what the app doesn't support yet.

The **SRD 5.1** rulepack is bundled as fragment files in `app/data/srd/` — one per class (`fighter.json`, `wizard.json`, …, each with its subclasses inside), plus `races.json`, `subraces.json`, `backgrounds.json`, `feats.json`, `spells.json`, `weapons.json`, `armor.json` and `beasts.json` — all sharing the pack id `srd-5.1` and merged on startup. Other packs are added on the **Rulepacks** page from a `.json` file, a `.zip` of several, or a URL. Every import is validated against the Zod schema in `app/schemas/rulepackSchema.ts`.

### Entry ids

Ids are the merge key. Files that share a pack `id` merge into one pack, and within a pack an entry with an existing id **replaces** it whole. The SRD uses bare ids (`fighter`, `fire-bolt`), so a custom pack should prefix its own with a short source abbreviation — `mpmm-satyr`, `tce-artificer`. A top-level `subclasses` or `subraces` entry points at a class or race in any pack through its `classId` / `raceId`.

Reusing another pack's id does **not** override it: two packs' entries with the same id are both listed, each labelled with its pack's name, which is how two books' takes on the same race coexist. To change an existing entry, edit it in the app. The edit is saved as a copy in the Homebrew pack, which takes precedence over the original, and the book itself is never modified.

## Project Structure

```
docs/                 # Guides — rulepacks.md for pack authors
scripts/              # Book scaffolding and pack-rulepacks (zip non-SRD data)
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
