#!/usr/bin/env python3
"""Add SRD 5.1 conjuration spells to app/data/srd-5.1.json."""
import json, pathlib, copy

DATA_FILE = pathlib.Path(__file__).parent.parent / "app" / "data" / "srd-5.1.json"

CONJURATION_SPELLS = [
    # ── Cantrips ───────────────────────────────────────────────────────────────
    {
        "id": "acid-splash",
        "name": "Acid Splash",
        "level": 0,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You hurl a bubble of acid. Choose one creature within range, or choose two creatures "
            "within range that are within 5 feet of each other. A target must succeed on a Dexterity "
            "saving throw or take 1d6 acid damage.\n\n"
            "This spell's damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), "
            "and 17th level (4d6)."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "poison-spray",
        "name": "Poison Spray",
        "level": 0,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "10 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You extend your hand toward a creature you can see within range and project a puff of "
            "noxious gas from your palm. The creature must succeed on a Constitution saving throw or "
            "take 1d12 poison damage.\n\n"
            "This spell's damage increases by 1d12 when you reach 5th level (2d12), 11th level (3d12), "
            "and 17th level (4d12)."
        ),
        "classes": ["druid", "sorcerer", "warlock", "wizard"],
    },

    # ── 1st Level ─────────────────────────────────────────────────────────────
    {
        "id": "find-familiar",
        "name": "Find Familiar",
        "level": 1,
        "school": "conjuration",
        "castingTime": "1 hour",
        "range": "10 feet",
        "components": "V, S, M (10 gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": True,
        "description": (
            "You gain the service of a familiar, a spirit that takes an animal form you choose: bat, "
            "cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, "
            "raven, sea horse, spider, or weasel. Appearing in an unoccupied space within range, the "
            "familiar has the statistics of the chosen form, though it is a celestial, fey, or fiend "
            "(your choice) instead of a beast.\n\n"
            "Your familiar acts independently of you, but it always obeys your commands. In combat, it "
            "rolls its own initiative and acts on its own turn. A familiar can't attack, but it can take "
            "other actions as normal.\n\n"
            "When the familiar drops to 0 hit points, it disappears, leaving behind no physical form. "
            "It reappears after you cast this spell again. While your familiar is within 100 feet of "
            "you, you can communicate with it telepathically. Additionally, as an action, you can see "
            "through your familiar's eyes and hear what it hears until the start of your next turn, "
            "gaining the benefits of any special senses that the familiar has. During this time, you "
            "are deaf and blind with regard to your own senses.\n\n"
            "As an action, you can temporarily dismiss your familiar. It disappears into a pocket "
            "dimension where it awaits your summons. Alternatively, you can dismiss it forever. As an "
            "action while it is temporarily dismissed, you can cause it to reappear in any unoccupied "
            "space within 30 feet of you.\n\n"
            "You can't have more than one familiar at a time. If you cast this spell while you already "
            "have a familiar, you instead cause it to adopt a new form. Choose one of the forms from "
            "the above list. Your familiar transforms into the chosen creature.\n\n"
            "Finally, when you cast a spell with a range of touch, your familiar can deliver the spell "
            "as if it had cast the spell. Your familiar must be within 100 feet of you, and it must use "
            "its reaction to deliver the spell when you cast it."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "fog-cloud",
        "name": "Fog Cloud",
        "level": 1,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a 20-foot-radius sphere of fog centered on a point within range. The sphere "
            "spreads around corners, and its area is heavily obscured. It lasts for the duration or "
            "until a wind of moderate or greater speed (at least 10 miles per hour) disperses it.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, "
            "the radius of the fog increases by 20 feet for each slot level above 1st."
        ),
        "classes": ["druid", "ranger", "sorcerer", "wizard"],
    },
    {
        "id": "grease",
        "name": "Grease",
        "level": 1,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a bit of pork rind or butter)",
        "duration": "1 minute",
        "concentration": False,
        "ritual": False,
        "description": (
            "Slick grease covers the ground in a 10-foot square centered on a point within range and "
            "turns it into difficult terrain for the duration.\n\n"
            "When the grease appears, each creature standing in its area must succeed on a Dexterity "
            "saving throw or fall prone. A creature that enters the area or ends its turn there must "
            "also succeed on a Dexterity saving throw or fall prone."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "unseen-servant",
        "name": "Unseen Servant",
        "level": 1,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a piece of string and a bit of wood)",
        "duration": "1 hour",
        "concentration": False,
        "ritual": True,
        "description": (
            "This spell creates an invisible, mindless, shapeless, Medium force that performs simple "
            "tasks at your command until the spell ends. The servant springs into existence in an "
            "unoccupied space on the ground within range. It has AC 10, 1 hit point, and a Strength "
            "of 2, and it can't attack. If it drops to 0 hit points, the spell ends.\n\n"
            "Once on each of your turns as a bonus action, you can mentally command the servant to "
            "move up to 15 feet and interact with an object. The servant can perform simple tasks that "
            "a human servant could do, such as fetching things, cleaning, mending, folding clothes, "
            "lighting fires, serving food, and pouring wine. Once you give the command, the servant "
            "performs the task to the best of its ability until it completes the task, then waits for "
            "your next command.\n\n"
            "If you command the servant to perform a task that would move it more than 60 feet away "
            "from you, the spell ends."
        ),
        "classes": ["bard", "warlock", "wizard"],
    },

    # ── 2nd Level ─────────────────────────────────────────────────────────────
    {
        "id": "cloud-of-daggers",
        "name": "Cloud of Daggers",
        "level": 2,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a sliver of glass)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You fill the air in a 5-foot cube centered on a point you choose within range with "
            "spinning daggers. A creature takes 4d4 slashing damage when it enters the spell's area "
            "for the first time on a turn or starts its turn there.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, "
            "the damage increases by 2d4 for each slot level above 2nd."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "misty-step",
        "name": "Misty Step",
        "level": 2,
        "school": "conjuration",
        "castingTime": "1 bonus action",
        "range": "Self",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space "
            "that you can see."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "web",
        "name": "Web",
        "level": 2,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a bit of spiderweb)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You conjure a mass of thick, sticky webbing at a point of your choice within range. The "
            "webs fill a 20-foot cube from that point for the duration. The webs are difficult terrain "
            "and lightly obscure their area.\n\n"
            "If the webs aren't anchored between two solid masses (such as walls or trees) or layered "
            "across a floor, wall, or ceiling, the conjured web collapses on itself, and the spell ends "
            "at the start of your next turn. Webs layered over a flat surface have a depth of 5 feet.\n\n"
            "Each creature that starts its turn in the webs or that enters them during its turn must "
            "make a Dexterity saving throw. On a failed save, the creature is restrained as long as it "
            "remains in the webs or until it breaks free. A creature restrained by the webs can use "
            "its action to make a Strength check against your spell save DC. If it succeeds, it is no "
            "longer restrained.\n\n"
            "The webs are flammable. Any 5-foot cube of webs exposed to fire burns away in 1 round, "
            "dealing 2d4 fire damage to any creature that starts its turn in the fire."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 3rd Level ─────────────────────────────────────────────────────────────
    {
        "id": "call-lightning",
        "name": "Call Lightning",
        "level": 3,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "A storm cloud appears in the shape of a cylinder that is 10 feet tall with a 60-foot "
            "radius, centered on a point you can see above you. The spell fails if you can't see a "
            "point in the air where the storm cloud could appear (for example, if you are in a room "
            "that can't accommodate the cloud).\n\n"
            "When you cast the spell, choose a point you can see under the cloud. A bolt of lightning "
            "flashes down from the cloud to that point. Each creature within 5 feet of that point must "
            "make a Dexterity saving throw. A creature takes 3d10 lightning damage on a failed save, "
            "or half as much damage on a successful one. On each of your turns until the spell ends, "
            "you can use your action to call down lightning in this way again, targeting the same point "
            "or a different one.\n\n"
            "If you are outdoors in stormy conditions when you cast this spell, the spell gives you "
            "control over the existing storm instead of creating a new one. Under such conditions, the "
            "spell's damage increases by 1d10.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 4th or higher level, "
            "the damage increases by 1d10 for each slot level above 3rd."
        ),
        "classes": ["druid"],
    },
    {
        "id": "conjure-animals",
        "name": "Conjure Animals",
        "level": 3,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You summon fey spirits that take the form of beasts and appear in unoccupied spaces that "
            "you can see within range. Choose one of the following options for what appears:\n\n"
            "• One beast of challenge rating 2 or lower\n"
            "• Two beasts of challenge rating 1 or lower\n"
            "• Four beasts of challenge rating 1/2 or lower\n"
            "• Eight beasts of challenge rating 1/4 or lower\n\n"
            "Each beast is also considered fey, and it disappears when it drops to 0 hit points or "
            "when the spell ends. The summoned creatures are friendly to you and your companions. Roll "
            "initiative for the summoned creatures as a group, which has its own turns. They obey any "
            "verbal commands that you issue to them (no action required by you). If you don't issue any "
            "commands to them, they defend themselves from hostile creatures, but otherwise take no "
            "actions. The DM has the creatures' statistics.\n\n"
            "At Higher Levels. When you cast this spell using certain higher-level spell slots, you "
            "choose one of the summoning options above, and more creatures appear: twice as many with "
            "a 5th-level slot, three times as many with a 7th-level slot, and four times as many with "
            "a 9th-level slot."
        ),
        "classes": ["druid", "ranger"],
    },
    {
        "id": "create-food-and-water",
        "name": "Create Food and Water",
        "level": 3,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "30 feet",
        "components": "V, S",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create 45 pounds of food and 30 gallons of water on the ground or in containers "
            "within range, enough to sustain up to fifteen humanoids or five steeds for 24 hours. "
            "The food is bland but nourishing, and spoils if uneaten after 24 hours. The water is "
            "clean and doesn't go bad."
        ),
        "classes": ["cleric", "paladin"],
    },
    {
        "id": "sleet-storm",
        "name": "Sleet Storm",
        "level": 3,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M (a pinch of dust and a few drops of water)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Until the spell ends, freezing rain and sleet fall in a 20-foot-tall cylinder with a "
            "40-foot radius centered on a point you choose within range. The area is heavily obscured, "
            "and exposed flames in the area are doused.\n\n"
            "The ground in the area is covered with slick ice, making it difficult terrain. When a "
            "creature enters the spell's area for the first time on a turn or starts its turn there, "
            "it must make a Dexterity saving throw. On a failed save, it falls prone.\n\n"
            "If a creature is concentrating in the spell's area, the creature must make a successful "
            "Constitution saving throw against your spell save DC or lose concentration."
        ),
        "classes": ["druid", "sorcerer", "wizard"],
    },
    {
        "id": "stinking-cloud",
        "name": "Stinking Cloud",
        "level": 3,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (a rotten egg or several skunk cabbage leaves)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a 20-foot-radius sphere of yellow, nauseating gas centered on a point within "
            "range. The cloud spreads around corners, and its area is heavily obscured. The cloud "
            "lingers in the air for the duration.\n\n"
            "Each creature that is completely within the cloud at the start of its turn must make a "
            "Constitution saving throw against poison. On a failed save, the creature spends its action "
            "that turn retching and reeling. Creatures that don't need to breathe or are immune to "
            "poison automatically succeed on this saving throw.\n\n"
            "A moderate wind (at least 10 miles per hour) disperses the cloud after 4 rounds. A strong "
            "wind (at least 20 miles per hour) disperses it after 1 round."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 4th Level ─────────────────────────────────────────────────────────────
    {
        "id": "conjure-minor-elementals",
        "name": "Conjure Minor Elementals",
        "level": 4,
        "school": "conjuration",
        "castingTime": "1 minute",
        "range": "90 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You summon elementals that appear in unoccupied spaces that you can see within range. "
            "Choose one of the following options for what appears:\n\n"
            "• One elemental of challenge rating 2 or lower\n"
            "• Two elementals of challenge rating 1 or lower\n"
            "• Four elementals of challenge rating 1/2 or lower\n"
            "• Eight elementals of challenge rating 1/4 or lower\n\n"
            "An elemental summoned by this spell disappears when it drops to 0 hit points or when the "
            "spell ends. The summoned creatures are friendly to you and your companions. Roll initiative "
            "for the summoned creatures as a group, which has its own turns. They obey any verbal "
            "commands that you issue to them (no action required by you). If you don't issue any "
            "commands to them, they defend themselves from hostile creatures but otherwise take no "
            "actions. The DM has the creatures' statistics.\n\n"
            "At Higher Levels. When you cast this spell using certain higher-level spell slots, you "
            "choose one of the summoning options above, and more creatures appear: twice as many with "
            "a 6th-level slot, three times as many with an 8th-level slot, and four times as many "
            "with a 9th-level slot."
        ),
        "classes": ["druid", "wizard"],
    },
    {
        "id": "conjure-woodland-beings",
        "name": "Conjure Woodland Beings",
        "level": 4,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (one holly berry per creature summoned)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You summon fey creatures that appear in unoccupied spaces that you can see within range. "
            "Choose one of the following options for what appears:\n\n"
            "• One fey creature of challenge rating 2 or lower\n"
            "• Two fey creatures of challenge rating 1 or lower\n"
            "• Four fey creatures of challenge rating 1/2 or lower\n"
            "• Eight fey creatures of challenge rating 1/4 or lower\n\n"
            "A summoned creature disappears when it drops to 0 hit points or when the spell ends. The "
            "summoned creatures are friendly to you and your companions. Roll initiative for the "
            "summoned creatures as a group, which has its own turns. They obey any verbal commands that "
            "you issue to them (no action required by you). If you don't issue any commands to them, "
            "they defend themselves from hostile creatures, but otherwise take no actions. The DM has "
            "the creatures' statistics.\n\n"
            "At Higher Levels. When you cast this spell using certain higher-level spell slots, you "
            "choose one of the summoning options above, and more creatures appear: twice as many with "
            "a 6th-level slot, three times as many with an 8th-level slot, and four times as many "
            "with a 9th-level slot."
        ),
        "classes": ["druid", "ranger"],
    },
    {
        "id": "dimension-door",
        "name": "Dimension Door",
        "level": 4,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "500 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You teleport yourself from your current location to any other spot within range. You "
            "arrive at exactly the spot desired. It can be a place you can see, one you can visualize, "
            "or one you can describe by stating distance and direction, such as \"200 feet straight "
            "downward\" or \"upward to the northwest at a 45-degree angle, 300 feet.\"\n\n"
            "You can bring along objects as long as their weight doesn't exceed what you can carry. "
            "You can also bring one willing creature of your size or smaller who is carrying gear up "
            "to its carrying capacity. The creature must be within 5 feet of you when you cast this "
            "spell.\n\n"
            "If you would arrive in a place already occupied by an object or a creature, you and any "
            "creature traveling with you each take 4d6 force damage, and the spell fails to teleport you."
        ),
        "classes": ["bard", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "evards-black-tentacles",
        "name": "Evard's Black Tentacles",
        "level": 4,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "90 feet",
        "components": "V, S, M (a piece of tentacle from a giant octopus or a giant squid)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. "
            "For the duration, these tentacles turn the ground in the area into difficult terrain.\n\n"
            "When a creature enters the affected area for the first time on a turn or starts its turn "
            "there, the creature must succeed on a Dexterity saving throw or take 3d6 bludgeoning "
            "damage and be restrained by the tentacles until the spell ends. A creature that starts "
            "its turn in the area and is already restrained by the tentacles takes 3d6 bludgeoning "
            "damage.\n\n"
            "A creature restrained by the tentacles can use its action to make a Strength or Dexterity "
            "check (its choice) against your spell save DC. On a success, it frees itself."
        ),
        "classes": ["wizard"],
    },
    {
        "id": "leomunds-secret-chest",
        "name": "Leomund's Secret Chest",
        "level": 4,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (an exquisite chest, 3 feet by 2 feet by 2 feet constructed from rare materials worth at least 5,000 gp, and a Tiny replica made from the same materials worth at least 50 gp)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You hide a chest, and all its contents, on the Ethereal Plane. You must touch the chest "
            "and the miniature replica that serves as a material component for the spell. The chest "
            "can contain up to 12 cubic feet of nonliving material (3 feet by 2 feet by 2 feet).\n\n"
            "While the chest remains on the Ethereal Plane, you can use an action and touch the "
            "replica to recall the chest. It appears in an unoccupied space on the ground within 5 "
            "feet of you. You can send the chest back to the Ethereal Plane by using an action and "
            "touching both the chest and the replica.\n\n"
            "After 60 days, there is a cumulative 5 percent chance per day that the spell's effect "
            "ends. This effect ends if you cast this spell again, if the smaller replica chest is "
            "destroyed, or if you choose to end the spell as an action. If the spell ends and the "
            "larger chest is on the Ethereal Plane, it is irretrievably lost."
        ),
        "classes": ["wizard"],
    },

    # ── 5th Level ─────────────────────────────────────────────────────────────
    {
        "id": "cloudkill",
        "name": "Cloudkill",
        "level": 5,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "120 feet",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create a 20-foot-radius sphere of poisonous, yellow-green fog centered on a point "
            "you choose within range. The fog spreads around corners. It lasts for the duration or "
            "until strong wind disperses the fog, ending the spell. Its area is heavily obscured.\n\n"
            "When a creature enters the spell's area for the first time on a turn or starts its turn "
            "there, that creature must make a Constitution saving throw. The creature takes 5d8 poison "
            "damage on a failed save, or half as much damage on a successful one. Creatures are "
            "affected even if they hold their breath or don't need to breathe.\n\n"
            "The fog moves 10 feet away from you at the start of each of your turns, rolling along "
            "the surface of the ground. The vapors, being heavier than air, sink to the lowest level "
            "of the land, even pouring down openings.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, "
            "the damage increases by 1d8 for each slot level above 5th."
        ),
        "classes": ["sorcerer", "wizard"],
    },
    {
        "id": "conjure-elemental",
        "name": "Conjure Elemental",
        "level": 5,
        "school": "conjuration",
        "castingTime": "1 minute",
        "range": "90 feet",
        "components": "V, S, M (burning incense for air, soft clay for earth, sulfur and phosphorus for fire, or water and sand for water)",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You call forth an elemental servant. Choose an area of air, earth, fire, or water that "
            "fills a 10-foot cube within range. An elemental of challenge rating 5 or lower appropriate "
            "to the area you chose appears in an unoccupied space within 10 feet of it. For example, "
            "a fire elemental emerges from a bonfire, and an earth elemental rises up from the ground. "
            "The elemental disappears when it drops to 0 hit points or when the spell ends.\n\n"
            "The elemental is friendly to you and your companions for the duration. Roll initiative for "
            "the elemental, which has its own turns. It obeys any verbal commands that you issue to it "
            "(no action required by you). If you don't issue any commands to the elemental, it defends "
            "itself from hostile creatures but otherwise takes no actions.\n\n"
            "If your concentration is broken, the elemental doesn't disappear. Instead, you lose "
            "control of the elemental, it becomes hostile toward you and your companions, and it might "
            "attack. An uncontrolled elemental can't be dismissed by you, and it disappears 1 hour "
            "after you summoned it. The DM has the elemental's statistics.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, "
            "the challenge rating increases by 1 for each slot level above 5th."
        ),
        "classes": ["druid", "wizard"],
    },
    {
        "id": "insect-plague",
        "name": "Insect Plague",
        "level": 5,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "300 feet",
        "components": "V, S, M (a few grains of sugar, some kernels of grain, and a smear of fat)",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "Swarming, biting locusts fill a 20-foot-radius sphere centered on a point you choose "
            "within range. The sphere spreads around corners. The sphere remains for the duration, "
            "and its area is lightly obscured. The sphere's area is difficult terrain.\n\n"
            "When the area appears, each creature in it must make a Constitution saving throw. A "
            "creature takes 4d10 piercing damage on a failed save, or half as much damage on a "
            "successful one. A creature must also make this saving throw when it enters the spell's "
            "area for the first time on a turn or ends its turn there.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, "
            "the damage increases by 1d10 for each slot level above 5th."
        ),
        "classes": ["cleric", "druid", "sorcerer"],
    },
    {
        "id": "teleportation-circle",
        "name": "Teleportation Circle",
        "level": 5,
        "school": "conjuration",
        "castingTime": "1 minute",
        "range": "10 feet",
        "components": "V, M (rare chalks and inks infused with precious gems worth 50 gp, which the spell consumes)",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "As you cast the spell, you draw a 10-foot-diameter circle on the ground inscribed with "
            "sigils that link your location to a permanent teleportation circle of your choice whose "
            "sigil sequence you know and that is on the same plane of existence as you. A shimmering "
            "portal opens within the circle you drew and remains open until the end of your next turn. "
            "Any creature that enters the portal is instantly transported to the destination "
            "teleportation circle.\n\n"
            "Many major temples, guilds, and other important places have permanent teleportation "
            "circles inscribed somewhere within their confines. Each such circle includes a unique "
            "sigil sequence — a string of magical runes arranged in a specific pattern. When you first "
            "gain the ability to cast this spell, you learn the sigil sequences for two destinations "
            "on the Material Plane, determined by the DM. You can learn additional sigil sequences "
            "during your adventures. You can commit a new sigil sequence to memory after studying it "
            "for 1 minute.\n\n"
            "You can also make a permanent teleportation circle by casting this spell in the same "
            "location every day for one year. You need not use the circle to teleport when you cast "
            "the spell in this way."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 6th Level ─────────────────────────────────────────────────────────────
    {
        "id": "arcane-gate",
        "name": "Arcane Gate",
        "level": 6,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "500 feet",
        "components": "V, S",
        "duration": "Concentration, up to 10 minutes",
        "concentration": True,
        "ritual": False,
        "description": (
            "You create linked teleportation portals that remain open for the duration. Choose two "
            "points on the ground that you can see, one point within 10 feet of you and one point "
            "within 500 feet of you. A circular portal, 10 feet in diameter, opens over each point. "
            "Any creature or object entering one portal exits from the other portal as if the two "
            "were adjacent to each other; passing through a portal from the nonportal side has no "
            "effect. The ring of each portal faces the other portal."
        ),
        "classes": ["sorcerer", "warlock", "wizard"],
    },
    {
        "id": "conjure-fey",
        "name": "Conjure Fey",
        "level": 6,
        "school": "conjuration",
        "castingTime": "1 minute",
        "range": "90 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 hour",
        "concentration": True,
        "ritual": False,
        "description": (
            "You summon a fey creature of challenge rating 6 or lower, or a fey spirit that takes the "
            "form of a beast of challenge rating 6 or lower. It appears in an unoccupied space that "
            "you can see within range. The fey creature disappears when it drops to 0 hit points or "
            "when the spell ends.\n\n"
            "The fey creature is friendly to you and your companions for the duration. Roll initiative "
            "for the creature, which has its own turns. It obeys any verbal commands that you issue to "
            "it (no action required by you), as long as they don't violate its alignment. If you don't "
            "issue any commands to the fey creature, it defends itself from hostile creatures but "
            "otherwise takes no actions.\n\n"
            "If your concentration is broken, the fey creature doesn't disappear. Instead, you lose "
            "control of the fey creature, it becomes hostile toward you and your companions, and it "
            "might attack. An uncontrolled fey creature can't be dismissed by you, and it disappears "
            "1 hour after you summoned it. The DM has the creature's statistics.\n\n"
            "At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, "
            "the challenge rating increases by 1 for each slot level above 6th."
        ),
        "classes": ["druid", "warlock"],
    },
    {
        "id": "transport-via-plants",
        "name": "Transport via Plants",
        "level": 6,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "10 feet",
        "components": "V, S",
        "duration": "1 round",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell creates a magical link between a Large or larger inanimate plant within range "
            "and another plant, at any distance, on the same plane of existence. You must have seen "
            "or touched the destination plant at least once before. For the duration, any creature can "
            "step into the target plant and exit from the destination plant by using 5 feet of movement."
        ),
        "classes": ["druid"],
    },
    {
        "id": "word-of-recall",
        "name": "Word of Recall",
        "level": 6,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "5 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You and up to five willing creatures of your choice within 5 feet of you instantly "
            "teleport to a previously designated sanctuary. You and any creatures that teleport with "
            "you appear in the nearest unoccupied space to the spot you designated when you prepared "
            "this spell's sanctuary (see below).\n\n"
            "If you cast this spell without first preparing a sanctuary, the spell has no effect. "
            "You must designate a sanctuary by casting this spell within a location, such as a temple, "
            "dedicated to or strongly linked with your deity. If you attempt to send the group to a "
            "sanctuary in a different plane of existence than the one you're on, there is a 25 percent "
            "chance that everyone is instead transported to a random location on that plane."
        ),
        "classes": ["cleric"],
    },

    # ── 7th Level ─────────────────────────────────────────────────────────────
    {
        "id": "plane-shift",
        "name": "Plane Shift",
        "level": 7,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "Touch",
        "components": "V, S, M (a forked, metal rod worth at least 250 gp, attuned to a specific plane of existence)",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "You and up to eight willing creatures who link hands in a circle are transported to a "
            "different plane of existence. You can specify a target destination in general terms, such "
            "as the City of Brass on the Elemental Plane of Fire or the palace of Dispater on the "
            "second level of the Nine Hells, and you appear in or near that destination. If you are "
            "trying to reach the City of Brass, for example, you might arrive in its streets, a random "
            "building, or if the DM decides, in front of Dispater's palace.\n\n"
            "Alternatively, if you know the sigil sequence of a teleportation circle on another plane "
            "of existence, you can use that as your means of transporting your group directly to that "
            "circle. A teleportation circle must be at least the same diameter as a Large creature to "
            "be usable for this purpose.\n\n"
            "If you attempt to send a creature with this spell, the target must be within reach and "
            "it must make a Charisma saving throw. On a failed save, the creature is transported to a "
            "random location on the plane you specify. A creature so transported must find its own way "
            "back to your current plane of existence."
        ),
        "classes": ["cleric", "druid", "sorcerer", "warlock", "wizard"],
    },
    {
        "id": "teleport",
        "name": "Teleport",
        "level": 7,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "10 feet",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "This spell instantly transports you and up to eight willing creatures of your choice "
            "that you can see within range, or a single object that you can see within range, to a "
            "destination you select. If you target an object, it must be able to fit entirely inside "
            "a 10-foot cube, and it can't be held or carried by an unwilling creature. The destination "
            "you choose must be known to you, and it must be on the same plane of existence as you.\n\n"
            "Your familiarity with the destination determines whether you arrive there successfully. "
            "The DM rolls d100 and consults the table:\n\n"
            "Familiarity — Mishap / Similar Area / Off Target / On Target\n"
            "Permanent circle — — — 01–100\n"
            "Associated object — — — 01–100\n"
            "Very familiar — 01–05 / 06–13 / 14–24 / 25–100\n"
            "Seen casually — 01–33 / 34–43 / 44–53 / 54–100\n"
            "Viewed once — 01–43 / 44–53 / 54–73 / 74–100\n"
            "Description — 01–43 / 44–53 / 54–73 / 74–100\n"
            "False destination — 01–50 / 51–100 / — / —\n\n"
            "On Target: You and your group appear where you want to.\n"
            "Off Target: You and your group appear a random distance away from the destination in a "
            "random direction.\n"
            "Similar Area: You and your group find yourselves in a different area that's visually or "
            "thematically similar to the target area.\n"
            "Mishap: The spell's unpredictable magic results in a difficult journey. Each teleporting "
            "creature (or the target object) takes 3d10 force damage, and the DM rerolls on the table "
            "to see where you end up (multiple mishaps can occur, dealing damage each time)."
        ),
        "classes": ["bard", "sorcerer", "wizard"],
    },

    # ── 8th Level ─────────────────────────────────────────────────────────────
    {
        "id": "demiplane",
        "name": "Demiplane",
        "level": 8,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "S",
        "duration": "1 hour",
        "concentration": False,
        "ritual": False,
        "description": (
            "You create a shadowy door on a flat solid surface that you can see within range. The door "
            "is large enough to allow Medium creatures to pass through unhindered. When opened, the "
            "door leads to a demiplane that appears to be an empty room 30 feet in each dimension, "
            "made of wood or stone. When the spell ends, the door disappears, and any creatures or "
            "objects inside the demiplane remain trapped there, as the door also disappears from the "
            "other side.\n\n"
            "Each time you cast this spell, you can create a new demiplane, or have the shadowy door "
            "connect to a demiplane you created with a previous casting of this spell. Additionally, "
            "if you know the nature and contents of a demiplane created by a casting of this spell by "
            "another creature, you can have the shadowy door connect to its demiplane instead."
        ),
        "classes": ["warlock", "wizard"],
    },
    {
        "id": "incendiary-cloud",
        "name": "Incendiary Cloud",
        "level": 8,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "A swirling cloud of smoke shot through with white-hot embers appears in a 20-foot-radius "
            "sphere centered on a point within range. The cloud spreads around corners and is heavily "
            "obscured. It lasts for the duration or until a wind of moderate or greater speed (at "
            "least 10 miles per hour) disperses it.\n\n"
            "When the cloud appears, each creature in it must make a Dexterity saving throw. A "
            "creature takes 10d8 fire damage on a failed save, or half as much damage on a successful "
            "one. A creature must also make this saving throw when it enters the spell's area for the "
            "first time on a turn or ends its turn there.\n\n"
            "The cloud moves 10 feet directly away from you in a direction that you choose at the "
            "start of each of your turns."
        ),
        "classes": ["sorcerer", "wizard"],
    },

    # ── 9th Level ─────────────────────────────────────────────────────────────
    {
        "id": "gate",
        "name": "Gate",
        "level": 9,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "60 feet",
        "components": "V, S, M (a diamond worth at least 5,000 gp)",
        "duration": "Concentration, up to 1 minute",
        "concentration": True,
        "ritual": False,
        "description": (
            "You conjure a portal linking an unoccupied space you can see within range to a precise "
            "location on a different plane of existence. The portal is a circular opening, which you "
            "can make 5 to 20 feet in diameter. You can orient the portal in any direction you choose. "
            "The portal lasts for the duration.\n\n"
            "The portal has a front and a back on each plane where it appears. Travel through the "
            "portal is possible only by moving through its front. Anything that does so is instantly "
            "transported to the other plane, appearing in the unoccupied space nearest to the portal.\n\n"
            "Deities and other planar rulers can prevent portals created by this spell from opening "
            "in their presence or anywhere within their domain.\n\n"
            "When you cast this spell, you can speak the name of a specific creature (a pseudonym, "
            "title, or nickname doesn't work). If that creature is on a plane other than the one you "
            "are on, the portal opens next to the named creature and draws the creature through it to "
            "the nearest unoccupied space on your side of the portal. You gain no special power over "
            "the creature, and it is free to act as the DM deems appropriate. It might leave, attack "
            "you, or help you."
        ),
        "classes": ["cleric", "sorcerer", "wizard"],
    },
    {
        "id": "wish",
        "name": "Wish",
        "level": 9,
        "school": "conjuration",
        "castingTime": "1 action",
        "range": "Self",
        "components": "V",
        "duration": "Instantaneous",
        "concentration": False,
        "ritual": False,
        "description": (
            "Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you "
            "can alter the very foundations of reality in accord with your desires.\n\n"
            "The basic use of this spell is to duplicate any other spell of 8th level or lower. You "
            "don't need to meet any requirements in that spell, including costly components. The spell "
            "simply takes effect.\n\n"
            "Alternatively, you can create one of the following effects of your choice:\n\n"
            "• You create one object of up to 25,000 gp in value that isn't a magic item. The object "
            "can be no more than 300 feet in any dimension, and it appears in an unoccupied space you "
            "can see on the ground.\n"
            "• You allow up to twenty creatures that you can see to regain all hit points, and you end "
            "all effects on them described in the greater restoration spell.\n"
            "• You grant up to ten creatures that you can see resistance to a damage type you choose.\n"
            "• You grant up to ten creatures you can see immunity to a single spell or other magical "
            "effect for 8 hours.\n"
            "• You undo a single recent event by forcing a reroll of any roll made within the last "
            "round (including your last turn). Reality reshapes itself to accommodate the new result. "
            "You can force the reroll to be made with advantage or disadvantage, and you can choose "
            "whether to use the reroll or the original roll.\n\n"
            "You might be able to achieve something beyond the scope of the above examples. State your "
            "wish to the DM as precisely as possible. The DM has great latitude in ruling what occurs "
            "in such an instance; the greater the wish, the greater the likelihood that something goes "
            "wrong.\n\n"
            "The stress of casting this spell to produce any effect other than duplicating another "
            "spell weakens you. After enduring that stress, each time you cast a spell until you "
            "finish a long rest, you take 1d10 necrotic damage per level of that spell. This damage "
            "can't be reduced or prevented in any way. In addition, your Strength drops to 3, if it "
            "isn't 3 or lower already, for 2d4 days. Finally, there is a 33 percent chance that you "
            "are unable to cast wish ever again if you suffer this weakening."
        ),
        "classes": ["sorcerer", "wizard"],
    },
]


def main():
    with open(DATA_FILE) as f:
        data = json.load(f)

    existing_ids = {s["id"] for s in data["spells"]}
    added, skipped = 0, 0
    for spell in CONJURATION_SPELLS:
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

    print(f"Added {added} conjuration spells (skipped {skipped} duplicates). "
          f"Total spells: {len(data['spells'])}")


if __name__ == "__main__":
    main()
