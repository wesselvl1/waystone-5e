# Starting Equipment and Gold Buy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The character-creation wizard offers each class's printed starting-equipment choices (or a rolled gold buy), and turns the result into inventory, attacks and the best armour class — with a 1st-level subclass picked first so proficiency and subclass AC are known.

**Architecture:** Equipment is rulepack data: `ClassDefinition.startingEquipment` / `startingWealth`, a new `equipmentPacks` content array, and an optional `ArmorDefinition.subclassId`. A pure service `app/services/startingEquipment.ts` turns a class's data plus the player's picks into a kit; `armorClass.ts` gains the "best AC" chooser. `new.vue` only wires state to those functions.

**Tech Stack:** Nuxt 4 (SPA), Vue 3 `<script setup>`, TypeScript, Zod, Pinia, Vitest (`node` env), Tailwind with the project palette.

**Spec:** `docs/superpowers/specs/2026-11-06-starting-equipment-design.md`

## Global Constraints

- Branch off `main` (e.g. `feat/starting-equipment`); never stack on another open PR.
- Every `app/data/srd/*.json` change: bump `SRD_SEED_REVISION` in `app/plugins/srd-loader.client.ts` once for the branch; every SRD fragment keeps `"id": "srd-5.1"`, `"version": "5.1"`.
- New rulepack fields: `app/types/rulepack.ts` **and** `RulepackSchema` (`app/schemas/rulepackSchema.ts`) **and** `docs/rulepacks.md`, whose examples must validate against the schema.
- `app/data/` outside `srd/` is gitignored — the artificer data (Task 7) is edited locally and never committed.
- Logic lives in services and is unit-tested under the `node` vitest env; pages only wire it.
- Objects headed for Dexie or `structuredClone` must not be reactive proxies (`new.vue` already JSON-clones before `resolveFirstClassLevel` — keep new fields inside that clone).
- Typecheck with `pnpm exec vue-tsc -b --force`; tests with `pnpm test`. There is no lint script.
- Tailwind palette tokens only (`surface`, `primary`, `accent`, `danger`, `success`); mobile-first.
- Starting wealth (exact): barbarian, druid `2d4 ×10`; sorcerer `3d4 ×10`; rogue, warlock, wizard `4d4 ×10`; bard, cleric, fighter, paladin, ranger, artificer `5d4 ×10`; monk `5d4 ×1`.
- AC ties go to the unarmored candidate, never to armour.
- Gold buy: no class items, no background items, no background coins; `currency.gp` = the entered amount.
- Ammunition is inventory only — never an attack.

## Review Focus

1. **Class or subclass changed after picks were made** — stale picks must be cleared, never resolved against the new class. The page's watch clears them (Task 6); the guard behind it is `isSelectionComplete` returning false for a selection sized for another class (Task 3 test).
2. **A book class referencing a weapon, armour or pack id that no loaded pack defines** — that line is skipped with the rest of the kit intact, not a crash (Task 3 test `skips unknown ids`).
3. **Gold-buy field empty, negative or fractional** — the step cannot advance until it holds a whole number ≥ 0 (Task 3 test on `parseGoldAmount`).
4. **A level-0 character saved with `subclassId` set (the hand-off to the level-up wizard)** — the level-up wizard must not ask for the subclass again and must not add its features twice (Task 5 equivalence test).
5. **A monk who somehow holds a shield, or a barbarian with a shield** — the monk's Unarmored Defense drops the shield, the barbarian's keeps it, and the chooser compares totals *with* that applied (Task 4 tests).

---

### Task 1: Rulepack shape — starting equipment, wealth, packs, subclass-tagged armour

**Files:**
- Modify: `app/types/rulepack.ts` (near `ClassDefinition` :574, `ArmorDefinition` :862, `Rulepack` :912)
- Modify: `app/schemas/rulepackSchema.ts` (class schema ~:455, armour ~:557, fragment arrays ~:628, `EntrySchemas` ~:661)
- Modify: `app/stores/rulepacks.ts` (merge :48/:80, getters near `getAllArmor` :319, `composedPack` :389)
- Modify: `app/services/homebrew.ts` (`ENTRY_KINDS` beside `armor` :241, empty pack :552)
- Modify: `app/components/sheet/ArmorClassModal.vue:263` ("Your class" hint)
- Modify: `docs/rulepacks.md`
- Test: `tests/unit/rulepackSchema.test.ts`, `tests/unit/rulepackMerge.test.ts`, `tests/unit/homebrew.test.ts`

**Interfaces — Produces:**

```ts
export type StartingItem =
  | { kind: 'weapon'; id: string; quantity?: number }          // quantity default 1
  | { kind: 'armor'; id: string; name?: string }                // name overrides display ("Wooden shield")
  | { kind: 'pack'; id: string }
  | { kind: 'item'; name: string; quantity?: number; weight?: number }
  | { kind: 'weaponChoice'; category?: WeaponCategory; rangeType?: 'melee' | 'ranged' }
  | { kind: 'itemChoice'; label: string; options?: string[] }   // no options = free text

export interface StartingEquipmentOption {
  label: string                       // as printed: "a light crossbow and 20 bolts"
  items: StartingItem[]
  /** "(if proficient)": offered only when every weapon/armour in `items` is proficient. */
  requiresProficiency?: boolean
}
/** One printed bullet. A single option is a fixed grant. */
export interface StartingEquipmentChoice { options: StartingEquipmentOption[] }

export interface StartingWealth { dice: string; multiplier: number }   // { dice: '5d4', multiplier: 10 }

export interface EquipmentPackItem { name: string; quantity: number; weight?: number }
export interface EquipmentPack { id: string; name: string; cost?: string; contents: EquipmentPackItem[] }

// ClassDefinition gains:  startingEquipment?: StartingEquipmentChoice[];  startingWealth?: StartingWealth
// ArmorDefinition gains:  subclassId?: string   (only meaningful with classId)
// Rulepack gains:         equipmentPacks: EquipmentPack[]   (schema: optional, default [])
// Store gains:            getAllEquipmentPacks(): WithSource<EquipmentPack>[];  getEquipmentPack(id): EquipmentPack | undefined
```

- [ ] **Step 1: Write failing tests.** In `rulepackSchema.test.ts`: `it('accepts a class with startingEquipment and startingWealth')` parses a minimal fragment carrying one class with one `requiresProficiency` option using every `StartingItem` kind, and asserts round-trip equality; `it('defaults equipmentPacks to []')`. In `rulepackMerge.test.ts`: `it('merges equipmentPacks by id, incoming wins')`. In `homebrew.test.ts`: `it('lists equipmentPacks as an editable kind')` asserting `ENTRY_KINDS.some(k => k.key === 'equipmentPacks')` and that `EntrySchemas.equipmentPacks` parses a pack.
- [ ] **Step 2: Run** `pnpm test tests/unit/rulepackSchema.test.ts tests/unit/rulepackMerge.test.ts tests/unit/homebrew.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the types, Zod schemas (`StartingItemSchema` as a `z.discriminatedUnion('kind', …)`), store merge/getters (mirror every place `armor` appears in `rulepacks.ts`), the homebrew kind (form fields: name and cost; `contents` is edited in the JSON tab), and in `ArmorClassModal.vue` show "Your class" only when `armor.classId` matches **and** (`!armor.subclassId` or the character's class entry has that `subclassId`).
- [ ] **Step 4: Document** `startingEquipment`, `startingWealth`, `equipmentPacks` and `ArmorDefinition.subclassId` in `docs/rulepacks.md` with one fighter-bullet example that validates.
- [ ] **Step 5: Run** the three tests plus `pnpm exec vue-tsc -b --force` — expect PASS / exit 0.
- [ ] **Step 6: Commit** `feat(rulepack): declare starting equipment, wealth and equipment packs`.

---

### Task 2: SRD data

**Files:**
- Create: `app/data/srd/equipment-packs.json`
- Modify: the 12 class files in `app/data/srd/`, `app/data/srd/armor.json` (`draconic-resilience`), `app/plugins/srd-loader.client.ts` (`SRD_SEED_REVISION`)
- Create test: `tests/unit/srdStartingEquipment.test.ts`

**Interfaces — Consumes:** Task 1 types. **Produces:** pack ids `burglars-pack`, `diplomats-pack`, `dungeoneers-pack`, `entertainers-pack`, `explorers-pack`, `priests-pack`, `scholars-pack`.

Pack contents (SRD 5.1 "Equipment Packs", verified):
- Burglar's (16 gp): backpack, bag of 1,000 ball bearings, 10 ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 flasks of oil, 5 rations, tinderbox, waterskin, 50 ft hempen rope.
- Diplomat's (39 gp): chest, 2 map/scroll cases, fine clothes, bottle of ink, ink pen, lamp, 2 flasks of oil, 5 sheets of paper, vial of perfume, sealing wax, soap.
- Dungeoneer's (12 gp): backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 rations, waterskin, 50 ft hempen rope.
- Entertainer's (40 gp): backpack, bedroll, 2 costumes, 5 candles, 5 rations, waterskin, disguise kit.
- Explorer's (10 gp): backpack, bedroll, mess kit, tinderbox, 10 torches, 10 rations, waterskin, 50 ft hempen rope.
- Priest's (19 gp): backpack, blanket, 10 candles, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 rations, waterskin.
- Scholar's (40 gp): backpack, book of lore, bottle of ink, ink pen, 10 sheets of parchment, little bag of sand, small knife.

Class data (SRD 5.1; "any X weapon" = `weaponChoice`; focus/instrument option lists below):
- **Barbarian:** greataxe | martial melee · 2 handaxes | simple · fixed: explorer's pack + 4 javelins.
- **Bard:** rapier | longsword | simple · diplomat's | entertainer's · lute | other instrument (`itemChoice`) · fixed: leather, dagger.
- **Cleric:** mace | warhammer *(requiresProficiency)* · scale mail | leather | chain mail *(requiresProficiency)* · light crossbow + 20 bolts | simple · priest's | explorer's · fixed: shield + holy symbol (`itemChoice`).
- **Druid:** wooden shield (`armor` `shield`, name "Wooden shield") | simple · scimitar | simple melee · fixed: leather, explorer's pack, druidic focus (`itemChoice`).
- **Fighter:** chain mail | leather + longbow + 20 arrows · martial + shield | two martial (two `weaponChoice`) · light crossbow + 20 bolts | 2 handaxes · dungeoneer's | explorer's.
- **Monk:** shortsword | simple · dungeoneer's | explorer's · fixed: 10 darts.
- **Paladin:** martial + shield | two martial · 5 javelins | simple melee · priest's | explorer's · fixed: chain mail + holy symbol.
- **Ranger:** scale mail | leather · 2 shortswords | two simple melee · dungeoneer's | explorer's · fixed: longbow + quiver + 20 arrows.
- **Rogue:** rapier | shortsword · shortbow + quiver + 20 arrows | shortsword · burglar's | dungeoneer's | explorer's · fixed: leather, 2 daggers, thieves' tools.
- **Sorcerer:** light crossbow + 20 bolts | simple · component pouch | arcane focus · dungeoneer's | explorer's · fixed: 2 daggers.
- **Warlock:** light crossbow + 20 bolts | simple · component pouch | arcane focus · scholar's | dungeoneer's · fixed: leather, one simple `weaponChoice`, 2 daggers.
- **Wizard:** quarterstaff | dagger · component pouch | arcane focus · scholar's | explorer's · fixed: spellbook.

`itemChoice` options: arcane focus — Crystal, Orb, Rod, Staff, Wand; druidic focus — Sprig of mistletoe, Totem, Wooden staff, Yew wand; holy symbol — Amulet, Emblem, Reliquary; other instrument — Bagpipes, Drum, Dulcimer, Flute, Horn, Lyre, Pan flute, Shawm, Viol. Arrows/bolts/quiver/thieves' tools/component pouch/spellbook are `item`.

- [ ] **Step 1: Write the failing test** `srdStartingEquipment.test.ts`: for each of the 12 SRD classes, `it('<class> declares starting equipment and wealth')` asserting `startingEquipment.length > 0` and `startingWealth` equals the Global Constraints value; `it('every referenced weapon, armour and pack id resolves')` loading `weapons.json`, `armor.json`, `equipment-packs.json`; `it('draconic resilience belongs to the draconic bloodline')` asserting `subclassId === 'draconic-bloodline'`; `it('the fighter offers chain mail or leather, longbow and 20 arrows')` pinning that bullet's two option labels.
- [ ] **Step 2: Run** `pnpm test tests/unit/srdStartingEquipment.test.ts` — FAIL.
- [ ] **Step 3: Add the data** and bump `SRD_SEED_REVISION`.
- [ ] **Step 4: Run** `pnpm test tests/unit/srdStartingEquipment.test.ts tests/unit/srdData.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(srd): starting equipment, wealth and equipment packs for every class`.

---

### Task 3: Starting-equipment service

**Files:**
- Create: `app/services/startingEquipment.ts`
- Test: `tests/unit/startingEquipment.test.ts`

**Interfaces — Consumes:** Task 1 types; `cleanEquipmentName` (`equipment.ts`); `isProficientWithWeapon`, `attackFromWeapon` (`attacks.ts`); `isProficientWithArmor` (`armorClass.ts`). **Produces:**

```ts
export interface EquipmentLookup {
  getWeapon(id: string): WeaponDefinition | undefined
  getArmor(id: string): ArmorDefinition | undefined
  getEquipmentPack(id: string): EquipmentPack | undefined
}
/** One answer per choice, same index. `picks[i]` answers `items[i]` of the chosen option: a weapon id or an item name. */
export interface EquipmentPick { option: number; picks: Record<number, string> }
export type EquipmentSelection = EquipmentPick[]

export interface StartingKit {
  items: Omit<EquipmentEntry, 'id'>[]                         // everything, weapons and armour included, merged by name
  weapons: { weapon: WeaponDefinition; quantity: number }[]   // merged by weapon id
  armor: ArmorDefinition[]                                    // body armour and shields as picked
}

export function availableOptions(choice: StartingEquipmentChoice, proficiencies: string[], lookup: EquipmentLookup): number[]  // indices offered
export function weaponsForChoice(item: Extract<StartingItem, { kind: 'weaponChoice' }>, all: WeaponDefinition[]): WeaponDefinition[]
export function isSelectionComplete(choices: StartingEquipmentChoice[], selection: EquipmentSelection, proficiencies: string[], lookup: EquipmentLookup): boolean
export function resolveStartingKit(choices: StartingEquipmentChoice[], selection: EquipmentSelection, lookup: EquipmentLookup): StartingKit
export function backgroundKit(lines: string[]): { items: Omit<EquipmentEntry, 'id'>[]; currency: Partial<Currency> }
export function attacksFromKit(kit: StartingKit, proficiencies: string[], modifiers: Record<AbilityKey, number>): Omit<AttackEntry, 'id'>[]
export function startingWealthLabel(w: StartingWealth): string            // "5d4 × 10 gp", "5d4 gp"
export function rollStartingWealth(w: StartingWealth, rng?: () => number): { rolls: number[]; total: number }
export function parseGoldAmount(raw: string | number | null): number | null   // whole number ≥ 0, else null
```

Notes: `weaponsForChoice` excludes `unarmed-strike` and filters by `category`/`rangeType` when given. `backgroundKit` moves `^\d+ (cp|sp|ep|gp|pp)$` and "… containing N gp" into currency (the latter leaves the container as an item, e.g. "Belt pouch"); the leading-count parse (`"5 sticks of incense"`) and `cleanEquipmentName` are lifted out of `new.vue:306`. Inventory lines for a weapon or armour take `weight` from its definition; pack and plain items carry a weight only where the data gives one. `attacksFromKit` is one attack per distinct weapon via `attackFromWeapon` with the `proficiencies` list.

- [ ] **Step 1: Write failing tests**, each with the spec's values:
  - `hides an "(if proficient)" option without the proficiency` — cleric bullet, proficiencies `['light','medium','shields','simple']` → `[0]`; with `'heavy'` added the chain mail option is offered.
  - `expands a pack into its contents` — explorer's pack → items include `{ name: 'Torch', quantity: 10 }` (names as stored in the pack file).
  - `merges two handaxes into one weapon of quantity 2` and `two picked longswords into one`.
  - `skips unknown ids` — an option naming `weapon: 'nope'` and `pack: 'nope'` still yields its other items.
  - `isSelectionComplete is false with a missing pick, an out-of-range option, or a selection sized for another class`.
  - `backgroundKit splits "Belt pouch containing 15 gp"` → item `Belt pouch`, currency `{ gp: 15 }`; `keeps "Prayer book or prayer wheel" as printed`.
  - `attacksFromKit marks a warhammer not proficient without martial`; `excludes arrows`.
  - `startingWealthLabel` for fighter and monk; `rollStartingWealth` with `rng = () => 0` → fighter `{ rolls: [1,1,1,1,1], total: 50 }`, monk total 5.
  - `parseGoldAmount('')`, `('-3')`, `('2.5')` → null; `('120')` → 120.
- [ ] **Step 2: Run** `pnpm test tests/unit/startingEquipment.test.ts` — FAIL.
- [ ] **Step 3: Implement** the functions above.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: resolve a class's starting-equipment picks into a kit`.

---

### Task 4: Best starting armour class

**Files:**
- Modify: `app/services/armorClass.ts`
- Test: `tests/unit/armorClass.test.ts`

**Interfaces — Consumes:** `configFromArmor`, `armorClassTotal`, `isProficientWithArmor`, `ArmorClassShield`. **Produces:**

```ts
/** Plain `unarmored` plus every unarmored entry whose classId matches and whose subclassId is absent or matches. */
export function unarmoredCandidates(all: ArmorDefinition[], classId: string, subclassId?: string): ArmorDefinition[]
/** Highest total wins; a tie goes to an unarmored candidate. A held shield is added to every candidate that allows one. Armour without proficiency is skipped. */
export function bestStartingArmorClass(
  worn: ArmorDefinition[],          // the kit's armour, shields included
  unarmored: ArmorDefinition[],
  proficiencies: string[],
  ctx: ArmorClassContext,
): ArmorClassConfig
```

The shield goes on as `{ equipped: true, armorId, name, bonus: shield.baseAC }`.

- [ ] **Step 1: Write failing tests:** `fighter Dex 14 in chain mail beats leather` (16); `barbarian Dex 14 Con 16 with a shield takes Unarmored Defense + shield` (17); `a tie goes to Unarmored Defense` (barbarian Dex 14 Con 14, no shield: Unarmored Defense 14 vs hide 12 + 2 = 14 → `armorId: 'unarmored-defense-barbarian'`); `a monk's Unarmored Defense drops the shield`; `draconic resilience is a candidate for the Draconic Bloodline only` (`unarmoredCandidates(all, 'sorcerer', 'wild-magic')` lacks it); `skips chain mail without heavy proficiency`.
- [ ] **Step 2: Run** `pnpm test tests/unit/armorClass.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: choose the best starting armour class, ties to unarmored`.

---

### Task 5: Choosing a 1st-level subclass at creation

**Files:**
- Modify: `app/services/levelUpService.ts` (export two small helpers)
- Modify: `app/pages/characters/new.vue` (class step, `draft`, `canProceed`, `createCharacter` classes entry)
- Test: `tests/unit/creationSubclass.test.ts`

**Interfaces — Produces:**

```ts
/** True when the class's own 1st level declares CHOOSE_SUBCLASS — read from data, never from class names. */
export function choosesSubclassAtFirstLevel(cls: ClassDefinition): boolean
/** GAIN_PROFICIENCY strings the subclass grants at the given level, ignoring `whenOption`-gated ones. */
export function subclassProficienciesAt(subclass: SubclassDefinition, level: number): string[]
```

`draft.subclassId: string` (cleared by a watch on `draft.classId`). The class step shows a searchable subclass list (`rulepackStore.getSubclassesForClass`, `filterBySearch` over name + description, as `levelup.vue:889`) only when `choosesSubclassAtFirstLevel(selectedClass)`; `canProceed` for step 1 then requires it. `createCharacter` writes `classes: [{ classId, level: 1, subclassId }]`; the level-0 hand-off keeps the `subclassId`.

- [ ] **Step 1: Write failing tests:** `choosesSubclassAtFirstLevel is true for SRD cleric, sorcerer, warlock and false for the other nine` (load the 12 files); `a homebrew class with CHOOSE_SUBCLASS at level 1 counts`; `subclassProficienciesAt(life-domain, 1)` contains `'heavy'`; **equivalence** — `a cleric whose domain is set before level 1 ends with the same features, otherProficiencies and spells as one who picks Life Domain in the level-up wizard`: path A sets `subclassId: 'life-domain'` and applies `resolveLevelUpEvents` automatic events + `applyResolvedChoices([])`; path B applies the same with `[{ type: 'RESOLVED_SUBCLASS', classId: 'cleric', subclassId: 'life-domain' }]` (copy the setup of `tests/unit/subclassConfirmationEvents.test.ts`); also assert path A's choice events contain no `CHOOSE_SUBCLASS`.
- [ ] **Step 2: Run** `pnpm test tests/unit/creationSubclass.test.ts` — FAIL.
- [ ] **Step 3: Implement** the helpers; if the equivalence test fails, fix the pipeline so both paths agree (do not special-case the test).
- [ ] **Step 4: Run** — PASS. Then wire the class step in `new.vue`.
- [ ] **Step 5: Typecheck** `pnpm exec vue-tsc -b --force` — exit 0.
- [ ] **Step 6: Commit** `feat: pick a 1st-level subclass in the creation wizard`.

---

### Task 6: Equipment step and character assembly

**Files:**
- Modify: `app/pages/characters/new.vue` (step 5 template :685-705, `draft`, `canProceed`, `createCharacter` equipment/attacks/armour/currency)
- Create (optional, if the step template passes ~80 lines): `app/components/creation/StartingEquipmentPicker.vue`

**Interfaces — Consumes:** everything in Tasks 3–5.

Behaviour:
- `draft.equipmentSelection: EquipmentSelection`, `draft.goldInput: string`; both reset by the watch on `draft.classId` and on `draft.subclassId`.
- Proficiency list for the step = `startingProficiencies()` + `subclassProficienciesAt(subclass, 1)`.
- Step 5, equipment mode: one card per choice; options as radio rows (only `availableOptions`); a `weaponChoice` gets a `<select>` from `weaponsForChoice(item, rulepackStore.getAllWeapons())`, an `itemChoice` a `<select>` of its options or a text input when it has none; the background's lines listed beneath. Replace the old "added automatically" copy.
- Step 5, gold mode (existing `draft.startingGold` toggle): show `startingWealthLabel`, a **Roll** button that fills `draft.goldInput` with `rollStartingWealth(...).total` and shows the individual dice, and a numeric input bound to `draft.goldInput` (`inputmode="numeric"`). Hide the toggle when the class has no `startingWealth`.
- `canProceed` step 5: equipment mode → `isSelectionComplete`; gold mode → `parseGoldAmount(draft.goldInput) !== null`.
- `createCharacter`: equipment mode → inventory = kit items + `backgroundKit` items (each with a fresh `crypto.randomUUID()`), currency gp from `backgroundKit`, `attacks` = `attacksFromKit` (ids added), `armorClassConfig` = `bestStartingArmorClass(kit.armor, unarmoredCandidates(getAllArmor(), classId, subclassId), proficiencies, { modifiers })` with modifiers from `effectiveAbilities`; `armorClass` stays `null`. Gold mode → no items, no attacks, no `armorClassConfig`, `currency.gp = parseGoldAmount(...)`.

- [ ] **Step 1: Implement** the step and assembly.
- [ ] **Step 2: Typecheck** `pnpm exec vue-tsc -b --force` and `pnpm test` — all green.
- [ ] **Step 3: Verify in the browser** (`preview_start` the dev server): create (a) a fighter Dex 14 taking chain mail, longsword + shield, light crossbow, explorer's pack → sheet shows AC 18, a Longsword and a Light Crossbow attack, 10 torches and 20 bolts in the inventory; (b) a Draconic Bloodline sorcerer → AC 13 + Dex; (c) a Life cleric offered chain mail; (d) a fighter with gold buy, rolled → empty inventory, gp equal to the field. Screenshot each sheet.
- [ ] **Step 4: Commit** `feat: starting equipment and gold buy in the creation wizard`.

---

### Task 7: Artificer (local, uncommitted)

**Files:** Modify `app/data/erlw/classes.json` (gitignored).

- [ ] **Step 1:** Add to the artificer: `startingWealth { dice: '5d4', multiplier: 10 }`; `startingEquipment`: fixed two `weaponChoice { category: 'simple' }`; fixed light crossbow + 20 bolts; studded leather | scale mail; fixed thieves' tools (`item`) + dungeoneer's pack.
- [ ] **Step 2:** Validate the edited file against `RulepackSchema` — run `pnpm test tests/unit/bookData.test.ts` if it covers local books (check its header), otherwise parse the file in a one-off vitest run — PASS.
- [ ] **Step 3:** In the browser, re-import or reload so the book updates, then create an artificer and confirm both simple-weapon pickers appear. **Do not commit** — `git status` must show nothing under `app/data/erlw/`.

---

### Task 8: Whole-branch check

- [ ] `pnpm test` and `pnpm exec vue-tsc -b --force` green; `pnpm build` succeeds.
- [ ] `git status` clean apart from intended commits; nothing under `app/data/` outside `srd/` staged.
