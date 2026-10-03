# Writing rulepacks

Everything Waystone knows about the game — races, classes, spells, feats, weapons — comes
from **rulepacks**: JSON files the app merges on startup or on import. The SRD 5.1 ships
built in. This page is for anyone writing their own: a homebrew subclass, a friend's
setting, or a whole sourcebook.

- [Three ways to add content](#three-ways-to-add-content)
- [A first pack](#a-first-pack)
- [The file](#the-file)
- [Ids, merging and overriding](#ids-merging-and-overriding)
- [Naming things other entries point at](#naming-things-other-entries-point-at)
- [Content kinds](#content-kinds)
- [Level-up events](#level-up-events)
- [Choices that do something](#choices-that-do-something)
- [Testing a pack](#testing-a-pack)
- [Known gaps](#known-gaps)
- [Checklist](#checklist)

The authoritative references are [`app/types/rulepack.ts`](../app/types/rulepack.ts), which
explains what each field means, and [`app/schemas/rulepackSchema.ts`](../app/schemas/rulepackSchema.ts),
which decides what an import accepts. Where this page and the schema disagree, the schema wins.

## Three ways to add content

| | Good for | How |
|---|---|---|
| **The in-app editor** | Fixing wording, a one-off homebrew feat or spell | Open a pack on the Rulepacks page and edit an entry, or add one to the Homebrew pack. Level tables and level-up events are on the entry's JSON tab. |
| **Importing a file** | Anything you want to share or keep under version control | Rulepacks page → import a `.json` file, a `.zip` of several, or a URL. |
| **The dev folder** | Writing a large pack against a running dev server | Put fragments in `app/data/<your-folder>/`; `pnpm dev` merges them on every start. See [Testing a pack](#testing-a-pack). |

The editor never changes the pack an entry came from: editing copies the entry into a
pack called **Homebrew**, which then takes precedence. That keeps your edit safe when the
book is re-imported or the SRD updates, and the Homebrew page tells you when the original
has changed since you copied it. Export (the download button on a pack's page) is the only
way homebrew leaves the browser.

## A first pack

Save this as `lantern.json` and import it from the Rulepacks page:

```json
{
  "id": "tol",
  "name": "Tome of the Lantern",
  "version": "1.0",
  "author": "You",
  "description": "A small homebrew supplement.",
  "feats": [
    {
      "id": "tol-lamplit-vigil",
      "name": "Lamplit Vigil",
      "description": "You have learned to keep watch by a single flame. Increase your Wisdom by 1. You know the light cantrip, and Wisdom is your spellcasting ability for it.",
      "abilityScoreBonus": { "wis": 1 },
      "levelUpEvents": [
        {
          "type": "GRANT_SPELLS",
          "addTo": "tol-lamplit-vigil",
          "spellIds": ["light"],
          "alwaysPrepared": true,
          "ability": "wis",
          "origin": "feat",
          "label": "Lamplit Vigil"
        }
      ]
    }
  ],
  "spells": [
    {
      "id": "tol-guttering-flame",
      "name": "Guttering Flame",
      "level": 1,
      "school": "evocation",
      "castingTime": "1 action",
      "range": "60 feet",
      "components": "V, S",
      "duration": "Instantaneous",
      "concentration": false,
      "ritual": false,
      "description": "A creature you can see within range must succeed on a Dexterity saving throw or take 2d8 fire damage.",
      "classes": ["sorcerer", "wizard"],
      "savingThrow": "dex"
    }
  ]
}
```

The feat appears in the feat picker labelled *Tome of the Lantern*, and the spell joins the
sorcerer and wizard lists beside the SRD's. `light` is an SRD spell id, which is fine: a
pack may point at any entry in any loaded pack.

## The file

### Header

| Field | Required | Notes |
|---|---|---|
| `id` | yes | The pack's id. Every file with the same `id` merges into one pack. Use a short abbreviation (`tol`), never `srd-5.1` or `homebrew` — see [Reserved pack ids](#reserved-pack-ids). |
| `name` | yes | Shown on the Rulepacks page and as the source label in every picker. |
| `version` | yes | A string. Bump it when you publish a change; a Homebrew copy records the version it was copied from. |
| `description`, `author` | no | Shown on the Rulepacks page. |

### Content arrays

Every array is optional. Include only what the file adds.

| Array | Holds |
|---|---|
| `races` | Races, with their subraces nested inside |
| `subraces` | Subraces for a race defined **anywhere** — each carries a `raceId` |
| `classes` | Classes, with their subclasses nested inside |
| `subclasses` | Subclasses for a class defined **anywhere** — each carries a `classId` |
| `backgrounds` | Backgrounds |
| `feats` | Feats |
| `spells` | Spells |
| `optionalFeatures` | Optional class features (Tasha's style), each naming a `classId` and `level` |
| `optionPools` | Extra options for a choice another pack owns — invocations, metamagic, fighting styles |
| `weapons` | Rows of the weapon table |
| `armor` | Rows of the armour table, including "unarmoured" features such as Unarmored Defense |
| `creatures` | Statblocks, used by Wild Shape |

### One file or many

A pack can be one file or several that share an `id`. The SRD is one file per class plus
`races.json`, `spells.json` and so on. For a sourcebook, one file per category
(`subclasses.json`, `feats.json`, `option-pools.json`) keeps each file readable.

To import several files at once, zip them. The importer reads every `.json` in the zip,
ignores anything else (a readme, `__MACOSX/`), and merges files with top-level `subclasses`
or `subraces` last so that the class or race they patch already exists. **If any one file
fails validation, the whole zip is rejected**, so a book never arrives half-merged.

### Importing from a URL

The app asks you to confirm the URL, then fetches it without cookies or credentials. It
must be `http` or `https`, and the server must allow cross-origin requests. A raw GitHub
URL works. A file on a server that doesn't send CORS headers fails with a network error,
whatever its contents.

## Ids, merging and overriding

Ids are how everything is found: a character stores `"race": "tol-lanternkin"`, not the
race itself, and a spell grant names `"spellIds": ["light"]`. Most mistakes a pack can make
are id mistakes.

**Use lowercase kebab-case, prefixed with your pack's abbreviation:** `tol-lanternkin`,
`tol-lamplighter`. The SRD uses bare ids (`fighter`, `fire-bolt`), so a prefix is what
keeps yours from ever colliding with it or with another book.

**Within one pack, a matching id replaces the whole entry.** Merging is by id, and the
incoming entry wins outright. There is no deep merge: re-sending a class with only a
changed `hitDie` replaces the class with one that has no levels.

**Re-importing adds and replaces; it never deletes.** If you remove an entry from your file
and import it again, the old entry stays in the browser. To drop entries, delete the pack
on the Rulepacks page and import it fresh. The same goes for the pack's `name`,
`description` and `author`: they are taken from the first import and kept after that. To
change them, rename the pack in the app (the pencil on its page) or remove it and
re-import.

**Two packs with the same entry id are two entries, not an override.** Both appear in the
pickers, each labelled with its pack's name. That is deliberate — two books' takes on the
same race should both be available — but it means you **cannot override an SRD entry by
reusing its id in your own pack**. A character stores only the id, and when two packs share
one, the app can't reliably tell which the player meant. Give your version its own id.

**To change an existing entry, edit it in the app.** The copy goes into the Homebrew pack
and replaces the original everywhere, in pickers and in lookups. Exporting the Homebrew pack
and importing it in another browser carries those replacements across.

### Reserved pack ids

- `srd-5.1` — the bundled SRD. It is deleted and rebuilt from the app whenever the app
  updates its rules data, so anything you merge into it is lost.
- `homebrew` — the in-app editor's pack. Its entries replace entries with the same id in
  every other pack. Importing a file with this id merges into the player's own homebrew,
  which is what importing an exported Homebrew pack is for. Don't use it to publish a pack.

## Naming things other entries point at

| Thing | Write it as | Examples |
|---|---|---|
| Ability | lowercase three letters | `str` `dex` `con` `int` `wis` `cha` |
| Skill | camelCase key | `acrobatics` `animalHandling` `arcana` `athletics` `deception` `history` `insight` `intimidation` `investigation` `medicine` `nature` `perception` `performance` `persuasion` `religion` `sleightOfHand` `stealth` `survival` |
| Class, spell, feat, race… | its `id` | `wizard`, `fire-bolt`, `tol-lamplit-vigil` |
| Spell school | lowercase | `evocation`, `divination` |
| Weapon proficiency | `simple`, `martial`, or a weapon's name | `longsword`, `hand crossbow` |
| Armour proficiency | `light`, `medium`, `heavy`, `shields` | |
| Tool or language proficiency | plain words | `thieves' tools`, `Elvish` |
| Damage type, condition | lowercase | `fire`, `poisoned` |
| Recharge | `short`, `long` or `dawn` | |

A spell's `classes` lists **class ids**, and that list is what puts it on a class's spell
list. `"classes": ["Wizard"]` puts it on no list at all.

## Content kinds

Only the essentials of each kind are shown here. The type file lists every optional field
and what it does.

### Races and subraces

```json
{
  "id": "tol-lanternkin",
  "name": "Lanternkin",
  "size": "small",
  "speeds": { "walk": 25 },
  "senses": { "darkvision": 60 },
  "abilityScoreBonuses": { "wis": 2 },
  "traits": [
    { "name": "Inner Glow", "description": "You shed dim light in a 5-foot radius. You can suppress or restore it as a bonus action." },
    { "name": "Ember Heart", "description": "You have resistance to fire damage." }
  ],
  "languages": ["Common", "Ignan"],
  "damageResistances": ["fire"],
  "subraceOptional": true,
  "subraces": [
    {
      "id": "tol-lanternkin-wick",
      "name": "Wickborn",
      "abilityScoreBonuses": { "dex": 1 },
      "traits": [{ "name": "Quick Flicker", "description": "Your walking speed increases to 30 feet." }],
      "speedOverrides": { "walk": 30 }
    }
  ]
}
```

- `traits` are the text on the sheet. What a trait *does* is the fields beside it: `senses`,
  `damageResistances`, `speeds`, and `levelUpEvents` for spells, proficiencies and choices.
- `subraceOptional: true` lets the player pick the race with no subrace. Leave it out when
  a subrace is required, as for a dwarf.
- Player-assigned ability increases use `abilityScoreChoice`:
  `{ "from": ["str","dex","con","int","wis","cha"], "distributions": [[2, 1], [1, 1, 1]] }`
  offers "+2 and +1, or three +1s". Each inner list hands one bonus to each of that many
  different abilities.
- A subrace adds to its race. `speedOverrides` replaces a speed mode; `senses` keeps the
  larger range of the two; the resistance and immunity lists are combined. Set
  `replacesRaceAbilityBonuses: true` when the subrace restates the whole ability line, and
  `replacesRaceTraits: ["Ember Heart"]` when it swaps out a race trait. That drops the trait
  and any race `levelUpEvents` group tagged `"trait": "Ember Heart"`.

To add a subrace to a race from another pack, use the top-level `subraces` array with a
`raceId`:

```json
{
  "id": "tol",
  "name": "Tome of the Lantern",
  "version": "1.0",
  "subraces": [
    {
      "raceId": "dwarf",
      "id": "tol-ashvault-dwarf",
      "name": "Ashvault Dwarf",
      "abilityScoreBonuses": { "str": 1 },
      "traits": [{ "name": "Ashen Lungs", "description": "You have resistance to fire damage." }],
      "damageResistances": ["fire"]
    }
  ]
}
```

The subrace stays in your pack, so removing your pack removes it again. The SRD is never
modified.

### Classes

A class is the biggest entry by far. The quickest way to write one is to copy the closest
SRD class from [`app/data/srd/`](../app/data/srd/) and change it. The parts that matter:

```json
{
  "id": "tol-lampwright",
  "name": "Lampwright",
  "hitDie": "d8",
  "primaryAbility": ["int"],
  "savingThrowProficiencies": ["con", "int"],
  "armorProficiencies": ["light"],
  "weaponProficiencies": ["simple"],
  "toolProficiencies": ["tinker's tools"],
  "skillChoices": { "count": 2, "from": ["arcana", "history", "investigation", "perception"] },
  "multiclassing": { "prerequisites": { "int": 13 }, "armorProficiencies": ["light"] },
  "spellcastingAbility": "int",
  "casterProgression": "half",
  "spellPreparation": { "kind": "prepared", "levelDivisor": 2 },
  "levels": [
    {
      "level": 1,
      "features": ["Kindle"],
      "levelUpEvents": []
    },
    {
      "level": 2,
      "features": ["Spellcasting"],
      "spellSlots": { "1": 2 },
      "levelUpEvents": [
        { "type": "EXPAND_SPELL_LIST", "addTo": "tol-lampwright", "classes": ["wizard"], "label": "Lampwright Spells" }
      ]
    },
    {
      "level": 3,
      "features": ["Lampwright Guild"],
      "spellSlots": { "1": 3 },
      "levelUpEvents": [{ "type": "CHOOSE_SUBCLASS", "label": "Lampwright Guild" }]
    },
    {
      "level": 4,
      "features": [],
      "spellSlots": { "1": 3 },
      "levelUpEvents": [{ "type": "ABILITY_SCORE_IMPROVEMENT", "points": 2 }]
    }
  ],
  "featureDefinitions": [
    { "name": "Kindle", "description": "As a bonus action, you touch an object and make it shed bright light in a 10-foot radius.", "usesMax": 2, "recharge": "long" },
    { "name": "Spellcasting", "description": "You can cast lampwright spells." },
    { "name": "Lampwright Guild", "description": "At 3rd level, you join a guild." }
  ],
  "subclasses": []
}
```

How the pieces fit:

- **`levels`** has one entry per class level, 1 to 20. Each needs `features` and
  `levelUpEvents`, even when both are empty.
- **`features`** lists names. The text, uses and recharge come from the
  **`featureDefinitions`** entry with *exactly* the same name. A name with no definition
  still reaches the sheet, but with no description.
- **A feature that improves** can be a new name whose definition says
  `"replaces": "Kindle"` (the SRD fighter's `Action Surge (1 use)` → `Action Surge (2
  uses)`), or an `UPDATE_FEATURE_USES` event naming the feature (the barbarian's Rage count).
- **Spell slots are derived, not granted.** Write the slot table on each level as
  `spellSlots` and set `casterProgression` (`full`, `half`, `third` or `artificer`); the
  app does single-class and multiclass slots from there. A pact-magic class sets
  `"pactMagic": true`, and its level's `spellSlots` holds one key: the slot level and how
  many.
- **Spells to learn** are `CHOOSE_SPELL` events on the levels that grant them, as the SRD
  wizard does: `{ "type": "CHOOSE_SPELL", "addTo": "wizard", "count": 2, "classes": ["wizard"] }`.
  The event's `count` is how many the player picks. `cantripsKnown` and `spellsKnown` on a
  level are columns in the class table, and `spellsKnown` is also the cap for a class whose
  `spellPreparation.kind` is `known`. A `prepared` class has no `CHOOSE_SPELL` for levelled
  spells: it prepares from its whole list, as the SRD cleric and paladin do.
- **Swapping a known spell.** A `known` class whose rules let the player trade one spell
  for another on each new level declares `CHANGE_SPELL` on every level that allows it:
  `{ "type": "CHANGE_SPELL", "addTo": "tol-lampwright", "amount": 1 }`. The SRD bard,
  ranger, sorcerer and warlock declare it on levels 2 to 20. It's optional for the player,
  and it isn't asked at all until the class knows a spell to give up.
- **A new class starts with an empty spell list**, because no spell names it in `classes`.
  `EXPAND_SPELL_LIST` (above) gives it another class's list, or specific `spellIds`.
- **Subclass placeholders.** When a level's subclass feature has no name of its own, write
  something ending in "Feature" (`"Lampwright Guild Feature"`). It is dropped from the
  sheet once the character's subclass supplies real features at that level.
- **Without `multiclassing`** the class cannot be taken as a second class.
- **Hit points, hit dice and the spellcasting ability** are added on every level
  automatically. Don't declare events for them.

### Subclasses

Nested in your own class's `subclasses`, or top-level with a `classId` to add one to a class
from another pack:

```json
{
  "id": "tol",
  "name": "Tome of the Lantern",
  "version": "1.0",
  "subclasses": [
    {
      "classId": "fighter",
      "id": "tol-lamplighter",
      "name": "Lamplighter",
      "description": "Warriors who carry light into the dark places of the world.",
      "levels": [
        {
          "level": 3,
          "features": [
            { "name": "Bearer of the Flame", "description": "You learn the light cantrip. Wisdom is your spellcasting ability for it." }
          ],
          "levelUpEvents": [
            { "type": "GRANT_SPELLS", "addTo": "fighter", "spellIds": ["light"], "alwaysPrepared": true, "ability": "wis", "label": "Bearer of the Flame" }
          ]
        },
        {
          "level": 7,
          "features": [
            { "name": "Unflinching Glow", "description": "You gain proficiency in Wisdom saving throws." }
          ],
          "levelUpEvents": [{ "type": "GAIN_SAVE_PROFICIENCY", "ability": "wis" }]
        }
      ]
    }
  ]
}
```

`level` is the **class** level. A subclass's features carry their text inline; there is no
`featureDefinitions` lookup here. The level where the class declares `CHOOSE_SUBCLASS` must
have a matching subclass level, or the new subclass arrives with nothing. A subclass that
gives a non-caster class its spellcasting, like an Eldritch Knight, needs a `spellcasting`
block, `spellSlots` on its levels, and a `GRANT_SPELLCASTING` event. See
`SubclassSpellcasting` in the type file.

### Backgrounds

```json
{
  "id": "tol-lamp-keeper",
  "name": "Lamp Keeper",
  "description": "You tended the lamps of a city that never slept.",
  "skillProficiencies": ["perception", "history"],
  "toolProficiencies": ["tinker's tools"],
  "languages": 1,
  "equipment": ["A hooded lantern", "A flask of oil", "Common clothes", "A pouch containing 10 gp"],
  "feature": { "name": "Keeper of the Ways", "description": "You know every street a lamplighter walks." },
  "levelUpEvents": [
    { "level": 1, "levelUpEvents": [{ "type": "GRANT_FEAT", "featId": "tol-lamplit-vigil", "label": "Lamp Keeper" }] }
  ]
}
```

`languages` is a **count**: the player writes them in on the sheet.

### Feats

See [A first pack](#a-first-pack). The common fields:

- `prerequisite` is the text shown; `prerequisiteCheck` is what the app enforces:
  `{ "minAbilityScore": { "str": 13 } }`, `{ "spellcasting": true }`, or
  `{ "proficiency": ["heavy"] }` (any one of them).
- `abilityScoreBonus` is a fixed increase; `abilityScoreChoice` lets the player pick,
  e.g. `{ "from": ["int", "wis", "cha"], "distributions": [[1]] }`.
- `hpBonusPerLevel` gives extra hit points per level, applied to past levels too (Tough is 2).
- `levelUpEvents` is a plain array, with no `level` wrapper: it all fires when the feat is
  taken. An `"ability": "increased"` on a spell or a saving throw means "whichever ability
  this feat's own `abilityScoreChoice` raised".

### Spells

See [A first pack](#a-first-pack). `level` is `0` for a cantrip. `savingThrow` (an ability)
and `attackRoll` (`melee` or `ranged`) are optional, but `CHOOSE_SPELL`'s `attackRoll`
filter and the sheet's roll badge read them.

### Optional class features

```json
{
  "id": "tol-steady-flame",
  "name": "Steady Flame",
  "description": "Your Kindle light can't be extinguished by wind.",
  "classId": "tol-lampwright",
  "level": 3
}
```

The level-up wizard offers it when the class reaches exactly `level`, so a character already
past that level never sees it. Add `replaces` for the text of the feature it stands in for,
and `levelUpEvents` (a plain array, like a feat's) for anything it grants.

### Option pools

Some choices are made several times from one list: Eldritch Invocations, Metamagic, Fighting
Styles. The class declares the list inline on every level that picks from it, so a new
invocation can't be added by editing the warlock. Instead, a top-level `optionPools` entry
names the pool:

```json
{
  "id": "tol",
  "name": "Tome of the Lantern",
  "version": "1.0",
  "optionPools": [
    {
      "group": "eldritch-invocation",
      "options": [
        {
          "id": "tol-lanternbearer",
          "name": "Lanternbearer",
          "description": "You can cast light at will.",
          "minLevel": 5,
          "requiresOption": { "choiceId": "pact-boon", "optionId": "pact-of-the-tome" }
        }
      ]
    },
    {
      "choiceId": "pact-boon",
      "options": [
        { "id": "tol-pact-of-the-lamp", "name": "Pact of the Lamp", "description": "Your patron gives you a lamp that never goes out." }
      ]
    }
  ]
}
```

Use `group` for a shared pool (`eldritch-invocation`, `metamagic`, `fighting-style`) and
`choiceId` for a one-off choice with no group (`pact-boon`). Options can be gated with
`minLevel` (class level), `requiresOption` (another choice's answer) and `requiresSpell` (a
spell id the character must know).

### Weapons and armour

```json
{
  "weapons": [
    { "id": "tol-lamp-hook", "name": "Lamp Hook", "category": "martial", "rangeType": "melee",
      "damageDice": "1d6", "damageType": "piercing", "properties": ["finesse", "reach"], "weight": 3 }
  ],
  "armor": [
    { "id": "tol-glasswork-mail", "name": "Glasswork Mail", "category": "medium", "baseAC": 14,
      "maxDexBonus": 2, "stealthDisadvantage": true, "weight": 25 },
    { "id": "tol-ember-skin", "name": "Ember Skin (Lanternkin)", "category": "unarmored", "baseAC": 12,
      "extraAbility": "wis", "description": "While not wearing armour, your AC is 12 + Dex + Wis." }
  ]
}
```

- `maxDexBonus` is what makes armour light, medium or heavy: leave it out for uncapped
  Dexterity, `2` for medium, `0` for none.
- Put features that replace armour (Unarmored Defense, natural armour) in the `unarmored`
  category. `"shieldAllowed": false` rules a shield out, and `classId` marks the entry as
  suiting that class.
- `properties` are lowercase. `finesse` and `thrown` decide which ability an attack uses by
  default.

### Creatures

Statblocks for Wild Shape. Copy the shape from [`app/data/srd/beasts.json`](../app/data/srd/beasts.json).
`challengeRating` is a number (`0.25`, not `"1/4"`); the druid's `SET_WILD_SHAPE_LIMITS`
events filter by it, by `type`, and by whether `speeds` has `swim` or `fly`.

## Level-up events

Events are how an entry *does* something rather than just describing it. Where they go
decides when they fire:

| On | Shape | Fires at |
|---|---|---|
| A class level | `levels[].levelUpEvents: [...]` | that **class** level |
| A subclass level | `levels[].levelUpEvents: [...]` | that class level, once the subclass is chosen |
| A race, subrace or background | `levelUpEvents: [{ "level": 3, "levelUpEvents": [...] }]` | that **character** level, however it's split across classes |
| A feat or optional feature | `levelUpEvents: [...]` | the moment it's taken |

### `addTo`, `origin`, `ability` and `label`

Spell events name a **source** in `addTo`. For a class or subclass that is the class id
(`"fighter"` for an Eldritch Knight-style subclass). For anything else it is the entry's own
id (`"tiefling"`, `"high-elf"`, `"tol-lamplit-vigil"`), together with:

- `origin`: `race`, `background` or `feat`
- `ability`: the spellcasting ability for these spells, or `"increased"` on a feat
- `label`: the heading the Spells tab shows (`"Infernal Legacy"`)

Each source gets its own save DC and attack bonus, so a wizard with a Wisdom-based feat spell
casts that one spell with Wisdom.

### Event reference

**Features and resources**

| Type | Fields | Does |
|---|---|---|
| `UPDATE_FEATURE_USES` | `featureName`, `usesMax` (number or `null` for unlimited) | Changes how often a feature can be used |
| `SET_WILD_SHAPE_LIMITS` | `maxCR`, `allowSwim?`, `allowFly?`, `types?` | Sets which creatures Wild Shape can become |
| `ABILITY_SCORE_IMPROVEMENT` | `points` | The usual +2 split, or a feat instead |
| `CHOOSE_SUBCLASS` | `label` | Asks for the subclass |

**Proficiencies, senses and speed**

| Type | Fields | Does |
|---|---|---|
| `GAIN_PROFICIENCY` | `proficiency`, `whenOption?` | Adds a weapon, armour, tool, language or skill proficiency. A skill key (`stealth`) becomes a skill proficiency. |
| `GAIN_SAVE_PROFICIENCY` | `ability` (or `"increased"`), `whenOption?` | Makes a saving throw proficient |
| `CHOOSE_SKILL` | `count`, `from?` (defaults to all 18), `whenOption?` | The player picks skill proficiencies |
| `CHOOSE_EXPERTISE` | `label`, `options` (skills), `count` | The player doubles proficiency in some skills |
| `SET_SPEED` | `mode` (`walk`/`climb`/`swim`/`fly`), `speed`, `whenOption?` | Sets one movement mode |
| `SET_SENSE` | `mode` (`darkvision`/`blindsight`/`tremorsense`/`truesight`), `range`, `whenOption?` | Sets one sense |

`SET_SPEED` and `SET_SENSE` are for a speed or sense that depends on a choice. A race that
simply *has* one uses `speeds`, `senses` or `speedOverrides`.

**Spells**

| Type | Fields | Does |
|---|---|---|
| `GRANT_SPELLS` | `addTo`, `spellIds`, `alwaysPrepared?`, `uses?`, `cost?`, `castAtLevel?`, `whenOption?`, source fields | Gives specific spells |
| `CHOOSE_SPELL` | `addTo`, `count`, filters, `maxLevel?`, `uses?`, `whenOption?`, source fields | The player picks spells |
| `CHANGE_SPELL` | `addTo`, `amount`, `classes?`, `schools?`, `cantrip?`, `label?` | Offers to trade a known spell for another |
| `EXPAND_SPELL_LIST` | `addTo` (class id or `"all"`), `spellIds?` and/or `classes?`, `minLevel?`, `whenOption?`, `label?` | Widens a spell list without granting anything to cast |
| `GRANT_SPELLCASTING` | `addTo`, `ability`, `list?` | Makes a non-caster class a caster (subclass spellcasting) |
| `CHOOSE_SPELLCASTING_ABILITY` | `addTo`, `from` | The player picks which ability casts a source's spells |

- `CHOOSE_SPELL`'s filters all narrow one another: `fromList` (spell ids), `classes` (class
  lists), `schools`, `cantrip`, `ritual` and `attackRoll`. A spell is offered only if it
  passes every filter the event sets, so "an abjuration or evocation spell from the wizard
  list" is `"classes": ["wizard"], "schools": ["abjuration", "evocation"]`. `maxLevel` caps
  the spell level for a source with no class level of its own, such as a feat.
- `CHANGE_SPELL` offers the spells known through `addTo` (not cantrips, unless
  `"cantrip": true`, and never a spell a trait granted) against replacements chosen the way
  `CHOOSE_SPELL` chooses them, up to the class's own maximum spell level. With neither
  `classes` nor `schools` the replacement comes from the `addTo` class's list. Each
  `amount` is a separate trade, and only a spell known before this level can be given up.
- `uses: { "max": 1, "recharge": "long" }` makes a free cast. `castAtLevel` fixes the
  level of that cast (a 2nd-level *hellish rebuke*). `cost: { "resource": "Ki", "amount": 2 }`
  makes the spell cost a feature's resource instead.

**Choices and feats**

| Type | Fields | Does |
|---|---|---|
| `CHOOSE_OPTION` | `id`, `label`, `options`, `group?`, `feature?` | The player picks one option. See [Choices that do something](#choices-that-do-something). |
| `REPLACE_OPTION` | `group`, `label?` | Offers to swap an earlier pick from a pool |
| `CHOOSE_FEAT` | — | The player picks a feat (see [Known gaps](#known-gaps)) |
| `GRANT_FEAT` | `featId`, `withOption?`, `label?` | Gives a specific feat. `withOption` pre-answers a question the feat asks. |

**Accepted but not used**

| Type | |
|---|---|
| `ADD_FEATURE`, `UPDATE_SPELL_SLOTS` | Ignored. Features come from `features` and slots from `spellSlots`. |
| `UPDATE_HIT_DIE` | Redundant; the class's `hitDie` is applied every level. |

## Choices that do something

A `CHOOSE_OPTION` asks the player to pick one option. On its own, the answer is only a name on
the sheet. It becomes mechanics through **`whenOption`**: any event carrying
`"whenOption": { "choiceId": ..., "optionId": ... }` applies only if that option was picked.
The events can sit beside the choice or on later levels, so a choice made once can keep
paying out.

```json
{
  "level": 1,
  "levelUpEvents": [
    {
      "type": "CHOOSE_OPTION",
      "id": "tol-lanternkin-kindling",
      "label": "Kindling",
      "options": [
        { "id": "hearth", "name": "Hearth", "description": "You learn the produce flame cantrip." },
        { "id": "beacon", "name": "Beacon", "description": "Your darkvision extends to 120 feet." },
        { "id": "wanderer", "name": "Wanderer", "description": "You gain proficiency in one skill of your choice." }
      ]
    },
    {
      "type": "GRANT_SPELLS", "addTo": "tol-lanternkin", "spellIds": ["produce-flame"],
      "alwaysPrepared": true, "ability": "wis", "origin": "race", "label": "Kindling",
      "whenOption": { "choiceId": "tol-lanternkin-kindling", "optionId": "hearth" }
    },
    {
      "type": "SET_SENSE", "mode": "darkvision", "range": 120,
      "whenOption": { "choiceId": "tol-lanternkin-kindling", "optionId": "beacon" }
    },
    {
      "type": "CHOOSE_SKILL", "count": 1,
      "whenOption": { "choiceId": "tol-lanternkin-kindling", "optionId": "wanderer" }
    }
  ]
}
```

That block sits in the race's `levelUpEvents`. The events that can carry `whenOption` are
`GRANT_SPELLS`, `CHOOSE_SPELL`, `EXPAND_SPELL_LIST`, `GAIN_PROFICIENCY`,
`GAIN_SAVE_PROFICIENCY`, `CHOOSE_SKILL`, `SET_SPEED` and `SET_SENSE`. A follow-up question
(`CHOOSE_SPELL`, `CHOOSE_SKILL`) is asked in the same level-up, straight after the answer
that unlocks it.

**Choice ids must be unique** across everything a character might have, so prefix them too.

**Pools.** Give several `CHOOSE_OPTION`s the same `group` and an option already taken from
that group won't be offered again. The SRD warlock declares
`eldritch-invocation-1`, `eldritch-invocation-2`, … each with `"group": "eldritch-invocation"`.
Each pick from a pool becomes its own feature on the sheet. `REPLACE_OPTION` with the same
`group` offers a swap on levels that allow retraining.

**Which feature the answer is written onto.** For a choice without a `group`, the pick is
appended to a feature's text on the sheet: the feature the choice id is named after, or the
level's only feature. If neither fits, name it with `"feature": "Kindling"`.

## Testing a pack

**Import it.** The import is the validator. A failure lists every problem with its path:

```
Rulepack validation failed in lantern.json:
classes.0.levels.3.levelUpEvents.0.type: Invalid discriminator value. Expected 'ADD_FEATURE' | 'UPDATE_FEATURE_USES' | ...
feats.0.levelUpEvents.0.spellIds: Too small: expected array to have >=1 items
```

Counting starts at 0, so `feats.0` is the first feat and `levels.3` the fourth level. An
"Invalid discriminator value" is an event `type` the app doesn't know, usually a typo.

**Misspelled optional fields vanish silently.** The schema strips any field it doesn't
recognise instead of rejecting it, so `"levelUpEvent"` or `"subraceOptinal"` imports fine and
does nothing. If something you wrote has no effect, look at the entry's JSON tab in the app:
a stripped field won't be there.

**Build a test character.** Create one through the wizard and level it past every level your
pack touches, since the level-up wizard is where most mistakes show. Check the Spells and
Features tabs.

**Iterating on a big pack** is fastest with the dev server:

1. `pnpm install`, then put your files in `app/data/<your-folder>/`. Everything under
   `app/data/` except `srd/` is gitignored, so they won't be committed.
2. `pnpm dev`. The fragments are validated and merged on every start, and failures are
   logged to the browser console.
3. Merged content stays in IndexedDB even after you delete the file (merging never deletes).
   Remove the pack on the Rulepacks page, or clear site data, to start clean.

`pnpm pack:rulepacks` zips every folder under `app/data/` except `srd/` into
`out/rulepacks.zip`, ready to import anywhere. `node scripts/pack-rulepacks.mjs tol` packs one
folder.

## Known gaps

Things a pack can declare that the app doesn't act on yet:

- **`CHOOSE_FEAT` on a race, subrace or background** is never asked. It works on a class
  level. `GRANT_FEAT` (a named feat) does work from a race or background.
- **An optional class feature's spells can't scale with level.** Its events all fire when
  it's taken, and `GRANT_SPELLS` has no minimum level, so one that grants more spells at
  higher levels can express only the first.
- **An optional class feature is offered at its own level only.** Importing one doesn't
  offer it to characters already past that level.
- **Feature uses are whole numbers.** `usesMax` can't be a formula like "your Wisdom
  modifier"; step it with `UPDATE_FEATURE_USES`, or leave it for the player to set.
- **Anything the wording says but no field covers** (advantage on a check, a reaction, a
  damage rider) is text only. The sheet reads a few things from wording: saving-throw
  bonuses from auras, "half your proficiency bonus" on checks, and doubled carrying
  capacity. Everything else is left to the player.

## Checklist

- [ ] Pack `id` is your own abbreviation, not `srd-5.1` or `homebrew`
- [ ] Every entry id and choice id is lowercase kebab-case with your prefix
- [ ] You're not reusing another pack's entry id to "override" it (edit it in the app instead)
- [ ] Every class has 20 `levels`, each with `features` and `levelUpEvents`
- [ ] Every name in a level's `features` has a `featureDefinitions` entry with the exact same name
- [ ] The `CHOOSE_SUBCLASS` level has a matching level in every subclass
- [ ] Spells list class **ids** in `classes`, and a new class has an `EXPAND_SPELL_LIST` or spells of its own
- [ ] Skills are camelCase keys (`sleightOfHand`), abilities are `str`…`cha`
- [ ] Race, background and feat spell grants set `addTo`, `origin`, `ability` and `label`
- [ ] Each fixed file was re-imported after removing the pack, not merged over the old version
