<script setup lang="ts">
import type { Character, SkillKey, ProficiencyLevel } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { useLongPress } from '~/composables/useLongPress'

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

/**
 * The dots only show proficiency; changing it takes a hold on the card, since a single
 * tap on a dot used to change it and a thumb scrolling the sheet tapped them by accident.
 */
const editing = ref(false)
const { pressing, bind: bindHold } = useLongPress<true>(() => editing.value = true)

const modalRows = computed(() => SKILLS.map(s => ({
  key: s.key,
  label: s.label,
  detail: s.ability,
  half: halfSource(s.key),
})))

function saveProficiencies(levels: Record<SkillKey, ProficiencyLevel>) {
  emit('update', {
    skillProficiencies: { ...props.character.skillProficiencies, ...levels },
  })
  editing.value = false
}

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function profLevel(key: SkillKey): ProficiencyLevel {
  return (props.character.skillProficiencies[key] ?? 0) as ProficiencyLevel
}

/**
 * The feature lending this skill half a proficiency bonus, or null.
 *
 * Derived, so it is not a fourth stop on the cycle — the dot shows it, the editor still
 * steps none → proficient → expertise, and a bard who takes the proficiency loses the
 * half on its own.
 */
function halfSource(key: SkillKey): string | null {
  return stats.skillHalfProficiency.value[key] ?? null
}

function dotTitle(key: SkillKey): string | undefined {
  const half = halfSource(key)
  return half ? `${half}: half proficiency` : undefined
}
</script>

<template>
  <div>
    <p class="section-header flex items-baseline gap-2">
      Skills
      <span class="text-[10px] normal-case tracking-normal font-normal text-slate-600">hold to edit</span>
    </p>
    <div
      class="card divide-y divide-surface-700/50 select-none transition-shadow"
      :class="pressing ? 'ring-1 ring-primary-500/60' : ''"
      title="Hold to change proficiencies"
      v-bind="bindHold(true)"
    >
      <div
        v-for="skill in SKILLS"
        :key="skill.key"
        class="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0"
      >
        <span
          class="proficiency-dot cursor-default"
          :class="{
            'half': halfSource(skill.key) !== null,
            'active': profLevel(skill.key) === 1,
            'expertise': profLevel(skill.key) === 2,
          }"
          :title="dotTitle(skill.key)"
        />
        <span class="flex-1 text-sm text-slate-300">{{ skill.label }}</span>
        <span class="text-[10px] text-slate-500 w-6 text-right">{{ skill.ability }}</span>
        <span class="font-mono text-sm font-semibold w-8 text-right" :class="stats.skills.value[skill.key] >= 0 ? 'text-white' : 'text-slate-400'">
          {{ fmt(stats.skills.value[skill.key]) }}
        </span>
      </div>
    </div>

    <SheetProficiencyDotsModal
      v-if="editing"
      :open="editing"
      title="Skill proficiencies"
      :rows="modalRows"
      :value="character.skillProficiencies"
      allow-expertise
      @save="saveProficiencies"
      @close="editing = false"
    />
  </div>
</template>
