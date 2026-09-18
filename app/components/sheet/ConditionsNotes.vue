<script setup lang="ts">
import type { Character } from '~/types/character'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
]

function toggleCondition(condition: string) {
  const lower = condition.toLowerCase()
  const current = props.character.conditions
  const updated = current.includes(lower)
    ? current.filter(c => c !== lower)
    : [...current, lower]
  emit('update', { conditions: updated })
}

function isActive(condition: string) {
  return props.character.conditions.includes(condition.toLowerCase())
}

/** Whether there is anything to show in the resistances card at all, so an empty card
    does not sit between Conditions and Proficiencies for a character with none. */
const hasResistances = computed(() =>
  (props.character.damageResistances?.length ?? 0) > 0
  || (props.character.damageImmunities?.length ?? 0) > 0
  || (props.character.conditionImmunities?.length ?? 0) > 0)

const draftNotes = ref(props.character.notes)
watch(() => props.character.notes, v => { draftNotes.value = v })

function saveNotes() {
  emit('update', { notes: draftNotes.value })
}

const draftAppearance = ref(props.character.appearance ?? '')
watch(() => props.character.appearance, v => { draftAppearance.value = v ?? '' })

function saveAppearance() {
  emit('update', { appearance: draftAppearance.value })
}
</script>

<template>
  <div class="space-y-3">
    <!-- Active conditions -->
    <div class="card">
      <p class="section-header">Conditions</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="condition in CONDITIONS"
          :key="condition"
          class="text-xs px-2.5 py-1 rounded-full border transition-colors"
          :class="isActive(condition)
            ? 'bg-danger-500/20 border-danger-500/60 text-danger-300'
            : 'bg-surface-700 border-surface-600 text-slate-400 hover:border-slate-500'"
          @click="toggleCondition(condition)"
        >
          {{ condition }}
        </button>
      </div>
    </div>

    <!-- Resistances & immunities granted by race, subrace or a feature that says so —
         Hellish Resistance, Dwarven Resilience. Read-only: they come from rulepack data
         (backfilled or set at creation), not something typed free-form on this tab. -->
    <div v-if="hasResistances" class="card space-y-2">
      <p class="section-header">Resistances &amp; Immunities</p>
      <div v-if="character.damageResistances?.length" class="space-y-1">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Damage Resistance</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="r in character.damageResistances"
            :key="r"
            class="text-xs px-2.5 py-1 rounded-full border border-surface-600 bg-surface-700 text-slate-300 capitalize"
          >{{ r }}</span>
        </div>
      </div>
      <div v-if="character.damageImmunities?.length" class="space-y-1">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Damage Immunity</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="r in character.damageImmunities"
            :key="r"
            class="text-xs px-2.5 py-1 rounded-full border border-surface-600 bg-surface-700 text-slate-300 capitalize"
          >{{ r }}</span>
        </div>
      </div>
      <div v-if="character.conditionImmunities?.length" class="space-y-1">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Condition Immunity</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="r in character.conditionImmunities"
            :key="r"
            class="text-xs px-2.5 py-1 rounded-full border border-surface-600 bg-surface-700 text-slate-300 capitalize"
          >{{ r }}</span>
        </div>
      </div>
    </div>

    <!-- Proficiencies -->
    <SheetProficienciesPanel :character="character" @update="emit('update', $event)" />

    <!-- Appearance -->
    <div class="card space-y-2">
      <p class="section-header">Appearance</p>
      <textarea
        v-model="draftAppearance"
        rows="3"
        class="input resize-none"
        placeholder="Age, height, weight, eyes, hair…"
        @blur="saveAppearance"
      />
    </div>

    <!-- Character art -->
    <SheetCharacterArt :character="character" @update="emit('update', $event)" />

    <!-- Notes -->
    <div class="card space-y-2">
      <p class="section-header">Notes</p>
      <textarea
        v-model="draftNotes"
        rows="6"
        class="input resize-none"
        placeholder="Session notes, backstory, reminders…"
        @blur="saveNotes"
      />
    </div>
  </div>
</template>
