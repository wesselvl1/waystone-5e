#!/usr/bin/env python3
"""Add all SRD 5.1 abjuration spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

ABJURATION_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "blade-ward",
        "name": "Blade Ward",
        "level": 0,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "You extend your hand and trace a sigil of warding in the air. Until the end of your next "
            "turn, you have resistance against bludgeoning, piercing, and slashing damage dealt by "
            "weapon attacks."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "alarm",
        "name": "Alarm",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 minute",
        "range": "30 feet",
        "components": "V, S, M (a tiny bell and a piece of fine silver wire)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": True,
        "description": (
            "You set an alarm against unwanted intrusion. Choose a door, a window, or an area within "
            "range that is no larger than a 20-foot cube. Until the spell ends, an alarm alerts you "
            "whenever a Tiny or larger creature touches or enters the warded area. When you cast the "
            "spell, you can designate creatures that won't set off the alarm. You also choose whether "
            "the alarm is mental or audible.\n\n"
            "A mental alarm alerts you with a ping in your mind if you are within 1 mile of the warded "
            "area. This ping awakens you if you are sleeping.\n\n"
            "An audible alarm produces the sound of a hand bell for 10 seconds within 60 feet."
        ),
        "classes": ["ranger", "wizard"],
    },
    {
        "id": "mage-armor",
        "name": "Mage Armor",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a piece of cured leather)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a willing creature who isn't wearing armor, and a protective magical force "
            "surrounds it until the spell ends. The target's base AC becomes 13 + its Dexterity "
            "modifier. The spell ends if the target dons armor or if you dismiss the spell as an action."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "protection-from-evil-and-good",
        "name": "Protection from Evil and Good",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (holy water or powdered silver and iron, which the spell consumes)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "Until the spell ends, one willing creature you touch is protected against certain types "
            "of creatures: aberrations, celestials, elementals, fey, fiends, and undead.\n\n"
            "The protection grants several benefits. Creatures of those types have disadvantage on "
            "attack rolls against the target. The target also can't be charmed, frightened, or "
            "possessed by them. If the target is already charmed, frightened, or possessed by such a "
            "creature, the target has advantage on any new saving throw against the relevant effect."
        ),
        "classes": ["cleric", "druid", "paladin", "warlock", "wizard"],
    },
    {
        "id": "sanctuary",
        "name": "Sanctuary",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 bonus action",
        "range": "30 feet",
        "components": "V, S, M (a small silver mirror)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You ward a creature within range against attack. Until the spell ends, any creature who "
            "targets the warded creature with an attack or a harmful spell must first make a Wisdom "
            "saving throw. On a failed save, the creature must choose a new target or lose the attack "
            "or spell. This spell doesn't protect the warded creature from area effects, such as the "
            "explosion of a fireball.\n\n"
            "If the warded creature makes an attack, casts a spell that affects an enemy, or deals "
            "damage to another creature, this spell ends."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "shield",
        "name": "Shield",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell",
        "range": "Self",
        "components": "V, S",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "An invisible barrier of magical force appears and protects you. Until the start of your "
            "next turn, you have a +5 bonus to AC, including against the triggering attack, and you "
            "take no damage from magic missile."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "shield-of-faith",
        "name": "Shield of Faith",
        "level": 1,
        "school": "abjuration",
        "castingTime": "1 bonus action",
        "range": "60 feet",
        "components": "V, S, M (a small parchment with a bit of holy text written on it)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "A shimmering field appears and surrounds a creature of your choice within range, granting "
            "it a +2 bonus to AC for the duration."
        ),
        "classes": ["cleric", "paladin"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "arcane-lock",
        "name": "Arcane Lock",
        "level": 2,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (gold dust worth at least 25 gp, which the spell consumes)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a closed door, window, gate, chest, or other entryway, and it becomes locked "
            "for the duration. You and the creatures you designate when you cast this spell can open "
            "the object normally. You can also set a password that, when spoken within 5 feet of the "
            "object, suppresses this spell for 1 minute. Otherwise, it is impassable until it is "
            "broken or the spell is dispelled or suppressed. Casting knock on the object suppresses "
            "arcane lock for 10 minutes.\n\n"
            "While affected by this spell, the object is more difficult to break or force open; the "
            "DC to break it or pick any locks on it increases by 10."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "lesser-restoration",
        "name": "Lesser Restoration",
        "level": 2,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature and can end either one disease or one condition afflicting it. The "
            "condition can be blinded, deafened, paralyzed, or poisoned."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger"],
    },
    {
        "id": "pass-without-trace",
        "name": "Pass Without Trace",
        "level": 2,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (ashes from a burned leaf of mistletoe and a sprig of spruce)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "A veil of shadows and silence radiates from you, masking you and your companions from "
            "detection. For the duration, each creature you choose within 30 feet of you (including "
            "you) has a +10 bonus to Dexterity (Stealth) checks and can't be tracked except by magical "
            "means. A creature that receives this bonus leaves behind no tracks or other traces of its "
            "passage."
        ),
        "classes": ["druid", "ranger"],
    },
    {
        "id": "protection-from-poison",
        "name": "Protection from Poison",
        "level": 2,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature. If it is poisoned, you neutralize the poison. If more than one "
            "poison afflicts the target, you neutralize one poison that you're aware of; you aren't "
            "aware of any poisons you didn't know afflicted the target.\n\n"
            "For the duration, the target has advantage on saving throws against being poisoned, and "
            "it has resistance to poison damage."
        ),
        "classes": ["cleric", "druid", "paladin", "ranger"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "counterspell",
        "name": "Counterspell",
        "level": 3,
        "school": "abjuration",
        "castingTime": "1 reaction, which you take when you see a creature within 60 feet of you casting a spell",
        "range": "60 feet",
        "components": "S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You attempt to interrupt a creature in the process of casting a spell. If the creature is "
            "casting a spell of 3rd level or lower, its spell fails and has no effect. If it is casting "
            "a spell of 4th level or higher, make an ability check using your spellcasting ability. "
            "The DC equals 10 + the spell's level. On a success, the creature's spell fails and has "
            "no effect.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "interrupted spell has no effect if its level is less than or equal to the level of the "
            "spell slot you used."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "dispel-magic",
        "name": "Dispel Magic",
        "level": 3,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Choose one creature, object, or magical effect within range. Any spell of 3rd level or "
            "lower on the target ends. For each spell of 4th level or higher on the target, make an "
            "ability check using your spellcasting ability. The DC equals 10 + the spell's level. On "
            "a successful check, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, you "
            "automatically end the effects of a spell on the target if the spell's level is equal to "
            "or less than the level of the spell slot you used."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "magic-circle",
        "name": "Magic Circle",
        "level": 3,
        "school": "abjuration",
        "castingTime": "1 minute",
        "range": "10 feet",
        "components": "V, S, M (holy water or powdered silver and iron worth at least 100 gp, which the spell consumes)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a 10-foot-radius, 20-foot-tall cylinder of magical energy centered on a point "
            "on the ground that you can see within range. Glowing runes appear wherever the cylinder "
            "intersects with the floor or other surface.\n\n"
            "Choose one or more of the following types of creatures: celestials, elementals, fey, "
            "fiends, or undead. The circle affects a creature of the chosen type in the following ways:\n\n"
            "• The creature can't willingly enter the cylinder by nonmagical means. If the creature "
            "tries to use teleportation or interplanar travel to do so, it must first succeed on a "
            "Charisma saving throw.\n"
            "• The creature has disadvantage on attack rolls against targets within the cylinder.\n"
            "• Targets within the cylinder can't be charmed, frightened, or possessed by the creature.\n\n"
            "When you cast this spell, you can elect to cause its magic to operate in the reverse "
            "direction, preventing a creature of the specified type from leaving the cylinder and "
            "protecting targets outside it.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "duration increases by 1 hour for each slot level above 3rd."
        ),
        "classes": ["cleric", "paladin", "warlock", "wizard"],
    },
    {
        "id": "protection-from-energy",
        "name": "Protection from Energy",
        "level": 3,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "For the duration, the willing creature you touch has resistance to one damage type of "
            "your choice: acid, cold, fire, lightning, or thunder."
        ),
        "classes": ["cleric", "druid", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "remove-curse",
        "name": "Remove Curse",
        "level": 3,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "At your touch, all curses affecting one creature or object end. If the object is a cursed "
            "magic item, its curse remains, but the spell breaks its owner's attunement to the object "
            "so it can be removed or discarded."
        ),
        "classes": ["cleric", "paladin", "warlock", "wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "banishment",
        "name": "Banishment",
        "level": 4,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (an item distasteful to the target)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to send one creature that you can see within range to another place of "
            "existence. The target must succeed on a Charisma saving throw or be banished.\n\n"
            "If the target is native to the plane of existence you're on, you banish the target to a "
            "harmless demiplane. While there, the target is incapacitated. The target remains there "
            "until the spell ends, at which point the target reappears in the space it left or in the "
            "nearest unoccupied space if that space is occupied.\n\n"
            "If the target is native to a different plane of existence than the one you're on, the "
            "target is banished with a faint popping noise, returning to its home plane. If the spell "
            "ends before 1 minute has passed, the target reappears in the space it left or in the "
            "nearest unoccupied space if that space is occupied. Otherwise, the target doesn't return.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, you "
            "can target one additional creature for each slot level above 4th."
        ),
        "classes": ["cleric", "paladin", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "death-ward",
        "name": "Death Ward",
        "level": 4,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature and grant it a measure of protection from death.\n\n"
            "The first time the target would drop to 0 hit points as a result of taking damage, the "
            "target instead drops to 1 hit point, and the spell ends.\n\n"
            "If the spell is still in effect when the target is subjected to an effect that would kill "
            "it instantaneously without dealing damage, that effect is instead negated against the "
            "target, and the spell ends."
        ),
        "classes": ["cleric", "paladin"],
    },
    {
        "id": "freedom-of-movement",
        "name": "Freedom of Movement",
        "level": 4,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a leather strap, bound around the arm or a similar appendage)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a willing creature. For the duration, the target's movement is unaffected by "
            "difficult terrain, and spells and other magical effects can neither reduce the target's "
            "speed nor cause the target to be paralyzed or restrained.\n\n"
            "The target can also spend 5 feet of movement to automatically escape from nonmagical "
            "restraints, such as manacles or a creature that has it grappled. Finally, being underwater "
            "imposes no penalties on the target's movement or attacks."
        ),
        "classes": ["bard", "cleric", "druid", "ranger"],
    },
    {
        "id": "stoneskin",
        "name": "Stoneskin",
        "level": 4,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (diamond dust worth 100 gp, which the spell consumes)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell turns the flesh of a willing creature you touch as hard as stone. Until the "
            "spell ends, the target has resistance to nonmagical bludgeoning, piercing, and slashing "
            "damage."
        ),
        "classes": ["druid", "ranger", "sorcerer", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "antimagic-field",
        "name": "Antimagic Field",
        "level": 8,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Self (10-foot-radius sphere)",
        "components": "V, S, M (a pinch of powdered iron or iron filings)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "A 10-foot-radius invisible sphere of antimagic surrounds you. This area is divorced from "
            "the magical energy that suffuses the multiverse. Within the sphere, spells can't be cast, "
            "summoned creatures disappear, and even magic items become mundane. Until the spell ends, "
            "the sphere moves with you, centered on you.\n\n"
            "Spells and other magical effects, except those created by an artifact or a deity, are "
            "suppressed in the sphere and can't protrude into it. A slot expended to cast a suppressed "
            "spell is consumed. While an effect is suppressed, it doesn't function, but the time it "
            "spends suppressed counts against its duration.\n\n"
            "Targeted Effects. Spells and other magical effects, such as magic missile and charm person, "
            "that target a creature or an object in the sphere have no effect on that target.\n\n"
            "Areas of Magic. The area of another spell or magical effect, such as fireball, can't extend "
            "into the sphere. If the sphere overlaps an area of magic, the part of the area that is "
            "covered by the sphere is suppressed. For example, the flames created by a wall of fire are "
            "suppressed within the sphere, creating a gap in the wall if the overlap is large enough.\n\n"
            "Spells. Any active spell or other magical effect on a creature or an object in the sphere "
            "is suppressed while the creature or object is in it.\n\n"
            "Magic Items. The properties and powers of magic items are suppressed in the sphere. For "
            "example, a +1 longsword in the sphere functions as a nonmagical longsword.\n\n"
            "An artifact's properties and powers are suppressed in the sphere. Artifacts are unaffected "
            "by this spell.\n\n"
            "Magical Travel. Teleportation and planar travel fail to work in the sphere, whether the "
            "sphere is the destination or the departure point for such magical travel. A portal to "
            "another location, world, or plane of existence, as well as an opening to an extradimensional "
            "space such as that created by the rope trick spell, temporarily closes while in the sphere.\n\n"
            "Creatures and Objects. A creature or object summoned or created by magic temporarily winks "
            "out of existence in the sphere. Such a creature instantly reappears once the space the "
            "creature occupied is no longer within the sphere.\n\n"
            "Dispel Magic. Spells and magical effects such as dispel magic have no effect on the sphere. "
            "Likewise, the spheres created by different antimagic field spells don't nullify each other."
        ),
        "classes": ["cleric", "wizard"],
    },
    {
        "id": "dispel-evil-and-good",
        "name": "Dispel Evil and Good",
        "level": 5,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (holy water or powdered silver and iron)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Shimmering energy surrounds and protects you from fey, undead, and creatures originating "
            "from beyond the Material Plane. For the duration, celestials, elementals, fey, fiends, "
            "and undead have disadvantage on attack rolls against you.\n\n"
            "You can end the spell early by using either of the following special functions.\n\n"
            "Break Enchantment. As your action, you touch a creature you can reach that is charmed, "
            "frightened, or possessed by a celestial, an elemental, a fey, a fiend, or an undead. The "
            "creature you touch is no longer charmed, frightened, or possessed by such creatures.\n\n"
            "Dismissal. As your action, make a melee spell attack against a celestial, an elemental, "
            "a fey, a fiend, or an undead you can reach. On a hit, you attempt to drive the creature "
            "back to its home plane. The creature must succeed on a Charisma saving throw or be sent "
            "back to its home plane (if it isn't there already). If they aren't on their home plane, "
            "undead are sent to the Shadowfell, and fey are sent to the Feywild."
        ),
        "classes": ["cleric", "paladin"],
    },
    {
        "id": "greater-restoration",
        "name": "Greater Restoration",
        "level": 5,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (diamond dust worth at least 100 gp, which the spell consumes)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You imbue a creature you touch with positive energy to undo a debilitating effect. You "
            "can reduce the target's exhaustion level by one, or end one of the following effects on "
            "the target:\n\n"
            "• One effect that charmed or petrified the target\n"
            "• One curse, including the target's attunement to a cursed magic item\n"
            "• Any reduction to one of the target's ability scores\n"
            "• One effect reducing the target's hit point maximum"
        ),
        "classes": ["bard", "cleric", "druid"],
    },
    {
        "id": "planar-binding",
        "name": "Planar Binding",
        "level": 5,
        "school": "abjuration",
        "castingTime": "1 hour",
        "range": "60 feet",
        "components": "V, S, M (a jewel worth at least 1,000 gp, which the spell consumes)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to "
            "your service. The creature must be within range for the entire casting of the spell. (Typically, "
            "the creature is first summoned into the center of an inverted magic circle in order to keep "
            "it trapped while this spell is cast.) At the completion of the casting, the target must make "
            "a Charisma saving throw. On a failed save, it is bound to serve you for the duration. If "
            "the creature was summoned or created by another spell, that spell's duration is extended "
            "to match the duration of this spell.\n\n"
            "A bound creature must follow your instructions to the best of its ability. You might command "
            "the creature to accompany you on an adventure, to guard a location, or to deliver a message. "
            "The creature obeys the letter of your instructions, but if the creature is hostile to you, "
            "it strives to twist your words to achieve its own goals. If the creature carries out your "
            "instructions completely before the spell ends, it travels to you to report this fact if you "
            "are on the same plane of existence. If you are on a different plane of existence, it returns "
            "to the place where you bound it and remains there until the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of a higher level, the "
            "duration increases to 10 days with a 6th-level slot, to 30 days with a 7th-level slot, "
            "to 180 days with an 8th-level slot, and to a year and a day with a 9th-level spell slot."
        ),
        "classes": ["bard", "cleric", "druid", "wizard"],
    },
    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "globe-of-invulnerability",
        "name": "Globe of Invulnerability",
        "level": 6,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Self (10-foot radius)",
        "components": "V, S, M (a glass or crystal bead that shatters when the spell ends)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "An immobile, faintly shimmering barrier springs into existence in a 10-foot radius around "
            "you and remains for the duration.\n\n"
            "Any spell of 5th level or lower cast from outside the barrier can't affect creatures or "
            "objects within it, even if the spell is cast using a higher level spell slot. Such a spell "
            "can target creatures and objects within the barrier, but the spell has no effect on them. "
            "Similarly, the area within the barrier is excluded from the areas affected by such spells.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the "
            "barrier blocks spells of one level lower than the slot you used."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "prismatic-wall",
        "name": "Prismatic Wall",
        "level": 9,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "10 minutes",
        "concentration": False,
        "ritual": False,
        "description": (
            "A shimmering, multicolored plane of light forms a vertical opaque wall—up to 90 feet long, "
            "30 feet high, and 1 inch thick—centered on a point you can see within range. Alternatively, "
            "you can shape the wall into a sphere up to 30 feet in diameter centered on a point you "
            "choose within range. The wall remains in place for the duration. If you position the wall "
            "so that it passes through a space occupied by a creature, the spell fails, and your action "
            "and the spell slot are wasted.\n\n"
            "The wall sheds bright light out to 100 feet and dim light for an additional 100 feet. You "
            "and creatures you designate at the time you cast the spell can pass through and remain near "
            "the wall without harm. If another creature that can see the wall moves to within 20 feet "
            "of it or starts its turn there, the creature must succeed on a Constitution saving throw "
            "or become blinded for 1 minute.\n\n"
            "The wall consists of seven layers, each with a different color. When a creature attempts "
            "to reach into or pass through the wall, it does so one layer at a time through all the "
            "wall's layers. As it passes or reaches through each layer, the creature must make a "
            "Dexterity saving throw or be stopped by that layer and subjected to its effect.\n\n"
            "The wall can be destroyed, also one layer at a time, in order from red to violet, by "
            "means specific to each layer."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "sequester",
        "name": "Sequester",
        "level": 7,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a powder composed of diamond, emerald, ruby, and sapphire dust worth at least 5,000 gp, which the spell consumes)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "By means of this spell, a willing creature or an object can be hidden away, safe from "
            "detection for the duration. When you cast the spell and touch the target, it becomes "
            "invisible and can't be targeted by divination spells or perceived through scrying sensors "
            "created by divination spells.\n\n"
            "If the target is a creature, it falls into a state of suspended animation. Time ceases to "
            "flow for it, and it doesn't grow older.\n\n"
            "You can set a condition for the spell to end early. The condition can be anything you "
            "choose, but it must occur or be visible within 1 mile of the target. Examples include "
            "'after 1,000 years' or 'when the tarrasque awakens.' This spell also ends if the target "
            "takes any damage."
        ),
        "classes": ["wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "mind-blank",
        "name": "Mind Blank",
        "level": 8,
        "school": "abjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "Until the spell ends, one willing creature you touch is immune to psychic damage, any "
            "effect that would sense its emotions or read its thoughts, divination spells, and the "
            "charmed condition. The spell even foils wish spells and spells or effects of similar power "
            "used to affect the target's mind or to gain information about the target."
        ),
        "classes": ["bard", "wizard"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    skipped = 0
    for spell in ABJURATION_SPELLS:
        # Skip any accidentally duplicated entries from other schools
        if spell["id"] in existing_ids:
            skipped += 1
            continue
        data["spells"].append(spell)
        existing_ids.add(spell["id"])
        added += 1

    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} abjuration spells (skipped {skipped} duplicates). Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
