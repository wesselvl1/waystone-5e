<script setup lang="ts">
import type { Character, AbilityKey } from '~/types/character'
import { useCharacterStats, abilityMod } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const ABILITIES: { key: AbilityKey; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' },
]

function toggleSave(key: AbilityKey) {
  const current = props.character.savingThrowProficiencies
  const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
  emit('update', { savingThrowProficiencies: updated })
}

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}` }
</script>

<template>
  <div>
    <p class="section-header">Saving Throws</p>
    <div class="card divide-y divide-surface-700/50">
      <div
        v-for="{ key, label } in ABILITIES"
        :key="key"
        class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
      >
        <button
          class="proficiency-dot"
          :class="{ active: character.savingThrowProficiencies.includes(key) }"
          :title="`Toggle ${label} save proficiency`"
          @click="toggleSave(key)"
        />
        <span class="flex-1 text-sm text-slate-300">{{ label }}</span>
        <span class="font-mono text-sm font-semibold" :class="stats.savingThrows.value[key] >= 0 ? 'text-white' : 'text-slate-400'">
          {{ fmt(stats.savingThrows.value[key]) }}
        </span>
      </div>
    </div>
  </div>
</template>
