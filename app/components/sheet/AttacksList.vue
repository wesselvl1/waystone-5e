<script setup lang="ts">
import type { Character, AttackEntry } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { attackBonus, formatDamage, formatSigned } from '~/services/attacks'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

/** Open on an existing attack to edit it, or on null to build a new one. */
const editing = ref<AttackEntry | null>(null)
const editorOpen = ref(false)

const context = computed(() => ({
  modifiers: stats.abilityModifiers.value,
  proficiencyBonus: stats.profBonus.value,
}))

function openNew() {
  editing.value = null
  editorOpen.value = true
}

function openEdit(attack: AttackEntry) {
  editing.value = attack
  editorOpen.value = true
}

/** One path for both: an id already in the list replaces its entry, a new one appends. */
function saveAttack(entry: AttackEntry) {
  const existing = props.character.attacks.some(a => a.id === entry.id)
  const attacks = existing
    ? props.character.attacks.map(a => (a.id === entry.id ? entry : a))
    : [...props.character.attacks, entry]
  emit('update', { attacks })
  editorOpen.value = false
}

function removeAttack(id: string) {
  emit('update', { attacks: props.character.attacks.filter(a => a.id !== id) })
  editorOpen.value = false
}

function displayBonus(attack: AttackEntry): string {
  return formatSigned(attackBonus(attack, context.value))
}

function displayDamage(attack: AttackEntry): string {
  return formatDamage(attack, context.value)
}

/**
 * The line under the name: what the attack is, rather than repeating its numbers.
 *
 * Split rather than joined into one string because only the property tags may be
 * title-cased. They are stored lowercase by the schema, so the sheet capitalises them —
 * but the same CSS over a range or a free-text note turns "150/600 ft." into "150/600
 * Ft." and capitalises every word the player wrote.
 */
function subtitle(attack: AttackEntry): { properties: string; plain: string } {
  const plain: string[] = []
  if (attack.range) plain.push(`${attack.range} ft.`)
  if (attack.notes?.trim()) plain.push(attack.notes.trim())
  return { properties: attack.properties?.join(', ') ?? '', plain: plain.join(' · ') }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <p class="section-header mb-0">Attacks</p>
      <button class="btn-ghost text-xs py-1 px-2" @click="openNew">+ Add</button>
    </div>

    <div class="card space-y-0 divide-y divide-surface-700/50">
      <div v-if="character.attacks.length === 0" class="text-slate-500 text-sm py-2 text-center">
        No attacks yet
      </div>

      <button
        v-for="attack in character.attacks"
        :key="attack.id"
        class="w-full flex items-center gap-3 py-2 first:pt-0 last:pb-0 text-left
          hover:bg-surface-700/30 transition-colors -mx-1 px-1 rounded"
        @click="openEdit(attack)"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{{ attack.name }}</p>
          <p v-if="subtitle(attack).properties || subtitle(attack).plain" class="text-xs text-slate-500 truncate">
            <span class="capitalize">{{ subtitle(attack).properties }}</span>
            <span v-if="subtitle(attack).properties && subtitle(attack).plain"> · </span>
            <span>{{ subtitle(attack).plain }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2 text-sm flex-shrink-0">
          <span class="font-mono text-primary-300">{{ displayBonus(attack) }}</span>
          <span class="text-slate-400">{{ displayDamage(attack) }}</span>
          <span class="text-xs text-slate-500 capitalize">{{ attack.damageType }}</span>
        </div>
        <svg
          class="w-3.5 h-3.5 text-slate-600 flex-shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <SheetAttackEditModal
      :open="editorOpen"
      :attack="editing"
      :character="character"
      @save="saveAttack"
      @remove="removeAttack"
      @close="editorOpen = false"
    />
  </div>
</template>
