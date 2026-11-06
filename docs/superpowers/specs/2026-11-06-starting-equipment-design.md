# Starting equipment and gold buy at character creation

## Why

Creating a character today leaves the inventory empty apart from the background's list.
Step 5 of `app/pages/characters/new.vue` claims "Starting equipment packs will be added
automatically from your class and background", but no class carries an equipment list, so
nothing is. The "Start with gold instead" toggle clears the background's items and gives
**no gold** — every coin stays at 0. A player building a fighter has to read the class's
equipment choices on another site and type the result in by hand, and then remember to set
up the attacks and the armour class to match.

Success: picking a class's equipment in the wizard produces a ready sheet — the items in
the inventory, an attack for every weapon, and the armour class set to the best option the
character has — and gold buy produces a purse with the class's starting wealth in it.

## Scope: the classes

Every playable class needs the data, in the SRD and in the local (gitignored) books:

- **SRD (`app/data/srd/<class>.json`, committed):** barbarian, bard, cleric, druid,
  fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard.
- **Local books:** only `app/data/erlw/classes.json` defines a class — the **Artificer**.
  Every other book adds subclasses, races, backgrounds and so on, but no class. The
  artificer's data is added to that local file by hand; it is never committed (the
  `app/data/` allow-list keeps it out), and the scaffold/fill scripts do not need to learn
  to produce it.

## Decided with the user

1. **Choices are data, per class.** Each class declares its "(a) or (b)" choices and its
   fixed items in its rulepack JSON, so a book's class brings its own list without code.
2. **Step 5 shows one row per choice** where the player picks (a) or (b), with the
   background's items listed alongside.
3. **"A martial weapon" / "any simple weapon" is a real pick** from the loaded weapon list
   (`getAllWeapons()`, filtered by category and, where the book says so, melee/ranged), so
   the result is a specific weapon.
4. **Equipment packs expand into their contents.** The explorer's pack becomes a
   backpack, a bedroll, a mess kit, 10 torches, … as separate inventory lines, so a used
   torch can be tracked and nobody has to look up what is in the pack.
5. **Weapons become attacks.** Every weapon the character ends up with gets an attack
   entry, built with the existing `attackFromWeapon()` (ability from finesse/ranged,
   proficiency from `isProficientWithWeapon`). Two handaxes are one attack and quantity 2
   in the inventory.
6. **Ammunition is inventory only** (arrows, bolts). A tracker linking ammunition to
   attacks is a later, separate piece of work — not this one.
7. **Armour class takes the best option.** The wizard works out every way the character
   could get an AC, using the final ability scores (after racial bonuses):
   - each armour they picked, plus the shield if they took one;
   - plain unarmored (10 + Dex);
   - their class's own unarmored entry from `armor.json` (the `unarmored` category entries
     already carry `classId`: barbarian 10 + Dex + Con with a shield allowed, monk
     10 + Dex + Wis with no shield, Draconic Resilience 13 + Dex),
   and writes the highest as `armorClassConfig` (with `armorClass: null`, so the sheet
   derives it). The losing armour stays in the inventory, so the sheet's AC calculator
   can switch to it later.
8. **Gold buy replaces both the class's and the background's equipment.** Confirmed
   against the PHB: the Backgrounds chapter states that a character using the optional
   rule to spend coin on gear does not receive the background's starting equipment either.
9. **A 1st-level subclass is chosen in the creation wizard, before equipment.** Whether a
   class needs it is read from the data — its 1st level declares `CHOOSE_SUBCLASS` — never
   from a list of class names, so a homebrew or book class that picks its subclass at 1st
   level gets the picker too. In the SRD that is the cleric, sorcerer and warlock; the
   artificer and everyone else choose later and are unaffected. The picker lists the same
   subclasses the level-up wizard would (every loaded pack's, homebrew included). This is
   what makes the equipment step correct: a Life cleric's heavy armour proficiency and a
   Draconic sorcerer's Draconic Resilience are known before the equipment and AC are
   decided. The pipeline already supports it — `resolveLevelUpEvents` skips
   `CHOOSE_SUBCLASS` when `subclassId` is set and resolves that subclass's level events
   instead (`levelUpService.ts` around the `CHOOSE_SUBCLASS` case) — so the subclass is
   stored on `classes[0]` before `resolveFirstClassLevel` runs, and the rest of level 1
   flows as before.
10. **Gold buy rolls dice, with a field for a real roll.** Turning gold buy on shows the
   class's dice (e.g. "5d4 × 10 gp"), a **Roll** button that rolls them, and a number field
   that the button fills and the player can also type a physical roll into. The amount
   becomes the character's `currency.gp`; the inventory starts empty. There is no in-app
   shop — the player adds what they buy on the sheet as today.

Starting wealth per class (PHB "Starting Wealth by Class"; artificer from ERLW):

| Class | Wealth |
|---|---|
| Barbarian, Druid | 2d4 × 10 gp |
| Sorcerer | 3d4 × 10 gp |
| Rogue, Warlock, Wizard | 4d4 × 10 gp |
| Bard, Cleric, Fighter, Paladin, Ranger, Artificer | 5d4 × 10 gp |
| Monk | 5d4 gp (no multiplier) |

## Calls made by the designer (not discussed with the user)

- **The subclass picker sits on the class step**, shown only when the class picks at 1st
  level, with each subclass's description as the level-up wizard shows it. Changing class
  clears it.
- **A subclass-only unarmored entry is tagged.** `ArmorDefinition` gains an optional
  `subclassId` (type, schema, `docs/rulepacks.md`), and `draconic-resilience` in
  `armor.json` sets it to the Draconic Bloodline's id, so the AC comparison — and the
  sheet's "Your class" hint in `ArmorClassModal.vue` — only offers it to that subclass.
  Today it is tagged with `classId: "sorcerer"` alone. Nothing has applied it
  automatically so far (no code sets `armorClassConfig` except the modal), but the modal
  marks it "Your class" for every sorcerer, Wild Magic included.
- **"(if proficient)" items are shown only when the character is proficient**, judged
  against the class's, background's, race's and chosen subclass's level-1 proficiencies
  — known by then, since the subclass is picked first. Armour the character is not
  proficient with is excluded from the AC comparison regardless.
- **A regression test pins the equivalence**: a cleric built with its domain chosen in
  the creation wizard ends level 1 with the same features, proficiencies and spells as
  one whose domain was chosen in the level-up wizard.

- **Ties on AC go to the class's unarmored option** (decided by the user): armour stays
  the same number for good, while an ability score improvement raises Unarmored Defense,
  so the unarmored base is the one that grows into the better choice.
- **A chain mail Strength requirement does not affect the AC choice** — it changes speed,
  not AC, and the calculator already warns about it.
- **Only the first class's equipment** — creation is single-class; multiclassing grants
  no starting equipment in the rules anyway.
- **Pack contents are SRD data**, in a new top-level rulepack content array (verified: SRD
  5.1's Equipment chapter has an "Equipment Packs" section with contents and costs for all
  seven: burglar's, diplomat's, dungeoneer's, entertainer's, explorer's, priest's,
  scholar's), so a book can add its own pack. Equipment items reference a pack by id.
- **Non-weapon "of your choice" items** (a musical instrument, artisan's tools, a holy
  symbol, an arcane focus) offer the names the class data lists where it lists them, and a
  free text field where the book leaves it fully open. There is no general adventuring-gear
  table in the data, and building one is out of scope.
- **Background coins go to the purse.** A background line such as "Belt pouch containing
  15 gp" today lands in the inventory as one item with that whole name. On the equipment
  path it becomes a "Belt pouch" item plus 15 gp in `currency`. Background "X or Y" lines
  ("Prayer book or prayer wheel") stay as printed — making background choices pickable is
  not part of this.
- **Changing class after step 5 clears the equipment picks**, since the choices belong to
  the class.
- **Item weights** come from the weapon/armour data where the item is one; other items get
  no weight (the inventory already tolerates that and says how many it skipped).

## Constraints from the codebase

- New rulepack fields go through all of: `app/types/rulepack.ts`, the Zod
  `RulepackSchema` in `app/schemas/rulepackSchema.ts` (the new content array must also
  merge by id like the others, and be optional), `docs/rulepacks.md` (the pack author's
  guide, whose examples must validate against the schema), and `ENTRY_KINDS` / homebrew
  editing if the new content array is to be editable like other kinds.
- Changing `app/data/srd/*.json` requires bumping `SRD_SEED_REVISION` in
  `app/plugins/srd-loader.client.ts`. `tests/unit/srdData.test.ts` validates the files.
- Creation goes through `resolveFirstClassLevel`, with the contract in `new.vue` about
  `hp`, `hitDice` and `classes[0].level`; the equipment, attacks, AC config and currency
  are plain fields on the draft character and do not need the level-up pipeline. Keep
  objects passed to `structuredClone`/Dexie free of reactive proxies.
- The armour-class and attack logic belongs in services (`armorClass.ts`, `attacks.ts`,
  or a new `startingEquipment.ts`) so it is unit-testable under the `node` vitest
  environment; the page only wires it up.
- Step 5's misleading copy is replaced.
- Use the custom Tailwind palette tokens; the wizard is mobile-first.

## Non-goals

- An in-app shop for spending gold-buy money.
- Ammunition tracking linked to attacks (later, separately).
- Pickable background equipment choices.
- Starting equipment for a second class taken by multiclassing.
- A general adventuring-gear table with costs and weights.

## Anti-goals

- A sheet whose AC silently uses worse armour than the character's own class feature.
- Gold buy that leaves the purse empty.
- Picks that produce text like "a martial weapon" in the inventory instead of a weapon.

## Left to the builder

- The exact JSON shape of a choice, an item reference, a weapon/category pick, a pack
  reference and the starting-wealth field — guided by the cases the 13 classes print, and
  documented in `docs/rulepacks.md`.
- The id of the new pack content array and whether packs get homebrew editing in this
  change.
- How the Roll button shows its result (individual dice or just the total).
