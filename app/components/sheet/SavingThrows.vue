<script setup lang="ts">
import type { Character, AbilityKey, ProficiencyLevel } from '~/types/character'
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
 * The dots only show proficiency; changing it takes a hold on the card, the way the
 * Skills card does, since a tap on a dot used to toggle it. A tap on a number still opens
 * its breakdown — the hold swallows the click that ends it, so it never does both.
 */
const editingProficiencies = ref(false)
const { pressing, bind: bindHold } = useLongPress<true>(() => editingProficiencies.value = true)

const proficiencyLevels = computed(() => Object.fromEntries(
  props.character.savingThrowProficiencies.map(k => [k, 1 as ProficiencyLevel]),
) as Partial<Record<AbilityKey, ProficiencyLevel>>)

/** Kept in the card's order rather than the order they were ticked. */
function saveProficiencies(levels: Record<AbilityKey, ProficiencyLevel>) {
  emit('update', {
    savingThrowProficiencies: ABILITIES.map(a => a.key).filter(k => levels[k] > 0),
  })
  editingProficiencies.value = false
}

function saveBonuses(patch: Pick<Character,
  'savingThrowBonuses' | 'savingThrowBonusesByAbility' | 'savingThrowAbilityBonus'>) {
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
    <div
      class="card divide-y divide-surface-700/50 select-none transition-shadow"
      :class="pressing ? 'ring-1 ring-primary-500/60' : ''"
      title="Hold to change proficiencies"
      v-bind="bindHold(true)"
    >
      <div
        v-for="{ key, label } in ABILITIES"
        :key="key"
        class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
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

    <SheetProficiencyDotsModal
      v-if="editingProficiencies"
      :open="editingProficiencies"
      title="Saving throw proficiencies"
      :rows="ABILITIES"
      :value="proficiencyLevels"
      @save="saveProficiencies"
      @close="editingProficiencies = false"
    />
  </div>
</template>
