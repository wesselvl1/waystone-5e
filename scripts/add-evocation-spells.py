#!/usr/bin/env python3
"""Add all SRD 5.1 evocation spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

EVOCATION_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "fire-bolt",
        "name": "Fire Bolt",
        "level": 0,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack "
            "against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by "
            "this spell ignites if it isn't being worn or carried.\n\n"
            "This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), "
            "and 17th level (4d10)."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "light",
        "name": "Light",
        "level": 0,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, M (a firefly or phosphorescent moss)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, "
            "the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. "
            "The light can be colored as you like. Completely covering the object with something opaque "
            "blocks the light. The spell ends if you cast it again or dismiss it as an action.\n\n"
            "If you target an object held or worn by a hostile creature, that creature must succeed on "
            "a Dexterity saving throw to avoid the spell."
        ),
        "classes": ["bard", "cleric", "sorcerer", "wizard"],
    },
    {
        "id": "ray-of-frost",
        "name": "Ray of Frost",
        "level": 0,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A frigid beam of blue-white light streaks toward a creature within range. Make a ranged "
            "spell attack against the target. On a hit, it takes 1d8 cold damage, and its speed is "
            "reduced by 10 feet until the start of your next turn.\n\n"
            "The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), "
            "and 17th level (4d8)."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "sacred-flame",
        "name": "Sacred Flame",
        "level": 0,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Flame-like radiance descends on a creature that you can see within range. The target must "
            "succeed on a Dexterity saving throw or take 1d8 radiant damage. The target gains no benefit "
            "from cover for this saving throw.\n\n"
            "The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and "
            "17th level (4d8)."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "shocking-grasp",
        "name": "Shocking Grasp",
        "level": 0,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a "
            "melee spell attack against the target. You have advantage on the attack roll if the target "
            "is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it "
            "can't take reactions until the start of its next turn.\n\n"
            "The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and "
            "17th level (4d8)."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "burning-hands",
        "name": "Burning Hands",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (15-foot cone)",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames "
            "shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make "
            "a Dexterity saving throw. A creature takes 3d6 fire damage on a failed save, or half as "
            "much damage on a successful one.\n\n"
            "The fire ignites any flammable objects in the area that aren't being worn or carried.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "damage increases by 1d6 for each slot level above 1st."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "cure-wounds",
        "name": "Cure Wounds",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting "
            "ability modifier. This spell has no effect on undead or constructs.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "healing increases by 1d8 for each slot level above 1st."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger"],
    },
    {
        "id": "faerie-fire",
        "name": "Faerie Fire",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Each object in a 20-foot cube within range is outlined in blue, green, or violet light "
            "(your choice). Any creature in the area when the spell is cast is also outlined in light "
            "if it fails a Dexterity saving throw. For the duration, objects and affected creatures "
            "shed dim light in a 10-foot radius.\n\n"
            "Any attack roll against an affected creature or object has advantage if the attacker can "
            "see it, and the affected creature or object can't benefit from being invisible."
        ),
        "classes": ["bard", "druid"],
    },
    {
        "id": "guiding-bolt",
        "name": "Guiding Bolt",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "A flash of light streaks toward a creature of your choice within range. Make a ranged "
            "spell attack against the target. On a hit, the target takes 4d6 radiant damage, and the "
            "next attack roll made against this target before the end of your next turn has advantage, "
            "thanks to the mystical dim light glittering on the target until then.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "damage increases by 1d6 for each slot level above 1st."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "healing-word",
        "name": "Healing Word",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 bonus action",
        "range": "60 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A creature of your choice that you can see within range regains hit points equal to "
            "1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "healing increases by 1d4 for each slot level above 1st."
        ),
        "classes": ["bard", "cleric", "druid"],
    },
    {
        "id": "magic-missile",
        "name": "Magic Missile",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create three glowing darts of magical force. Each dart hits a creature of your choice "
            "that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts "
            "all strike simultaneously, and you can direct them to hit one creature or several.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "spell creates one more dart for each slot level above 1st."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "thunderwave",
        "name": "Thunderwave",
        "level": 1,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (15-foot cube)",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating "
            "from you must make a Constitution saving throw. On a failed save, a creature takes 2d8 "
            "thunder damage and is pushed 10 feet away from you. On a successful save, the creature takes "
            "half as much damage and isn't pushed.\n\n"
            "In addition, unsecured objects that are completely within the area of effect are automatically "
            "pushed 10 feet away from you by the spell's effect, and the spell emits a thunderous boom "
            "audible out to 300 feet.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "damage increases by 1d8 for each slot level above 1st."
        ),
        "classes": ["bard", "druid", "sorcerer", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "continual-flame",
        "name": "Continual Flame",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (ruby dust worth 50 gp, which the spell consumes)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "A flame, equivalent in brightness to a torch, springs forth from an object that you touch. "
            "The effect looks like a regular flame, but it creates no heat and doesn't use oxygen. A "
            "continual flame can be covered or hidden but not smothered or quenched."
        ),
        "classes": ["cleric", "wizard"],
    },
    {
        "id": "darkness",
        "name": "Darkness",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, M (bat fur and a drop of pitch or piece of coal)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "Magical darkness spreads from a point you choose within range to fill a 15-foot-radius "
            "sphere for the duration. The darkness spreads around corners. A creature with darkvision "
            "can't see through this magical darkness, and nonmagical light can't illuminate it.\n\n"
            "If the point you choose is on an object you are holding or one that isn't being worn or "
            "carried, the darkness emanates from the object and moves with it. Completely covering the "
            "source of the darkness with an opaque object, such as a bowl or a helm, blocks the darkness.\n\n"
            "If any of this spell's area overlaps with an area of light created by a spell of 2nd level "
            "or lower, the spell that created the light is dispelled."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "melfs-acid-arrow",
        "name": "Melf's Acid Arrow",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (powdered rhubarb leaf and an adder's stomach)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. "
            "Make a ranged spell attack against the target. On a hit, the target takes 4d4 acid damage "
            "immediately and 2d4 acid damage at the end of its next turn. On a miss, the arrow splashes "
            "the target with acid for half as much of the initial damage and no damage at the end of its "
            "next turn.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the "
            "damage (both initial and later) increases by 1d4 for each slot level above 2nd."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "scorching-ray",
        "name": "Scorching Ray",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create three rays of fire and hurl them at targets within range. You can hurl them at "
            "one target or several.\n\n"
            "Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you "
            "create one additional ray for each slot level above 2nd."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "shatter",
        "name": "Shatter",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a chip of mica)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A sudden loud ringing noise, painfully intense, erupts from a point of your choice within "
            "range. Each creature in a 10-foot-radius sphere centered on that point must make a "
            "Constitution saving throw. A creature takes 3d8 thunder damage on a failed save, or half "
            "as much damage on a successful one. A creature made of inorganic material such as stone, "
            "crystal, or metal has disadvantage on this saving throw.\n\n"
            "A nonmagical object that isn't being worn or carried also takes the damage if it's in the "
            "spell's area.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the "
            "damage increases by 1d8 for each slot level above 2nd."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "spiritual-weapon",
        "name": "Spiritual Weapon",
        "level": 2,
        "school": "evocation",
        "castingTime": "1 bonus action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a floating, spectral weapon within range that lasts for the duration or until "
            "you cast this spell again. When you cast the spell, you can make a melee spell attack "
            "against a creature within 5 feet of the weapon. On a hit, the target takes force damage "
            "equal to 1d8 + your spellcasting ability modifier.\n\n"
            "As a bonus action on your turn, you can move the weapon up to 20 feet and repeat the attack "
            "against a creature within 5 feet of it.\n\n"
            "The weapon can take whatever form you choose. Clerics of deities who are associated with a "
            "particular weapon (as St. Cuthbert is known for his mace and Thor for his hammer) make "
            "this spell's effect resemble that weapon.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the "
            "damage increases by 1d8 for every two slot levels above 2nd."
        ),
        "classes": ["cleric"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "daylight",
        "name": "Daylight",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "A 60-foot-radius sphere of light spreads out from a point you choose within range. The "
            "sphere is bright light and sheds dim light for an additional 60 feet.\n\n"
            "If you chose a point on an object you are holding or one that isn't being worn or carried, "
            "the light shines from the object and moves with it. Completely covering the affected object "
            "with an opaque object, such as a bowl or a helm, blocks the light.\n\n"
            "If any of this spell's area overlaps with an area of darkness created by a spell of 3rd "
            "level or lower, the spell that created the darkness is dispelled."
        ),
        "classes": ["cleric", "druid", "paladin", "ranger", "sorcerer"],
    },
    {
        "id": "fireball",
        "name": "Fireball",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (a tiny ball of bat guano and sulfur)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A bright streak flashes from your pointing finger to a point you choose within range and "
            "then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius "
            "sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire "
            "damage on a failed save, or half as much damage on a successful one.\n\n"
            "The fire spreads around corners. It ignites flammable objects in the area that aren't being "
            "worn or carried.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "damage increases by 1d6 for each slot level above 3rd."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "leomunds-tiny-hut",
        "name": "Leomund's Tiny Hut",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 minute",
        "range": "Self (10-foot-radius hemisphere)",
        "components": "V, S, M (a small crystal bead)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": True,
        "description": (
            "A 10-foot-radius immobile dome of force springs into existence around and above you and "
            "remains stationary for the duration. The spell ends if you leave its area.\n\n"
            "Nine creatures of Medium size or smaller can fit inside the dome with you. The spell fails "
            "if its area includes a larger creature or more than nine creatures. Creatures and objects "
            "within the dome when you cast this spell can move through it freely. All other creatures "
            "and objects are barred from passing through it. Spells and other magical effects can't "
            "extend through the dome or be cast through it. The atmosphere inside the space is "
            "comfortable and dry, regardless of the weather outside.\n\n"
            "Until the spell ends, you can command the interior to become dimly lit or dark. The dome "
            "is opaque from the outside, of any color you choose, but it is transparent from the inside."
        ),
        "classes": ["bard", "wizard"],
    },
    {
        "id": "lightning-bolt",
        "name": "Lightning Bolt",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (100-foot line)",
        "components": "V, S, M (a bit of fur and a rod of amber, crystal, or glass)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in "
            "a direction you choose. Each creature in the line must make a Dexterity saving throw. A "
            "creature takes 8d6 lightning damage on a failed save, or half as much damage on a "
            "successful one.\n\n"
            "The lightning ignites flammable objects in the area that aren't being worn or carried.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "damage increases by 1d6 for each slot level above 3rd."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "mass-healing-word",
        "name": "Mass Healing Word",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 bonus action",
        "range": "60 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "As you call out words of restoration, up to six creatures of your choice that you can see "
            "within range regain hit points equal to 1d4 + your spellcasting ability modifier. This "
            "spell has no effect on undead or constructs.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "healing increases by 1d4 for each slot level above 3rd."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "sending",
        "name": "Sending",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Unlimited",
        "components": "V, S, M (a short piece of fine copper wire)",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "You send a short message of twenty-five words or less to a creature with which you are "
            "familiar. The creature hears the message in its mind, recognizes you as the sender if it "
            "knows you, and can answer in a like manner immediately. The spell enables creatures with "
            "Intelligence scores of at least 1 to understand the meaning of your message.\n\n"
            "You can send the message across any distance and even to other planes of existence, but "
            "if the target is on a different plane than you, there is a 5 percent chance that the "
            "message doesn't arrive."
        ),
        "classes": ["bard", "cleric", "wizard"],
    },
    {
        "id": "wind-wall",
        "name": "Wind Wall",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a tiny fan and a feather of exotic origin)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A wall of strong wind rises from the ground at a point you choose within range. You can "
            "make the wall up to 50 feet long, 15 feet high, and 1 foot thick. You can shape the wall "
            "in any way you choose so long as it makes one continuous path along the ground. The wall "
            "lasts for the duration.\n\n"
            "When the wall appears, each creature within its area must make a Strength saving throw. A "
            "creature takes 3d8 bludgeoning damage on a failed save, or half as much damage on a "
            "successful one.\n\n"
            "The strong wind keeps fog, smoke, and other gases at bay. Small or smaller flying creatures "
            "or objects can't pass through the wall. Loose, lightweight materials brought into the wall "
            "fly upward. Arrows, bolts, and other ordinary projectiles launched at targets behind the "
            "wall are deflected upward and automatically miss. (Boulders hurled by giants or siege "
            "engines, and similar projectiles, are unaffected.) Creatures in gaseous form can't pass "
            "through it."
        ),
        "classes": ["druid", "ranger"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "ice-storm",
        "name": "Ice Storm",
        "level": 4,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "300 feet",
        "components": "V, S, M (a pinch of dust and a few drops of water)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A hail of rock-hard ice pounds to the ground in a 20-foot-radius, 40-foot-high cylinder "
            "centered on a point within range. Each creature in the cylinder must make a Dexterity "
            "saving throw. A creature takes 2d8 bludgeoning damage and 4d6 cold damage on a failed "
            "save, or half as much damage on a successful one.\n\n"
            "Hailstones turn the storm's area of effect into difficult terrain until the end of your "
            "next turn.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the "
            "bludgeoning damage increases by 1d8 for each slot level above 4th."
        ),
        "classes": ["druid", "sorcerer", "wizard"],
    },
    {
        "id": "wall-of-fire",
        "name": "Wall of Fire",
        "level": 4,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a small piece of phosphorus)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a wall of fire on a solid surface within range. The wall can be up to 60 feet "
            "long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet "
            "high, and 1 foot thick. The wall is opaque and lasts for the duration.\n\n"
            "When the wall appears, each creature within its area must make a Dexterity saving throw. "
            "On a failed save, a creature takes 5d8 fire damage, or half as much damage on a "
            "successful save.\n\n"
            "One side of the wall, selected by you when you cast this spell, deals 5d8 fire damage to "
            "each creature that ends its turn within 10 feet of that side or inside the wall. A creature "
            "takes the same damage when it enters the wall for the first time on a turn. The other side "
            "of the wall deals no damage.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the "
            "damage increases by 1d8 for each slot level above 4th."
        ),
        "classes": ["druid", "sorcerer", "wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "cone-of-cold",
        "name": "Cone of Cold",
        "level": 5,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (60-foot cone)",
        "components": "V, S, M (a small crystal or glass cone)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a "
            "Constitution saving throw. A creature takes 8d8 cold damage on a failed save, or half as "
            "much damage on a successful one.\n\n"
            "A creature killed by this spell becomes a frozen statue until it thaws.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the "
            "damage increases by 1d8 for each slot level above 5th."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "flame-strike",
        "name": "Flame Strike",
        "level": 5,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (pinch of sulfur)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A vertical column of divine fire roars down from the heavens in a location you specify. "
            "Each creature in a 10-foot-radius, 40-foot-high cylinder centered on a point within range "
            "must make a Dexterity saving throw. A creature takes 4d6 fire damage and 4d6 radiant "
            "damage on a failed save, or half as much damage on a successful one.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the "
            "fire damage or the radiant damage (your choice) increases by 1d6 for each slot level "
            "above 5th."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "mass-cure-wounds",
        "name": "Mass Cure Wounds",
        "level": 5,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A wave of healing energy washes out from a point of your choice within range. Choose up "
            "to six creatures in a 30-foot-radius sphere centered on that point. Each target regains "
            "hit points equal to 3d8 + your spellcasting ability modifier. This spell has no effect "
            "on undead or constructs.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the "
            "healing increases by 1d8 for each slot level above 5th."
        ),
        "classes": ["bard", "cleric", "druid"],
    },
    {
        "id": "wall-of-force",
        "name": "Wall of Force",
        "level": 5,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a pinch of powder made by crushing a clear gemstone)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "An invisible wall of force springs into existence at a point you choose within range. The "
            "wall appears in any orientation you choose, as a horizontal or vertical barrier or at an "
            "angle. It can be free floating or resting on a solid surface. You can form it into a "
            "hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat "
            "surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with "
            "another panel. In any form, the wall is 1/4 inch thick. It lasts for the duration. If "
            "the wall cuts through a creature's space when it appears, the creature is pushed to one "
            "side of the wall (your choice which side).\n\n"
            "Nothing can physically pass through the wall. It is immune to all damage and can't be "
            "dispelled by dispel magic. A disintegrate spell destroys the wall instantly, however. "
            "The wall also extends into the Ethereal Plane, blocking ethereal travel through the wall."
        ),
        "classes": ["wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "chain-lightning",
        "name": "Chain Lightning",
        "level": 6,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (a bit of fur; a piece of amber, glass, or a crystal rod; and three silver pins)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a bolt of lightning that arcs toward a target of your choice that you can see "
            "within range. Three bolts then leap from that target to as many as three other targets, "
            "each of which must be within 30 feet of the first target. A target can be a creature or "
            "an object and can be targeted by only one of the bolts.\n\n"
            "A target must make a Dexterity saving throw. The target takes 10d8 lightning damage on a "
            "failed save, or half as much damage on a successful one.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, one "
            "additional bolt leaps from the first target to another target for each slot level above 6th."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "heal",
        "name": "Heal",
        "level": 6,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Choose a creature that you can see within range. A surge of positive energy washes through "
            "the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, "
            "and any diseases affecting the target. This spell has no effect on constructs or undead.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the "
            "amount of healing increases by 10 for each slot level above 6th."
        ),
        "classes": ["cleric", "druid"],
    },
    {
        "id": "sunbeam",
        "name": "Sunbeam",
        "level": 6,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (60-foot line)",
        "components": "V, S, M (a magnifying glass)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line. "
            "Each creature in the line must make a Constitution saving throw. On a failed save, a "
            "creature takes 6d8 radiant damage and is blinded until your next turn. On a successful "
            "save, it takes half as much damage and isn't blinded by this spell. Undead and oozes have "
            "disadvantage on this saving throw.\n\n"
            "You can create a new line of radiance as your action on any turn until the spell ends.\n\n"
            "For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light "
            "in a 30-foot radius and dim light for an additional 30 feet. This light is sunlight."
        ),
        "classes": ["cleric", "druid", "sorcerer", "wizard"],
    },
    {
        "id": "wall-of-ice",
        "name": "Wall of Ice",
        "level": 6,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a small piece of quartz)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a wall of ice on a solid surface within range. The wall is 1 foot thick and is "
            "composed of ten 10-foot-square panels. Each panel must be contiguous with at least one "
            "other panel. The wall lasts for the duration.\n\n"
            "If the wall cuts through a creature's space when it appears, the creature within its area "
            "is pushed to one side of the wall and must make a Dexterity saving throw. On a failed "
            "save, the creature takes 10d6 cold damage, or half as much damage on a successful save.\n\n"
            "The wall is an object that can be damaged and thus breached. It has AC 12 and 30 hit "
            "points per 10-foot section, and it is vulnerable to fire damage. Reducing a 10-foot "
            "section of wall to 0 hit points destroys it and leaves behind a sheet of frigid air in "
            "the space the wall occupied. A creature moving through the sheet of frigid air for the "
            "first time on a turn must make a Constitution saving throw. That creature takes 5d6 cold "
            "damage on a failed save, or half as much damage on a successful one.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the "
            "damage the wall deals when it appears increases by 2d6, and the damage from passing through "
            "the sheet of frigid air increases by 1d6, for each slot level above 6th."
        ),
        "classes": ["wizard"],
    },

    # ── 7th Level ─────────────────────────────────────────────────────────────
    {
        "id": "fire-storm",
        "name": "Fire Storm",
        "level": 7,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A storm made up of sheets of roaring flame appears in a location you choose within range. "
            "The area of the storm consists of up to ten 10-foot cubes, which you can arrange as you "
            "wish. Each cube must have at least one face adjacent to the face of another cube. Each "
            "creature in the area must make a Dexterity saving throw. It takes 7d10 fire damage on a "
            "failed save, or half as much damage on a successful one.\n\n"
            "The fire damages objects in the area and ignites flammable objects that aren't being worn "
            "or carried. If you choose, plant life in the area is unaffected by this spell."
        ),
        "classes": ["cleric", "druid", "sorcerer"],
    },
    {
        "id": "prismatic-spray",
        "name": "Prismatic Spray",
        "level": 7,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "Self (60-foot cone)",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Eight multicolored rays of light flash from your hand. Each ray is a different color and "
            "has a different power and purpose. Each creature in a 60-foot cone must make a Dexterity "
            "saving throw. For each target, roll a d8 to determine which color ray affects it.\n\n"
            "1. Red. The target takes 10d6 fire damage on a failed save, or half as much damage on a "
            "successful one.\n"
            "2. Orange. The target takes 10d6 acid damage on a failed save, or half as much damage on "
            "a successful one.\n"
            "3. Yellow. The target takes 10d6 lightning damage on a failed save, or half as much damage "
            "on a successful one.\n"
            "4. Green. The target takes 10d6 poison damage on a failed save, or half as much damage on "
            "a successful one.\n"
            "5. Blue. The target takes 10d6 cold damage on a failed save, or half as much damage on a "
            "successful one.\n"
            "6. Indigo. On a failed save, the target is restrained. It must then make a Constitution "
            "saving throw at the end of each of its turns. If it successfully saves three times, the "
            "spell ends. If it fails its save three times, it permanently turns to stone and is "
            "subjected to the petrified condition. The successes and failures don't need to be "
            "consecutive; keep track of both until the target collects three of a kind.\n"
            "7. Violet. On a failed save, the target is blinded. It must then make a Wisdom saving "
            "throw at the start of your next turn. A successful save ends the blindness. If it fails "
            "that saving throw, the creature is transported to another plane of existence of the DM's "
            "choosing and is no longer blinded. (Typically, a creature that is on a plane that isn't "
            "its home plane is banished home, while other creatures are generally cast into the Astral "
            "or Ethereal planes.)\n"
            "8. Special. The target is struck by two rays. Roll twice more, rerolling any 8."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "sunburst",
        "name": "Sunburst",
        "level": 8,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (fire and a piece of sunstone)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Brilliant sunlight blazes in a 60-foot radius centered on a point you choose within range. "
            "Each creature in that light must make a Constitution saving throw. On a failed save, a "
            "creature takes 12d6 radiant damage and is blinded for 1 minute. On a successful save, it "
            "takes half as much damage and isn't blinded by this spell. Undead and oozes have "
            "disadvantage on this saving throw.\n\n"
            "A creature blinded by this spell makes another Constitution saving throw at the end of "
            "each of its turns. On a successful save, it is no longer blinded.\n\n"
            "This spell dispels any darkness in its area that was created by a spell."
        ),
        "classes": ["cleric", "druid", "sorcerer", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "mass-heal",
        "name": "Mass Heal",
        "level": 9,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A flood of healing energy flows from you into injured creatures around you. You restore up "
            "to 700 hit points, divided as you choose among any number of creatures that you can see "
            "within range. Creatures healed by this spell are also cured of all diseases and any effect "
            "making them blinded or deafened. This spell has no effect on undead or constructs."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "meteor-swarm",
        "name": "Meteor Swarm",
        "level": 9,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "1 mile",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Blazing orbs of fire plummet to the ground at four different points you can see within "
            "range. Each creature in a 40-foot-radius sphere centered on each point you choose must "
            "make a Dexterity saving throw. The sphere spreads around corners. A creature takes 20d6 "
            "fire damage and 20d6 bludgeoning damage on a failed save, or half as much damage on a "
            "successful one. A creature in the area of more than one fiery burst is affected only once.\n\n"
            "The spell damages objects in the area and ignites flammable objects that aren't being worn "
            "or carried."
        ),
        "classes": ["sorcerer", "wizard"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    for spell in EVOCATION_SPELLS:
        if spell["id"] not in existing_ids:
            data["spells"].append(spell)
            added += 1

    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} evocation spells. Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
