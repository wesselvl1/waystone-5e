import type { Character, AbilityKey, AbilityScores, SkillKey } from '~/types/character'

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

  const savingThrows = computed<Record<AbilityKey, number>>(() => {
    const c = characterRef.value
    const mods = abilityModifiers.value
    const prof = profBonus.value
    const proficient = new Set(c?.savingThrowProficiencies ?? [])
    return {
      str: mods.str + (proficient.has('str') ? prof : 0),
      dex: mods.dex + (proficient.has('dex') ? prof : 0),
      con: mods.con + (proficient.has('con') ? prof : 0),
      int: mods.int + (proficient.has('int') ? prof : 0),
      wis: mods.wis + (proficient.has('wis') ? prof : 0),
      cha: mods.cha + (proficient.has('cha') ? prof : 0),
    }
  })

  const skills = computed<Record<SkillKey, number>>(() => {
    const c = characterRef.value
    const mods = abilityModifiers.value
    const prof = profBonus.value
    const skillProfs = c?.skillProficiencies ?? {}

    const result = {} as Record<SkillKey, number>
    for (const [skill, ability] of Object.entries(SKILL_ABILITY) as [SkillKey, AbilityKey][]) {
      const profLevel = ((skillProfs as Record<string, number>)[skill] ?? 0) as 0 | 1 | 2
      result[skill] = mods[ability] + profLevel * prof
    }
    return result
  })

  const passivePerception = computed(() => 10 + (skills.value.perception ?? 0))

  const initiative = computed(() => {
    const c = characterRef.value
    return c?.initiative !== null && c?.initiative !== undefined
      ? c.initiative
      : abilityModifiers.value.dex
  })

  const armorClass = computed(() => {
    const c = characterRef.value
    return c?.armorClass !== null && c?.armorClass !== undefined
      ? c.armorClass
      : 10 + abilityModifiers.value.dex
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
    passivePerception,
    initiative,
    armorClass,
    spellSaveDC,
    spellAttackBonus,
    bardicInspiration,
  }
}
