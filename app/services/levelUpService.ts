import type { Character, AbilityKey, SpellSlotLevel } from '~/types/character'
import type { Rulepack, OptionalClassFeature, FeatDefinition, FeatPrerequisite } from '~/types/rulepack'
import { addHitDieForClass, multiclassProficiencies } from '~/services/multiclass'
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
  SetSpellcastingAbilityEvent,
  ChooseExpertiseEvent,
  UpdateFeatureUsesEvent,
  GrantSpellsEvent,
  SetWildShapeLimitsEvent,
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

/** Turn spell ids into the denormalized shape a GRANT_SPELLS event carries. */
function resolveGrantedSpells(spellIds: string[], rulepack: Rulepack) {
  return spellIds
    .map(id => rulepack.spells.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map(s => ({ spellId: s.id, name: s.name, level: s.level }))
}

/** Add granted spells to a character in place, skipping ones already known. */
function grantSpellsTo(
  character: Character,
  addTo: string,
  spells: Array<{ spellId: string; name: string; level: number }>,
  alwaysPrepared: boolean,
): void {
  for (const spell of spells) {
    const existing = character.spells.find(s => s.spellId === spell.spellId)
    if (existing) {
      if (alwaysPrepared) {
        existing.alwaysPrepared = true
        existing.prepared = true
      }
      continue
    }
    character.spells.push({
      id: crypto.randomUUID(),
      spellId: spell.spellId,
      name: spell.name,
      level: spell.level,
      prepared: alwaysPrepared || spell.level === 0,
      alwaysPrepared: alwaysPrepared || undefined,
      classId: addTo,
    })
  }
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

  // Record this class's spellcasting ability against its own source, so a multiclass
  // caster gets a DC per class rather than one taken from whichever class came first.
  if (classDef.spellcastingAbility) {
    events.push({
      type: 'SET_SPELLCASTING_ABILITY',
      sourceId: classId,
      ability: classDef.spellcastingAbility,
    } satisfies SetSpellcastingAbilityEvent)
  }

  // Hit dice are pooled per class, since a fighter/wizard spends d10s and d6s separately
  events.push({
    type: 'UPDATE_HIT_DIE',
    classId,
    die: classDef.hitDie,
  } satisfies UpdateHitDieEvent)

  // Only pact magic is tracked on the character: warlock slots are absolute and separate.
  // Regular slots are derived from the combined caster level by baseSpellSlots(), so
  // nothing is emitted for them — a new class level changes the derivation instead.
  if (levelData.spellSlots && classDef.pactMagic) {
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

    const featDef = classDef.featureDefinitions?.find(d => d.name === featureName)
    events.push({
      type: 'ADD_FEATURE',
      feature: {
        id: `${classId}-${featureName.toLowerCase().replace(/\s+/g, '-')}-${newLevel}`,
        name: featureName,
        source: classDef.name,
        description: featDef?.description ?? '',
        usesMax: featDef?.usesMax,
        recharge: featDef?.recharge,
        replaces: featDef?.replaces,
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
  // Taking a class as an additional class grants the SRD's reduced proficiency set, never
  // saving throws. Level 1 of the *first* class is handled at character creation instead,
  // so this only fires when the character already has levels elsewhere.
  const enteringAsMulticlass = newLevel === 1
    && character.classes.some(c => c.classId !== classId && c.level > 0)
  if (enteringAsMulticlass && classDef.multiclassing) {
    for (const proficiency of multiclassProficiencies(classDef)) {
      events.push({
        type: 'GAIN_PROFICIENCY',
        proficiency,
        category: 'armor',
      } satisfies GainProficiencyEvent)
    }
    const skills = classDef.multiclassing.skillChoices
    if (skills && skills.count > 0) {
      events.push({ type: 'CHOOSE_SKILL', count: skills.count, from: skills.from })
    }
  }

  for (const eventDef of levelData.levelUpEvents) {    switch (eventDef.type) {
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
          addTo: eventDef.addTo,
          count: eventDef.count,
          cantrip: eventDef.cantrip ?? false,
          fromList: eventDef.fromList,
          classes: eventDef.classes,
          schools: eventDef.schools,
        })
        break
      case 'GRANT_SPELLS': {
        // A guarded grant only fires once the option it depends on has been picked. At
        // the level the option is chosen the answer is not known yet, so the grant is
        // skipped here and applied by RESOLVED_OPTION instead.
        if (eventDef.whenOption
          && character.chosenOptions?.[eventDef.whenOption.choiceId] !== eventDef.whenOption.optionId) {
          break
        }
        const granted = resolveGrantedSpells(eventDef.spellIds, rulepack)
        if (granted.length > 0) {
          events.push({
            type: 'GRANT_SPELLS',
            addTo: eventDef.addTo,
            spells: granted,
            alwaysPrepared: eventDef.alwaysPrepared ?? false,
            ...(eventDef.whenOption ? { whenOption: eventDef.whenOption } : {}),
          } satisfies GrantSpellsEvent)
        }
        break
      }
      case 'SET_WILD_SHAPE_LIMITS':
        events.push({
          type: 'SET_WILD_SHAPE_LIMITS',
          maxCR: eventDef.maxCR,
          // Unset means unrestricted, so a subclass that widens the limits can simply
          // omit the gates rather than having to re-state them as true.
          allowSwim: eventDef.allowSwim ?? true,
          allowFly: eventDef.allowFly ?? true,
          // Copy: eventDef belongs to the reactive rulepack store, and a Vue proxy
          // stored on the character makes the next structuredClone throw.
          types: eventDef.types ? [...eventDef.types] : undefined,
        } satisfies SetWildShapeLimitsEvent)
        break
      case 'CHOOSE_EXPERTISE':
        events.push({
          type: 'CHOOSE_EXPERTISE',
          label: eventDef.label,
          options: eventDef.options,
          count: eventDef.count,
        } satisfies ChooseExpertiseEvent)
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
      case 'UPDATE_FEATURE_USES':
        events.push({
          type: 'UPDATE_FEATURE_USES',
          featureName: eventDef.featureName,
          usesMax: eventDef.usesMax,
        } satisfies UpdateFeatureUsesEvent)
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
          addTo: eventDef.addTo,
          count: eventDef.count,
          cantrip: eventDef.cantrip ?? false,
          fromList: eventDef.fromList,
          classes: eventDef.classes,
          schools: eventDef.schools,
        })
        break
      case 'GRANT_SPELLS': {
        // A guarded grant only fires once the option it depends on has been picked. At
        // the level the option is chosen the answer is not known yet, so the grant is
        // skipped here and applied by RESOLVED_OPTION instead.
        if (eventDef.whenOption
          && character.chosenOptions?.[eventDef.whenOption.choiceId] !== eventDef.whenOption.optionId) {
          break
        }
        const granted = resolveGrantedSpells(eventDef.spellIds, rulepack)
        if (granted.length > 0) {
          events.push({
            type: 'GRANT_SPELLS',
            addTo: eventDef.addTo,
            spells: granted,
            alwaysPrepared: eventDef.alwaysPrepared ?? false,
            ...(eventDef.whenOption ? { whenOption: eventDef.whenOption } : {}),
          } satisfies GrantSpellsEvent)
        }
        break
      }
      case 'GAIN_PROFICIENCY':
        events.push({
          type: 'GAIN_PROFICIENCY',
          proficiency: eventDef.proficiency,
          category: 'skill',
        } satisfies GainProficiencyEvent)
        break
      case 'SET_WILD_SHAPE_LIMITS':
        events.push({
          type: 'SET_WILD_SHAPE_LIMITS',
          maxCR: eventDef.maxCR,
          // Unset means unrestricted, so a subclass that widens the limits can simply
          // omit the gates rather than having to re-state them as true.
          allowSwim: eventDef.allowSwim ?? true,
          allowFly: eventDef.allowFly ?? true,
          // Copy: eventDef belongs to the reactive rulepack store, and a Vue proxy
          // stored on the character makes the next structuredClone throw.
          types: eventDef.types ? [...eventDef.types] : undefined,
        } satisfies SetWildShapeLimitsEvent)
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
  return ['CHOOSE_SPELL', 'CHANGE_SPELL', 'CHOOSE_EXPERTISE', 'CHOOSE_FEAT', 'ABILITY_SCORE_IMPROVEMENT', 'CHOOSE_SUBCLASS', 'CHOOSE_SKILL', 'CHOOSE_OPTION', 'OFFER_OPTIONAL_FEATURES'].includes(event.type)
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
          if (event.feature.replaces)
            updated.features = updated.features.filter(f => f.name !== event.feature.replaces)
          updated.features.push({
            ...event.feature,
            usesRemaining: event.feature.usesMax,
          })
        }
        break
      }
      case 'GRANT_SPELLS': {
        for (const spell of event.spells) {
          const existing = updated.spells.find(s => s.spellId === spell.spellId)
          if (existing) {
            // Already known — a granted spell still becomes always-prepared
            if (event.alwaysPrepared) {
              existing.alwaysPrepared = true
              existing.prepared = true
            }
            continue
          }
          updated.spells.push({
            id: crypto.randomUUID(),
            spellId: spell.spellId,
            name: spell.name,
            level: spell.level,
            prepared: event.alwaysPrepared || spell.level === 0,
            alwaysPrepared: event.alwaysPrepared || undefined,
            classId: event.addTo,
          })
        }
        break
      }
      case 'SET_WILD_SHAPE_LIMITS': {
        // Absolute, not a delta: a later level (or a subclass) replaces the limits.
        // An active form is preserved even if it would no longer qualify — dropping a
        // player out of a form mid-session because a limit narrowed would be worse.
        updated.wildShape = {
          ...updated.wildShape,
          limits: {
            maxCR: event.maxCR,
            allowSwim: event.allowSwim,
            allowFly: event.allowFly,
            ...(event.types ? { types: [...event.types] } : {}),
          },
        }
        break
      }
      case 'GAIN_PROFICIENCY': {
        if (!updated.otherProficiencies.includes(event.proficiency)) {
          updated.otherProficiencies.push(event.proficiency)
        }
        break
      }
      case 'SET_SPELLCASTING_ABILITY': {
        // Recorded per source so a cleric/sorcerer has two DCs. The deprecated
        // character.spellcastingAbility is left alone: feat prerequisites still read it.
        // Absent on characters stored before per-source lists existed
        const sources = updated.classSpellcasting ?? {}
        const existing = sources[event.sourceId]
        updated.classSpellcasting = {
          ...sources,
          [event.sourceId]: existing
            ? { ...existing, ability: event.ability }
            : { ability: event.ability, origin: 'class', spells: [] },
        }
        break
      }
      case 'UPDATE_HIT_DIE': {
        updated.hitDice = addHitDieForClass(updated.hitDice, event.classId, event.die)
        break
      }
      case 'UPDATE_FEATURE_USES': {
        const feature = updated.features.find(f => f.name === event.featureName)
        if (feature) {
          if (event.usesMax === null) {
            delete feature.usesMax
            delete feature.usesRemaining
          }
          else {
            feature.usesMax = event.usesMax
            // Clamp against base + manual bonus, not the base alone, or a magic-item
            // bonus would be silently trimmed off on every level-up.
            const bonusTotal = Object.values(feature.usesBonuses ?? {})
              .reduce<number>((sum, n) => sum + (n ?? 0), 0)
            const effectiveMax = Math.max(0, event.usesMax + bonusTotal)
            feature.usesRemaining = Math.min(feature.usesRemaining ?? effectiveMax, effectiveMax)
          }
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
            const subclassLevel = subclassDef.levels.find(l => l.level === currentLevel)
            const levelFeatures = subclassLevel?.features ?? []
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
            // The subclass was unchosen when resolveLevelUpEvents ran, so its own
            // level events were never emitted. Apply the automatic ones here.
            for (const evt of subclassLevel?.levelUpEvents ?? []) {
              if (evt.type === 'GRANT_SPELLS') {
                for (const spellId of evt.spellIds) {
                  const spellDef = rulepack.spells.find(sp => sp.id === spellId)
                  if (!spellDef) continue
                  const existing = updated.spells.find(sp => sp.spellId === spellId)
                  if (existing) {
                    if (evt.alwaysPrepared) {
                      existing.alwaysPrepared = true
                      existing.prepared = true
                    }
                    continue
                  }
                  updated.spells.push({
                    id: crypto.randomUUID(),
                    spellId,
                    name: spellDef.name,
                    level: spellDef.level,
                    prepared: (evt.alwaysPrepared ?? false) || spellDef.level === 0,
                    alwaysPrepared: evt.alwaysPrepared || undefined,
                    classId: evt.addTo,
                  })
                }
              }
              else if (evt.type === 'GAIN_PROFICIENCY') {
                if (!updated.otherProficiencies.includes(evt.proficiency)) {
                  updated.otherProficiencies.push(evt.proficiency)
                }
              }
            }
          }
        }
        break
      }
      case 'RESOLVED_EXPERTISE': {
        for (const skill of choice.skills) {
          // Expertise doubles an existing proficiency, so it only applies where the
          // character is already proficient; granting it outright would be a free skill.
          if ((updated.skillProficiencies[skill] ?? 0) === 1) {
            updated.skillProficiencies[skill] = 2
          }
        }
        break
      }
      case 'RESOLVED_SKILL': {
        for (const skill of choice.skills) {
          // Never downgrade: a skill already at expertise (2) stays there.
          if ((updated.skillProficiencies[skill] ?? 0) === 0) {
            updated.skillProficiencies[skill] = 1
          }
        }
        break
      }
      case 'RESOLVED_OPTION': {
        // Record the choice so later levels can act on it. Previously the pick lived only
        // in a feature's name, which nothing could query.
        updated.chosenOptions = {
          ...updated.chosenOptions,
          [choice.choiceId]: choice.optionId,
        }

        // Apply grants guarded by this option that sit on the level being gained.
        // resolveLevelUpEvents could not emit them: the option was still unanswered when
        // it ran, the same ordering problem RESOLVED_SUBCLASS has.
        for (const cls of rulepack.classes) {
          const entry = updated.classes.find(c => c.classId === cls.id)
          if (!entry) continue
          const levelEvents = [
            ...(cls.levels.find(l => l.level === entry.level)?.levelUpEvents ?? []),
            ...(cls.subclasses ?? [])
              .filter(sub => sub.id === entry.subclassId)
              .flatMap(sub => sub.levels.find(l => l.level === entry.level)?.levelUpEvents ?? []),
          ]
          for (const evt of levelEvents) {
            if (evt.type !== 'GRANT_SPELLS' || !evt.whenOption) continue
            if (evt.whenOption.choiceId !== choice.choiceId) continue
            if (evt.whenOption.optionId !== choice.optionId) continue
            grantSpellsTo(
              updated,
              evt.addTo,
              resolveGrantedSpells(evt.spellIds, rulepack),
              evt.alwaysPrepared ?? false,
            )
          }
        }
        // Find the option definition from the rulepack across all subclass level events
        let optionName: string | undefined
        let optionDescription: string | undefined
        outer: for (const cls of rulepack.classes) {
          for (const sub of cls.subclasses ?? []) {
            for (const lvl of sub.levels) {
              for (const evt of lvl.levelUpEvents ?? []) {
                if (evt.type === 'CHOOSE_OPTION' && evt.id === choice.choiceId) {
                  const opt = evt.options.find(o => o.id === choice.optionId)
                  if (opt) { optionName = opt.name; optionDescription = opt.description; break outer }
                }
              }
            }
          }
        }
        if (optionName) {
          // Update the feature whose id contains the choiceId (e.g. "totem-spirit" in the feature id)
          const feat = updated.features.find(f => f.id.includes(choice.choiceId))
          if (feat) {
            feat.name = `${feat.name} (${optionName})`
            feat.description = optionDescription ?? feat.description
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
