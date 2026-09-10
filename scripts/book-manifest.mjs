/**
 * What each sourcebook adds, as an index of names only — a table of contents to scaffold
 * against, not book content. `scaffold-books.mjs` turns each entry into an empty stub
 * under app/data/<abbrev>/ for a human to fill in from their own copy of the book.
 *
 * Entry forms:
 *   'Name'                              a plain entry
 *   ['Name', { classId: 'ranger' }]     a subclass, patching a class in another pack
 *   ['Name', { raceId: 'elf' }]         a subrace
 *   ['Name', { classId, level }]        an optional class feature
 *   ['Name', { prerequisite: '...' }]   a feat with a prerequisite line
 *   ['Name', { id: 'custom.id' }]       an explicit id, overriding the derived one
 *
 * Ids default to `<abbrev>.<kebab-name>`, e.g. tce.fey-wanderer.
 *
 * COVERAGE: every name here has been checked against 5etools' own per-source listings,
 * so a name that no longer scaffolds is a real gap rather than a typo. It is still only
 * as complete as what was listed in the first place — several books add content this
 * index does not mention, and a book's own contents page is the thing to check against.
 * Adding a name and re-running the scaffold is a one-line change; nothing already filled
 * in is overwritten.
 *
 * Two kinds of entry deliberately survive not matching:
 *   - content a book really adds that 5etools files under another shape, such as TCE's
 *     Blessed Strikes, which it records as a feature on each cleric domain rather than
 *     as an optional class feature;
 *   - content reprinted from an earlier book, which is listed under both — a reader may
 *     load either pack, and both books do contain it.
 *
 * Only classes that already exist (in the SRD pack or an earlier book) can be patched by
 * a subclass, so `classId` values use SRD class ids: barbarian, bard, cleric, druid,
 * fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard — plus artificer,
 * which ERLW introduces.
 */

export const BOOKS = [
  // ── Player's Handbook ───────────────────────────────────────────────────────
  {
    abbrev: 'phb',
    name: "Player's Handbook",
    version: '1.0',
    subclasses: [
      ['Path of the Totem Warrior', { classId: 'barbarian' }],
      ['College of Valor', { classId: 'bard' }],
      ['Knowledge Domain', { classId: 'cleric' }],
      ['Light Domain', { classId: 'cleric' }],
      ['Nature Domain', { classId: 'cleric' }],
      ['Tempest Domain', { classId: 'cleric' }],
      ['Trickery Domain', { classId: 'cleric' }],
      ['War Domain', { classId: 'cleric' }],
      ['Circle of the Moon', { classId: 'druid' }],
      ['Battle Master', { classId: 'fighter' }],
      ['Eldritch Knight', { classId: 'fighter' }],
      ['Way of Shadow', { classId: 'monk' }],
      ['Way of the Four Elements', { classId: 'monk' }],
      ['Oath of the Ancients', { classId: 'paladin' }],
      ['Oath of Vengeance', { classId: 'paladin' }],
      ['Beast Master', { classId: 'ranger' }],
      ['Arcane Trickster', { classId: 'rogue' }],
      ['Assassin', { classId: 'rogue' }],
      ['Wild Magic', { classId: 'sorcerer' }],
      ['The Archfey', { classId: 'warlock' }],
      ['The Great Old One', { classId: 'warlock' }],
      ['School of Abjuration', { classId: 'wizard' }],
      ['School of Conjuration', { classId: 'wizard' }],
      ['School of Divination', { classId: 'wizard' }],
      ['School of Enchantment', { classId: 'wizard' }],
      ['School of Illusion', { classId: 'wizard' }],
      ['School of Necromancy', { classId: 'wizard' }],
      ['School of Transmutation', { classId: 'wizard' }],
    ],
    feats: [
      'Alert', 'Athlete', 'Actor', 'Charger', 'Crossbow Expert', 'Defensive Duelist',
      'Dual Wielder', 'Dungeon Delver', 'Durable', 'Elemental Adept', 'Great Weapon Master',
      'Healer', 'Heavily Armored', 'Heavy Armor Master', 'Inspiring Leader', 'Keen Mind',
      'Lightly Armored', 'Linguist', 'Lucky', 'Mage Slayer', 'Magic Initiate',
      'Martial Adept', 'Medium Armor Master', 'Mobile', 'Moderately Armored',
      'Mounted Combatant', 'Observant', 'Polearm Master', 'Resilient', 'Ritual Caster',
      'Savage Attacker', 'Sentinel', 'Sharpshooter', 'Shield Master', 'Skilled', 'Skulker',
      'Spell Sniper', 'Tavern Brawler', 'Tough', 'War Caster', 'Weapon Master',
    ],
    backgrounds: [
      'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero', 'Guild Artisan', 'Hermit',
      'Noble', 'Outlander', 'Sage', 'Sailor', 'Soldier', 'Urchin',
      // Each variant swaps a background's feature for another and is printed as its own
      // option. "Custom Background" is deliberately absent: that is the rule for
      // building one, not a background.
      'Variant Criminal (Spy)', 'Variant Entertainer (Gladiator)',
      'Variant Guild Artisan (Guild Merchant)', 'Variant Noble (Knight)',
      'Variant Noble (Retainers)', 'Variant Sailor (Pirate)',
    ],
    subraces: [
      ['Variant Human', { raceId: 'human' }],
      ['Mountain Dwarf', { raceId: 'dwarf' }],
      ['Wood Elf', { raceId: 'elf' }],
      ['Dark Elf (Drow)', { raceId: 'elf' }],
      ['Stout Halfling', { raceId: 'halfling' }],
      ['Forest Gnome', { raceId: 'gnome' }],
    ],
    // The PHB spells the SRD leaves out. Several are referenced by the expanded spell
    // lists of PHB and later-book subclasses, so a GRANT_SPELLS event has nothing to
    // point at until they exist as entries.
    spells: [
      'Arcane Gate', 'Armor of Agathys', 'Arms of Hadar', 'Aura of Life', 'Aura of Purity',
      'Aura of Vitality', 'Banishing Smite', 'Beast Sense', "Bigby's Hand", 'Blade Ward',
      'Blinding Smite', 'Chromatic Orb', 'Circle of Power', 'Cloud of Daggers',
      'Compelled Duel', 'Conjure Barrage', 'Conjure Volley', 'Cordon of Arrows',
      'Crown of Madness', "Crusader's Mantle", 'Destructive Wave', 'Dissonant Whispers',
      "Drawmij's Instant Summons", 'Elemental Weapon', 'Ensnaring Strike',
      "Evard's Black Tentacles", 'Feign Death', 'Friends', 'Grasping Vine',
      'Hail of Thorns', 'Hex', 'Hunger of Hadar', "Leomund's Secret Chest",
      "Leomund's Tiny Hut", 'Lightning Arrow', "Melf's Acid Arrow",
      "Mordenkainen's Faithful Hound", "Mordenkainen's Magnificent Mansion",
      "Mordenkainen's Private Sanctum", "Mordenkainen's Sword", "Nystul's Magic Aura",
      "Otiluke's Freezing Sphere", "Otiluke's Resilient Sphere",
      "Otto's Irresistible Dance", 'Phantasmal Force', 'Power Word Heal',
      "Rary's Telepathic Bond", 'Ray of Sickness', 'Searing Smite', 'Staggering Smite',
      'Swift Quiver', "Tasha's Hideous Laughter", 'Telepathy', "Tenser's Floating Disk",
      'Thorn Whip', 'Thunderous Smite', 'Tsunami', 'Witch Bolt', 'Wrathful Smite',
    ],
  },

  // ── Elemental Evil Player's Companion ───────────────────────────────────────
  {
    abbrev: 'ee',
    name: "Elemental Evil Player's Companion",
    version: '1.0',
    races: ['Aarakocra', 'Genasi', 'Goliath'],
    subraces: [
      ['Air Genasi', { raceId: 'ee.genasi' }],
      ['Earth Genasi', { raceId: 'ee.genasi' }],
      ['Fire Genasi', { raceId: 'ee.genasi' }],
      ['Water Genasi', { raceId: 'ee.genasi' }],
    ],
    spells: [
      'Abi-Dalzim’s Horrid Wilting', 'Absorb Elements', 'Aganazzar’s Scorcher',
      'Beast Bond', 'Bones of the Earth', 'Catapult', 'Control Flames',
      'Control Winds', 'Create Bonfire', 'Dust Devil', 'Earthbind', 'Earth Tremor',
      'Elemental Bane', 'Erupting Earth', 'Flame Arrows', 'Frostbite', 'Gust',
      'Ice Knife', 'Immolation', 'Investiture of Flame', 'Investiture of Ice',
      'Investiture of Stone', 'Investiture of Wind', 'Maelstrom', 'Magic Stone',
      'Maximilian’s Earthen Grasp', 'Melf’s Minute Meteors', 'Mold Earth',
      'Primordial Ward', 'Pyrotechnics', 'Shape Water', 'Skywrite', 'Snilloc’s Snowball Swarm',
      'Storm Sphere', 'Thunderclap', 'Tidal Wave', 'Transmute Rock', 'Vitriolic Sphere',
      'Wall of Water', 'Warding Wind', 'Watery Sphere', 'Whirlwind',
    ],
  },

  // ── Sword Coast Adventurer's Guide ──────────────────────────────────────────
  {
    abbrev: 'scag',
    name: "Sword Coast Adventurer's Guide",
    version: '1.0',
    subclasses: [
      ['Path of the Battlerager', { classId: 'barbarian' }],
      ['Arcana Domain', { classId: 'cleric' }],
      ['Purple Dragon Knight (Banneret)', { classId: 'fighter' }],
      ['Way of the Long Death', { classId: 'monk' }],
      ['Way of the Sun Soul', { classId: 'monk' }],
      ['Oath of the Crown', { classId: 'paladin' }],
      ['Storm Sorcery', { classId: 'sorcerer' }],
      ['The Undying', { classId: 'warlock' }],
      ['Bladesinging', { classId: 'wizard' }],
    ],
    backgrounds: [
      'City Watch', 'Clan Crafter', 'Cloistered Scholar', 'Courtier', 'Faction Agent',
      'Far Traveler', 'Inheritor', 'Knight of the Order', 'Mercenary Veteran',
      'Urban Bounty Hunter', 'Uthgardt Tribe Member', 'Waterdhavian Noble',
      'Variant City Watch (Investigator)',
    ],
    subraces: [
      ['Gray Dwarf (Duergar)', { raceId: 'dwarf' }],
      ['Ghostwise Halfling', { raceId: 'halfling' }],
      ['Deep Gnome (Svirfneblin)', { raceId: 'gnome' }],
      // The half-elf descents and tiefling legacies the book prints as variants
      ['Aquatic Elf Descent Half-Elf', { raceId: 'half-elf' }],
      ['Drow Descent Half-Elf', { raceId: 'half-elf' }],
      ['Moon Elf or Sun Elf Descent Half-Elf', { raceId: 'half-elf' }],
      ['Wood Elf Descent Half-Elf', { raceId: 'half-elf' }],
      ["Devil's Tongue Tiefling", { raceId: 'tiefling' }],
      ['Hellfire Tiefling', { raceId: 'tiefling' }],
      ['Infernal Legacy Tiefling', { raceId: 'tiefling' }],
      ['Winged Tiefling', { raceId: 'tiefling' }],
    ],
    spells: ['Booming Blade', 'Green-Flame Blade', 'Lightning Lure', 'Sword Burst'],
  },

  // ── Volo's Guide to Monsters ────────────────────────────────────────────────
  {
    abbrev: 'vgm',
    name: "Volo's Guide to Monsters",
    version: '1.0',
    races: [
      'Aasimar', 'Firbolg', 'Goliath', 'Kenku', 'Lizardfolk', 'Tabaxi', 'Triton',
      'Bugbear', 'Goblin', 'Hobgoblin', 'Kobold', 'Orc', 'Yuan-ti Pureblood',
    ],
    subraces: [
      ['Protector Aasimar', { raceId: 'vgm.aasimar' }],
      ['Scourge Aasimar', { raceId: 'vgm.aasimar' }],
      ['Fallen Aasimar', { raceId: 'vgm.aasimar' }],
    ],
  },

  // ── Xanathar's Guide to Everything ──────────────────────────────────────────
  {
    abbrev: 'xge',
    name: "Xanathar's Guide to Everything",
    version: '1.0',
    // The racial feats, each gated on a race rather than an ability score
    feats: [
      'Bountiful Luck', 'Dragon Fear', 'Dragon Hide', 'Drow High Magic',
      'Dwarven Fortitude', 'Elven Accuracy', 'Fade Away', 'Fey Teleportation',
      'Flames of Phlegethos', 'Infernal Constitution', 'Orcish Fury', 'Prodigy',
      'Second Chance', 'Squat Nimbleness', 'Wood Elf Magic',
    ],
    subclasses: [
      ['Path of the Ancestral Guardian', { classId: 'barbarian' }],
      ['Path of the Storm Herald', { classId: 'barbarian' }],
      ['Path of the Zealot', { classId: 'barbarian' }],
      ['College of Glamour', { classId: 'bard' }],
      ['College of Swords', { classId: 'bard' }],
      ['College of Whispers', { classId: 'bard' }],
      ['Forge Domain', { classId: 'cleric' }],
      ['Grave Domain', { classId: 'cleric' }],
      ['Circle of Dreams', { classId: 'druid' }],
      ['Circle of the Shepherd', { classId: 'druid' }],
      ['Arcane Archer', { classId: 'fighter' }],
      ['Cavalier', { classId: 'fighter' }],
      ['Samurai', { classId: 'fighter' }],
      ['Way of the Drunken Master', { classId: 'monk' }],
      ['Way of the Kensei', { classId: 'monk' }],
      ['Way of the Sun Soul', { classId: 'monk' }],
      ['Oath of Conquest', { classId: 'paladin' }],
      ['Oath of Redemption', { classId: 'paladin' }],
      ['Gloom Stalker', { classId: 'ranger' }],
      ['Horizon Walker', { classId: 'ranger' }],
      ['Monster Slayer', { classId: 'ranger' }],
      ['Inquisitive', { classId: 'rogue' }],
      ['Mastermind', { classId: 'rogue' }],
      ['Scout', { classId: 'rogue' }],
      ['Swashbuckler', { classId: 'rogue' }],
      ['Divine Soul', { classId: 'sorcerer' }],
      ['Shadow Magic', { classId: 'sorcerer' }],
      ['Storm Sorcery', { classId: 'sorcerer' }],
      ['The Celestial', { classId: 'warlock' }],
      ['The Hexblade', { classId: 'warlock' }],
      ['War Magic', { classId: 'wizard' }],
    ],
    spells: [
      'Abi-Dalzim’s Horrid Wilting', 'Absorb Elements', 'Aganazzar’s Scorcher',
      'Beast Bond', 'Bones of the Earth', 'Catapult', 'Catnap', 'Cause Fear',
      'Ceremony', 'Chaos Bolt', 'Charm Monster', 'Control Flames', 'Control Winds',
      'Create Bonfire', 'Create Homunculus', 'Crown of Stars', 'Danse Macabre',
      'Dawn', 'Dragon’s Breath', 'Druid Grove', 'Dust Devil', 'Earthbind',
      'Earth Tremor', 'Elemental Bane', 'Enemies Abound', 'Enervation', 'Erupting Earth',
      'Far Step', 'Find Greater Steed', 'Flame Arrows', 'Frostbite', 'Guardian of Nature',
      'Gust', 'Healing Spirit', 'Holy Weapon', 'Ice Knife', 'Illusory Dragon',
      'Immolation', 'Infernal Calling', 'Infestation', 'Investiture of Flame',
      'Investiture of Ice', 'Investiture of Stone', 'Investiture of Wind',
      'Life Transference', 'Maddening Darkness', 'Maelstrom', 'Magic Stone',
      'Mass Polymorph', 'Maximilian’s Earthen Grasp', 'Melf’s Minute Meteors',
      'Mental Prison', 'Mighty Fortress', 'Mind Spike', 'Mold Earth', 'Negative Energy Flood',
      'Power Word Pain', 'Primal Savagery', 'Primordial Ward', 'Psychic Scream',
      'Pyrotechnics', 'Scatter', 'Shadow Blade', 'Shadow of Moil', 'Shape Water',
      'Sickening Radiance', 'Skill Empowerment', 'Skywrite', 'Snare',
      'Snilloc’s Snowball Swarm', 'Soul Cage', 'Steel Wind Strike', 'Storm Sphere',
      'Summon Greater Demon', 'Summon Lesser Demons', 'Synaptic Static', 'Temple of the Gods',
      'Tenser’s Transformation', 'Thunderclap', 'Thunder Step', 'Tidal Wave',
      'Tiny Servant', 'Toll the Dead', 'Transmute Rock', 'Vitriolic Sphere',
      'Wall of Light', 'Wall of Sand', 'Wall of Water', 'Warding Wind', 'Watery Sphere',
      'Whirlwind', 'Word of Radiance', 'Wrath of Nature', 'Zephyr Strike',
    ],
  },

  // ── Mordenkainen's Tome of Foes ─────────────────────────────────────────────
  {
    abbrev: 'mtf',
    name: "Mordenkainen's Tome of Foes",
    version: '1.0',
    feats: ['Svirfneblin Magic'],
    races: ['Gith'],
    subraces: [
      ['Githyanki', { raceId: 'mtf.gith' }],
      ['Githzerai', { raceId: 'mtf.gith' }],
      ['Duergar', { raceId: 'dwarf' }],
      ['Eladrin', { raceId: 'elf' }],
      ['Sea Elf', { raceId: 'elf' }],
      ['Shadar-kai', { raceId: 'elf' }],
      ['Deep Gnome', { raceId: 'gnome' }],
      ['Bloodline of Asmodeus', { raceId: 'tiefling' }],
      ['Bloodline of Baalzebul', { raceId: 'tiefling' }],
      ['Bloodline of Dispater', { raceId: 'tiefling' }],
      ['Bloodline of Fierna', { raceId: 'tiefling' }],
      ['Bloodline of Glasya', { raceId: 'tiefling' }],
      ['Bloodline of Levistus', { raceId: 'tiefling' }],
      ['Bloodline of Mammon', { raceId: 'tiefling' }],
      ['Bloodline of Mephistopheles', { raceId: 'tiefling' }],
      ['Bloodline of Zariel', { raceId: 'tiefling' }],
    ],
  },

  // ── Guildmasters' Guide to Ravnica ──────────────────────────────────────────
  {
    abbrev: 'ggr',
    name: "Guildmasters' Guide to Ravnica",
    version: '1.0',
    races: ['Centaur', 'Goblin', 'Loxodon', 'Minotaur', 'Simic Hybrid', 'Vedalken'],
    backgrounds: [
      'Azorius Functionary', 'Boros Legionnaire', 'Dimir Operative', 'Golgari Agent',
      'Gruul Anarch', 'Izzet Engineer', 'Orzhov Representative', 'Rakdos Cultist',
      'Selesnya Initiate', 'Simic Scientist',
    ],
    // The book's one spell, and the Dimir guild list expands onto it — without an entry
    // that EXPAND_SPELL_LIST has a name it cannot resolve.
    spells: ['Encode Thoughts'],
  },

  // ── Eberron: Rising from the Last War ───────────────────────────────────────
  {
    abbrev: 'erlw',
    name: 'Eberron: Rising from the Last War',
    version: '1.0',
    classes: ['Artificer'],
    subclasses: [
      ['Alchemist', { classId: 'artificer' }],
      ['Artillerist', { classId: 'artificer' }],
      ['Battle Smith', { classId: 'artificer' }],
    ],
    feats: [['Aberrant Dragonmark', { prerequisite: 'No Dragonmark feat' }], 'Revenant Blade'],
    races: ['Changeling', 'Kalashtar', 'Shifter', 'Warforged'],
    subraces: [
      ['Beasthide', { raceId: 'erlw.shifter' }],
      ['Longtooth', { raceId: 'erlw.shifter' }],
      ['Swiftstride', { raceId: 'erlw.shifter' }],
      ['Wildhunt', { raceId: 'erlw.shifter' }],
      // The dragonmarked houses, each a subrace of the race that bears the mark
      ['Mark of Warding Dwarf', { raceId: 'dwarf' }],
      ['Mark of Shadow Elf', { raceId: 'elf' }],
      ['Mark of Scribing Gnome', { raceId: 'gnome' }],
      ['Mark of Detection Half-Elf', { raceId: 'half-elf' }],
      ['Mark of Storm Half-Elf', { raceId: 'half-elf' }],
      ['Mark of Finding Half-Orc', { raceId: 'half-orc' }],
      ['Mark of Healing Halfling', { raceId: 'halfling' }],
      ['Mark of Hospitality Halfling', { raceId: 'halfling' }],
      ['Mark of Handling Human', { raceId: 'human' }],
      ['Mark of Making Human', { raceId: 'human' }],
      ['Mark of Passage Human', { raceId: 'human' }],
      ['Mark of Sentinel Human', { raceId: 'human' }],
    ],
    backgrounds: ['House Agent'],
  },

  // ── Explorer's Guide to Wildemount ──────────────────────────────────────────
  {
    abbrev: 'egtw',
    name: "Explorer's Guide to Wildemount",
    version: '1.0',
    subclasses: [
      ['Echo Knight', { classId: 'fighter' }],
      ['Chronurgy Magic', { classId: 'wizard' }],
      ['Graviturgy Magic', { classId: 'wizard' }],
    ],
    races: ['Aarakocra', 'Genasi', 'Goblin', 'Hobgoblin', 'Bugbear', 'Orc', 'Tortle'],
    backgrounds: [
      'Grinner', 'Volstrucker Agent', 'Augen Trust (Spy)', 'Cobalt Scholar (Sage)',
      'Luxonborn (Acolyte)', 'Myriad Operative (Criminal)', 'Revelry Pirate (Sailor)',
    ],
    subraces: [
      ['Draconblood Dragonborn', { raceId: 'dragonborn' }],
      ['Ravenite Dragonborn', { raceId: 'dragonborn' }],
      ['Pallid Elf', { raceId: 'elf' }],
      ['Lotusden Halfling', { raceId: 'halfling' }],
    ],
    spells: [
      'Dark Star', 'Fortune’s Favor', 'Gift of Alacrity', 'Gravity Fissure',
      'Gravity Sinkhole', 'Immovable Object', 'Magnify Gravity', 'Pulse Wave',
      'Ravenous Void', 'Reality Break', 'Sapping Sting', 'Temporal Shunt',
      'Tether Essence', 'Time Ravage', 'Wristpocket',
    ],
  },

  // ── Mythic Odysseys of Theros ───────────────────────────────────────────────
  {
    abbrev: 'mot',
    name: 'Mythic Odysseys of Theros',
    version: '1.0',
    subclasses: [
      ['College of Eloquence', { classId: 'bard' }],
      ['Oath of Glory', { classId: 'paladin' }],
    ],
    races: ['Centaur', 'Leonin', 'Minotaur', 'Satyr', 'Triton'],
    backgrounds: ['Athlete'],
  },

  // ── Tasha's Cauldron of Everything ──────────────────────────────────────────
  {
    abbrev: 'tce',
    name: "Tasha's Cauldron of Everything",
    version: '1.0',
    races: ['Custom Lineage'],
    optionalFeatures: [
      ['Primal Knowledge', { classId: 'barbarian', level: 3 }],
      ['Instinctive Pounce', { classId: 'barbarian', level: 7 }],
      ['Magical Inspiration', { classId: 'bard', level: 2 }],
      ['Bardic Versatility', { classId: 'bard', level: 4 }],
      ['Harness Divine Power', { classId: 'cleric', level: 2 }],
      ['Cantrip Versatility', { classId: 'cleric', level: 4 }],
      ['Blessed Strikes', { classId: 'cleric', level: 8 }],
      ['Wild Companion', { classId: 'druid', level: 2 }],
      ['Cantrip Versatility', { classId: 'druid', level: 4, id: 'tce.cantrip-versatility-druid' }],
      ['Martial Versatility', { classId: 'fighter', level: 4 }],
      ['Dedicated Weapon', { classId: 'monk', level: 2 }],
      ['Ki-Fueled Attack', { classId: 'monk', level: 3 }],
      ['Quickened Healing', { classId: 'monk', level: 4 }],
      ['Focused Aim', { classId: 'monk', level: 5 }],
      ['Harness Divine Power', { classId: 'paladin', level: 3, id: 'tce.harness-divine-power-paladin' }],
      ['Martial Versatility', { classId: 'paladin', level: 4, id: 'tce.martial-versatility-paladin' }],
      ['Deft Explorer', { classId: 'ranger', level: 1, replaces: 'Natural Explorer' }],
      ['Favored Foe', { classId: 'ranger', level: 1, replaces: 'Favored Enemy' }],
      ['Spellcasting Focus', { classId: 'ranger', level: 2 }],
      ['Primal Awareness', { classId: 'ranger', level: 3, replaces: 'Primeval Awareness' }],
      ['Martial Versatility', { classId: 'ranger', level: 4, id: 'tce.martial-versatility-ranger' }],
      ['Steady Aim', { classId: 'rogue', level: 3 }],
      ['Sorcerous Versatility', { classId: 'sorcerer', level: 4 }],
      ['Magical Guidance', { classId: 'sorcerer', level: 5 }],
      ['Eldritch Versatility', { classId: 'warlock', level: 4 }],
      ['Cantrip Formulas', { classId: 'wizard', level: 3 }],
    ],
    subclasses: [
      ['Path of the Beast', { classId: 'barbarian' }],
      ['Path of Wild Magic', { classId: 'barbarian' }],
      ['College of Creation', { classId: 'bard' }],
      ['College of Eloquence', { classId: 'bard' }],
      ['Order Domain', { classId: 'cleric' }],
      ['Peace Domain', { classId: 'cleric' }],
      ['Twilight Domain', { classId: 'cleric' }],
      ['Circle of Spores', { classId: 'druid' }],
      ['Circle of Stars', { classId: 'druid' }],
      ['Circle of Wildfire', { classId: 'druid' }],
      ['Psi Warrior', { classId: 'fighter' }],
      ['Rune Knight', { classId: 'fighter' }],
      ['Way of Mercy', { classId: 'monk' }],
      ['Way of the Astral Self', { classId: 'monk' }],
      ['Oath of Glory', { classId: 'paladin' }],
      ['Oath of the Watchers', { classId: 'paladin' }],
      ['Fey Wanderer', { classId: 'ranger' }],
      ['Swarmkeeper', { classId: 'ranger' }],
      ['Phantom', { classId: 'rogue' }],
      ['Soulknife', { classId: 'rogue' }],
      ['Aberrant Mind', { classId: 'sorcerer' }],
      ['Clockwork Soul', { classId: 'sorcerer' }],
      ['The Fathomless', { classId: 'warlock' }],
      ['The Genie', { classId: 'warlock' }],
      ['Bladesinging', { classId: 'wizard' }],
      ['Order of Scribes', { classId: 'wizard' }],
      ['Armorer', { classId: 'artificer' }],
    ],
    feats: [
      'Artificer Initiate', 'Chef', 'Crusher', 'Eldritch Adept', 'Fey Touched',
      'Fighting Initiate', 'Gunner', 'Metamagic Adept', 'Piercer', 'Poisoner',
      'Shadow Touched', 'Skill Expert', 'Slasher', 'Telekinetic', 'Telepathic',
    ],
    spells: [
      'Blade of Disaster', 'Booming Blade', 'Dream of the Blue Veil', 'Green-Flame Blade',
      'Intellect Fortress', 'Lightning Lure', 'Mind Sliver', 'Spirit Shroud',
      'Summon Aberration', 'Summon Beast', 'Summon Celestial', 'Summon Construct',
      'Summon Elemental', 'Summon Fey', 'Summon Fiend', 'Summon Shadowspawn',
      'Summon Undead', 'Sword Burst', 'Tasha’s Caustic Brew', 'Tasha’s Mind Whip',
      'Tasha’s Otherworldly Guise', 'Tasha’s Hideous Laughter',
    ],
  },

  // ── Van Richten's Guide to Ravenloft ────────────────────────────────────────
  {
    abbrev: 'vrgr',
    name: "Van Richten's Guide to Ravenloft",
    version: '1.0',
    subclasses: [
      ['College of Spirits', { classId: 'bard' }],
      ['The Undead', { classId: 'warlock' }],
    ],
    races: ['Dhampir', 'Hexblood', 'Reborn'],
    backgrounds: ['Haunted One', 'Investigator'],
  },

  // ── Fizban's Treasury of Dragons ────────────────────────────────────────────
  {
    abbrev: 'ftd',
    name: "Fizban's Treasury of Dragons",
    version: '1.0',
    subclasses: [
      ['Drakewarden', { classId: 'ranger' }],
      ['Way of the Ascendant Dragon', { classId: 'monk' }],
    ],
    feats: ['Gift of the Chromatic Dragon', 'Gift of the Gem Dragon', 'Gift of the Metallic Dragon'],
    races: ['Gem Dragonborn', 'Chromatic Dragonborn', 'Metallic Dragonborn'],
    spells: [
      'Ashardalon’s Stride', 'Draconic Transformation', 'Fizban’s Platinum Shield',
      'Nathair’s Mischief', 'Raulothim’s Psychic Lance', 'Rime’s Binding Ice',
      'Summon Draconic Spirit',
    ],
  },

  // ── Strixhaven: A Curriculum of Chaos ───────────────────────────────────────
  {
    abbrev: 'scc',
    name: 'Strixhaven: A Curriculum of Chaos',
    version: '1.0',
    races: ['Owlin'],
    feats: ['Strixhaven Initiate', 'Strixhaven Mascot'],
    backgrounds: [
      'Lorehold Student', 'Prismari Student', 'Quandrix Student', 'Silverquill Student',
      'Witherbloom Student',
    ],
    spells: [
      'Borrowed Knowledge', 'Silvery Barbs', 'Kinetic Jaunt', 'Vortex Warp',
      'Wither and Bloom',
    ],
  },

  // ── Monsters of the Multiverse ──────────────────────────────────────────────
  {
    abbrev: 'mpmm',
    name: "Mordenkainen Presents: Monsters of the Multiverse",
    version: '1.0',
    races: [
      'Aarakocra', 'Aasimar', 'Bugbear', 'Centaur', 'Changeling', 'Deep Gnome',
      'Duergar', 'Eladrin', 'Fairy', 'Firbolg', 'Genasi', 'Githyanki', 'Githzerai',
      'Goblin', 'Goliath', 'Harengon', 'Hobgoblin', 'Kenku', 'Kobold', 'Lizardfolk',
      'Minotaur', 'Orc', 'Satyr', 'Sea Elf', 'Shadar-kai', 'Shifter', 'Tabaxi',
      'Tortle', 'Triton', 'Yuan-ti',
    ],
  },

  // ── The Wild Beyond the Witchlight ──────────────────────────────────────────
  {
    abbrev: 'wbtw',
    name: 'The Wild Beyond the Witchlight',
    version: '1.0',
    races: ['Fairy', 'Harengon'],
    backgrounds: ['Feylost', 'Witchlight Hand'],
  },

  // ── Spelljammer: Astral Adventurer's Guide ──────────────────────────────────
  {
    abbrev: 'aag',
    name: "Astral Adventurer's Guide",
    version: '1.0',
    races: [
      'Astral Elf', 'Autognome', 'Giff', 'Hadozee', 'Plasmoid', 'Thri-kreen',
    ],
    backgrounds: ['Astral Drifter', 'Wildspacer'],
    spells: ['Air Bubble', 'Create Spelljamming Helm'],
  },

  // ── Dragonlance: Shadow of the Dragon Queen ─────────────────────────────────
  {
    abbrev: 'sotdq',
    name: 'Dragonlance: Shadow of the Dragon Queen',
    version: '1.0',
    subclasses: [['Lunar Sorcery', { classId: 'sorcerer' }]],
    feats: [
      'Adept of the Black Robes', 'Adept of the Red Robes', 'Adept of the White Robes',
      'Divinely Favored', 'Initiate of High Sorcery', 'Squire of Solamnia',
      'Knight of the Crown', 'Knight of the Rose', 'Knight of the Sword',
    ],
    races: ['Kender'],
    backgrounds: ['Knight of Solamnia', 'Mage of High Sorcery'],
  },

  // ── Bigby Presents: Glory of the Giants ─────────────────────────────────────
  {
    abbrev: 'bgg',
    name: 'Bigby Presents: Glory of the Giants',
    version: '1.0',
    subclasses: [['Path of the Giant', { classId: 'barbarian' }]],
    feats: [
      'Strike of the Giants', 'Ember of the Fire Giant', 'Guile of the Cloud Giant',
      'Fury of the Frost Giant', 'Keenness of the Stone Giant', 'Soul of the Storm Giant',
      'Vigor of the Hill Giant', 'Rune Shaper',
    ],
    backgrounds: ['Giant Foundling', 'Rune Carver'],
  },

  // ── Planescape: Adventures in the Multiverse ────────────────────────────────
  {
    abbrev: 'pam',
    name: 'Planescape: Adventures in the Multiverse',
    version: '1.0',
    feats: [
      'Scion of the Outer Planes', 'Agent of Order', 'Baleful Scion', 'Cohort of Chaos',
      'Outlands Envoy', 'Planar Wanderer', 'Righteous Heritor',
    ],
    backgrounds: ['Gate Warden', 'Planar Philosopher'],
  },

  // ── The Book of Many Things ─────────────────────────────────────────────────
  {
    abbrev: 'bmt',
    name: 'The Deck of Many Things: The Book of Many Things',
    version: '1.0',
    feats: ['Cartomancer'],
    backgrounds: ['Rewarded', 'Ruined'],
    spells: ['Antagonize', 'Spirit of Death', 'Spray of Cards'],
  },

  // ── Adventure-book backgrounds ──────────────────────────────────────────────
  {
    abbrev: 'bgdia',
    name: 'Baldur’s Gate: Descent into Avernus',
    version: '1.0',
    backgrounds: [
      'Faceless',
      // The book reprints each PHB background with a Baldur's Gate feature of its own
      'Baldur’s Gate Acolyte', 'Baldur’s Gate Charlatan', 'Baldur’s Gate Criminal',
      'Baldur’s Gate Entertainer', 'Baldur’s Gate Folk Hero',
      'Baldur’s Gate Guild Artisan', 'Baldur’s Gate Hermit', 'Baldur’s Gate Noble',
      'Baldur’s Gate Outlander', 'Baldur’s Gate Sage', 'Baldur’s Gate Sailor',
      'Baldur’s Gate Soldier', 'Baldur’s Gate Urchin',
    ],
  },
  {
    abbrev: 'ai',
    name: 'Acquisitions Incorporated',
    version: '1.0',
    races: ['Verdan'],
    backgrounds: [
      'Celebrity Adventurer’s Scion', 'Failed Merchant', 'Gambler', 'Rival Intern',
      'Plaintiff',
    ],
    spells: [
      'Distort Value', 'Fast Friends', 'Gift of Gab', 'Incite Greed',
      "Jim's Glowing Coin", "Jim's Magic Missile", 'Motivational Speech',
    ],
  },
]
