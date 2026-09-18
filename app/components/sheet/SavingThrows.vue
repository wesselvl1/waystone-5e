<script setup lang="ts">
import type { Character, AbilityKey } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { savingThrowBonusTotal } from '~/services/savingThrows'

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

/** A save is derived like an attack now, so its number opens the same kind of modal. */
const editing = ref<AbilityKey | null>(null)

function toggleSave(key: AbilityKey) {
  const current = props.character.savingThrowProficiencies
  const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
  emit('update', { savingThrowProficiencies: updated })
}

function saveBonuses(patch: Pick<Character, 'savingThrowBonuses' | 'savingThrowAbilityBonus'>) {
  emit('update', patch)
  editing.value = null
}

/**
 * Whether anything beyond the ability and proficiency is in play — the dot on the header
 * that says the numbers below are carrying something, without opening all six.
 */
const hasExtras = computed(() =>
  savingThrowBonusTotal(props.character) !== 0
  || !!props.character.savingThrowAbilityBonus
  || ABILITIES.some(({ key }) => {
    const base = stats.abilityModifiers.value[key]
      + (props.character.savingThrowProficiencies.includes(key) ? stats.profBonus.value : 0)
    return stats.savingThrows.value[key] !== base
  }))

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}` }
</script>

<template>
  <div>
    <p class="section-header flex items-center gap-1.5">
      Saving Throws
      <span
        v-if="hasExtras"
        class="w-1.5 h-1.5 rounded-full bg-primary-400"
        title="A feature or a bonus is adding to these"
      />
    </p>
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
        <button
          class="font-mono text-sm font-semibold px-2 -mr-2 py-0.5 rounded hover:bg-surface-700/60"
          :class="stats.savingThrows.value[key] >= 0 ? 'text-white' : 'text-slate-400'"
          :title="`What makes up the ${label} save`"
          @click="editing = key"
        >
          {{ fmt(stats.savingThrows.value[key]) }}
        </button>
      </div>
    </div>

    <SheetSavingThrowsModal
      v-if="editing"
      :open="!!editing"
      :character="character"
      :ability="editing"
      @save="saveBonuses"
      @close="editing = null"
    />
  </div>
</template>
