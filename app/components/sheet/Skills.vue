<script setup lang="ts">
import type { Character, SkillKey, ProficiencyLevel } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const SKILLS: { key: SkillKey; label: string; ability: string }[] = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'Dex' },
  { key: 'animalHandling', label: 'Animal Handling', ability: 'Wis' },
  { key: 'arcana', label: 'Arcana', ability: 'Int' },
  { key: 'athletics', label: 'Athletics', ability: 'Str' },
  { key: 'deception', label: 'Deception', ability: 'Cha' },
  { key: 'history', label: 'History', ability: 'Int' },
  { key: 'insight', label: 'Insight', ability: 'Wis' },
  { key: 'intimidation', label: 'Intimidation', ability: 'Cha' },
  { key: 'investigation', label: 'Investigation', ability: 'Int' },
  { key: 'medicine', label: 'Medicine', ability: 'Wis' },
  { key: 'nature', label: 'Nature', ability: 'Int' },
  { key: 'perception', label: 'Perception', ability: 'Wis' },
  { key: 'performance', label: 'Performance', ability: 'Cha' },
  { key: 'persuasion', label: 'Persuasion', ability: 'Cha' },
  { key: 'religion', label: 'Religion', ability: 'Int' },
  { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'Dex' },
  { key: 'stealth', label: 'Stealth', ability: 'Dex' },
  { key: 'survival', label: 'Survival', ability: 'Wis' },
]

function cycleProf(key: SkillKey) {
  const current = (props.character.skillProficiencies[key] ?? 0) as ProficiencyLevel
  const next: ProficiencyLevel = current === 0 ? 1 : current === 1 ? 2 : 0
  emit('update', {
    skillProficiencies: { ...props.character.skillProficiencies, [key]: next },
  })
}

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function profLevel(key: SkillKey): ProficiencyLevel {
  return (props.character.skillProficiencies[key] ?? 0) as ProficiencyLevel
}
</script>

<template>
  <div>
    <p class="section-header">Skills</p>
    <div class="card divide-y divide-surface-700/50">
      <div
        v-for="skill in SKILLS"
        :key="skill.key"
        class="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0"
      >
        <button
          class="proficiency-dot"
          :class="{
            'active': profLevel(skill.key) === 1,
            'expertise': profLevel(skill.key) === 2,
          }"
          :title="`Cycle proficiency (none → prof → expertise)`"
          @click="cycleProf(skill.key)"
        />
        <span class="flex-1 text-sm text-slate-300">{{ skill.label }}</span>
        <span class="text-[10px] text-slate-500 w-6 text-right">{{ skill.ability }}</span>
        <span class="font-mono text-sm font-semibold w-8 text-right" :class="stats.skills.value[skill.key] >= 0 ? 'text-white' : 'text-slate-400'">
          {{ fmt(stats.skills.value[skill.key]) }}
        </span>
      </div>
    </div>
  </div>
</template>
