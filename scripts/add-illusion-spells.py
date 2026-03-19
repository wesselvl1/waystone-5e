#!/usr/bin/env python3
"""Add all SRD 5.1 illusion spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

ILLUSION_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "dancing-lights",
        "name": "Dancing Lights",
        "level": 0,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a bit of phosphorus or wychwood, or a glowworm)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create up to four torch-sized lights within range, making them appear as torches, lanterns, "
            "or glowing orbs that hover in the air for the duration. You can also combine the four lights "
            "into one glowing vaguely humanoid form of Medium size. Whichever form you choose, each light "
            "sheds dim light in a 10-foot radius.\n\n"
            "As a bonus action on your turn, you can move the lights up to 60 feet to a new spot within "
            "range. A light must be within 20 feet of another light created by this spell, and a light "
            "winks out if it exceeds the spell's range."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "minor-illusion",
        "name": "Minor Illusion",
        "level": 0,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "S, M (a bit of fleece)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a sound or an image of an object within range that lasts for the duration. The "
            "illusion also ends if you dismiss it as an action or cast this spell again.\n\n"
            "If you create a sound, its volume can range from a whisper to a scream. It can be your voice, "
            "someone else's voice, a lion's roar, a beating of drums, or any other sound you choose. The "
            "sound continues unabated throughout the duration, or you can make discrete sounds at different "
            "times before the spell ends.\n\n"
            "If you create an image of an object—such as a chair, muddy footprints, or a small chest—it "
            "must be no larger than a 5-foot cube. The image can't create sound, light, smell, or any "
            "other sensory effect. Physical interaction with the image reveals it to be an illusion, because "
            "things can pass through it.\n\n"
            "If a creature uses its action to examine the sound or image, the creature can determine that "
            "it is an illusion with a successful Intelligence (Investigation) check against your spell save "
            "DC. If a creature discerns the illusion for what it is, the illusion becomes faint to the "
            "creature."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "color-spray",
        "name": "Color Spray",
        "level": 1,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self (15-foot cone)",
        "components": "V, S, M (a pinch of powder or sand that is colored red, yellow, and blue)",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "A dazzling array of flashing, colored light springs from your hand. Roll 6d10; the total is "
            "how many hit points of creatures this spell can affect. Creatures in a 15-foot cone "
            "originating from you are affected in ascending order of their current hit points (ignoring "
            "unconscious creatures and creatures that can't see).\n\n"
            "Starting with the creature that has the lowest current hit points, each creature affected by "
            "this spell is blinded until the end of your next turn. Subtract each creature's hit points "
            "from the total before moving on to the creature with the next lowest hit points. A creature's "
            "hit points must be equal to or less than the remaining total for that creature to be affected.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, roll an "
            "additional 2d10 for each slot level above 1st."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "disguise-self",
        "name": "Disguise Self",
        "level": 1,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You make yourself—including your clothing, armor, weapons, and other belongings on your "
            "person—look different until the spell ends or until you use your action to dismiss it. You can "
            "seem 1 foot shorter or taller and can appear thin, fat, or in between. You can't change your "
            "body type, so you must adopt a form that has the same basic arrangement of limbs. Otherwise, "
            "the extent of the illusion is up to you.\n\n"
            "The changes wrought by this spell fail to hold up to physical inspection. For example, if you "
            "use this spell to add a hat to your outfit, objects pass through the hat, and anyone who "
            "touches it would feel nothing or would feel your head and hair. If you use this spell to appear "
            "thinner than you are, the hand of someone who reaches out to touch you would bump into you "
            "while it was seemingly still in midair.\n\n"
            "To discern that you are disguised, a creature can use its action to inspect your appearance "
            "and must succeed on an Intelligence (Investigation) check against your spell save DC."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "illusory-script",
        "name": "Illusory Script",
        "level": 1,
        "school": "illusion",
        "castingTime": "1 minute",
        "range": "Touch",
        "components": "S, M (a lead-based ink worth at least 10 gp, which the spell consumes)",
        "duration": "10 days",
        "concentration": False,
        "ritual": True,
        "description": (
            "You write on parchment, paper, or some other suitable writing material and imbue it with a "
            "potent illusion that lasts for the duration.\n\n"
            "To you and any creatures you designate when you cast the spell, the writing appears normal, "
            "written in your hand, and conveys whatever meaning you intended when you wrote the text. To "
            "all others, the writing appears as if it were written in an unknown or magical script that is "
            "unintelligible. Alternatively, you can cause the writing to appear to be an entirely different "
            "message, written in a different hand and language, though the language must be one you know.\n\n"
            "Should the spell be dispelled, the original script and the illusion both disappear.\n\n"
            "A creature with truesight can read the hidden message."
        ),
        "classes": ["bard", "warlock", "wizard"],
    },
    {
        "id": "silent-image",
        "name": "Silent Image",
        "level": 1,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a bit of fleece)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create the image of an object, a creature, or some other visible phenomenon that is no "
            "larger than a 15-foot cube. The image appears at a spot within range and lasts for the "
            "duration. The image is purely visual; it isn't accompanied by sound, smell, or other sensory "
            "effects.\n\n"
            "You can use your action to cause the image to move to any spot within range. As the image "
            "changes location, you can alter its appearance so that its movements appear natural for the "
            "image. For example, if you create an image of a creature and move it, you can alter the image "
            "so that it appears to be walking.\n\n"
            "Physical interaction with the image reveals it to be an illusion, because things can pass "
            "through it. A creature that uses its action to examine the image can determine that it is an "
            "illusion with a successful Intelligence (Investigation) check against your spell save DC. If "
            "a creature discerns the illusion for what it is, the creature can see through the image."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "blur",
        "name": "Blur",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Your body becomes blurred, shifting and wavering to all who can see you. For the duration, "
            "any creature has disadvantage on attack rolls against you. An attacker is immune to this "
            "effect if it doesn't rely on sight, as with blindsight, or can see through illusions, as "
            "with truesight."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "invisibility",
        "name": "Invisibility",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (an eyelash encased in gum arabic)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "A creature you touch becomes invisible until the spell ends. Anything the target is wearing "
            "or carrying is invisible as long as it is on the target's person. The spell ends for a target "
            "that attacks or casts a spell.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you can "
            "target one additional creature for each slot level above 2nd."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "magic-mouth",
        "name": "Magic Mouth",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 minute",
        "range": "30 feet",
        "components": "V, S, M (a small bit of honeycomb and jade dust worth at least 10 gp, which the spell consumes)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": True,
        "description": (
            "You implant a message within an object in range, a message that is uttered when a trigger "
            "condition is met. Choose an object that you can see and that isn't being worn or carried by "
            "another creature. Then speak the message, which must be 25 words or less, though it can be "
            "delivered over as long as 10 minutes. Finally, determine the circumstance that will trigger "
            "the spell to deliver your message.\n\n"
            "When that circumstance occurs, a magical mouth appears on the object and recites the message "
            "in your voice and at the same volume you spoke. If the object you chose has a mouth or "
            "something that looks like a mouth (for example, the mouth of a statue), the magical mouth "
            "appears there so that the words appear to come from the object's mouth. When you cast this "
            "spell, you can have the spell end after it delivers its message, or it can remain and repeat "
            "its message whenever the trigger occurs.\n\n"
            "The triggering circumstance can be as general or as detailed as you like, though it must be "
            "based on visual or audible conditions that occur within 30 feet of the object. For example, "
            "you could instruct the mouth to speak when any creature moves within 30 feet of the object "
            "or when a silver bell rings within 30 feet of it."
        ),
        "classes": ["bard", "wizard"],
    },
    {
        "id": "mirror-image",
        "name": "Mirror Image",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "Three illusory duplicates of yourself appear in your space. Until the spell ends, the "
            "duplicates move with you and mimic your actions, shifting position so it's impossible to "
            "track which image is real. You can use your action to dismiss the illusory duplicates.\n\n"
            "Each time a creature targets you with an attack during the spell's duration, roll a d20 to "
            "determine whether the attack instead targets one of your duplicates.\n\n"
            "If you have three duplicates, you must roll a 6 or higher to change the attack's target to "
            "a duplicate. With two duplicates, you must roll an 8 or higher. With one duplicate, you "
            "must roll an 11 or higher.\n\n"
            "A duplicate's AC equals 10 + your Dexterity modifier. If an attack hits a duplicate, the "
            "duplicate is destroyed. A duplicate can be destroyed only by an attack that hits it. It "
            "ignores all other damage and effects. The spell ends when all three duplicates are destroyed.\n\n"
            "A creature is unaffected by this spell if it can't see, if it relies on senses other than "
            "sight, such as blindsight, or if it can perceive illusions as false, as with truesight."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "nystuls-magic-aura",
        "name": "Nystul's Magic Aura",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a small square of silk)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You place an illusion on a creature or an object you touch so that divination spells reveal "
            "false information about it. The target can be a willing creature or an object that isn't being "
            "carried or worn by another creature.\n\n"
            "When you cast the spell, choose one or both of the following effects. The effect lasts for "
            "the duration. If you cast this spell on the same creature or object every day for 30 days, "
            "placing the same effect on it each time, the illusion lasts until it is dispelled.\n\n"
            "False Aura. You change the way the target appears to spells and magical effects, such as "
            "detect magic, that detect magical auras. You can make a nonmagical object appear magical, a "
            "magical object appear nonmagical, or change the object's magical aura so that it appears to "
            "belong to a specific school of magic that you choose. When you use this effect on an object, "
            "you can make the false magic apparent to any creature that handles the item.\n\n"
            "Mask. You change the way the target appears to spells and magical effects that detect creature "
            "types, such as a paladin's Divine Sense or the trigger of a symbol spell. You choose a "
            "creature type and other spells and magical effects treat the target as if it were a creature "
            "of that type or of that alignment."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "phantasmal-force",
        "name": "Phantasmal Force",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a bit of fleece)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You craft an illusion that takes root in the mind of a creature that you can see within range. "
            "The target must make an Intelligence saving throw. On a failed save, you create a phantasmal "
            "object, creature, or other visible phenomenon of your choice that is no larger than a 10-foot "
            "cube and that is perceivable only to the target for the duration. This spell has no effect on "
            "undead or constructs.\n\n"
            "The phantasm includes sound, temperature, and other stimuli, also evident only to the creature. "
            "The target can use its action to examine the phantasm with an Intelligence (Investigation) "
            "check against your spell save DC. If the check succeeds, the target realizes that the phantasm "
            "is an illusion, and the spell ends.\n\n"
            "While a target is affected by the spell, the target treats the phantasm as if it were real. "
            "The target rationalizes any illogical outcomes from interacting with the phantasm. For example, "
            "a target attempting to walk across a phantasmal bridge that spans a chasm falls once it steps "
            "onto the bridge. If the target survives the fall, it still believes that the bridge exists and "
            "comes up with some other explanation for why it fell—it was pushed, it slipped, or a strong "
            "wind might have knocked it off.\n\n"
            "An affected target is so convinced of the phantasm's reality that it can even take damage from "
            "the illusion. A phantasm created to appear as a creature can attack the target. Similarly, a "
            "phantasm created to appear as fire, a pool of acid, or lava can burn the target. Each round "
            "on your turn, the phantasm can deal 1d6 psychic damage to the target if it is in the "
            "phantasm's area or within 5 feet of the phantasm, provided that the illusion is of a creature "
            "or a hazard that could logically deal damage, such as by attacking. The target perceives the "
            "damage as a type appropriate to the illusion."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "silence",
        "name": "Silence",
        "level": 2,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": True,
        "description": (
            "For the duration, no sound can be created within or pass through a 20-foot-radius sphere "
            "centered on a point you choose within range. Any creature or object entirely inside the sphere "
            "is immune to thunder damage, and creatures are deafened while entirely inside it. Casting a "
            "spell that includes a verbal component is impossible there."
        ),
        "classes": ["bard", "cleric", "ranger"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "fear",
        "name": "Fear",
        "level": 3,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self (30-foot cone)",
        "components": "V, S, M (a white feather or the heart of a hen)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You project a phantasmal image of a creature's worst fears. Each creature in a 30-foot cone "
            "must succeed on a Wisdom saving throw or drop whatever it is holding and become frightened "
            "for the duration.\n\n"
            "While frightened by this spell, a creature must take the Dash action and move away from you "
            "by the safest available route on each of its turns, unless there is nowhere to move. If the "
            "creature ends its turn in a location where it doesn't have line of sight to you, the creature "
            "can make a Wisdom saving throw. On a successful save, the spell ends for that creature."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "hypnotic-pattern",
        "name": "Hypnotic Pattern",
        "level": 3,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "S, M (a glowing stick of incense or a crystal vial filled with phosphorescent material)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a twisting pattern of colors that weaves through the air inside a 30-foot cube "
            "within range. The pattern appears for a moment and vanishes. Each creature in the area who "
            "sees the pattern must make a Wisdom saving throw. On a failed save, the creature becomes "
            "charmed for the duration. While charmed by this spell, the creature is incapacitated and has "
            "a speed of 0.\n\n"
            "The spell ends for an affected creature if it takes any damage or if someone else uses an "
            "action to shake the creature out of its stupor."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "major-image",
        "name": "Major Image",
        "level": 3,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a bit of fleece)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create the image of an object, a creature, or some other visible phenomenon that is no "
            "larger than a 20-foot cube. The image appears at a spot that you can see within range and "
            "lasts for the duration. It seems completely real, including sounds, smells, and temperature "
            "appropriate to the thing depicted. You can't create sufficient heat or cold to cause damage, "
            "a sound loud enough to deal thunder damage or deafen a creature, or a smell that might cause "
            "a creature to become poisoned.\n\n"
            "As long as you are within range of the illusion, you can use your action to cause the image "
            "to move to any other spot within range. As the image changes location, you can alter its "
            "appearance so that its movements appear natural for the image. For example, if you create an "
            "image of a creature and move it, you can alter the image so that it appears to be walking. "
            "Similarly, you can cause the illusion to make different sounds at different times, even having "
            "it carry on a conversation, for example.\n\n"
            "Physical interaction with the image reveals it to be an illusion, because things can pass "
            "through it. A creature that uses its action to examine the image can determine that it is an "
            "illusion with a successful Intelligence (Investigation) check against your spell save DC. If "
            "a creature discerns the illusion for what it is, the creature can see through the image, and "
            "its other sensory qualities become faint to the creature.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the "
            "spell lasts until dispelled, without requiring your concentration."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "phantom-steed",
        "name": "Phantom Steed",
        "level": 3,
        "school": "illusion",
        "castingTime": "1 minute",
        "range": "30 feet",
        "components": "V, S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "A Large quasi-real, horse-like creature appears on the ground in an unoccupied space of your "
            "choice within range. You decide the creature's appearance, but it is equipped with a saddle, "
            "bit, and bridle. Any of the equipment created by the spell vanishes in a puff of smoke if it "
            "is carried more than 10 feet away from the steed.\n\n"
            "For the duration, you or a creature you choose can ride the steed. The creature uses the "
            "statistics for a riding horse, except it has a speed of 100 feet and can travel 10 miles in "
            "an hour, or 13 miles at a fast pace. When the spell ends, the steed gradually fades, giving "
            "the rider 1 minute to dismount. The spell ends if you use an action to dismiss it or if the "
            "steed takes any damage."
        ),
        "classes": ["wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "greater-invisibility",
        "name": "Greater Invisibility",
        "level": 4,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You or a creature you touch becomes invisible until the spell ends. Anything the target is "
            "wearing or carrying is invisible as long as it is on the target's person."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "hallucinatory-terrain",
        "name": "Hallucinatory Terrain",
        "level": 4,
        "school": "illusion",
        "castingTime": "10 minutes",
        "range": "300 feet",
        "components": "V, S, M (a stone, a twig, and a bit of green plant)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You make natural terrain in a 150-foot cube in range look, sound, and smell like some other "
            "sort of natural terrain. Thus, open fields or a road can be made to resemble a swamp, hill, "
            "crevasse, or some other difficult or impassable terrain. A pond can be made to seem like a "
            "grassy meadow, a precipice like a gentle slope, or a rock-strewn gully like a wide and smooth "
            "road. Manufactured structures, equipment, and creatures within the area aren't changed in "
            "appearance.\n\n"
            "The tactile characteristics of the terrain are unchanged, so creatures entering the area are "
            "likely to see through the illusion. If the difference isn't obvious by touch, a creature "
            "carefully examining the illusion can attempt an Intelligence (Investigation) check against "
            "your spell save DC to disbelieve it. A creature who discerns the illusion for what it is, "
            "sees it as a vague image superimposed on the terrain."
        ),
        "classes": ["bard", "druid", "warlock", "wizard"],
    },
    {
        "id": "phantasmal-killer",
        "name": "Phantasmal Killer",
        "level": 4,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You tap into the nightmares of a creature you can see within range and create an illusory "
            "manifestation of its deepest fears, visible only to that creature. The target must make a "
            "Wisdom saving throw. On a failed save, the target becomes frightened for the duration. At "
            "the end of each of the target's turns before the spell ends, the target must succeed on a "
            "Wisdom saving throw or take 4d10 psychic damage. On a successful save, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the "
            "damage increases by 1d10 for each slot level above 4th."
        ),
        "classes": ["wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "creation",
        "name": "Creation",
        "level": 5,
        "school": "illusion",
        "castingTime": "1 minute",
        "range": "30 feet",
        "components": "V, S, M (a tiny piece of matter of the same type of the item you plan to create)",
        "duration": "Special",
        "concentration": False,
        "ritual": False,
        "description": (
            "You pull wisps of shadow material from the Shadowfell to create a nonliving object of "
            "vegetable matter within range: soft goods, rope, wood, or something similar. You can also use "
            "this spell to create mineral objects such as stone, crystal, or metal. The object created "
            "must be no larger than a 5-foot cube, and the object must be of a form and material that you "
            "have seen before.\n\n"
            "The duration depends on the object's material. If the object is composed of multiple "
            "materials, use the shortest duration.\n\n"
            "Vegetable matter: 1 day. Stone or crystal: 12 hours. Precious metals: 1 hour. Gems: 10 "
            "minutes. Adamantine or mithral: 1 minute.\n\n"
            "Using any material created by this spell as another spell's material component causes that "
            "spell to fail.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the "
            "cube increases by 5 feet for each slot level above 5th."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "dream",
        "name": "Dream",
        "level": 5,
        "school": "illusion",
        "castingTime": "1 minute",
        "range": "Special",
        "components": "V, S, M (a handful of sand, a dab of ink, and a writing quill plucked from a sleeping bird)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell shapes a creature's dreams. Choose a creature known to you as the target of this "
            "spell. The target must be on the same plane of existence as you. Creatures that don't sleep, "
            "such as elves, can't be contacted by this spell. You, or a willing creature you touch, enters "
            "a trance state, acting as a messenger. While in the trance, the messenger is aware of his or "
            "her surroundings, but can't take actions or move.\n\n"
            "If the target is asleep, the messenger appears in the target's dreams and can converse with "
            "the target as long as it remains asleep, through the duration of the spell. The messenger can "
            "also shape the environment of the dream, creating landscapes, objects, and other images. The "
            "messenger can emerge from the trance at any time, ending the effect of the spell early. The "
            "target recalls the dream perfectly upon waking.\n\n"
            "If the target is awake when you cast the spell, the messenger knows it, and can either end "
            "the trance (and the spell) or wait for the target to fall asleep, at which point the "
            "messenger appears in the target's dreams.\n\n"
            "You can make the messenger appear monstrous and terrifying to the target. If you do, the "
            "messenger can deliver a message of no more than ten words and then the target must make a "
            "Wisdom saving throw. On a failed save, echoes of the phantasmal monstrosity spawn a "
            "nightmare that lasts the duration of the target's sleep and prevents the target from gaining "
            "any benefit from that rest. In addition, when the target wakes up, it takes 3d6 psychic "
            "damage.\n\n"
            "If you have a body part, lock of hair, clipping from a nail, or similar portion of the "
            "target's body, the target makes its saving throw with disadvantage."
        ),
        "classes": ["bard", "warlock", "wizard"],
    },
    {
        "id": "mislead",
        "name": "Mislead",
        "level": 5,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "Self",
        "components": "S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You become invisible at the same time that an illusory double of you appears where you are "
            "standing. The double lasts for the duration, but the invisibility ends if you attack or cast "
            "a spell.\n\n"
            "You can use your action to move your illusory double up to twice your speed and make it "
            "gesture, speak, and behave in whatever way you choose.\n\n"
            "You can see through its eyes and hear through its ears as if you were located where it is. "
            "On each of your turns as a bonus action, you can switch from using its senses to using your "
            "own, or back again. While you are using its senses, you are blinded and deafened in regard "
            "to your own surroundings."
        ),
        "classes": ["bard", "wizard"],
    },
    {
        "id": "seeming",
        "name": "Seeming",
        "level": 5,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell allows you to change the appearance of any number of creatures that you can see "
            "within range. You give each target you choose a new, illusory appearance. An unwilling target "
            "can make a Charisma saving throw, and if it succeeds, it is unaffected by this spell.\n\n"
            "The spell disguises physical appearance as well as clothing, armor, weapons, and equipment. "
            "You can make each creature seem 1 foot shorter or taller and appear thin, fat, or in between. "
            "You can't change a target's body type, so you must choose a form that has the same basic "
            "arrangement of limbs. Otherwise, the extent of the illusion is up to you. The spell lasts "
            "for the duration, unless you use your action to dismiss it sooner.\n\n"
            "The changes wrought by this spell fail to hold up to physical inspection. For example, if "
            "you use this spell to add a hat to a creature's outfit, objects pass through the hat, and "
            "anyone who touches it would feel nothing or would feel the creature's head and hair.\n\n"
            "To discern that a target is disguised, a creature can use its action to inspect the target's "
            "appearance and must succeed on an Intelligence (Investigation) check against your spell save "
            "DC."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "programmed-illusion",
        "name": "Programmed Illusion",
        "level": 6,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S, M (a bit of fleece and jade dust worth at least 25 gp)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create an illusion of an object, a creature, or some other visible phenomenon within "
            "range that activates when a specific condition occurs. The illusion is imperceptible until "
            "then. It must be no larger than a 30-foot cube, and you decide when you cast the spell how "
            "the illusion behaves and what sounds it makes. This scripted performance can last up to 5 "
            "minutes.\n\n"
            "When the condition you specify occurs, the illusion springs into existence and performs in "
            "the manner you described. Once the illusion finishes performing, it disappears and remains "
            "dormant for 10 minutes. After this time, the illusion can be activated again.\n\n"
            "The triggering condition can be as general or as detailed as you like, though it must be "
            "based on visual or audible conditions that occur within 30 feet of the area. For example, "
            "you could create an illusion of yourself to appear and warn off others who attempt to open "
            "a trapped door, or you could set the illusion to trigger whenever any creature speaking "
            "approaches within 30 feet.\n\n"
            "Physical interaction with the image reveals it to be an illusion, because things can pass "
            "through it. A creature that uses its action to examine the image can determine that it is "
            "an illusion with a successful Intelligence (Investigation) check against your spell save DC. "
            "If a creature discerns the illusion for what it is, the creature can see through the image."
        ),
        "classes": ["bard", "wizard"],
    },

    # ── 7th Level ─────────────────────────────────────────────────────────────
    {
        "id": "project-image",
        "name": "Project Image",
        "level": 7,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "500 miles",
        "components": "V, S, M (a small replica of you made from materials worth at least 5 gp)",
        "duration": "Concentration, up to 1 day",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create an illusory image of yourself that lasts for the duration. The copy can appear at "
            "any location within range that you have seen before, regardless of intervening obstacles. The "
            "illusion looks and sounds like you but is intangible. If the illusion takes any damage, it "
            "disappears, and the spell ends.\n\n"
            "You can use your action to move this illusion up to twice your speed, and make it gesture, "
            "speak, and behave in whatever way you choose. It mimics your mannerisms perfectly.\n\n"
            "You can see through its eyes and hear through its ears as if you were in its space. On each "
            "of your turns as a bonus action, you can switch from using its senses to using your own, or "
            "back again. While you are using its senses, you are blinded and deafened in regard to your "
            "own surroundings.\n\n"
            "Physical interaction with the image reveals it to be an illusion, because things can pass "
            "through it. A creature that uses its action to examine the image can determine that it is an "
            "illusion with a successful Intelligence (Investigation) check against your spell save DC. If "
            "a creature discerns the illusion for what it is, the creature can see through the image."
        ),
        "classes": ["bard", "wizard"],
    },
    {
        "id": "simulacrum",
        "name": "Simulacrum",
        "level": 7,
        "school": "illusion",
        "castingTime": "12 hours",
        "range": "Touch",
        "components": (
            "V, S, M (snow or ice in quantities sufficient to make a life-size copy of the duplicated "
            "creature; some hair, fingernail clippings, or other piece of that creature's body placed "
            "inside the snow or ice; and powdered ruby worth 1,500 gp, sprinkled over the duplicate and "
            "consumed by the spell)"
        ),
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "You shape an illusory duplicate of one beast or humanoid that is within range for the entire "
            "casting time of the spell. The duplicate is a creature, partially real and formed from ice "
            "or snow, and it can take actions and otherwise be affected as a normal creature. It appears "
            "to be the same as the original, but it has half the creature's hit point maximum and is "
            "formed without any equipment. Otherwise, the illusion uses all the statistics of the creature "
            "it duplicates, except that it is a construct.\n\n"
            "The simulacrum is friendly to you and creatures you designate. It obeys your spoken commands, "
            "moving and acting in accordance with your wishes and acting on your turn in combat. The "
            "simulacrum lacks the ability to learn or become more powerful, so it never increases its "
            "level or other abilities, nor can it regain expended spell slots.\n\n"
            "If the simulacrum is damaged, you can repair it in an alchemical laboratory, using rare herbs "
            "and minerals worth 100 gp per hit point it regains. The simulacrum lasts until it drops to 0 "
            "hit points, at which point it reverts to snow and melts instantly.\n\n"
            "If you cast this spell again, any currently active duplicates you created with this spell are "
            "instantly destroyed."
        ),
        "classes": ["wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "weird",
        "name": "Weird",
        "level": 9,
        "school": "illusion",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Drawing on the deepest fears of a group of creatures, you create illusory creatures in their "
            "minds, visible only to them. Each creature in a 30-foot-radius sphere centered on a point of "
            "your choice within range must make a Wisdom saving throw. On a failed save, the creature "
            "becomes frightened for the duration. The illusion calls on the creature's deepest fears, "
            "manifesting its worst nightmares as an implacable threat. At the end of each of the "
            "frightened creature's turns, it must succeed on a Wisdom saving throw or take 4d10 psychic "
            "damage. On a successful save, the spell ends for that creature."
        ),
        "classes": ["wizard"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    for spell in ILLUSION_SPELLS:
        if spell["id"] not in existing_ids:
            data["spells"].append(spell)
            added += 1

    # Sort spells by level then name
    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} illusion spells. Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
