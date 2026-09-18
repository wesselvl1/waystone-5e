import type { Character, AbilityKey, AbilityScores, SkillKey } from '~/types/character'
import { characterArmorClass } from '~/services/armorClass'
import { initiativeBreakdown } from '~/services/initiative'
import { savingThrowTotals } from '~/services/savingThrows'
import { halfProficiency, halfProficiencyBonus } from '~/services/halfProficiency'

const SKILL_ABILITY: Record<SkillKey, AbilityKey> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function proficiencyBonus(totalLevel: number): number {
  return Math.ceil(totalLevel / 4) + 1
}

export function useCharacterStats(characterRef: Ref<Character | null>) {
  const scores = computed<AbilityScores>(() => {
    const c = characterRef.value
    if (!c) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    return {
      str: c.abilityScoreOverrides.str ?? c.abilityScores.str,
      dex: c.abilityScoreOverrides.dex ?? c.abilityScores.dex,
      con: c.abilityScoreOverrides.con ?? c.abilityScores.con,
      int: c.abilityScoreOverrides.int ?? c.abilityScores.int,
      wis: c.abilityScoreOverrides.wis ?? c.abilityScores.wis,
      cha: c.abilityScoreOverrides.cha ?? c.abilityScores.cha,
    }
  })

  const totalLevel = computed(() => {
    return characterRef.value?.classes.reduce((sum, c) => sum + c.level, 0) ?? 1
  })

  const profBonus = computed(() => proficiencyBonus(totalLevel.value))

  const abilityModifiers = computed<Record<AbilityKey, number>>(() => ({
    str: abilityMod(scores.value.str),
    dex: abilityMod(scores.value.dex),
    con: abilityMod(scores.value.con),
    int: abilityMod(scores.value.int),
    wis: abilityMod(scores.value.wis),
    cha: abilityMod(scores.value.cha),
  }))

  // The ability and proficiency, plus what the features say — a paladin's aura — plus the
  // hand-entered slots. The modal shows the same sum's working, one save at a time.
  const savingThrows = computed<Record<AbilityKey, number>>(() => savingThrowTotals(
    characterRef.value,
    { modifiers: abilityModifiers.value, proficiencyBonus: profBonus.value },
  ))

  // Jack of All Trades and anything worded like it, read off the features once rather
  // than once per skill.
  const halfProf = computed(() => halfProficiency(characterRef.value))

  /**
   * The feature lending each unproficient skill half a proficiency bonus, or null.
   *
   * Only the skills the character has no proficiency in appear: "that doesn't already
   * include your proficiency bonus" is the rule, so a proficient skill is never half.
   */
  const skillHalfProficiency = computed<Record<SkillKey, string | null>>(() => {
    const c = characterRef.value
    const prof = profBonus.value
    const skillProfs = c?.skillProficiencies ?? {}

    const result = {} as Record<SkillKey, string | null>
    for (const [skill, ability] of Object.entries(SKILL_ABILITY) as [SkillKey, AbilityKey][]) {
      const profLevel = (skillProfs as Record<string, number>)[skill] ?? 0
      if (profLevel > 0) {
        result[skill] = null
        continue
      }
      const half = halfProficiencyBonus(halfProf.value, ability, prof)
      result[skill] = half.value ? half.source : null
    }
    return result
  })

  const skills = computed<Record<SkillKey, number>>(() => {
    const c = characterRef.value
    const mods = abilityModifiers.value
    const prof = profBonus.value
    const skillProfs = c?.skillProficiencies ?? {}

    const result = {} as Record<SkillKey, number>
    for (const [skill, ability] of Object.entries(SKILL_ABILITY) as [SkillKey, AbilityKey][]) {
      const profLevel = ((skillProfs as Record<string, number>)[skill] ?? 0) as 0 | 1 | 2
      const half = profLevel === 0 ? halfProficiencyBonus(halfProf.value, ability, prof).value : 0
      result[skill] = mods[ability] + profLevel * prof + half
    }
    return result
  })

  const passivePerception = computed(() => 10 + (skills.value.perception ?? 0))

  // Dexterity plus whatever the character's features add to the roll — a Chronurgy
  // wizard's Intelligence, the Alert feat's +5 — plus the hand-entered slots, with the
  // stored total still overriding the lot. The modal shows the same sum's working.
  const initiative = computed(() => initiativeBreakdown(characterRef.value, {
    modifiers: abilityModifiers.value,
    proficiencyBonus: profBonus.value,
  }).total)

  const armorClass = computed(() => {
    const c = characterRef.value
    if (!c) return 10 + abilityModifiers.value.dex
    return characterArmorClass(c, { modifiers: abilityModifiers.value })
  })

  const spellSaveDC = computed(() => {
    const c = characterRef.value
    if (!c?.spellcastingAbility) return null
    return 8 + profBonus.value + abilityModifiers.value[c.spellcastingAbility]
  })

  const spellAttackBonus = computed(() => {
    const c = characterRef.value
    if (!c?.spellcastingAbility) return null
    return profBonus.value + abilityModifiers.value[c.spellcastingAbility]
  })

  const bardicInspiration = computed(() => {
    const c = characterRef.value
    if (!c) return null
    const bardEntry = c.classes.find(e => e.classId === 'bard')
    if (!bardEntry) return null
    const bardLevel = bardEntry.level
    const chaMod = abilityModifiers.value.cha
    const max = Math.max(1, chaMod)
    const recharge = bardLevel >= 5 ? 'short' : 'long'
    let die: string
    if (bardLevel >= 15) die = 'd12'
    else if (bardLevel >= 10) die = 'd10'
    else if (bardLevel >= 5) die = 'd8'
    else die = 'd6'
    const used = c.bardicInspirationUsed ?? 0
    return { max, used, recharge, die }
  })

  return {
    scores,
    totalLevel,
    profBonus,
    abilityModifiers,
    savingThrows,
    skills,
    skillHalfProficiency,
    passivePerception,
    initiative,
    armorClass,
    spellSaveDC,
    spellAttackBonus,
    bardicInspiration,
  }
}
