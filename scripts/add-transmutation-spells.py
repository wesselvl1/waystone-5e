#!/usr/bin/env python3
"""Add all SRD 5.1 transmutation spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

TRANSMUTATION_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "mending",
        "name": "Mending",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 minute",
        "range": "Touch",
        "components": "V, S, M (two lodestones)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell repairs a single break or tear in an object you touch, such as a broken chain link, "
            "two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is "
            "no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage.\n\n"
            "This spell can physically repair a magic item or construct, but the spell can't restore magic to "
            "such an object."
        ),
        "classes": ["bard", "cleric", "druid", "sorcerer", "wizard"],
    },
    {
        "id": "message",
        "name": "Message",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a short piece of copper wire)",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "You point your finger toward a creature within range and whisper a message. The target (and only "
            "the target) hears the message and can reply in a whisper that only you can hear.\n\n"
            "You can cast this spell through solid objects if you are familiar with the target and know it is "
            "beyond the barrier. Magical silence, 1 foot of stone, 1 inch of common metal, a thin sheet of lead, "
            "or 3 feet of wood blocks the spell. The spell doesn't have to follow a straight line and can travel "
            "freely around corners or through openings."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "prestidigitation",
        "name": "Prestidigitation",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "10 feet",
        "components": "V, S",
        "duration": "Up to 1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell is a minor magical trick that novice spellcasters use for practice. You create one of "
            "the following magical effects within range:\n\n"
            "• You create an instantaneous, harmless sensory effect, such as a shower of sparks, a puff of wind, "
            "faint musical notes, or an odd odor.\n"
            "• You instantaneously light or snuff out a candle, a torch, or a small campfire.\n"
            "• You instantaneously clean or soil an object no larger than 1 cubic foot.\n"
            "• You chill, warm, or flavor up to 1 cubic foot of nonliving material for 1 hour.\n"
            "• You make a color, a small mark, or a symbol appear on an object or a surface for 1 hour.\n"
            "• You create a nonmagical trinket or an illusory image that can fit in your hand and that lasts "
            "until the end of your next turn.\n\n"
            "If you cast this spell multiple times, you can have up to three of its non-instantaneous effects "
            "active at a time, and you can dismiss such an effect as an action."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "shillelagh",
        "name": "Shillelagh",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 bonus action",
        "range": "Touch",
        "components": "V, S, M (mistletoe, a shamrock leaf, and a club or quarterstaff)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "The wood of a club or quarterstaff you are holding is imbued with nature's power. For the duration, "
            "you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee "
            "attacks using that weapon, and the weapon's damage die becomes a d8. The weapon also becomes magical, "
            "if it isn't already. The spell ends if you cast it again or if you let go of the weapon."
        ),
        "classes": ["druid"],
    },
    {
        "id": "thaumaturgy",
        "name": "Thaumaturgy",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V",
        "duration": "Up to 1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You manifest a minor wonder, a sign of supernatural power, within range. You create one of the "
            "following magical effects within range:\n\n"
            "• Your voice booms up to three times as loud as normal for 1 minute.\n"
            "• You cause flames to flicker, brighten, dim, or change color for 1 minute.\n"
            "• You cause harmless tremors in the ground for 1 minute.\n"
            "• You create an instantaneous sound that originates from a point of your choice within range, "
            "such as a rumble of thunder, the cry of a raven, or ominous whispers.\n"
            "• You instantaneously cause an unlocked door or window to fly open or slam shut.\n"
            "• You alter the appearance of your eyes for 1 minute.\n\n"
            "If you cast this spell multiple times, you can have up to three of its 1-minute effects active "
            "at a time, and you can dismiss such an effect as an action."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "thorn-whip",
        "name": "Thorn Whip",
        "level": 0,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (the stem of a plant with thorns)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a long, vine-like whip covered in thorns that lashes out at your command toward a "
            "creature in range. Make a melee spell attack against the target. If the attack hits, the creature "
            "takes 1d6 piercing damage, and if the creature is Large or smaller, you pull the creature up to "
            "10 feet closer to you.\n\n"
            "This spell's damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and "
            "17th level (4d6)."
        ),
        "classes": ["druid"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "expeditious-retreat",
        "name": "Expeditious Retreat",
        "level": 1,
        "school": "transmutation",
        "castingTime": "1 bonus action",
        "range": "Self",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell allows you to move at an incredible pace. When you cast this spell, and then as a "
            "bonus action on each of your turns until the spell ends, you can take the Dash action."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "feather-fall",
        "name": "Feather Fall",
        "level": 1,
        "school": "transmutation",
        "castingTime": "1 reaction, which you take when you or a creature within 60 feet of you falls",
        "range": "60 feet",
        "components": "V, M (a small feather or piece of down)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "Choose up to five falling creatures within range. A falling creature's rate of descent slows to "
            "60 feet per round until the spell ends. If the creature lands before the spell ends, it takes no "
            "falling damage and can land on its feet, and the spell ends for that creature."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "jump",
        "name": "Jump",
        "level": 1,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a grasshopper's hind leg)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature. The creature's jump distance is tripled until the spell ends."
        ),
        "classes": ["druid", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "longstrider",
        "name": "Longstrider",
        "level": 1,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a pinch of dirt)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature. The target's speed increases by 10 feet until the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, you can "
            "target one additional creature for each slot level above 1st."
        ),
        "classes": ["bard", "druid", "ranger", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "alter-self",
        "name": "Alter Self",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You assume a different form. When you cast the spell, choose one of the following options, the "
            "effects of which last for the duration of the spell. While the spell lasts, you can end one option "
            "as an action to gain the benefits of a different one.\n\n"
            "Aquatic Adaptation. You adapt your body to an aquatic environment, sprouting gills and growing "
            "webbing between your fingers. You can breathe underwater and gain a swimming speed equal to your "
            "walking speed.\n\n"
            "Change Appearance. You transform your appearance. You decide what you look like, including your "
            "height, weight, facial features, sound of your voice, hair length, coloration, and distinguishing "
            "characteristics, if any. You can make yourself appear as a member of another race, though none of "
            "your statistics change. You also can't appear as a creature of a different size than you, and your "
            "basic shape stays the same. The changes wrought by this spell fail to fool Truesight.\n\n"
            "Natural Weapons. You grow claws, fangs, spines, horns, or a different natural weapon of your "
            "choice. Your unarmed strikes deal 1d6 bludgeoning, piercing, or slashing damage, as appropriate "
            "to the natural weapon you chose, and you are proficient with your unarmed strikes. Finally, the "
            "natural weapon is magic and you have a +1 bonus to the attack and damage rolls you make using it."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "barkskin",
        "name": "Barkskin",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a handful of oak bark)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch a willing creature. Until the spell ends, the target's skin has a rough, bark-like "
            "appearance, and the target's AC can't be less than 16, regardless of what kind of armor it is "
            "wearing."
        ),
        "classes": ["druid", "ranger"],
    },
    {
        "id": "darkvision",
        "name": "Darkvision",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (either a pinch of dried carrot or an agate)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a willing creature to grant it the ability to see in the dark. For the duration, that "
            "creature has darkvision out to a range of 60 feet."
        ),
        "classes": ["druid", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "enhance-ability",
        "name": "Enhance Ability",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (fur or a feather from a beast)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; "
            "the target gains that effect until the spell ends.\n\n"
            "Bear's Endurance. The target has advantage on Constitution checks. It also gains 2d6 temporary hit points, "
            "which are lost when the spell ends.\n\n"
            "Bull's Strength. The target has advantage on Strength checks, and his or her carrying capacity doubles.\n\n"
            "Cat's Grace. The target has advantage on Dexterity checks. It also doesn't take damage from falling 20 feet "
            "or less if it isn't incapacitated.\n\n"
            "Eagle's Splendor. The target has advantage on Charisma checks.\n\n"
            "Fox's Cunning. The target has advantage on Intelligence checks.\n\n"
            "Owl's Wisdom. The target has advantage on Wisdom checks.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you can target "
            "one additional creature for each slot level above 2nd."
        ),
        "classes": ["bard", "cleric", "druid", "sorcerer"],
    },
    {
        "id": "enlarge-reduce",
        "name": "Enlarge/Reduce",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a pinch of powdered iron)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You cause a creature or an object you can see within range to grow larger or smaller for the "
            "duration. Choose either a creature or a nonmagical object that is neither worn nor carried. If "
            "the target is unwilling, it can make a Constitution saving throw. On a success, the spell has "
            "no effect.\n\n"
            "Enlarge. The target's size doubles in all dimensions, and its weight is multiplied by eight. "
            "This growth increases its size by one category—from Medium to Large, for example. If there isn't "
            "room for the target to double its size, the creature or object attains the maximum possible size "
            "in the space available. Until the spell ends, the target also has advantage on Strength checks "
            "and Strength saving throws. The target's weapons also grow to match its new size. While these "
            "weapons are enlarged, the target's attacks with them deal 1d4 extra damage.\n\n"
            "Reduce. The target's size is halved in all dimensions, and its weight is reduced to one-eighth "
            "of normal. This reduction decreases its size by one category—from Medium to Small, for example. "
            "Until the spell ends, the target also has disadvantage on Strength checks and Strength saving "
            "throws. The target's weapons also shrink to match its new size. While these weapons are reduced, "
            "the target's attacks with them deal 1d4 less damage (this can't reduce the damage below 1)."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "levitate",
        "name": "Levitate",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": (
            "V, S, M (either a small leather loop or a piece of golden wire bent into a cup shape "
            "with a long shank on one end)"
        ),
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "One creature or object of your choice that you can see within range rises vertically, up to 20 "
            "feet, and remains suspended there for the duration. The spell can levitate a target that weighs "
            "up to 500 pounds. An unwilling creature that succeeds on a Constitution saving throw is unaffected.\n\n"
            "The target can move only by pushing or pulling against a fixed object or surface within reach "
            "(such as a wall or a ceiling), which allows it to move as if it were climbing. You can change "
            "the target's altitude by up to 20 feet in either direction on your turn. If you are the target, "
            "you can move up or down as part of your move. Otherwise, you can use your action to move the "
            "target, which must remain within the spell's range.\n\n"
            "When the spell ends, the target floats gently to the ground if it is still aloft."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "magic-weapon",
        "name": "Magic Weapon",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 bonus action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a "
            "+1 bonus to attack rolls and damage rolls.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the bonus "
            "increases to +2. When you use a spell slot of 6th level or higher, the bonus increases to +3."
        ),
        "classes": ["paladin", "wizard"],
    },
    {
        "id": "rope-trick",
        "name": "Rope Trick",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (powdered corn extract and a twisted loop of parchment)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a length of rope that is up to 60 feet long. One end of the rope then rises into the "
            "air until the whole rope hangs perpendicular to the ground. At the upper end of the rope, an "
            "invisible entrance opens to an extradimensional space that lasts until the spell ends.\n\n"
            "The extradimensional space can be reached by climbing to the top of the rope. The space can hold "
            "as many as eight Medium or smaller creatures. The rope can be pulled into the space, making the "
            "rope disappear from view outside the space.\n\n"
            "Attacks and spells can't cross through the entrance into or out of the extradimensional space, "
            "but those inside can see out of it as if through a 3-foot-by-5-foot window centered on the rope.\n\n"
            "Anything inside the extradimensional space drops out when the spell ends."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "spider-climb",
        "name": "Spider Climb",
        "level": 2,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a drop of bitumen and a spider)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "Until the spell ends, one willing creature you touch gains the ability to move up, down, and "
            "across vertical surfaces and upside down along ceilings, while leaving its hands free. The target "
            "also gains a climbing speed equal to its walking speed."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "blink",
        "name": "Blink",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "Roll a d20 at the end of each of your turns for the duration of the spell. On a roll of 11 or "
            "higher, you vanish from your current plane of existence and appear in the Ethereal Plane (the "
            "spell fails and the casting is wasted if you were already on that plane). At the start of your "
            "next turn, and when the spell ends if you are on the Ethereal Plane, you return to an unoccupied "
            "space of your choice that you can see within 10 feet of the space you vanished from. If no "
            "unoccupied space is available within that range, you appear in the nearest unoccupied space "
            "(chosen at random if multiple spaces are equally near). You can dismiss this spell as an action.\n\n"
            "While on the Ethereal Plane, you can see and hear the plane you originated from, which is cast "
            "in shades of gray, and you can't see anything there more than 60 feet away. You can only affect "
            "and be affected by other creatures on the Ethereal Plane. Creatures that aren't there can't "
            "perceive you or interact with you, unless they have the ability to do so."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "fly",
        "name": "Fly",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a wing feather from any bird)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When "
            "the spell ends, the target falls if it is still aloft, unless it can stop the fall.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, you can "
            "target one additional creature for each slot level above 3rd."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "gaseous-form",
        "name": "Gaseous Form",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a bit of gauze and a wisp of smoke)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You transform a willing creature you touch, along with everything it's wearing and carrying, "
            "into a misty cloud for the duration. The spell ends if the creature drops to 0 hit points. An "
            "incorporeal creature isn't affected.\n\n"
            "While in this form, the target's only method of movement is a flying speed of 10 feet. The "
            "target can enter and occupy the space of another creature. The target has resistance to nonmagical "
            "damage, and it has advantage on Strength, Dexterity, and Constitution saving throws. The target "
            "can pass through small holes, narrow openings, and even mere cracks, though it treats liquids "
            "as though they were solid surfaces. The target can't fall and remains hovering in the air even "
            "when stunned or otherwise incapacitated.\n\n"
            "While in the form of a misty cloud, the target can't talk or manipulate objects, and any objects "
            "it was carrying or holding can't be dropped, used, or otherwise interacted with. The target can't "
            "attack or cast spells."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "haste",
        "name": "Haste",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a shaving of licorice root)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose a willing creature that you can see within range. Until the spell ends, the target's speed "
            "is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains "
            "an additional action on each of its turns. That action can be used only to take the Attack (one "
            "weapon attack only), Dash, Disengage, Hide, or Use an Object action.\n\n"
            "When the spell ends, the target can't move or take actions until after its next turn, as a wave "
            "of lethargy sweeps over it."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "slow",
        "name": "Slow",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a drop of molasses)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You alter time around up to six creatures of your choice in a 40-foot cube within range. Each "
            "target must succeed on a Wisdom saving throw or be affected by this spell for the duration.\n\n"
            "An affected target's speed is halved, it takes a −2 penalty to AC and Dexterity saving throws, "
            "and it can't use reactions. On its turn, it can use either an action or a bonus action, not both. "
            "Regardless of the creature's abilities or magic items, it can't make more than one melee or ranged "
            "attack during its turn.\n\n"
            "If the creature attempts to cast a spell with a casting time of 1 action, roll a d20. On an 11 "
            "or higher, the spell doesn't take effect until the creature's next turn, and the creature must "
            "use its action on that turn to complete the spell. If it can't, the spell is wasted.\n\n"
            "A creature affected by this spell makes another Wisdom saving throw at the end of each of its "
            "turns. On a successful save, the effect ends for it."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "water-breathing",
        "name": "Water Breathing",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a short reed or piece of straw)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": True,
        "description": (
            "This spell grants up to ten willing creatures you can see within range the ability to breathe "
            "underwater until the spell ends. Affected creatures also retain their normal mode of respiration."
        ),
        "classes": ["druid", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "water-walk",
        "name": "Water Walk",
        "level": 3,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a piece of cork)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "This spell grants the ability to move across any liquid surface—such as water, acid, mud, snow, "
            "quicksand, or lava—as if it were harmless solid ground (creatures crossing molten lava can still "
            "take damage from the heat). Up to ten willing creatures you can see within range gain this ability "
            "for the duration.\n\n"
            "If you target a creature submerged in a liquid, the spell carries the target to the surface of "
            "the liquid at a rate of 60 feet per round."
        ),
        "classes": ["cleric", "druid", "ranger", "sorcerer"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "fabricate",
        "name": "Fabricate",
        "level": 4,
        "school": "transmutation",
        "castingTime": "10 minutes",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You convert raw materials into products of the same material. For example, you can fabricate a "
            "wooden bridge from a clump of trees, a rope from a patch of hemp, and clothes from flax or wool.\n\n"
            "Choose raw materials that you can see within range. You can fabricate a Large or smaller object "
            "(contained within a 10-foot cube, or eight connected 5-foot cubes), given a sufficient quantity "
            "of raw material. If you are working with metal, stone, or another mineral substance, however, "
            "the fabricated object can be no larger than Medium (contained within a single 5-foot cube). The "
            "quality of objects made by the spell is commensurate with the quality of the raw materials.\n\n"
            "Creatures or magic items can't be created or transmuted by this spell. You also can't use it to "
            "create items that ordinarily require a high degree of craftsmanship, such as jewelry, weapons, "
            "glass, or armor, unless you have proficiency with the type of artisan's tools used to craft "
            "such objects."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "polymorph",
        "name": "Polymorph",
        "level": 4,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a caterpillar cocoon)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell transforms a creature that you can see within range into a new form. An unwilling "
            "creature must make a Wisdom saving throw to avoid the effect. The spell has no effect on a "
            "shapechanger or a creature with 0 hit points.\n\n"
            "The transformation lasts for the duration, or until the target drops to 0 hit points or dies. "
            "The new form can be any beast whose challenge rating is equal to or less than the target's (or "
            "the target's level, if it doesn't have a challenge rating). The target's game statistics, "
            "including mental ability scores, are replaced by the statistics of the chosen beast. It retains "
            "its alignment and personality.\n\n"
            "The target assumes the hit points of its new form. When it reverts to its normal form, the "
            "creature returns to the number of hit points it had before it transformed. If it reverts as a "
            "result of dropping to 0 hit points, any excess damage carries over to its normal form. As long "
            "as the excess damage doesn't reduce the creature's normal form to 0 hit points, it isn't knocked "
            "unconscious.\n\n"
            "The creature is limited in the actions it can perform by the nature of its new form, and it can't "
            "cast spells, speak, or take any other action that requires hands or speech.\n\n"
            "The target's gear melds into the new form. The creature can't activate, use, wield, or otherwise "
            "benefit from any of its equipment."
        ),
        "classes": ["bard", "druid", "sorcerer", "wizard"],
    },
    {
        "id": "stone-shape",
        "name": "Stone Shape",
        "level": 4,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Touch",
        "components": (
            "V, S, M (soft clay, which must be worked into roughly the desired shape of the stone object)"
        ),
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a stone object of Medium size or smaller or a section of stone no more than 5 feet "
            "in any dimension and form it into any shape that suits your purpose. So, for example, you could "
            "shape a large rock into a weapon, idol, or coffer, or make a small passage through a wall, as "
            "long as the wall is less than 5 feet thick. You could also shape a stone door or its frame to "
            "seal the door shut. The object you create can have up to two hinges and a latch, but finer "
            "mechanical detail isn't possible."
        ),
        "classes": ["cleric", "druid", "wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "animate-objects",
        "name": "Animate Objects",
        "level": 5,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Objects come to life at your command. Choose up to ten nonmagical objects within range that are "
            "not being worn or carried. Medium targets count as two objects, Large targets count as four "
            "objects, Huge targets count as eight objects. You can't animate any object larger than Huge. "
            "Each target animates and becomes a creature under your control until the spell ends or until "
            "reduced to 0 hit points.\n\n"
            "As a bonus action, you can mentally command any creature you made with this spell if the creature "
            "is within 500 feet of you (if you control multiple creatures, you can command any or all of them "
            "at the same time, issuing the same command to each one). You decide what action the creature will "
            "take and where it will move during its next turn, or you can issue a general command, such as to "
            "guard a particular chamber or corridor. If you issue no commands, the creature only defends itself "
            "against hostile creatures. Once given an order, the creature continues to follow it until its "
            "task is complete.\n\n"
            "At Higher Levels. If you cast this spell using a spell slot of 6th level or higher, you can "
            "animate two additional objects for each slot level above 5th."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "awaken",
        "name": "Awaken",
        "level": 5,
        "school": "transmutation",
        "castingTime": "8 hours",
        "range": "Touch",
        "components": "V, S, M (an agate worth at least 1,000 gp, which the spell consumes)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "After spending the casting time tracing magical pathways within a precious gemstone, you touch "
            "a Huge or smaller beast or plant. The target must have either no Intelligence score or an "
            "Intelligence of 3 or less. The target gains an Intelligence of 10. The target also gains the "
            "ability to speak one language you know. If the target is a plant, it gains the ability to move "
            "its limbs, roots, vines, creepers, and so forth, and it gains senses similar to a human's. Your "
            "GM chooses statistics appropriate for the awakened plant, such as the statistics for the awakened "
            "shrub or the awakened tree.\n\n"
            "The awakened beast or plant is charmed by you for 30 days or until you or your companions do "
            "anything harmful to it. When the charmed condition ends, the awakened creature chooses whether "
            "to remain friendly to you, based on how you treated it while it was charmed."
        ),
        "classes": ["bard", "druid"],
    },
    {
        "id": "passwall",
        "name": "Passwall",
        "level": 5,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a pinch of sesame seeds)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "A passage appears at a point of your choice that you can see on a wooden, plaster, or stone "
            "surface (such as a wall, a ceiling, or a floor) within range, and lasts for the duration. You "
            "choose the opening's dimensions: up to 5 feet wide, 8 feet tall, and 20 feet deep. The passage "
            "creates no instability in a structure surrounding it.\n\n"
            "When the opening disappears, any creatures or objects still in the passage created by the spell "
            "are safely ejected to an unoccupied space nearest to the surface on which you cast the spell."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "telekinesis",
        "name": "Telekinesis",
        "level": 5,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You gain the ability to move or manipulate creatures or objects by thought. When you cast the "
            "spell, and as your action each round for the duration, you can exert your will on one creature "
            "or object that you can see within range, causing the appropriate effect below. You can affect "
            "the same target round after round, or choose a new one at any time. If you switch targets, the "
            "prior target is no longer affected by the spell.\n\n"
            "Creature. You can try to move a Huge or smaller creature. Make an ability check with your "
            "spellcasting ability contested by the creature's Strength check. If you win the contest, you "
            "move the creature up to 30 feet in any direction, including upward but not beyond the range of "
            "this spell. Until the end of your next turn, the creature is restrained in your telekinetic "
            "grip. A creature lifted upward is suspended in mid-air.\n\n"
            "Object. You can try to move an object that weighs up to 1,000 pounds. If the object isn't "
            "being worn or carried, you automatically move it up to 30 feet in any direction, but not beyond "
            "the range of this spell. If the object is worn or carried by a creature, you must make an "
            "ability check with your spellcasting ability contested by that creature's Strength check. On "
            "a success, you pull the object away from that creature and can move it up to 30 feet in any "
            "direction but not beyond the range of this spell.\n\n"
            "You can exert fine control on objects with your telekinetic grip, such as manipulating a simple "
            "tool, opening a door or a container, stowing or retrieving an item from an open container, or "
            "pouring the contents from a vial."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "disintegrate",
        "name": "Disintegrate",
        "level": 6,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a lodestone and a pinch of dust)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A thin green ray springs from your pointing finger to a target you can see within range. The "
            "target can be a creature, an object, or a creation of magical force, such as the wall created "
            "by wall of force.\n\n"
            "A creature targeted by this spell must make a Dexterity saving throw. On a failed save, the "
            "target takes 10d6 + 40 force damage. The target is disintegrated if this damage leaves it with "
            "0 hit points.\n\n"
            "A disintegrated creature and everything it is wearing and carrying, except magic items, are "
            "reduced to a pile of fine gray dust. The creature can be restored to life only by means of a "
            "true resurrection or a wish spell.\n\n"
            "This spell automatically disintegrates a Large or smaller nonmagical object or a creation of "
            "magical force. If the target is a Huge or larger object or creation of force, this spell "
            "disintegrates a 10-foot-cube portion of it. A magic item is unaffected by this spell.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the "
            "damage increases by 3d6 for each slot level above 6th."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "flesh-to-stone",
        "name": "Flesh to Stone",
        "level": 6,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a pinch of lime, water, and earth)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to turn one creature that you can see within range into stone. If the target's body "
            "is made of flesh, the creature must make a Constitution saving throw. On a failed save, it is "
            "restrained as its flesh begins to harden. On a successful save, the creature isn't affected.\n\n"
            "A creature restrained by this spell must make another Constitution saving throw at the end of "
            "each of its turns. If it successfully saves against this spell three times, the spell ends. If "
            "it fails its saves three times, it is turned to stone and subjected to the petrified condition "
            "for the duration. The successes and failures don't need to be consecutive; keep track of both "
            "until the target collects three of a kind.\n\n"
            "If the creature is physically broken while petrified, it suffers from similar deformities if "
            "it reverts to its original state.\n\n"
            "If you maintain your concentration on this spell for the entire possible duration, the creature "
            "is turned to stone until the effect is removed."
        ),
        "classes": ["warlock", "wizard"],
    },
    {
        "id": "move-earth",
        "name": "Move Earth",
        "level": 6,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": (
            "V, S, M (an iron blade and a small bag containing a mixture of soils—clay, loam, and sand)"
        ),
        "duration": "Concentration, up to 2 hours",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose an area of terrain no larger than 40 feet on a side within range. You can reshape dirt, "
            "sand, or clay in the area in any manner you choose for the duration. You can raise or lower the "
            "area's elevation, create or fill in a trench, erect or flatten a wall, or form a pillar. The "
            "extent of any such changes can't exceed half the area's largest dimension. So, if you affect a "
            "40-foot square, you can create a pillar up to 20 feet high, raise or lower the square's "
            "elevation by up to 20 feet, dig a trench up to 20 feet deep, and so on. It takes 10 minutes "
            "for these changes to complete.\n\n"
            "At the end of every 10 minutes you spend concentrating on the spell, you can choose a new area "
            "of terrain to affect.\n\n"
            "Because the terrain's transformation occurs slowly, creatures in the area can't usually be "
            "trapped or hurt by the ground's movement.\n\n"
            "This spell can't manipulate natural stone or stone construction. Rocks and structures shift to "
            "accomodate the new terrain. If the way you shape the terrain would make a structure unstable, "
            "it might collapse.\n\n"
            "Similarly, this spell doesn't directly affect plant growth. The moved earth carries any plants "
            "along with it."
        ),
        "classes": ["druid", "sorcerer", "wizard"],
    },

    # ── 7th Level ─────────────────────────────────────────────────────────────
    {
        "id": "reverse-gravity",
        "name": "Reverse Gravity",
        "level": 7,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "100 feet",
        "components": "V, S, M (a lodestone and iron filings)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell reverses gravity in a 50-foot-radius, 100-foot high cylinder centered on a point "
            "within range. All creatures and objects that aren't somehow anchored to the ground in the area "
            "fall upward and reach the top of the area. A creature can make a Dexterity saving throw to grab "
            "onto a fixed object it can reach, thus avoiding the fall.\n\n"
            "If some solid object (such as a ceiling) is encountered in the fall, falling creatures and "
            "objects strike it just as they would during a normal downward fall. If an object or creature "
            "reaches the top of the area without striking anything, it remains there, oscillating slightly, "
            "for the duration.\n\n"
            "At the end of the duration, affected objects and creatures fall back down."
        ),
        "classes": ["druid", "sorcerer", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "animal-shapes",
        "name": "Animal Shapes",
        "level": 8,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "Concentration, up to 24 hours",
        "concentration": True,
        "ritual": False,
        "description": (
            "Your magic turns others into beasts. Choose any number of willing creatures that you can see "
            "within range. You transform each target into the form of a Large or smaller beast with a "
            "challenge rating of 4 or lower. On subsequent turns, you can use your action to transform "
            "affected creatures into new forms.\n\n"
            "The transformation lasts for the duration for each target, or until the target drops to 0 hit "
            "points or dies. You can choose a different form for each target. A target's game statistics are "
            "replaced by the statistics of the chosen beast, though the target retains its alignment and "
            "Intelligence, Wisdom, and Charisma scores. The target assumes the hit points of its new form, "
            "and when it reverts to its normal form, it returns to the number of hit points it had before "
            "it transformed. If it reverts as a result of dropping to 0 hit points, any excess damage "
            "carries over to its normal form. As long as the excess damage doesn't reduce the creature's "
            "normal form to 0 hit points, it isn't knocked unconscious. The creature is limited in the "
            "actions it can perform by the nature of its new form.\n\n"
            "The target's gear melds into the new form. The target can't activate, wield, or otherwise "
            "benefit from any of its equipment."
        ),
        "classes": ["druid"],
    },
    {
        "id": "control-weather",
        "name": "Control Weather",
        "level": 8,
        "school": "transmutation",
        "castingTime": "10 minutes",
        "range": "Self (5-mile radius)",
        "components": "V, S, M (burning incense and bits of earth and wood mixed in water)",
        "duration": "Concentration, up to 8 hours",
        "concentration": True,
        "ritual": False,
        "description": (
            "You take control of the weather within 5 miles of you for the duration. You must be outdoors to "
            "cast this spell. Moving to a place where you don't have a clear path to the sky ends the spell "
            "early.\n\n"
            "When you cast the spell, you change the current weather conditions, which are determined by the "
            "DM based on the climate and season. You can change precipitation, temperature, and wind. It "
            "takes 1d4 × 10 minutes for the new conditions to take effect. Once they do, you can change the "
            "conditions again. When the spell ends, the weather gradually returns to normal.\n\n"
            "When you change the weather conditions, find a current condition on the following tables and "
            "change its stage by one, up or down. When changing the wind, you can change its direction."
        ),
        "classes": ["cleric", "druid", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "shapechange",
        "name": "Shapechange",
        "level": 9,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Self",
        "components": (
            "V, S, M (a jade circlet worth at least 1,500 gp, which you place on your head before "
            "the spell takes effect)"
        ),
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You assume the form of a different creature for the duration. The new form can be of any creature "
            "with a challenge rating equal to your level or lower. The creature can't be a construct or an "
            "undead, and you must have seen the sort of creature at least once. You transform into an average "
            "example of that creature, one without any class levels or the Spellcasting trait.\n\n"
            "Your game statistics are replaced by the statistics of the chosen creature, though you retain "
            "your alignment and Intelligence, Wisdom, and Charisma scores. You also retain all of your skill "
            "and saving throw proficiencies, in addition to gaining those of the creature. If the creature "
            "has the same proficiency as you and the bonus in its stat block is higher than yours, use the "
            "creature's bonus instead of yours. You can't use any legendary actions or lair actions of the "
            "new form.\n\n"
            "You assume the hit points and Hit Dice of the new form. When you revert to your normal form, "
            "you return to the number of hit points you had before you transformed. If you revert as a result "
            "of dropping to 0 hit points, any excess damage carries over to your normal form.\n\n"
            "You retain the benefit of any features from your class, race, or other source and can use them "
            "if the new form is physically capable of doing so. You can't use any special senses you have "
            "(for example, darkvision) unless your new form also has that sense. You can only speak if the "
            "creature can normally speak.\n\n"
            "When you transform, you choose whether your equipment falls to the ground in your space, merges "
            "into your new form, or is worn by it. Worn equipment functions as normal, but the DM decides "
            "whether it is practical for the new form to wear a piece of equipment, based on the creature's "
            "shape and size. Your equipment doesn't change size or shape to match the new form, and any "
            "equipment that the new form can't wear must either fall to the ground or merge with it. Equipment "
            "that merges with the form has no effect until you leave the form."
        ),
        "classes": ["druid", "wizard"],
    },
    {
        "id": "time-stop",
        "name": "Time Stop",
        "level": 9,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, "
            "while you take 1d4 + 1 turns in a row, during which you can use actions and move as normal.\n\n"
            "This spell ends if one of the actions you use during this period, or any effects that you create "
            "during this period, affects a creature other than you or an object being worn or carried by "
            "someone other than you. In addition, the spell ends if you move to a place more than 1,000 feet "
            "from the location where you cast it."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "true-polymorph",
        "name": "True Polymorph",
        "level": 9,
        "school": "transmutation",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a drop of mercury, a dollop of gum arabic, and a wisp of smoke)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose one creature or nonmagical object that you can see within range. You transform the "
            "creature into a different creature, the creature into a nonmagical object, or the object into "
            "a creature (the object must be neither worn nor carried by another creature). The transformation "
            "lasts for the duration, or until the target drops to 0 hit points or dies. If you concentrate "
            "on this spell for the full duration, the transformation becomes permanent.\n\n"
            "Shapechangers aren't affected by this spell. An unwilling creature can make a Wisdom saving "
            "throw, and if it succeeds, it isn't affected by this spell.\n\n"
            "Creature into Creature. If you turn a creature into another kind of creature, the new form can "
            "be any kind whose challenge rating is equal to or less than the target's (or its level, if the "
            "target doesn't have a challenge rating). The target's game statistics, including mental ability "
            "scores, are replaced by the statistics of the new form. It retains its alignment and "
            "personality.\n\n"
            "Object into Creature. You can turn an object into any kind of creature, as long as the "
            "creature's size is no larger than the object's size and the creature's challenge rating is 9 "
            "or lower. The creature is friendly to you and your companions. It acts on each of your turns. "
            "You decide what action it takes and how it moves. The DM has the creature's statistics.\n\n"
            "Creature into Object. If you turn a creature into an object, it transforms along with whatever "
            "it is wearing and carrying into that form. The creature's statistics become those of the object, "
            "and the creature has no memory of time spent in this form after the spell ends and it returns "
            "to its normal form."
        ),
        "classes": ["bard", "warlock", "wizard"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    for spell in TRANSMUTATION_SPELLS:
        if spell["id"] not in existing_ids:
            data["spells"].append(spell)
            added += 1

    # Sort spells by level then name
    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} transmutation spells. Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
