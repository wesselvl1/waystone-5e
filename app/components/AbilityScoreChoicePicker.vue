<script setup lang="ts">
/**
 * Distributing an `AbilityScoreChoice`. Used by the creation wizard for a race's or
 * subrace's increases and by the level-up wizard for a feat's, so all three ask for them
 * the same way.
 *
 * The parent owns the answer and decides what a complete one unlocks — call
 * `isChoiceSatisfied` rather than tracking completeness here, since the same test also
 * has to hold for an answer that arrived from somewhere else.
 */
import {
  distributionLabel,
  distributionPrompt,
  orderedAmounts,
  type AbilityPicks,
} from '~/services/abilityScoreChoice'
import type { AbilityKey } from '~/types/character'
import type { AbilityScoreChoice } from '~/types/rulepack'

const props = defineProps<{
  choice: AbilityScoreChoice
  /** Scores to show the increase against, so the player sees the resulting number. */
  baseScores: Partial<Record<AbilityKey, number>>
  modelValue: AbilityPicks
}>()

const emit = defineEmits<{ 'update:modelValue': [AbilityPicks] }>()

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

/** Which shape the player is spending. Only an affordance — the answer itself is the map. */
const shape = ref(0)
const amounts = computed(() => orderedAmounts(props.choice.distributions[shape.value] ?? []))

// A half-spent answer under the old shape would be unspendable under the new one.
function chooseShape(index: number) {
  shape.value = index
  emit('update:modelValue', {})
}

// Switching race mid-pick leaves bonuses that the new race may not offer at all.
watch(() => props.choice, () => { shape.value = 0 })

/** The next unspent bonus, largest first. */
const nextAmount = computed(() => {
  const remaining = [...amounts.value]
  for (const v of Object.values(props.modelValue)) {
    const at = remaining.indexOf(v as number)
    if (at >= 0) remaining.splice(at, 1)
  }
  return remaining[0]
})

function toggle(key: AbilityKey) {
  const next = { ...props.modelValue }
  if (next[key]) delete next[key]
  else if (nextAmount.value !== undefined) next[key] = nextAmount.value
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-2">
    <!-- Only the Multiverse-style rule offers more than one shape; one shape needs no toggle. -->
    <div v-if="choice.distributions.length > 1" class="flex gap-2">
      <button
        v-for="(dist, i) in choice.distributions"
        :key="i"
        class="flex-1 btn text-xs py-1.5"
        :class="shape === i ? 'btn-primary' : 'btn-ghost'"
        @click="chooseShape(i)"
      >
        {{ distributionLabel(dist) }}
      </button>
    </div>

    <p class="text-sm text-slate-300">{{ distributionPrompt(amounts) }}</p>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="key in choice.from"
        :key="key"
        class="stat-box cursor-pointer transition-colors"
        :class="modelValue[key]
          ? 'border-primary-500 bg-primary-900/20'
          : nextAmount === undefined ? 'opacity-50' : 'hover:border-primary-500/50'"
        @click="toggle(key)"
      >
        <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
        <span class="text-lg font-bold text-white">
          {{ (baseScores[key] ?? 10) + (modelValue[key] ?? 0) }}
        </span>
        <span class="text-xs text-accent-400">{{ modelValue[key] ? `+${modelValue[key]}` : '\xa0' }}</span>
      </button>
    </div>
  </div>
</template>
