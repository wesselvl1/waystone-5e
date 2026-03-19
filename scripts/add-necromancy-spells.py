#!/usr/bin/env python3
"""Add all SRD 5.1 necromancy spells to the srd-5.1.json data file."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'srd-5.1.json')

NECROMANCY_SPELLS = [
    # ── Cantrips ──────────────────────────────────────────────────────────────
    {
        "id": "chill-touch",
        "name": "Chill Touch",
        "level": 0,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged "
            "spell attack against the creature to assail it with the chill of the grave. On a hit, the "
            "target takes 1d8 necrotic damage, and it can't regain hit points until the start of your "
            "next turn. Until then, the hand clings to the target.\n\n"
            "If you hit an undead target, it also has disadvantage on attack rolls against you until the "
            "end of your next turn.\n\n"
            "This spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and "
            "17th level (4d8)."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "spare-the-dying",
        "name": "Spare the Dying",
        "level": 0,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a living creature that has 0 hit points. The creature becomes stable. This spell "
            "has no effect on undead or constructs."
        ),
        "classes": ["cleric"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "false-life",
        "name": "False Life",
        "level": 1,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S, M (a small amount of alcohol or distilled spirits)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "Bolstering yourself with a necromantic facsimile of life, you gain 1d4 + 4 temporary hit "
            "points for the duration.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, you "
            "gain 5 additional temporary hit points for each slot level above 1st."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "inflict-wounds",
        "name": "Inflict Wounds",
        "level": 1,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Make a melee spell attack against a creature you can reach. On a hit, the target takes "
            "3d10 necrotic damage.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "damage increases by 1d10 for each slot level above 1st."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "ray-of-sickness",
        "name": "Ray of Sickness",
        "level": 1,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A ray of sickening greenish energy lashes out toward a creature within range. Make a ranged "
            "spell attack against the target. On a hit, the target takes 2d8 poison damage and must make "
            "a Constitution saving throw. On a failed save, it is also poisoned until the end of your "
            "next turn.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the "
            "damage increases by 1d8 for each slot level above 1st."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "blindness-deafness",
        "name": "Blindness/Deafness",
        "level": 2,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "You can blind or deafen a foe. Choose one creature that you can see within range to make a "
            "Constitution saving throw. If it fails, the target is either blinded or deafened (your "
            "choice) for the duration. At the end of each of its turns, the target can make a "
            "Constitution saving throw. On a success, the spell ends.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you "
            "can target one additional creature for each slot level above 2nd."
        ),
        "classes": ["bard", "cleric", "sorcerer", "wizard"],
    },
    {
        "id": "gentle-repose",
        "name": "Gentle Repose",
        "level": 2,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a pinch of salt and one copper piece placed on each of the corpse's eyes, which must remain there for the duration)",
        "duration": "10 days",
        "concentration": False,
        "ritual": True,
        "description": (
            "You touch a corpse or other remains. For the duration, the target is protected from decay "
            "and can't become undead.\n\n"
            "The spell also effectively extends the time limit on raising the target from the dead, since "
            "days spent under the influence of this spell don't count against the time limit of spells "
            "such as raise dead."
        ),
        "classes": ["cleric", "wizard"],
    },
    {
        "id": "ray-of-enfeeblement",
        "name": "Ray of Enfeeblement",
        "level": 2,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A black beam of enervating energy springs from your finger toward a creature within range. "
            "Make a ranged spell attack against the target. On a hit, the target deals only half damage "
            "with weapon attacks that use Strength until the spell ends.\n\n"
            "At the end of each of the target's turns, it can make a Constitution saving throw against "
            "the spell. On a success, the spell ends."
        ),
        "classes": ["warlock", "wizard"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "animate-dead",
        "name": "Animate Dead",
        "level": 3,
        "school": "necromancy",
        "castingTime": "1 minute",
        "range": "10 feet",
        "components": "V, S, M (a drop of blood, a piece of flesh, and a pinch of bone dust)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell creates an undead servant. Choose a pile of bones or a corpse of a Medium or "
            "Small humanoid within range. Your spell imbues the target with a foul mimicry of life, "
            "raising it as an undead creature. The target becomes a skeleton if you chose bones or a "
            "zombie if you chose a corpse (the DM has the creature's game statistics).\n\n"
            "On each of your turns, you can use a bonus action to mentally command any creature you "
            "made with this spell if the creature is within 60 feet of you (if you control multiple "
            "creatures, you can command any or all of them at the same time, issuing the same command "
            "to each one). You decide what action the creature will take and where it will move during "
            "its next turn, or you can issue a general command, such as to guard a particular chamber "
            "or corridor. If you issue no commands, the creature only defends itself against hostile "
            "creatures. Once given an order, the creature continues to follow it until its task is "
            "complete.\n\n"
            "The creature is under your control for 24 hours, after which it stops obeying any command "
            "you've given it. To maintain control of the creature for another 24 hours, you must cast "
            "this spell on the creature again before the current 24-hour period ends. This use of the "
            "spell reasserts your control over up to four creatures you have animated with this spell, "
            "rather than animating a new one.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, you "
            "animate or reassert control over two additional undead creatures for each slot level above "
            "3rd. Each of the creatures must come from a different corpse or pile of bones."
        ),
        "classes": ["cleric", "wizard"],
    },
    {
        "id": "bestow-curse",
        "name": "Bestow Curse",
        "level": 3,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You touch a creature, and that creature must succeed on a Wisdom saving throw or become "
            "cursed for the duration of the spell. When you cast this spell, choose the nature of the "
            "curse from the following options:\n\n"
            "• Choose one ability score. While cursed, the target has disadvantage on ability checks "
            "and saving throws made with that ability score.\n"
            "• While cursed, the target has disadvantage on attack rolls against you.\n"
            "• While cursed, the target must make a Wisdom saving throw at the start of each of its "
            "turns. If it fails, it wastes its action that turn doing nothing.\n"
            "• While the target is cursed, your attacks and spells deal an extra 1d8 necrotic damage "
            "to the target.\n\n"
            "A remove curse spell ends this effect. At the DM's option, you may choose an alternative "
            "curse effect, but it should be no more powerful than those described above. The DM has "
            "final say on such a curse's effect.\n\n"
            "At Higher Levels. If you cast this spell using a spell slot of 4th level or higher, the "
            "duration is concentration, up to 10 minutes. If you use a spell slot of 5th level or "
            "higher, the duration is 8 hours. If you use a spell slot of 7th level or higher, the "
            "duration is 24 hours. If you use a 9th-level spell slot, the spell lasts until it is "
            "dispelled. Using a spell slot of 5th level or higher grants a duration that doesn't "
            "require concentration."
        ),
        "classes": ["bard", "cleric", "wizard"],
    },
    {
        "id": "feign-death",
        "name": "Feign Death",
        "level": 3,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a pinch of graveyard dirt)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "You touch a willing creature and put it into a cataleptic state that is indistinguishable "
            "from death.\n\n"
            "For the spell's duration, or until you use an action to touch the target and dismiss the "
            "spell, the target appears dead to all outward inspection and to spells used to determine "
            "the target's status. The target is blinded and incapacitated, and its speed drops to 0. "
            "The target has resistance to all damage except psychic damage, and it is immune to the "
            "poisoned condition. If the target is diseased or poisoned when you cast the spell, or "
            "becomes diseased or poisoned while under the spell's effect, the disease and poison have "
            "no effect until the spell ends."
        ),
        "classes": ["bard", "cleric", "druid", "wizard"],
    },
    {
        "id": "speak-with-dead",
        "name": "Speak with Dead",
        "level": 3,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "10 feet",
        "components": "V, S, M (burning incense)",
        "duration": "10 minutes",
        "concentration": False,
        "ritual": False,
        "description": (
            "You grant the semblance of life and intelligence to a corpse of your choice within range, "
            "allowing it to answer the questions you pose. The corpse must still have a mouth and can't "
            "be undead. The spell fails if the corpse was the target of this spell within the last 10 "
            "days.\n\n"
            "Until the spell ends, you can ask the corpse up to five questions. The corpse knows only "
            "what it knew in life, including the languages it knew. Answers are usually brief, cryptic, "
            "or repetitive, and the corpse is under no compulsion to offer a truthful answer if you are "
            "hostile to it or it recognizes you as an enemy. This spell doesn't return the creature's "
            "soul to its body, only its animating spirit. Thus, the corpse can't learn new information, "
            "doesn't comprehend anything that has happened since it died, and can't speculate about "
            "future events."
        ),
        "classes": ["bard", "cleric"],
    },
    {
        "id": "vampiric-touch",
        "name": "Vampiric Touch",
        "level": 3,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "The touch of your shadow-wreathed hand can siphon life force from others to heal your "
            "wounds. Make a melee spell attack against a creature within your reach. On a hit, the "
            "target takes 3d6 necrotic damage, and you regain hit points equal to half the amount of "
            "necrotic damage dealt. Until the spell ends, you can make the attack again on each of "
            "your turns as an action.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the "
            "damage increases by 1d6 for each slot level above 3rd."
        ),
        "classes": ["warlock", "wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "blight",
        "name": "Blight",
        "level": 4,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Necromantic energy washes over a creature of your choice that you can see within range, "
            "draining moisture and vitality from it. The target must make a Constitution saving throw. "
            "The target takes 8d8 necrotic damage on a failed save, or half as much damage on a "
            "successful one. This spell has no effect on undead or constructs.\n\n"
            "If you target a plant creature or a magical plant, it makes the saving throw with "
            "disadvantage, and the spell deals maximum damage to it.\n\n"
            "If you target a nonmagical plant that isn't a creature, such as a tree or shrub, it "
            "doesn't make a saving throw; it simply withers and dies.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the "
            "damage increases by 1d8 for each slot level above 4th."
        ),
        "classes": ["druid", "sorcerer", "warlock", "wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "contagion",
        "name": "Contagion",
        "level": 5,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S",
        "duration": "7 days",
        "concentration": False,
        "ritual": False,
        "description": (
            "Your touch inflicts disease. Make a melee spell attack against a creature within your "
            "reach. On a hit, the target is poisoned.\n\n"
            "At the end of each of the poisoned target's turns, the target must make a Constitution "
            "saving throw. If the target succeeds on three of these saves, it is no longer poisoned, "
            "and the spell ends. If the target fails three of these saves, the target is no longer "
            "poisoned, but choose one of the diseases below. The target is subjected to the chosen "
            "disease for the spell's duration.\n\n"
            "Since this spell induces a natural disease in its target, any effect that removes a "
            "disease or otherwise ameliorates a disease's effects apply to it.\n\n"
            "Blinding Sickness. Pain grips the creature's mind, and its eyes turn milky white. The "
            "creature has disadvantage on Wisdom checks and Wisdom saving throws and is blinded.\n\n"
            "Filth Fever. A raging fever sweeps through the creature's body. The creature has "
            "disadvantage on Strength checks, Strength saving throws, and attack rolls that use "
            "Strength.\n\n"
            "Flesh Rot. The creature's flesh decays. The creature has disadvantage on Charisma checks "
            "and vulnerability to all damage.\n\n"
            "Mindfire. The creature's mind becomes feverish. The creature has disadvantage on "
            "Intelligence checks and Intelligence saving throws, and the creature behaves as if under "
            "the effects of the confusion spell during combat.\n\n"
            "Seizure. The creature is overcome with shaking. The creature has disadvantage on Dexterity "
            "checks, Dexterity saving throws, and attack rolls that use Dexterity.\n\n"
            "Slimy Doom. The creature begins to bleed uncontrollably. The creature has disadvantage on "
            "Constitution checks and Constitution saving throws. In addition, whenever the creature "
            "takes damage, it is stunned until the end of its next turn."
        ),
        "classes": ["cleric", "druid"],
    },
    {
        "id": "raise-dead",
        "name": "Raise Dead",
        "level": 5,
        "school": "necromancy",
        "castingTime": "1 hour",
        "range": "Touch",
        "components": "V, S, M (a diamond worth at least 500 gp, which the spell consumes)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You return a dead creature you touch to life, provided that it has been dead no longer "
            "than 10 days. If the creature's soul is both willing and at liberty to rejoin the body, "
            "the creature returns to life with 1 hit point.\n\n"
            "This spell also neutralizes any poisons and cures nonmagical diseases that affected the "
            "creature at the time it died. This spell doesn't, however, remove magical diseases, "
            "curses, or similar effects; if these aren't first removed prior to casting the spell, "
            "they take effect when the creature returns to life. The spell can't return an undead "
            "creature to life.\n\n"
            "This spell closes all mortal wounds, but it doesn't restore missing body parts. If the "
            "creature is lacking body parts or organs integral for its survival—its head, for "
            "instance—the spell automatically fails.\n\n"
            "Coming back from the dead is an ordeal. The target takes a −4 penalty to all attack "
            "rolls, saving throws, and ability checks. Every time the target finishes a long rest, "
            "the penalty is reduced by 1 until it disappears."
        ),
        "classes": ["bard", "cleric", "paladin"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "circle-of-death",
        "name": "Circle of Death",
        "level": 6,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (the powder of a crushed black pearl worth at least 500 gp)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "A sphere of negative energy ripples out in a 60-foot-radius sphere from a point within "
            "range. Each living creature in that area must make a Constitution saving throw. A target "
            "takes 8d6 necrotic damage on a failed save, or half as much damage on a successful one.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the "
            "damage increases by 2d6 for each slot level above 6th."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "create-undead",
        "name": "Create Undead",
        "level": 6,
        "school": "necromancy",
        "castingTime": "1 minute",
        "range": "10 feet",
        "components": "V, S, M (one clay pot filled with grave dirt, one clay pot filled with brackish water, and one 150 gp black onyx stone for each corpse)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You can cast this spell only at night. Choose up to three corpses of Medium or Small "
            "humanoids within range. Each corpse becomes a ghoul under your control. (The DM has game "
            "statistics for these creatures.)\n\n"
            "As a bonus action on each of your turns, you can mentally command any creature you animated "
            "with this spell if the creature is within 120 feet of you (if you control multiple "
            "creatures, you can command any or all of them at the same time, issuing the same command "
            "to each one). You decide what action the creature will take and where it will move during "
            "its next turn, or you can issue a general command, such as to guard a particular chamber "
            "or corridor. If you issue no commands, the creature only defends itself against hostile "
            "creatures. Once given an order, the creature continues to follow it until its task is "
            "complete.\n\n"
            "The creature is under your control for 24 hours, after which it stops obeying any command "
            "you have given it. To maintain control of the creature for another 24 hours, you must cast "
            "this spell on the creature before the current 24-hour period ends. This use of the spell "
            "reasserts your control over up to three creatures you have animated with this spell, "
            "rather than animating new ones.\n\n"
            "At Higher Levels. When you cast this spell using a 7th-level spell slot, you can animate "
            "or reassert control over four ghouls. When you cast this spell using an 8th-level spell "
            "slot, you can animate or reassert control over five ghouls or two ghasts or wights. When "
            "you cast this spell using a 9th-level spell slot, you can animate or reassert control "
            "over six ghouls, three ghasts or wights, or two mummies."
        ),
        "classes": ["cleric", "warlock", "wizard"],
    },
    {
        "id": "eyebite",
        "name": "Eyebite",
        "level": 6,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "For the spell's duration, your eyes become an inky void imbued with dread power. One "
            "creature of your choice within 60 feet of you that you can see must succeed on a Wisdom "
            "saving throw or be affected by one of the following effects of your choice for the "
            "duration. On each of your turns until the spell ends, you can use your action to target "
            "another creature but can't target a creature again if it has succeeded on a saving throw "
            "against this casting of eyebite.\n\n"
            "Asleep. The target falls unconscious. It wakes up if it takes any damage or if another "
            "creature uses its action to shake the sleeper awake.\n\n"
            "Panicked. The target is frightened of you. On each of its turns, the frightened creature "
            "must take the Dash action and move away from you by the safest and shortest available "
            "route, unless there is nowhere to move. If the target moves to a place at least 60 feet "
            "away from you where it can no longer see you, this effect ends.\n\n"
            "Sickened. The target has disadvantage on attack rolls and ability checks. At the end of "
            "each of its turns, it can make another Wisdom saving throw. If it succeeds, the effect "
            "ends."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "harm",
        "name": "Harm",
        "level": 6,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You unleash a virulent disease on a creature that you can see within range. The target "
            "must make a Constitution saving throw. On a failed save, it takes 14d6 necrotic damage, "
            "or half as much damage on a successful save. The damage can't reduce the target's hit "
            "points below 1. If the target fails the saving throw, its hit point maximum is reduced "
            "for 1 hour by an amount equal to the necrotic damage it took. Any effect that removes a "
            "disease allows a creature's hit point maximum to return to normal before that time passes."
        ),
        "classes": ["cleric"],
    },
    {
        "id": "magic-jar",
        "name": "Magic Jar",
        "level": 6,
        "school": "necromancy",
        "castingTime": "1 minute",
        "range": "Self",
        "components": "V, S, M (a gem, crystal, reliquary, or some other ornamental container worth at least 500 gp)",
        "duration": "Until dispelled",
        "concentration": False,
        "ritual": False,
        "description": (
            "Your body falls into a catatonic state as your soul leaves it and enters the container "
            "you used for the spell's material component. While your soul inhabits the container, you "
            "are aware of your surroundings as if you were in the container's space. You can't move or "
            "use reactions. The only action you can take is to project your soul up to 100 feet out of "
            "the container, either returning to your living body (and ending the spell) or attempting "
            "to possess a humanoid's body.\n\n"
            "You can attempt to possess any humanoid within 100 feet of you that you can see (creatures "
            "warded by a protection from evil and good or magic circle spell can't be possessed). The "
            "target must make a Charisma saving throw. On a failure, your soul moves into the target's "
            "body, and the target's soul becomes trapped in the container. On a success, the target "
            "resists your efforts to possess it, and you can't attempt to possess it again for 24 "
            "hours.\n\n"
            "Once you possess a creature's body, you control it. Your game statistics are replaced by "
            "the statistics of the creature, though you retain your alignment and your Intelligence, "
            "Wisdom, and Charisma scores. You retain the benefit of your own class features. If the "
            "target has any class levels, you can't use any of its class features.\n\n"
            "Meanwhile, the possessed creature's soul can perceive from the container using its own "
            "senses, but it can't move or take actions at all.\n\n"
            "While possessing a body, you can use your action to return from the host body to the "
            "container if it is within 100 feet of you, returning the host creature's soul to its "
            "body. The host creature is incapacitated for 1 minute upon returning to its body.\n\n"
            "If the host body dies while you're in it, the creature dies, and you must make a Charisma "
            "saving throw against your own spellcasting DC. On a success, you return to the container "
            "if it is within 100 feet of you. Otherwise, you die.\n\n"
            "If the container is destroyed or the spell ends, your soul immediately returns to your "
            "body. If your body is more than 100 feet away from you or if your body is dead when you "
            "attempt to return to it, you die. If another creature's soul is in the container when it "
            "is destroyed, the creature's soul returns to its body if the body is alive and within "
            "100 feet. Otherwise, that creature dies."
        ),
        "classes": ["wizard"],
    },

    # ── 7th Level ─────────────────────────────────────────────────────────────
    {
        "id": "finger-of-death",
        "name": "Finger of Death",
        "level": 7,
        "school": "necromancy",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You send negative energy coursing through a creature that you can see within range, "
            "causing it searing pain. The target must make a Constitution saving throw. It takes "
            "7d8 + 30 necrotic damage on a failed save, or half as much damage on a successful one.\n\n"
            "A humanoid killed by this spell rises at the start of your next turn as a zombie that is "
            "permanently under your command, following your verbal orders to the best of its ability."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "clone",
        "name": "Clone",
        "level": 8,
        "school": "necromancy",
        "castingTime": "1 hour",
        "range": "Touch",
        "components": "V, S, M (a diamond worth at least 1,000 gp and at least 1 cubic inch of flesh of the creature that is to be cloned, which the spell consumes, and a vessel worth at least 2,000 gp that has a sealable lid and is large enough to hold a Medium creature, such as a huge urn, coffin, mud-filled cyst in the ground, or crystal container filled with salt water)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell grows an inert duplicate of a living creature as a safeguard against death. "
            "This clone forms inside a sealed vessel and grows to full size and maturity after 120 "
            "days; you can also choose to have the clone be a younger version of the same creature. "
            "It remains inert and endures indefinitely, as long as its vessel remains undisturbed.\n\n"
            "At any time after the clone matures, if the original creature dies, its soul transfers "
            "to the clone, provided that the soul is free and willing to return. The clone is "
            "physically identical to the original and has the same personality, memories, and "
            "abilities, but none of the original's equipment. The original creature's physical "
            "remains, if they still exist, become inert and can't thereafter be restored to life, "
            "since the creature's soul is elsewhere."
        ),
        "classes": ["wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "astral-projection",
        "name": "Astral Projection",
        "level": 9,
        "school": "necromancy",
        "castingTime": "1 hour",
        "range": "10 feet",
        "components": "V, S, M (for each creature you affect with this spell, you must provide one jacinth worth at least 1,000 gp and one ornately carved bar of silver worth at least 100 gp, all of which the spell consumes)",
        "duration": "Special",
        "concentration": False,
        "ritual": False,
        "description": (
            "You and up to eight willing creatures within range project your astral bodies into the "
            "Astral Plane (the spell fails and the casting is wasted if you are already on that plane). "
            "The material body you leave behind is unconscious and in a state of suspended animation; "
            "it doesn't need food or air and doesn't age.\n\n"
            "Your astral body resembles your mortal form in almost every way, replicating your game "
            "statistics and possessions. The principal difference is the addition of a silvery cord "
            "that extends from between your shoulder blades and trails behind you, fading to "
            "invisibility after 1 foot. This cord is your tether to your material body. As long as "
            "the tether remains intact, you can find your way home. If the cord is cut—something that "
            "can happen only when an effect specifically states that it does—your soul and body are "
            "separated, killing you instantly.\n\n"
            "Your astral form can freely travel through the Astral Plane and can pass through portals "
            "there leading to any other plane. If you enter a new plane or return to the plane you "
            "were on when casting this spell, your body and possessions are transported along the "
            "silver cord, allowing you to re-enter your body as you enter the new plane. Your astral "
            "form is a separate incarnation. Any damage or other effects that apply to it have no "
            "effect on your physical body, nor do they persist when you return to it.\n\n"
            "The spell ends for you and your companions when you use your action to dismiss it. When "
            "the spell ends, the affected creature returns to its physical body, and it awakens.\n\n"
            "The spell might also end early for you or one of your companions. A successful dispel "
            "magic spell used against an astral or physical body ends the spell for that creature. "
            "If a creature's original body or its astral form drops to 0 hit points, the spell ends "
            "for that creature. If the spell ends and the silver cord is intact, the cord pulls the "
            "creature's astral form back to its body, ending its state of suspended animation.\n\n"
            "If you are returned to your body prematurely, your companions remain in their astral "
            "forms and must find their own way back to their bodies, usually by dropping to 0 hit "
            "points."
        ),
        "classes": ["cleric", "warlock", "wizard"],
    },
    {
        "id": "true-resurrection",
        "name": "True Resurrection",
        "level": 9,
        "school": "necromancy",
        "castingTime": "1 hour",
        "range": "Touch",
        "components": "V, S, M (a sprinkle of holy water and diamonds worth at least 25,000 gp, which the spell consumes)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You touch a creature that has been dead for no longer than 200 years and that died for "
            "any reason except old age. If the creature's soul is free and willing, the creature is "
            "restored to life with all its hit points.\n\n"
            "This spell closes all wounds, neutralizes any poison, cures all diseases, and lifts any "
            "curses affecting the creature when it died. The spell replaces damaged or missing organs "
            "and limbs. If the creature was undead, it is restored to its non-undead form.\n\n"
            "The spell can even provide a new body if the original no longer exists, in which case "
            "you must speak the creature's name. The creature then appears in an unoccupied space you "
            "choose within 10 feet of you."
        ),
        "classes": ["cleric", "druid"],
    },
]


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data.get("spells", [])}
    added = 0
    for spell in NECROMANCY_SPELLS:
        if spell["id"] not in existing_ids:
            data["spells"].append(spell)
            added += 1

    data["spells"].sort(key=lambda s: (s["level"], s["name"]))

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Added {added} necromancy spells. Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
