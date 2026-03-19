<script setup lang="ts">
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
  </div>
</template>
