#!/usr/bin/env python3
"""Add SRD 5.1 enchantment spells to app/data/srd-5.1.json."""
import json, pathlib

DATA_FILE = pathlib.Path(__file__).parent.parent / "app" / "data" / "srd-5.1.json"

ENCHANTMENT_SPELLS = [
    # ── Cantrips ───────────────────────────────────────────────────────────────
    {
        "id": "friends",
        "name": "Friends",
        "level": 0,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "Self",
        "components": "S, M (a small amount of makeup applied to the face as this spell is cast)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "For the duration, you have advantage on all Charisma checks directed at one creature of "
            "your choice that isn't hostile toward you. When the spell ends, the creature realizes "
            "that you used magic to influence its mood and becomes hostile toward you. A creature "
            "prone to violence might attack you. Another creature might seek retribution in other "
            "ways (at the DM's discretion), depending on the nature of your interaction with it."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "animal-friendship",
        "name": "Animal Friendship",
        "level": 1,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a morsel of food)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell lets you convince a beast that you mean it no harm. Choose a beast that you "
            "can see within range. It must see and hear you. If the beast's Intelligence is 4 or "
            "higher, the spell fails. Otherwise, the beast must succeed on a Wisdom saving throw or "
            "be charmed by you for the spell's duration. If you or one of your companions harms the "
            "target, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, "
            "you can affect one additional beast for each slot level above 1st."
        ),
        "classes": ["bard", "druid", "ranger"],
    },
    {
        "id": "charm-person",
        "name": "Charm Person",
        "level": 1,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You attempt to charm a humanoid you can see within range. It must make a Wisdom saving "
            "throw, and does so with advantage if you or your companions are fighting it. If it fails "
            "the saving throw, it is charmed by you until the spell ends or until you or your "
            "companions do anything harmful to it. The charmed creature regards you as a friendly "
            "acquaintance. When the spell ends, the creature knows it was charmed by you.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, "
            "you can target one additional creature for each slot level above 1st. The creatures must "
            "be within 30 feet of each other when you target them."
        ),
        "classes": ["bard", "druid", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "heroism",
        "name": "Heroism",
        "level": 1,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A willing creature you touch is imbued with bravery. Until the spell ends, the creature "
            "is immune to being frightened and gains temporary hit points equal to your spellcasting "
            "ability modifier at the start of each of its turns. When the spell ends, the target loses "
            "any remaining temporary hit points from this spell.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, "
            "you can target one additional creature for each slot level above 1st."
        ),
        "classes": ["bard", "paladin"],
    },
    {
        "id": "sleep",
        "name": "Sleep",
        "level": 1,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (a pinch of fine sand, rose petals, or a cricket)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit "
            "points of creatures this spell can affect. Creatures within 20 feet of a point you "
            "choose within range are affected in ascending order of their current hit points (ignoring "
            "unconscious creatures).\n\n"
            "Starting with the creature that has the lowest current hit points, each creature affected "
            "by this spell falls unconscious until the spell ends, the sleeper takes damage, or "
            "someone uses an action to shake or slap the sleeper awake. Subtract each creature's hit "
            "points from the total before moving on to the creature with the next lowest hit points. "
            "A creature's hit points must be equal to or less than the remaining total for that "
            "creature to be affected.\n\n"
            "Undead and creatures immune to being charmed aren't affected by this spell.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, "
            "roll an additional 2d8 for each slot level above 1st."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "tashas-hideous-laughter",
        "name": "Tasha's Hideous Laughter",
        "level": 1,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (tiny tarts and a feather that is waved in the air)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A creature of your choice that you can see within range perceives everything as hilariously "
            "funny and falls into fits of laughter if this spell affects it. The target must succeed "
            "on a Wisdom saving throw or fall prone, becoming incapacitated and unable to stand up "
            "for the duration. A creature with an Intelligence score of 4 or less isn't affected.\n\n"
            "At the end of each of its turns, and each time it takes damage, the target can make "
            "another Wisdom saving throw. The target has advantage on the saving throw if it's "
            "triggered by damage. On a success, the spell ends."
        ),
        "classes": ["bard", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "calm-emotions",
        "name": "Calm Emotions",
        "level": 2,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to suppress strong emotions in a group of people. Each humanoid in a "
            "20-foot-radius sphere centered on a point you choose within range must make a Charisma "
            "saving throw; a creature can choose to fail this saving throw if it wishes. If a creature "
            "fails its saving throw, choose one of the following two effects.\n\n"
            "You can suppress any effect causing a target to be charmed or frightened. When this "
            "spell ends, any suppressed effect resumes, provided that its duration has not expired "
            "in the meantime.\n\n"
            "Alternatively, you can make a target indifferent about creatures of your choice that it "
            "is hostile toward. This indifference ends if the target is attacked or harmed by a spell "
            "or if it witnesses any of its friends being harmed. When the spell ends, the creature "
            "becomes hostile again, unless the DM rules otherwise."
        ),
        "classes": ["bard", "cleric"],
    },
    {
        "id": "crown-of-madness",
        "name": "Crown of Madness",
        "level": 2,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "One humanoid of your choice that you can see within range must succeed on a Wisdom "
            "saving throw or become charmed by you for the duration. While the target is charmed in "
            "this way, a twisted crown of jagged iron appears on its head, and a madness glows in "
            "its eyes.\n\n"
            "The charmed target must use its action before moving on each of its turns to make a "
            "melee attack against a creature other than itself that you mentally choose. The target "
            "can act normally on its turn if you choose no creature or if none are within its reach.\n\n"
            "On your subsequent turns, you must use your action to maintain control over the target, "
            "or the spell ends. Also, the target can make a Wisdom saving throw at the end of each "
            "of its turns. On a success, the spell ends."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "enthrall",
        "name": "Enthrall",
        "level": 2,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You weave a distracting string of words, causing creatures of your choice that you can "
            "see within range and that can hear you to make a Wisdom saving throw. Any creature that "
            "can't be charmed succeeds on this saving throw automatically, and if you or your "
            "companions are fighting a creature, it has advantage on the save. On a failed save, the "
            "target has disadvantage on Wisdom (Perception) checks made to perceive any creature "
            "other than you until the spell ends or until the target can no longer hear you. The "
            "spell ends if you are incapacitated or can no longer speak."
        ),
        "classes": ["bard", "warlock"],
    },
    {
        "id": "hold-person",
        "name": "Hold Person",
        "level": 2,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a small, straight piece of iron)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose a humanoid that you can see within range. The target must succeed on a Wisdom "
            "saving throw or be paralyzed for the duration. At the end of each of its turns, the "
            "target can make another Wisdom saving throw. On a success, the spell ends on the target.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, "
            "you can target one additional humanoid for each slot level above 2nd. The humanoids must "
            "be within 30 feet of each other when you target them."
        ),
        "classes": ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "suggestion",
        "name": "Suggestion",
        "level": 2,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, M (a snake's tongue and either a bit of honeycomb or a drop of sweet oil)",
        "duration": "Concentration, up to 8 hours",
        "concentration": True,
        "ritual": False,
        "description": (
            "You suggest a course of activity (limited to a sentence or two) and magically influence "
            "a creature you can see within range that can hear and understand you. Creatures that "
            "can't be charmed are immune to this effect. The suggestion must be worded in such a "
            "manner as to make the course of action sound reasonable. Asking the creature to stab "
            "itself, throw itself onto a spear, immolate itself, or do some other obviously harmful "
            "act automatically negates the effect of the spell.\n\n"
            "The target must make a Wisdom saving throw. On a failed save, it pursues the course of "
            "action you described to the best of its ability. The suggested course of action can "
            "continue for the entire duration. If the suggested activity can be completed in a shorter "
            "time, the spell ends when the subject finishes what it was asked to do.\n\n"
            "You can also specify conditions that will trigger a special activity during the duration. "
            "If the condition isn't met before the spell expires, the activity isn't performed.\n\n"
            "If you or any of your companions damage the target, the spell ends."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "compulsion",
        "name": "Compulsion",
        "level": 4,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Creatures of your choice that you can see within range and that can hear you must make "
            "a Wisdom saving throw. A target automatically succeeds on this saving throw if it can't "
            "be charmed. On a failed save, a target is affected by this spell. Until the spell ends, "
            "you can use a bonus action on each of your turns to designate a direction that is "
            "horizontal to you. Each affected target must use as much of its movement as possible to "
            "move in that direction on its next turn. It can take any action before it moves. After "
            "moving in this way, it can make another Wisdom saving throw to try to end the effect.\n\n"
            "A target isn't compelled to move into an obviously deadly hazard, such as a fire or pit, "
            "but it will provoke opportunity attacks to move in the designated direction."
        ),
        "classes": ["bard"],
    },
    {
        "id": "confusion",
        "name": "Confusion",
        "level": 4,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (three nut shells)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell assaults and twists creatures' minds, spawning delusions and provoking "
            "uncontrolled action. Each creature in a 10-foot-radius sphere centered on a point you "
            "choose within range must succeed on a Wisdom saving throw when you cast this spell or "
            "be affected by it.\n\n"
            "An affected target can't take reactions and must roll a d10 at the start of each of its "
            "turns to determine its behavior for that turn.\n\n"
            "d10 — Behavior\n"
            "1 — The creature uses all its movement to move in a random direction. To determine the "
            "direction, roll a d8 and assign a direction to each die face. The creature doesn't take "
            "an action this turn.\n"
            "2–6 — The creature doesn't move or take actions this turn.\n"
            "7–8 — The creature uses its action to make a melee attack against a randomly determined "
            "creature within its reach. If there is no creature within its reach, the creature does "
            "nothing this turn.\n"
            "9–10 — The creature can act and move normally.\n\n"
            "At the end of each of its turns, an affected target can make a Wisdom saving throw. If "
            "it succeeds, this effect ends for that target.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, "
            "the radius of the sphere increases by 5 feet for each slot level above 4th."
        ),
        "classes": ["bard", "druid", "sorcerer", "wizard"],
    },
    {
        "id": "dominate-beast",
        "name": "Dominate Beast",
        "level": 4,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to beguile a beast that you can see within range. It must succeed on a "
            "Wisdom saving throw or be charmed by you for the duration. If you or creatures that are "
            "friendly to you are fighting it, it has advantage on the saving throw.\n\n"
            "While the beast is charmed, you have a telepathic link with it as long as the two of "
            "you are on the same plane of existence. You can use this telepathic link to issue "
            "commands to the creature while you are conscious (no action required), which it does its "
            "best to obey. You can specify a simple and general course of action, such as 'Attack that "
            "creature,' 'Run over there,' or 'Fetch that object.' If the creature completes the order "
            "and doesn't receive further direction from you, it defends itself.\n\n"
            "Each time the target takes damage, it makes a new Wisdom saving throw against the spell. "
            "On a success, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell with a 5th-level spell slot, the duration is "
            "concentration, up to 10 minutes. When you use a 6th-level spell slot, the duration is "
            "concentration, up to 1 hour. When you use a spell slot of 7th level or higher, the "
            "duration is concentration, up to 8 hours."
        ),
        "classes": ["druid", "ranger", "sorcerer"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "dominate-person",
        "name": "Dominate Person",
        "level": 5,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to beguile a humanoid that you can see within range. It must succeed on a "
            "Wisdom saving throw or be charmed by you for the duration. If you or creatures that are "
            "friendly to you are fighting it, it has advantage on the saving throw.\n\n"
            "While the target is charmed, you have a telepathic link with it as long as the two of "
            "you are on the same plane of existence. You can use this telepathic link to issue "
            "commands to the creature while you are conscious (no action required), which it does its "
            "best to obey. You can specify a simple and general course of action, such as 'Attack that "
            "creature,' 'Run over there,' or 'Fetch that object.' If the creature completes the order "
            "and doesn't receive further direction from you, it defends itself.\n\n"
            "Each time the target takes damage, it makes a new Wisdom saving throw against the spell. "
            "On a success, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a 6th-level spell slot, the duration is "
            "concentration, up to 10 minutes. When you use a 7th-level spell slot, the duration is "
            "concentration, up to 1 hour. When you use an 8th-level spell slot, the duration is "
            "concentration, up to 8 hours."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "geas",
        "name": "Geas",
        "level": 5,
        "school": "enchantment",
        "castingTime": "1 minute",
        "range": "60 feet",
        "components": "V",
        "duration": "30 days",
        "concentration": False,
        "ritual": False,
        "description": (
            "You place a magical command on a creature that you can see within range, forcing it to "
            "carry out some service or refrain from some action or course of activity as you decide. "
            "If the creature can understand you, it must succeed on a Wisdom saving throw or become "
            "charmed by you for the duration. While the creature is charmed by you, it takes 5d10 "
            "psychic damage each time it acts in a manner directly counter to your instructions, but "
            "no more than once each day. A creature that can't understand you is unaffected by the "
            "spell.\n\n"
            "You can issue any command you choose, short of an activity that would result in certain "
            "death. Should you issue a suicidal command, the spell ends.\n\n"
            "You can end the spell early by using an action to dismiss it. A remove curse, greater "
            "restoration, or wish spell also ends it.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th or 8th level, the "
            "duration is 1 year. When you cast this spell using a spell slot of 9th level, the spell "
            "lasts until it is ended by one of the spells mentioned above."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "wizard"],
    },
    {
        "id": "hold-monster",
        "name": "Hold Monster",
        "level": 5,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (a small, straight piece of iron)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose a creature that you can see within range. The target must succeed on a Wisdom "
            "saving throw or be paralyzed for the duration. This spell has no effect on undead. At "
            "the end of each of its turns, the target can make another Wisdom saving throw. On a "
            "success, the spell ends on the target.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, "
            "you can target one additional creature for each slot level above 5th. The creatures must "
            "be within 30 feet of each other when you target them."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "mass-suggestion",
        "name": "Mass Suggestion",
        "level": 6,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, M (a snake's tongue and either a bit of honeycomb or a drop of sweet oil)",
        "duration": "24 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You suggest a course of activity (limited to a sentence or two) and magically influence "
            "up to twelve creatures of your choice that you can see within range and that can hear "
            "and understand you. Creatures that can't be charmed are immune to this effect. The "
            "suggestion must be worded in such a manner as to make the course of action sound "
            "reasonable. Asking the creature to stab itself, throw itself onto a spear, immolate "
            "itself, or do some other obviously harmful act automatically negates the effect of the "
            "spell.\n\n"
            "Each target must make a Wisdom saving throw. On a failed save, it pursues the course of "
            "action you described to the best of its ability. The suggested course of action can "
            "continue for the entire duration. If the suggested activity can be completed in a shorter "
            "time, the spell ends when the subject finishes what it was asked to do.\n\n"
            "You can also specify conditions that will trigger a special activity during the duration. "
            "If the condition isn't met before the spell expires, the activity isn't performed.\n\n"
            "If you or any of your companions damage a target, the spell ends for that target.\n\n"
            "At Higher Levels. When you cast this spell using a 7th-level spell slot, the duration "
            "is 10 days. When you use an 8th-level spell slot, the duration is 30 days. When you use "
            "a 9th-level spell slot, the duration is a year and a day."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "ottos-irresistible-dance",
        "name": "Otto's Irresistible Dance",
        "level": 6,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Choose one creature that you can see within range. The target begins a comic dance in "
            "place: shuffling, tapping its feet, and capering for the duration. Creatures that can't "
            "be charmed are immune to this spell.\n\n"
            "A dancing creature must use all its movement to dance without leaving its space and has "
            "disadvantage on Dexterity saving throws and attack rolls. While the target is affected "
            "by this spell, other creatures have advantage on attack rolls against it. As an action, "
            "a dancing creature makes a Wisdom saving throw to regain control of itself. On a "
            "successful save, the spell ends."
        ),
        "classes": ["bard", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "dominate-monster",
        "name": "Dominate Monster",
        "level": 8,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You attempt to beguile a creature that you can see within range. It must succeed on a "
            "Wisdom saving throw or be charmed by you for the duration. If you or creatures that are "
            "friendly to you are fighting it, it has advantage on the saving throw.\n\n"
            "While the creature is charmed, you have a telepathic link with it as long as the two of "
            "you are on the same plane of existence. You can use this telepathic link to issue "
            "commands to the creature while you are conscious (no action required), which it does its "
            "best to obey. You can specify a simple and general course of action, such as 'Attack that "
            "creature,' 'Run over there,' or 'Fetch that object.' If the creature completes the order "
            "and doesn't receive further direction from you, it defends itself.\n\n"
            "Each time the target takes damage, it makes a new Wisdom saving throw against the spell. "
            "On a success, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a 9th-level spell slot, the duration "
            "is concentration, up to 8 hours."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "feeblemind",
        "name": "Feeblemind",
        "level": 8,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (a handful of clay, crystal, glass, or mineral spheres)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You blast the mind of a creature you can see within range, attempting to shatter its "
            "intellect and personality. The target takes 4d6 psychic damage and must make an "
            "Intelligence saving throw.\n\n"
            "On a failed save, the creature's Intelligence and Charisma scores become 1. The creature "
            "can't cast spells, activate magic items, understand language, or communicate in any "
            "intelligible way. The creature can, however, identify its friends, follow them, and even "
            "protect them.\n\n"
            "At the end of every 30 days, the creature can repeat its saving throw against this spell. "
            "On a success, the spell ends.\n\n"
            "The spell can also be ended by greater restoration, heal, or wish."
        ),
        "classes": ["bard", "druid", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "power-word-stun",
        "name": "Power Word Stun",
        "level": 8,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "You speak a word of power that overwhelms the mind of one creature you can see within "
            "range, leaving it dumbfounded. If the target has 150 hit points or fewer, it is stunned. "
            "Otherwise, the spell has no effect.\n\n"
            "The stunned target must make a Constitution saving throw at the end of each of its turns. "
            "On a successful save, the stunning effect ends."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "power-word-kill",
        "name": "Power Word Kill",
        "level": 9,
        "school": "enchantment",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You utter a word of power that can compel one creature you can see within range to die "
            "instantly. If the creature you choose has 100 hit points or fewer, it dies. Otherwise, "
            "the spell has no effect."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
]


def main():
    with open(DATA_FILE) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data["spells"]}
    added, skipped = 0, 0
    for spell in ENCHANTMENT_SPELLS:
        if spell["id"] in existing_ids:
            print(f"  skip (duplicate): {spell['id']}")
            skipped += 1
        else:
            data["spells"].append(spell)
            existing_ids.add(spell["id"])
            added += 1

    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(f"Added {added} enchantment spells (skipped {skipped} duplicates). "
          f"Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
