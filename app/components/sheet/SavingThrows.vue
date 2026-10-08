<script setup lang="ts">
import type { Character, AbilityKey } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { useLongPress } from '~/composables/useLongPress'

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

/**
 * The dots only show proficiency, since a tap on one used to toggle it and a thumb
 * scrolling the sheet tapped them by accident. Holding a row opens the save's modal,
 * where the proficiency is a checkbox beside the bonuses; a tap on the number still does.
 */
const { pressing, bind: bindHold } = useLongPress<AbilityKey>(key => editing.value = key)

function saveBonuses(patch: Pick<Character,
  'savingThrowProficiencies' | 'savingThrowBonuses' | 'savingThrowBonusesByAbility' | 'savingThrowAbilityBonus'>) {
  emit('update', patch)
  editing.value = null
}

/**
 * Whether anything beyond the ability and proficiency is in play — the dot on the header
 * that says the numbers below are carrying something, without opening all six.
 *
 * Asked of the totals rather than of the stored fields, so it covers every layer at once
 * — features, both sets of slots, the aura — and stays quiet where a set nets to zero or
 * the aura has been switched off, neither of which is the sheet carrying anything.
 */
const hasExtras = computed(() => ABILITIES.some(({ key }) => {
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
      <span class="ml-0.5 text-[10px] normal-case tracking-normal font-normal text-slate-600">hold to edit</span>
    </p>
    <div class="card divide-y divide-surface-700/50">
      <div
        v-for="{ key, label } in ABILITIES"
        :key="key"
        class="flex items-center gap-3 py-2 first:pt-0 last:pb-0 -mx-2 px-2 rounded select-none transition-colors"
        :class="pressing === key ? 'bg-surface-700' : ''"
        :title="`Hold to edit the ${label} save`"
        v-bind="bindHold(key)"
      >
        <span
          class="proficiency-dot cursor-default"
          :class="{ active: character.savingThrowProficiencies.includes(key) }"
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
