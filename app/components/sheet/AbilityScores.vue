<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import { outstandingRacialChoices, racialChoicePatch } from '~/services/characterMigration'
import {
  isChoiceSetSatisfied,
  sumBonuses,
  type AbilityPicks,
} from '~/services/abilityScoreChoice'
import type { Character, AbilityKey, AbilityScores } from '~/types/character'
import { abilityMod } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const ABILITIES: { key: AbilityKey; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' },
]

function effectiveScore(key: AbilityKey) {
  return props.character.abilityScoreOverrides[key] ?? props.character.abilityScores[key]
}

function modifier(key: AbilityKey) {
  const mod = abilityMod(effectiveScore(key))
  return mod >= 0 ? `+${mod}` : `${mod}`
}

const editing = ref<AbilityKey | null>(null)
const draft = ref(10)

function startEdit(key: AbilityKey) {
  editing.value = key
  draft.value = effectiveScore(key)
}

function commitEdit(key: AbilityKey) {
  const val = Math.max(1, Math.min(30, draft.value || 10))
  emit('update', {
    abilityScoreOverrides: { ...props.character.abilityScoreOverrides, [key]: val },
  })
  editing.value = null
}

/**
 * A race's distributable increases, for a character that predates them being asked for.
 *
 * The back-fill on load can only supply the fixed bonuses; what the player would have
 * distributed was never recorded, so it is asked for here instead of guessed. New
 * characters answer this in the creation wizard and never see the card.
 */
const rulepackStore = useRulepacksStore()
const race = computed(() => rulepackStore.getRace(props.character.race))
const subrace = computed(() => race.value?.subraces?.find(s => s.id === props.character.subrace))
const pendingChoices = computed(() =>
  outstandingRacialChoices(props.character, race.value, subrace.value))

/** One answer per choice still owed, since a race and its subrace can each print one. */
const racialPicks = ref<AbilityPicks[]>([])
watch(pendingChoices, cs => { racialPicks.value = cs.map(() => ({})) }, { immediate: true })

const racialPicksComplete = computed(() =>
  isChoiceSetSatisfied(pendingChoices.value, sumBonuses(racialPicks.value)))

function confirmRacialPicks() {
  emit('update', racialChoicePatch(props.character, sumBonuses(racialPicks.value)))
}

function modClass(key: AbilityKey) {
  const m = abilityMod(effectiveScore(key))
  if (m >= 3) return 'text-success-400'
  if (m <= -2) return 'text-danger-400'
  return 'text-white'
}
</script>

<template>
  <div>
    <p class="section-header">Ability Scores</p>
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="{ key, label } in ABILITIES"
        :key="key"
        class="stat-box cursor-pointer hover:border-primary-500/40 transition-colors"
        @click="startEdit(key)"
      >
        <span class="stat-label">{{ label.slice(0, 3).toUpperCase() }}</span>
        <template v-if="editing === key">
          <input
            v-model.number="draft"
            type="number"
            min="1"
            max="30"
            class="input text-center text-xl font-bold w-16 px-1 py-0"
            autofocus
            @blur="commitEdit(key)"
            @keydown.enter="commitEdit(key)"
            @keydown.esc="editing = null"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="text-3xl font-bold leading-none" :class="modClass(key)">{{ modifier(key) }}</span>
          <span class="text-slate-400 text-sm font-mono">{{ effectiveScore(key) }}</span>
        </template>
      </div>
    </div>

    <div v-if="pendingChoices.length" class="card mt-3">
      <p class="text-xs text-slate-400 mb-2">
        This character was made before these were asked for, so they are still unspent.
      </p>
      <div v-for="(choice, i) in pendingChoices" :key="i" class="mb-3">
        <p class="section-header">
          {{ subrace?.abilityScoreChoice === choice ? subrace?.name : race?.name }}
          Ability Score Increase
        </p>
        <AbilityScoreChoicePicker
          :model-value="racialPicks[i] ?? {}"
          :choice="choice"
          :base-scores="character.abilityScores"
          @update:model-value="picks => racialPicks[i] = picks"
        />
      </div>
      <button
        class="btn-primary w-full text-sm"
        :disabled="!racialPicksComplete"
        @click="confirmRacialPicks"
      >Apply</button>
    </div>
  </div>
</template>
