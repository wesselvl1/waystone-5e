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

    <!-- Proficiencies -->
    <div class="card">
      <p class="section-header">Other Proficiencies & Languages</p>
      <p class="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
        {{ character.otherProficiencies.join(', ') || '—' }}
      </p>
    </div>

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
