import type { Character, AbilityKey, SpellSlotLevel } from '~/types/character'
import type { Rulepack, OptionalClassFeature, FeatDefinition, FeatPrerequisite } from '~/types/rulepack'
import type {
  LevelUpEvent,
  AutomaticLevelUpEvent,
  ChoiceLevelUpEvent,
  AddHpEvent,
  AddFeatureEvent,
  GainProficiencyEvent,
  UpdateSpellSlotsEvent,
  UpdateWarlockSlotsEvent,
  UpdateHitDieEvent,
  ResolvedChoice,
} from '~/types/events'

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Returns true if the character satisfies all machine-checkable prerequisites for the given feat.
 * Always returns true for feats without a prerequisiteCheck.
 */
export function checkFeatPrerequisite(character: Character, feat: FeatDefinition): boolean {
  const check: FeatPrerequisite | undefined = feat.prerequisiteCheck
  if (!check) return true
  if (check.minAbilityScore) {
    for (const [ability, min] of Object.entries(check.minAbilityScore)) {
      if ((character.abilityScores[ability as AbilityKey] ?? 0) < (min ?? 0)) return false
    }
  }
  if (check.spellcasting && !character.spellcastingAbility) return false
  if (check.proficiency) {
    const hasAny = check.proficiency.some(p =>
      character.otherProficiencies.some(op => op.toLowerCase() === p.toLowerCase()),
    )
    if (!hasAny) return false
  }
  return true
}

// Feature names in class level tables that are placeholders for subclass features
const SUBCLASS_PLACEHOLDER_PATTERN = /\bpath\b|\barchetype\b|\bpatron\b|\bcircle\b|\bdomain\b|\bcollege\b|\bprimal path feature\b|\bsacred oath feature\b|\bwarlord presence\b| feature$/i

function isSubclassPlaceholder(featureName: string): boolean {
  return SUBCLASS_PLACEHOLDER_PATTERN.test(featureName)
}

function parseDieSides(die: string): number {
  const match = die.match(/d(\d+)/)
  return (match && match[1]) ? parseInt(match[1]) : 8
}

export function resolveLevelUpEvents(
  character: Character,
  classId: string,
  newLevel: number,
  rulepack: Rulepack,
  optionalFeatures: Array<OptionalClassFeature & { sourceName: string }> = [],
): LevelUpEvent[] {
  const classDef = rulepack.classes.find(c => c.id === classId)
  if (!classDef) return []

  const levelData = classDef.levels.find(l => l.level === newLevel)
  if (!levelData) return []

  const events: LevelUpEvent[] = []
  const hitDieSides = parseDieSides(classDef.hitDie)
  const conMod = Math.floor((character.abilityScores.con - 10) / 2)
  const conBonus = Math.max(conMod, -5)

  // Always add HP event
  const roll = rollDie(hitDieSides)
  const average = Math.floor(hitDieSides / 2) + 1
  const max = hitDieSides
  events.push({
    type: 'ADD_HP',
    roll,
    average,
    max,
    conBonus,
    hpFlatBonus: character.hpBonusPerLevel ?? 0,
  } satisfies AddHpEvent)

  // Update hit die tracking
  events.push({
    type: 'UPDATE_HIT_DIE',
    die: classDef.hitDie,
    totalDice: character.hitDice.total + 1,
  } satisfies UpdateHitDieEvent)

  // Spell slots — pact magic classes (warlock) get separate warlock slots; regular casters
  // use delta vs. previous level so manual overrides (e.g. magic items) are preserved
  if (levelData.spellSlots) {
    if (classDef.pactMagic) {
      // Warlock pact magic: all slots are the same level — take absolute values, not deltas
      const entries = Object.entries(levelData.spellSlots)
      if (entries.length > 0) {
        const [slotLvlStr, count] = entries.at(-1)! // highest (and only) key
        events.push({
          type: 'UPDATE_WARLOCK_SLOTS',
          slotLevel: Number.parseInt(slotLvlStr) as SpellSlotLevel,
          max: count ?? 0,
        } satisfies UpdateWarlockSlotsEvent)
      }
    }
    else {
      const prevLevelData = classDef.levels.find(l => l.level === newLevel - 1)
      const prevSlots = (prevLevelData?.spellSlots ?? {}) as Record<string, number>
      const delta: Partial<Record<SpellSlotLevel, number>> = {}
      for (const [slotLvlStr, newCount] of Object.entries(levelData.spellSlots)) {
        const diff = (newCount ?? 0) - (prevSlots[slotLvlStr] ?? 0)
        if (diff > 0) delta[parseInt(slotLvlStr) as SpellSlotLevel] = diff
      }
      if (Object.keys(delta).length > 0) {
        events.push({ type: 'UPDATE_SPELL_SLOTS', slots: delta } satisfies UpdateSpellSlotsEvent)
      }
    }
  }

  // Features — look up subclass definition for this character's subclass (if any)
  const subclassId = character.classes.find(c => c.classId === classId)?.subclassId
  const subclassDef = subclassId
    ? rulepack.classes.flatMap(c => c.subclasses ?? []).find(s => s.id === subclassId)
    : undefined
  const subclassLevelData = subclassDef?.levels.find(l => l.level === newLevel)
  const subclassLevelFeatures = subclassLevelData?.features ?? []
  const subclassLevelEvents = subclassLevelData?.levelUpEvents ?? []
  // Track which level-data feature names are placeholders replaced by subclass features
  const hasSubclassFeatures = subclassLevelFeatures.length > 0

  for (const featureName of levelData.features) {
    // Skip generic "Primal Path Feature" style placeholders when we have real subclass features
    if (hasSubclassFeatures && isSubclassPlaceholder(featureName)) continue

    events.push({
      type: 'ADD_FEATURE',
      feature: {
        id: `${classId}-${featureName.toLowerCase().replace(/\s+/g, '-')}-${newLevel}`,
        name: featureName,
        source: `${classDef.name} ${newLevel}`,
        description: '',
      },
    } satisfies AddFeatureEvent)
  }

  // Add the actual subclass features for this level (if character already has a subclass)
  for (const feat of subclassLevelFeatures) {
    events.push({
      type: 'ADD_FEATURE',
      feature: {
        id: `${subclassId}-${feat.name.toLowerCase().replaceAll(' ', '-')}-${newLevel}`,
        name: feat.name,
        source: subclassDef!.name,
        description: feat.description,
        usesMax: feat.usesMax,
        recharge: feat.recharge,
      },
    } satisfies AddFeatureEvent)
  }

  // Process levelUpEvents from the rulepack definition
  for (const eventDef of levelData.levelUpEvents) {
    switch (eventDef.type) {
      case 'ADD_FEATURE':
        // Already handled above via feature names; skip duplicate
        break
      case 'UPDATE_SPELL_SLOTS':
        // Already handled above
        break
      case 'GAIN_PROFICIENCY':
        events.push({
          type: 'GAIN_PROFICIENCY',
          proficiency: eventDef.proficiency,
          category: 'skill',
        } satisfies GainProficiencyEvent)
        break
      case 'CHOOSE_SPELL':
        events.push({
          type: 'CHOOSE_SPELL',
          count: eventDef.count,
          cantrip: eventDef.cantrip ?? false,
          fromList: eventDef.fromList,
        })
        break
      case 'CHOOSE_FEAT':
        events.push({ type: 'CHOOSE_FEAT' })
        break
      case 'ABILITY_SCORE_IMPROVEMENT':
        events.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
        break
      case 'CHOOSE_SUBCLASS':
        if (character.classes.find(c => c.classId === classId)?.subclassId === undefined) {
          events.push({ type: 'CHOOSE_SUBCLASS', label: eventDef.label })
        }
        break
      case 'CHOOSE_OPTION':
        events.push({ type: 'CHOOSE_OPTION', id: eventDef.id, label: eventDef.label, options: eventDef.options })
        break
    }
  }

  // Process levelUpEvents defined on the subclass level (e.g. totem/archetype choices)
  for (const eventDef of subclassLevelEvents) {
    switch (eventDef.type) {
      case 'CHOOSE_OPTION':
        events.push({ type: 'CHOOSE_OPTION', id: eventDef.id, label: eventDef.label, options: eventDef.options })
        break
      case 'CHOOSE_SPELL':
        events.push({
          type: 'CHOOSE_SPELL',
          count: eventDef.count,
          cantrip: eventDef.cantrip ?? false,
          fromList: eventDef.fromList,
        })
        break
      case 'GAIN_PROFICIENCY':
        events.push({
          type: 'GAIN_PROFICIENCY',
          proficiency: eventDef.proficiency,
          category: 'skill',
        } satisfies GainProficiencyEvent)
        break
      case 'ABILITY_SCORE_IMPROVEMENT':
        events.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
        break
    }
  }

  // Offer optional features from supplemental rulepacks (e.g. Tasha's optional class features)
  if (optionalFeatures.length > 0) {
    events.push({ type: 'OFFER_OPTIONAL_FEATURES', features: optionalFeatures })
  }

  return events
}

export function isChoiceEvent(event: LevelUpEvent): event is ChoiceLevelUpEvent {
  return ['CHOOSE_SPELL', 'CHOOSE_FEAT', 'ABILITY_SCORE_IMPROVEMENT', 'CHOOSE_SUBCLASS', 'CHOOSE_SKILL', 'CHOOSE_OPTION', 'OFFER_OPTIONAL_FEATURES'].includes(event.type)
}

export function getChoiceEvents(events: LevelUpEvent[]): ChoiceLevelUpEvent[] {
  return events.filter(isChoiceEvent) as ChoiceLevelUpEvent[]
}

export function getAutomaticEvents(events: LevelUpEvent[]): AutomaticLevelUpEvent[] {
  return events.filter(e => !isChoiceEvent(e)) as AutomaticLevelUpEvent[]
}

export function applyAutomaticEvents(
  character: Character,
  events: AutomaticLevelUpEvent[],
  hpChoice: 'roll' | 'average' | 'max' | 'manual',
  manualHp?: number,
): Character {
  const updated = structuredClone(character)

  for (const event of events) {
    switch (event.type) {
      case 'ADD_HP': {
        let baseHp: number
        if (hpChoice === 'average') baseHp = event.average
        else if (hpChoice === 'max') baseHp = event.max
        else if (hpChoice === 'manual') baseHp = manualHp ?? event.average
        else baseHp = event.roll
        const gain = baseHp + event.conBonus + event.hpFlatBonus
        updated.hp.max += Math.max(gain, 1)
        updated.hp.current += Math.max(gain, 1)
        break
      }
      case 'UPDATE_SPELL_SLOTS': {
        // slots contains deltas — add to current max to preserve manual overrides
        for (const [lvlStr, delta] of Object.entries(event.slots)) {
          const lvl = parseInt(lvlStr) as SpellSlotLevel
          if (!updated.spellSlots[lvl]) {
            updated.spellSlots[lvl] = { max: 0, used: 0 }
          }
          updated.spellSlots[lvl].max += delta
        }
        break
      }
      case 'UPDATE_WARLOCK_SLOTS': {
        // Pact magic slots — absolute values; preserve used count up to new max
        updated.warlockSlots = {
          slotLevel: event.slotLevel,
          max: event.max,
          used: Math.min(updated.warlockSlots?.used ?? 0, event.max),
        }
        break
      }
      case 'ADD_FEATURE': {
        const exists = updated.features.some(f => f.id === event.feature.id)
        if (!exists) {
          updated.features.push({
            ...event.feature,
            usesRemaining: event.feature.usesMax,
          })
        }
        break
      }
      case 'GAIN_PROFICIENCY': {
        if (!updated.otherProficiencies.includes(event.proficiency)) {
          updated.otherProficiencies.push(event.proficiency)
        }
        break
      }
      case 'UPDATE_HIT_DIE': {
        updated.hitDice = {
          total: event.totalDice,
          remaining: Math.min(updated.hitDice.remaining + 1, event.totalDice),
          die: event.die,
        }
        break
      }
    }
  }

  return updated
}

export function applyResolvedChoices(
  character: Character,
  choices: ResolvedChoice[],
  rulepack: Rulepack,
): Character {
  const updated = structuredClone(character)
  const oldConMod = Math.floor((updated.abilityScores.con - 10) / 2)

  for (const choice of choices) {
    switch (choice.type) {
      case 'RESOLVED_ASI': {
        for (const [ability, bonus] of Object.entries(choice.bonuses)) {
          const key = ability as AbilityKey
          updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
        }
        break
      }
      case 'RESOLVED_CHOOSE_FEAT': {
        const feat = rulepack.feats.find(f => f.id === choice.featId)
        if (feat) {
          updated.features.push({
            id: feat.id,
            name: feat.name,
            source: 'Feat',
            description: feat.description,
          })
          // Flat ability score bonuses (no player choice)
          if (feat.abilityScoreBonus) {
            for (const [ability, bonus] of Object.entries(feat.abilityScoreBonus)) {
              const key = ability as AbilityKey
              updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
            }
          }
          // Player-chosen ability score bonus (e.g. +1 to one of Wis/Int/Cha)
          if (choice.abilityBonus) {
            for (const [ability, bonus] of Object.entries(choice.abilityBonus)) {
              const key = ability as AbilityKey
              updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
            }
          }
          // Spells granted by the feat
          if (feat.grantedSpells) {
            for (const spellId of feat.grantedSpells) {
              const spellDef = rulepack.spells.find(s => s.id === spellId)
              if (spellDef && !updated.spells.some(s => s.spellId === spellId)) {
                updated.spells.push({
                  id: crypto.randomUUID(),
                  spellId,
                  name: spellDef.name,
                  level: spellDef.level,
                  prepared: spellDef.level === 0,
                })
              }
            }
          }
          // Extra HP per level (retroactive for all current levels)
          if (feat.hpBonusPerLevel) {
            const totalLevel = updated.classes.reduce((s, c) => s + c.level, 0)
            const hpGain = feat.hpBonusPerLevel * totalLevel
            updated.hp.max += hpGain
            updated.hp.current += hpGain
            updated.hpBonusPerLevel = (updated.hpBonusPerLevel ?? 0) + feat.hpBonusPerLevel
          }
        }
        break
      }
      case 'RESOLVED_CHOOSE_SPELL': {
        const spellsToRemove = new Set(choice.removedSpellIds)
        updated.spells = updated.spells.filter(s => !spellsToRemove.has(s.spellId))
        for (const spellId of choice.spellIds) {
          const spellDef = rulepack.spells.find(s => s.id === spellId)
          if (spellDef && !updated.spells.some(s => s.spellId === spellId)) {
            updated.spells.push({
              id: crypto.randomUUID(),
              spellId,
              name: spellDef.name,
              level: spellDef.level,
              prepared: spellDef.level === 0,
              classId: choice.classId,
            })
          }
        }
        break
      }
      case 'RESOLVED_SUBCLASS': {
        const classEntry = updated.classes.find(c => c.classId === choice.classId)
        if (classEntry) {
          classEntry.subclassId = choice.subclassId
          // Add subclass features for the current level (e.g. level 3 pick)
          const currentLevel = classEntry.level
          const subclassDef = rulepack.classes
            .flatMap(c => c.subclasses ?? [])
            .find(s => s.id === choice.subclassId)
          if (subclassDef) {
            const levelFeatures = subclassDef.levels.find(l => l.level === currentLevel)?.features ?? []
            for (const feat of levelFeatures) {
              const featId = `${choice.subclassId}-${feat.name.toLowerCase().replaceAll(' ', '-')}-${currentLevel}`
              if (!updated.features.some(f => f.id === featId)) {
                updated.features.push({
                  id: featId,
                  name: feat.name,
                  source: subclassDef.name,
                  description: feat.description,
                  usesMax: feat.usesMax,
                  usesRemaining: feat.usesMax,
                  recharge: feat.recharge,
                })
              }
            }
          }
        }
        break
      }
      case 'RESOLVED_OPTIONAL_FEATURES': {
        for (const feat of choice.taken) {
          if (!updated.features.some(f => f.id === feat.id)) {
            updated.features.push({
              id: feat.id,
              name: feat.name,
              source: feat.sourceName,
              description: feat.description,
              usesMax: feat.usesMax,
              usesRemaining: feat.usesMax,
              recharge: feat.recharge,
            })
          }
        }
        break
      }
    }
  }

  // If the CON modifier changed (from ASI or feat), adjust HP for all existing levels.
  // Each level's HP was calculated with the old modifier, so we compensate the delta.
  const newConMod = Math.floor((updated.abilityScores.con - 10) / 2)
  if (newConMod !== oldConMod) {
    const totalLevel = updated.classes.reduce((s, c) => s + c.level, 0)
    const hpDelta = (newConMod - oldConMod) * totalLevel
    updated.hp.max = Math.max(updated.hp.max + hpDelta, totalLevel)
    updated.hp.current = Math.max(updated.hp.current + hpDelta, 1)
  }

  return updated
}
