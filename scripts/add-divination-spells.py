#!/usr/bin/env python3
"""Add all SRD 5.1 divination spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

DIVINATION_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "guidance",
        "name": "Guidance",
        "level": 0,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch one willing creature. Once before the spell ends, the target can roll a d4 and "
            "add the number rolled to one ability check of its choice. It can roll the die before or "
            "after making the ability check. The spell then ends."
        ),
        "classes": ["cleric", "druid"],
    },
    {
        "id": "resistance",
        "name": "Resistance",
        "level": 0,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a miniature cloak)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch one willing creature. Once before the spell ends, the target can roll a d4 and "
            "add the number rolled to one saving throw of its choice. It can roll the die before or "
            "after making the saving throw. The spell then ends."
        ),
        "classes": ["cleric", "druid"],
    },
    {
        "id": "true-strike",
        "name": "True Strike",
        "level": 0,
        "school": "divination",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "S",
        "duration": "Concentration, up to 1 round",
        "concentration": True,
        "ritual": False,
        "description": (
            "You extend your hand and point a finger at a target in range. Your magic grants you a brief "
            "insight into the target's defenses. On your next turn, you gain advantage on your first "
            "attack roll against the target, provided that this spell hasn't ended."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "comprehend-languages",
        "name": "Comprehend Languages",
        "level": 1,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a pinch of soot and salt)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "For the duration, you understand the literal meaning of any spoken language that you hear. "
            "You also understand any written language that you see, but you must be touching the surface "
            "on which the words are written. It takes about 1 minute to read one page of text.\n\n"
            "This spell doesn't decode secret messages in a text or a glyph, such as an arcane sigil, "
            "that isn't part of a written language."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "detect-magic",
        "name": "Detect Magic",
        "level": 1,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": True,
        "description": (
            "For the duration, you sense the presence of magic within 30 feet of you. If you sense "
            "magic in this way, you can use your action to see a faint aura around any visible creature "
            "or object in the area that bears magic, and you learn its school of magic, if any.\n\n"
            "The spell can penetrate most barriers, but it is blocked by 1 foot of stone, 1 inch of "
            "common metal, a thin sheet of lead, or 3 feet of wood or dirt."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "detect-poison-and-disease",
        "name": "Detect Poison and Disease",
        "level": 1,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a yew leaf)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": True,
        "description": (
            "For the duration, you can sense the presence and location of poisons, poisonous creatures, "
            "and diseases within 30 feet of you. You also identify the kind of poison, poisonous "
            "creature, or disease in each case.\n\n"
            "The spell can penetrate most barriers, but it is blocked by 1 foot of stone, 1 inch of "
            "common metal, a thin sheet of lead, or 3 feet of wood or dirt."
        ),
        "classes": ["cleric", "druid", "paladin", "ranger"],
    },
    {
        "id": "identify",
        "name": "Identify",
        "level": 1,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Touch",
        "components": "V, S, M (a pearl worth at least 100 gp and an owl feather)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "You choose one object that you must touch throughout the casting of the spell. If it is a "
            "magic item or some other magic-imbued object, you learn its properties and how to use them, "
            "whether it requires attunement to use, and how many charges it has, if any. You learn "
            "whether any spells are affecting the item and what they are. If the item was created by a "
            "spell, you learn which spell created it.\n\n"
            "If you instead touch a creature throughout the casting, you learn what spells, if any, are "
            "currently affecting it."
        ),
        "classes": ["bard", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "augury",
        "name": "Augury",
        "level": 2,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V, S, M (specially marked sticks, bones, or similar tokens worth at least 25 gp)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "By casting gem-inlaid sticks, rolling dragon bones, laying out ornate cards, or employing "
            "some other divining tool, you receive an omen from an otherworldly entity about the results "
            "of a specific course of action that you plan to take within the next 30 minutes. The DM "
            "chooses from the following possible omens:\n\n"
            "• Weal, for good results\n"
            "• Woe, for bad results\n"
            "• Weal and woe, for both good and bad results\n"
            "• Nothing, for results that aren't especially good or bad\n\n"
            "The spell doesn't take into account any possible circumstances that might change the "
            "outcome, such as the casting of additional spells or the loss or gain of a companion.\n\n"
            "If you cast the spell two or more times before completing your next long rest, there is a "
            "cumulative 25 percent chance for each casting after the first that you get a random reading. "
            "The DM makes this roll in secret."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "detect-thoughts",
        "name": "Detect Thoughts",
        "level": 2,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a copper piece)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "For the duration, you can read the thoughts of certain creatures. When you cast the spell "
            "and as your action on each turn until the spell ends, you can focus your mind on any one "
            "creature that you can see within 30 feet of you. If the creature you choose has an "
            "Intelligence of 3 or lower or doesn't speak any language, the creature is unaffected.\n\n"
            "You initially learn the surface thoughts of the creature—what is most on its mind in that "
            "moment. As an action, you can either shift your attention to another creature's thoughts "
            "or attempt to probe deeper into the same creature's mind. If you probe deeper, the target "
            "must make a Wisdom saving throw. If it fails, you gain insight into its reasoning (if any), "
            "its emotional state, and something that looms large in its mind (such as something it "
            "worries over, loves, or hates). If it succeeds, the spell ends. Either way, the target "
            "knows that you are probing into its mind, and unless you shift your attention to another "
            "creature's thoughts, the creature can use its action on its turn to make an Intelligence "
            "check contested by your Intelligence check; if it succeeds, the spell ends.\n\n"
            "Questions verbally directed at the target creature naturally shape the course of its "
            "thoughts, so this spell is particularly effective as part of an interrogation.\n\n"
            "You can also use this spell to detect the presence of thinking creatures you can't see. "
            "When you cast the spell or as your action during the duration, you can search for thoughts "
            "within 30 feet of you. The spell can penetrate barriers, but 2 feet of rock, 2 inches of "
            "any metal other than lead, or a thin sheet of lead blocks you. You can't detect a creature "
            "with an Intelligence of 3 or lower or one that doesn't speak any language.\n\n"
            "Once you detect the presence of a creature in this way, you can read its thoughts for the "
            "rest of the duration as described above, even if you can't see it, but it must still be "
            "within range."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },
    {
        "id": "find-traps",
        "name": "Find Traps",
        "level": 2,
        "school": "divination",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You sense the presence of any trap within range that is within line of sight. A trap, for "
            "the purpose of this spell, includes anything that would inflict a sudden or unexpected "
            "effect you consider harmful or undesirable, which was specifically intended as such by its "
            "creator. Thus the spell would sense an area affected by the alarm spell, a glyph of "
            "warding, or a mechanical pit trap, but it would not reveal a natural weakness in the floor, "
            "an unstable ceiling, or a hidden sinkhole.\n\n"
            "This spell merely reveals that a trap is present. You don't learn the location of each "
            "trap, but you do learn the general nature of the danger posed by a trap you sense."
        ),
        "classes": ["cleric", "druid", "ranger"],
    },
    {
        "id": "locate-animals-or-plants",
        "name": "Locate Animals or Plants",
        "level": 2,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a bit of fur from a bloodhound)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "Describe or name a specific kind of beast or plant. Concentrating on the voice of nature "
            "in your surroundings, you learn the direction and distance to the closest creature or plant "
            "of that kind within 5 miles, if any are present."
        ),
        "classes": ["bard", "druid", "ranger"],
    },
    {
        "id": "locate-object",
        "name": "Locate Object",
        "level": 2,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a forked twig)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "Describe or name an object that is familiar to you. You sense the direction to the object's "
            "location, as long as that object is within 1,000 feet of you. If the object is in motion, "
            "you know the direction of its movement.\n\n"
            "The spell can locate a specific object known to you, as long as you have seen it up close—"
            "within 30 feet—at least once. Alternatively, the spell can locate the nearest object of a "
            "particular kind, such as a certain kind of apparel, jewelry, furniture, tool, or weapon.\n\n"
            "This spell can't locate an object if any thickness of lead, even a thin sheet, separates "
            "you from the object."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger", "wizard"],
    },
    {
        "id": "see-invisibility",
        "name": "See Invisibility",
        "level": 2,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a pinch of talc and a small sprinkling of powdered silver)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "For the duration, you see invisible creatures and objects as if they were visible, and you "
            "can see into the Ethereal Plane. Ethereal creatures and objects appear ghostly and "
            "translucent."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "clairvoyance",
        "name": "Clairvoyance",
        "level": 3,
        "school": "divination",
        "castingTime": "10 minutes",
        "range": "1 mile",
        "components": "V, S, M (a focus worth at least 100 gp, either a jeweled horn for hearing or a glass eye for seeing)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create an invisible sensor within range in a location familiar to you (a place you have "
            "visited or seen before) or in an obvious location that is unfamiliar to you (such as behind "
            "a door, around a corner, or in a grove of trees). The sensor remains in place for the "
            "duration, and it can't be attacked or otherwise interacted with.\n\n"
            "When you cast the spell, you choose seeing or hearing. You can use the chosen sense through "
            "the sensor as if you were in its space. As your action, you can switch between seeing and "
            "hearing.\n\n"
            "A creature that can see the sensor (such as a creature benefiting from see invisibility or "
            "truesight) sees a luminous, intangible orb about the size of your fist."
        ),
        "classes": ["bard", "cleric", "sorcerer", "wizard"],
    },
    {
        "id": "nondetection",
        "name": "Nondetection",
        "level": 3,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a pinch of diamond dust worth 25 gp sprinkled over the target, which the spell consumes)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "For the duration, you hide a target that you touch from divination magic. The target can "
            "be a willing creature or a place or an object no larger than 10 feet in any dimension. The "
            "target can't be targeted by any divination magic or perceived through magical scrying sensors."
        ),
        "classes": ["bard", "ranger", "wizard"],
    },
    {
        "id": "tongues",
        "name": "Tongues",
        "level": 3,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, M (a small clay model of a ziggurat)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell grants the creature you touch the ability to understand any spoken language it "
            "hears. Moreover, when the target speaks, any creature that knows at least one language and "
            "can hear the target understands what it says."
        ),
        "classes": ["bard", "cleric", "sorcerer", "warlock", "wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "arcane-eye",
        "name": "Arcane Eye",
        "level": 4,
        "school": "divination",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (a bit of bat fur)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create an invisible, magical eye within range that hovers in the air for the duration.\n\n"
            "You mentally receive visual information from the eye, which has normal vision and darkvision "
            "out to 30 feet. The eye can look in every direction.\n\n"
            "As an action, you can move the eye up to 30 feet in any direction. There is no limit to how "
            "far away from you the eye can move, but it can't enter another plane of existence. A solid "
            "barrier blocks the eye's movement, but the eye can pass through an opening as small as "
            "1 inch in diameter."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "divination",
        "name": "Divination",
        "level": 4,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (incense and a sacrificial offering appropriate to your religion, together worth at least 25 gp, which the spell consumes)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "Your magic and an offering put you in contact with a god or a god's servants. You ask a "
            "single question concerning a specific goal, event, or activity to occur within 7 days. The "
            "DM offers a truthful reply. The reply might be a short phrase, a cryptic rhyme, or an omen.\n\n"
            "The spell doesn't take into account any possible circumstances that might change the outcome, "
            "such as the casting of additional spells or the loss or gain of a companion.\n\n"
            "If you cast the spell two or more times before finishing your next long rest, there is a "
            "cumulative 25 percent chance for each casting after the first that you get a random reading. "
            "The DM makes this roll in secret."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "locate-creature",
        "name": "Locate Creature",
        "level": 4,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a bit of fur from a bloodhound)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "Describe or name a creature that is familiar to you. You sense the direction to the "
            "creature's location, as long as that creature is within 1,000 feet of you. If the creature "
            "is in motion, you know the direction of its movement.\n\n"
            "The spell can locate a specific creature known to you, or the nearest creature of a specific "
            "kind (such as a human or a unicorn), so long as you have seen such a creature up close—within "
            "30 feet—at least once. If the creature you described or named is in a different form, such "
            "as being under the effects of a polymorph spell, this spell doesn't locate the creature.\n\n"
            "This spell can't locate a creature if running water at least 10 feet wide blocks a direct "
            "path between you and the creature."
        ),
        "classes": ["bard", "cleric", "druid", "paladin", "ranger", "wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "commune",
        "name": "Commune",
        "level": 5,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V, S, M (incense and a vial of holy or unholy water)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": True,
        "description": (
            "You contact your deity or a divine proxy and ask up to three questions that can be answered "
            "with a yes or no. You must ask your questions before the spell ends. You receive a correct "
            "answer for each question asked.\n\n"
            "Divine beings aren't necessarily omniscient, so you might receive 'unclear' as an answer "
            "if a question pertains to information that lies beyond the deity's knowledge. In a case "
            "where a one-word answer could be misleading or contrary to the deity's interests, the DM "
            "might offer a short phrase as an answer instead.\n\n"
            "If you cast the spell two or more times before finishing your next long rest, there is a "
            "cumulative 25 percent chance for each casting after the first that you get no answer. The "
            "DM makes this roll in secret."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "commune-with-nature",
        "name": "Commune with Nature",
        "level": 5,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "You briefly become one with nature and gain knowledge of the surrounding territory. In the "
            "outdoors, the spell gives you knowledge of the land within 3 miles of you. In caves and "
            "other natural underground settings, the radius is limited to 300 feet. The spell doesn't "
            "function where nature has been replaced by construction, such as in dungeons and towns.\n\n"
            "You instantly gain knowledge of up to three facts of your choice about any of the "
            "following subjects as they relate to the area:\n\n"
            "• terrain and bodies of water\n"
            "• prevalent plants, minerals, animals, or peoples\n"
            "• powerful celestials, fey, fiends, elementals, or undead\n"
            "• influence from other planes of existence\n"
            "• buildings\n\n"
            "For example, you could determine the location of powerful undead in the area, the location "
            "of major sources of safe drinking water, and the location of any nearby towns."
        ),
        "classes": ["druid", "ranger"],
    },
    {
        "id": "contact-other-plane",
        "name": "Contact Other Plane",
        "level": 5,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V",
        "duration": "1 minute",
        "concentration": False,
        "ritual": True,
        "description": (
            "You mentally contact a demigod, the spirit of a long-dead sage, or some other mysterious "
            "entity from another plane. Contacting this extraplanar intelligence can strain or even "
            "break your mind. When you cast this spell, make a DC 15 Intelligence saving throw. On a "
            "failure, you take 6d6 psychic damage and are insane until you finish a long rest. While "
            "insane, you can't take actions, can't understand what other creatures say, can't read, and "
            "speak only in gibberish. A greater restoration spell cast on you ends this effect.\n\n"
            "On a successful save, you can ask the entity up to five questions. You must ask your "
            "questions before the spell ends. The DM answers each question with one word, such as "
            "'yes,' 'no,' 'maybe,' 'never,' 'irrelevant,' or 'unclear' (if the entity doesn't know "
            "the answer to the question). If a one-word answer would be misleading, the DM might "
            "instead offer a short phrase as an answer."
        ),
        "classes": ["warlock", "wizard"],
    },
    {
        "id": "legend-lore",
        "name": "Legend Lore",
        "level": 5,
        "school": "divination",
        "castingTime": "10 minutes",
        "range": "Self",
        "components": "V, S, M (incense worth at least 250 gp, which the spell consumes, and four ivory strips worth at least 50 gp each)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Name or describe a person, place, or object. The spell brings to your mind a brief summary "
            "of the significant lore about the thing you named. The lore might consist of current tales, "
            "forgotten stories, or even secret lore that has never been widely known. If the thing you "
            "named isn't of legendary importance, you gain no information. The more information you "
            "already have about the thing, the more precise and detailed the information you receive is.\n\n"
            "The information you learn is accurate but might be couched in figurative language. For "
            "example, if you have a mysterious magic axe on hand, the spell might yield this information: "
            "'Woe to the evildoer whose hand touches the Axe of the Dwarvish Lords, for the gods of the "
            "dwarves crystalize the evil crafted from the fires of their hearts. Only a true sacrificial "
            "lamb, consecrated in the blood of the innocent, can be wielded by evil.'"
        ),
        "classes": ["bard", "cleric", "wizard"],
    },
    {
        "id": "rary-telepathic-bond",
        "name": "Rary's Telepathic Bond",
        "level": 5,
        "school": "divination",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S, M (pieces of eggshell from two different kinds of creatures)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "You forge a telepathic link among up to eight willing creatures of your choice within range, "
            "psychically linking each creature to all the others for the duration. Creatures with "
            "Intelligence scores of 2 or less aren't affected by this spell.\n\n"
            "Until the spell ends, the targets can communicate telepathically through the bond whether "
            "or not they have a common language. The communication is possible over any distance, though "
            "it can't extend to other planes of existence."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "scrying",
        "name": "Scrying",
        "level": 5,
        "school": "divination",
        "castingTime": "10 minutes",
        "range": "Self",
        "components": "V, S, M (a focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You can see and hear a particular creature you choose that is on the same plane of existence "
            "as you. The target must make a Wisdom saving throw, which is modified by how well you know "
            "the target and the sort of physical connection you have to it. If a target knows you're "
            "casting this spell, it can fail the saving throw voluntarily if it wants to be observed.\n\n"
            "Knowledge: Secondhand (you have heard of the target): +5 penalty. Firsthand (you have met "
            "the target): +0 penalty. Familiar (you know the target well): −5 penalty.\n\n"
            "Connection: Likeness or picture: −2 penalty. Possession or garment: −4 penalty. Body part, "
            "lock of hair, bit of nail, or the like: −10 penalty.\n\n"
            "On a failed save, the spell creates an invisible sensor within 10 feet of the target. You "
            "can see and hear through the sensor as if you were there. The sensor moves with the target, "
            "remaining within 10 feet of it for the duration. A creature that can see invisible objects "
            "sees the sensor as a luminous orb about the size of your fist.\n\n"
            "Instead of targeting a creature, you can choose a location you have seen before as the "
            "target of this spell. When you do, the sensor appears at that location and doesn't move."
        ),
        "classes": ["bard", "cleric", "druid", "warlock", "wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "find-the-path",
        "name": "Find the Path",
        "level": 6,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V, S, M (a set of divinatory tools—such as bones, ivory sticks, cards, teeth, or carved runes—worth 100 gp and an object from the location you wish to find)",
        "duration": "Concentration, up to 1 day",
        "concentration": True,
        "ritual": False,
        "description": (
            "This spell allows you to find the shortest, most direct physical route to a specific fixed "
            "location that you are familiar with on the same plane of existence. If you name a "
            "destination on another plane of existence that you have visited, a destination that moves "
            "(such as a mobile fortress), or a destination that isn't specific (such as 'a green dragon's "
            "lair'), the spell fails.\n\n"
            "For the duration, as long as you are on the same plane of existence as the destination, you "
            "know how far it is and in what direction it lies. While you are traveling there, whenever "
            "you are presented with a choice of paths along the way, you automatically determine which "
            "path is the shortest and most direct route (but not necessarily the safest route) to the "
            "destination."
        ),
        "classes": ["bard", "cleric", "druid"],
    },
    {
        "id": "true-seeing",
        "name": "True Seeing",
        "level": 6,
        "school": "divination",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (an ointment for the eyes that costs 25 gp; is made from mushroom powder, saffron, and fat; and is consumed by the spell)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You give the willing creature you touch the ability to see things as they actually are. "
            "For the duration, the creature has truesight, notices secret doors hidden by magic, and "
            "can see into the Ethereal Plane, all out to a range of 120 feet."
        ),
        "classes": ["bard", "cleric", "sorcerer", "warlock", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "foresight",
        "name": "Foresight",
        "level": 9,
        "school": "divination",
        "castingTime": "1 minute",
        "range": "Touch",
        "components": "V, S, M (a hummingbird feather)",
        "duration": "8 hours",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a willing creature and bestow a limited ability to see into the immediate future. "
            "For the duration, the target can't be surprised and has advantage on attack rolls, ability "
            "checks, and saving throws. Additionally, other creatures have disadvantage on attack rolls "
            "against the target for the duration.\n\n"
            "This spell immediately ends if you cast it again before its duration ends."
        ),
        "classes": ["bard", "druid", "warlock", "wizard"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    for spell in DIVINATION_SPELLS:
        if spell["id"] not in existing_ids:
            data["spells"].append(spell)
            added += 1

    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} divination spells. Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
