# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # also runs `nuxt prepare` (postinstall) — required before typecheck
pnpm dev              # dev server on http://localhost:3000
pnpm generate         # static build into .output/public (what CI deploys)
pnpm build            # Node-server build
pnpm preview
pnpm test             # vitest run
pnpm test:watch
pnpm pack:rulepacks   # zip every non-SRD app/data/ fragment into out/rulepacks.zip
```

`pack:rulepacks` writes to `out/` (gitignored), *not* `dist/` — after a build `dist/` is
Nuxt's link to `.output/public`, the directory the deploy workflow uploads, so a zip of
non-SRD book content written there would ride along into a public deploy.

Single test file / single test:

```bash
pnpm test tests/unit/levelUpService.test.ts
pnpm test -t "applies an ASI"
```

Typecheck (no npm script exists for this):

```bash
pnpm exec vue-tsc -b --force
```

**Build mode (`-b`) is required.** `tsconfig.json` has `"files": []` plus `"references"`, so
`vue-tsc --noEmit -p tsconfig.json` type-checks *nothing* and exits 0 — it silently passes
even with dozens of real errors, including template errors in `.vue` files. Note `tests/`
is not covered by either form, since the `.nuxt` project configs only include `app/`.

`@antfu/eslint-config` and `eslint` are installed but there is **no `eslint.config.*` file and no `lint` script** — `pnpm exec eslint .` fails. Don't tell the user to run lint; match surrounding style manually.

CI (`.github/workflows/ci.yml`) runs only `pnpm build` + `pnpm test` on PRs to `main`. Pushing a `v*.*.*` tag deploys `pnpm generate` output to Cloudflare Pages.

## Architecture

Nuxt 4 with `ssr: false` — a pure client-side SPA/PWA. There is no backend and no server routes; everything lives in IndexedDB (Dexie, `app/db/index.ts`, two tables: `characters`, `rulepacks`). `~` aliases `app/` in both `nuxt.config.ts` and `vitest.config.ts`.

### Rulepacks are the rules engine

Game content is data, not code. A **rulepack** (`app/types/rulepack.ts`) holds races, classes, subclasses, backgrounds, feats, spells and optional features. Characters store only ids (`race`, `background`, `classes[].classId`, `spells[].spellId`) plus denormalized display names so a sheet still renders if a pack is missing.

`RulepackSchema` (`app/schemas/rulepackSchema.ts`) is actually a **fragment** schema: every content array is optional and defaults to `[]`, and it accepts top-level `subclasses` / `subraces` arrays whose entries carry a `classId` / `raceId`. `useRulepacksStore().add(fragment)` merges a fragment into an existing pack **by matching `id`** (`mergeById`, incoming wins) and distributes those patch entries into the target class/race. This is how the bundled SRD is assembled from the JSON files in `app/data/srd/`, which all share `"id": "srd-5.1"`. There is one fragment per class (`fighter.json`, `wizard.json`, …), each carrying its own subclasses nested inside the class, plus `races.json`, `subraces.json`, `backgrounds.json`, `feats.json`, `spells.json` and `beasts.json`. No SRD fragment uses the top-level `subclasses` patch array any more — `subraces.json` is the only remaining patch fragment.

The rulepacks store is also the lookup layer — `getClass`, `getSpell`, `getAllSpells`, `getSubclass`, `getOptionalFeaturesForClass`, `getAllCreatures`, `getCreature`, `getCreaturesMatching` search across *all* loaded packs, so custom packs transparently extend or override the SRD.

Because ids are the merge key, a custom pack is expected to **prefix its entry ids with a source abbreviation** (`mpmm-satyr`) and reuse a bare SRD id only to override deliberately. So two books' versions of the same race are two entries, not a conflict — the `getAll*` list getters return both, each tagged with a `sourceName` (`WithSource<T>`), and every picker labels them. Don't "fix" that by de-duplicating a list by name; the source label is the disambiguator. Those getters also sort — by name, or level-then-name for spells — so merging a pack in never reshuffles a list. `composedPack()` deliberately stays on the raw arrays: `sourceName` is for display, not for the level-up pipeline.

### SRD seeding

`app/plugins/srd-loader.client.ts` merges the files in `app/data/srd/` on client startup. Only `SRD_FRAGMENT_ORDER` (`races`, then `subraces`) is ordered, because a patch fragment must follow the fragment defining its target; everything else is self-contained and loads alphabetically after. The loader globs the directory rather than importing each file, so adding a fragment needs no loader change. Re-seeding is gated by two things: the pack's `version` field and a `SRD_SEED_REVISION` constant tracked in `localStorage`.

**When you change anything in `app/data/srd/*.json`, bump `SRD_SEED_REVISION` in the loader** — otherwise existing users keep their stale IndexedDB copy. Load order matters: a fragment that patches a class (e.g. `subclasses.json`) must come after the fragment that defines it.

`tests/unit/srdData.test.ts` validates every SRD JSON file against `RulepackSchema`, so schema-invalid data fails CI.

### Level-up event pipeline

Level-up is a three-stage pipeline in `app/services/levelUpService.ts`, driven by `levelUpEvents` declared per class-level (and per subclass-level) in rulepack JSON:

1. `resolveLevelUpEvents(character, classId, newLevel, rulepack, optionalFeatures)` — translates the declarative `LevelUpEventDef`s (`app/types/rulepack.ts`) into runtime `LevelUpEvent`s (`app/types/events.ts`), skipping choices already made (e.g. a subclass already chosen) and adding the implicit HP / hit-die events.
2. `getAutomaticEvents` / `getChoiceEvents` split them; `app/pages/characters/[id]/levelup.vue` drives the UI for the choice events and produces `ResolvedChoice` objects.
3. `applyAutomaticEvents(...)` then `applyResolvedChoices(...)` return new `Character` objects.

There are three distinct type families here — `*EventDef` (JSON/rulepack), `*Event` (runtime), `Resolved*` (player answer). Adding a new level-up mechanic means touching all three plus the Zod `LevelUpEventDefSchema` discriminated union and the wizard page.

Non-obvious rules encoded in that service:

- **Regular spell slots are derived, not stored.** `baseSpellSlots()` in `app/services/spellcasting.ts` reads them off the character's classes: full casters count fully, half casters halve rounded down, pact magic not at all. With a *single* spellcasting class that class's own table applies — a paladin 5 has four 1st- and two 2nd-level slots, where a caster level of 2 would give three 1st only. `character.spellSlots` persists only `used` plus an optional manual `bonus`, so no level-up event writes slots. **Warlock `pactMagic` slots are absolute** and live in `character.warlockSlots`, separate from `character.spellSlots`.
- Slots come from the combined caster level, but **what a class may learn is capped by that class's own level** (`maxSpellLevelForClass`): a cleric 1 / wizard 1 has a 2nd-level slot yet may only prepare 1st-level spells from either list.
- **Multiclassing** lives in `app/services/multiclass.ts`. Entering a class as an additional class grants the SRD's reduced proficiency set from `ClassDefinition.multiclassing` and never saving throws; prerequisites warn rather than block.
- Class level tables contain placeholder feature names for subclass features ("Primal Path Feature", "Martial Archetype"). `isSubclassPlaceholder` regex-filters them out when the character's subclass supplies real features at that level.
- Changing CON (via ASI or feat) retroactively adjusts `hp.max`/`hp.current` by the modifier delta × total level. Feats with `hpBonusPerLevel` (Tough) apply retroactively *and* set `character.hpBonusPerLevel` for future level-ups.
- **A `CHOOSE_OPTION` pool gates its own entries.** `ChooseOptionDef` carries `minLevel`, `requiresOption` (another choice's answer — the Pact Boon behind Thirsting Blade) and `requiresSpell` (eldritch blast behind Agonizing Blast); `optionAvailable()` is the single check, and the service applies it against the *stored* character. A gate the same level-up run answers is not stored yet, so the wizard re-answers against a projected character — see `projectedCharacter` in `levelup.vue`.
- **`REPLACE_OPTION` trades one pool pick for another** (a warlock swapping an invocation on every level). It is declared per class-level like any other event, and `resolveOptionReplacement()` returns undefined unless there is both something to trade and something to trade it for. The swap overwrites the *same* choice id, so a pool's number of picks cannot drift.
- **A pick from a grouped pool gets its own feature**, id `option-<choiceId>`, so the sheet names it — `chosenOptions` alone left a warlock showing "Eldritch Invocations" and nothing else. Ungrouped one-off choices (Pact Boon, Totem Spirit) keep the older behavior of renaming the feature that raised them. `backfillPoolPickFeatures()` adds them to characters levelled before this existed.
- **A subrace can replace one of the race's traits.** `Subrace.replacesRaceTraits` names them, and a race's `levelUpEvents` group carries an optional `trait` tag so the events go with the trait — the SCAG tiefling bloodlines replace Infernal Legacy (spells and all), a half-elf descent replaces Skill Versatility. The creation wizard filters the same names out of the trait list and the stored features.
- **`CHOOSE_SKILL` is declarable from JSON**, with `from` defaulting to all eighteen skills — the half-elf's two, a feat's three. The wizard's picker greys out skills the character already has. It takes `whenOption` like a `GRANT_SPELLS` does, so one arm of a variant can ask for skills while another grants spells; `resolveUnlockedChoices` raises it when the option is answered in the same run.
- **A race or subrace `CHOOSE_OPTION` pick becomes a named feature**, and its guarded grants are applied by `RESOLVED_OPTION` — through `grantSpellsEvent`, so the ability, free casts and fixed slot level survive. Grants sitting at a later level are held back by the group's `level`, since the answer is given once. This is how the half-elf descents are modelled: one choice, each arm carrying its own consequence.
- **`GAIN_PROFICIENCY` and `SET_SPEED` take `whenOption` too**, so an arm of a choice can grant weapon proficiencies (Elf Weapon Training) or a speed (Fleet of Foot). `SET_SPEED` writes one movement mode on the character; a subrace that simply *has* the speed uses `speedOverrides` instead.
- **`Subrace.speedOverrides` is merged over the race's speeds** by `raceSpeeds()` in `multiclass.ts`, key by key, and the sheet prints fly/swim/climb beside the walk box. The character's stored `speeds.walk` stays editable, so the sheet's backfill for older characters adds only the modes beyond walking.
- **`Race.subraceOptional` makes the wizard offer "None".** A dwarf or an elf must pick a subrace; a half-elf, human, tiefling, half-orc or dragonborn is complete as printed, and once a sourcebook adds variants to one of those, forcing a pick made the plain race unbuildable.

### Derived stats

`app/composables/useCharacterStats.ts` computes everything derivable (modifiers, proficiency bonus, saves, skills, AC, initiative, spell DC, bardic inspiration) — nothing derived is persisted. Fields typed `number | null` on `Character` (`armorClass`, `initiative`, `attacks[].bonus`) mean "null = use the computed value"; the composable resolves them. It uses Nuxt auto-imports (`ref`, `computed`), so under the `node` vitest environment only its pure exports (`abilityMod`, `proficiencyBonus`) are unit-testable.

### Persistence gotcha

Dexie cannot structured-clone Vue reactive proxies. Anything going into IndexedDB is deep-cloned first (`JSON.parse(JSON.stringify(...))` in both stores), and `structuredClone` inside `levelUpService` requires callers to pass `toRaw(...)`. Keep that when adding write paths.

`app/pages/characters/[id]/index.vue` also runs `repairFeatures()` on load — back-filling missing `description`/`usesMax`/`recharge` on stored features from the rulepack's `featureDefinitions` and re-saving. This is the migration mechanism for characters created before feature data was enriched; there is no Dexie version migration (schema is still `version(1)`).

**Shape migrations go in `app/services/characterMigration.ts`.** The characters store reads raw from Dexie in *both* `loadAll` and `getById`, so a migration placed only in `CharacterSchema` never runs for stored characters — the schema guards the import boundary alone. `migrateCharacterShape()` is called from both the store and the schema's transform so there is one implementation, and it is deliberately tolerant: it never rejects a character.

### Validation boundary

All external JSON (character import, rulepack import from file or URL) goes through Zod in `app/services/characterIO.ts` / `rulepackImport.ts`. Both rulepack entry points return an *array* of fragments: they sniff the leading bytes and unpack a zip through `app/services/zip.ts` (a dependency-free reader over `DecompressionStream`), so one file can carry a whole book. Zip entries are re-ordered so patch fragments merge last, mirroring `SRD_FRAGMENT_ORDER`, and a single invalid fragment fails the whole import rather than merging half a book. `importFromUrl` restricts to http/https and uses `credentials: 'omit'`; the *caller* is responsible for showing the URL to the user for confirmation before fetching (documented anti-SSRF contract in that file). `CharacterSchema` must stay in sync with `app/types/character.ts` by hand — they are separate declarations.

## Notes

- Every SRD fragment declares `"version": "5.1"`. Keep them in sync — the loader reads the version from `races.json` only, so a mismatch there silently changes re-seed behavior for existing users.
- `Character` carries a few deprecated/transitional fields. `spellcastingAbility` is superseded by `classSpellcasting[sourceId].ability`, which `SpellsPanel` now reads so a multiclass caster gets a DC per list; the old field is still what `useCharacterStats` exposes as `spellSaveDC`/`spellAttackBonus` and what feat `spellcasting` prerequisites check, so it is written at creation and left alone. The flat `spells` array is still the source the sheet renders from; `classSpellcasting` carries the per-source ability and is populated by migration and by `SET_SPELLCASTING_ABILITY` on level-up.
- `classSpellcasting` is keyed by *source*, not strictly by class: entries carry `origin` (`class` | `race` | `background` | `feat`), an optional `label`, and `abilityChosen`, so a race or background grant can use its own ability without another shape change.
- `Character.hitDice` is one pool **per class** (`HitDicePool[]`), because a fighter/wizard spends d10s and d6s separately. A long rest recovers half the character's total, largest die first.
- Tailwind uses a custom dark palette (`surface`, `primary`, `accent`, `danger`, `success`) in `tailwind.config.ts` with `darkMode: 'class'`; the app is dark-only in practice. Prefer these tokens over raw hex/slate values in new components.
- The sheet is mobile-first: five tabs with touch-swipe navigation implemented in `app/pages/characters/[id]/index.vue`; tab components in `app/components/sheet/` receive the character and emit `update` patches upward (the page owns saving).
