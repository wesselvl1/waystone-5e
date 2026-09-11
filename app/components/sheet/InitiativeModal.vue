<script setup lang="ts">
/**
 * What the initiative roll is made of.
 *
 * Smaller than the armour class calculator on purpose: there is nothing to choose here,
 * only something to see. Dexterity and the features that move the roll are derived and
 * shown read-only — a player whose sheet says +6 with 14 Dexterity is owed the reason —
 * and the three bonus slots below are the part they can actually set, for the ring and
 * the ruling no rulepack knows about.
 */
import type { Character, InitiativeBonuses } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { compactBonusSet, formatSigned } from '~/services/attacks'
import {
  INITIATIVE_BONUS_KINDS,
  INITIATIVE_BONUS_LABELS,
  initiativeBreakdown,
} from '~/services/initiative'

const props = defineProps<{
  open: boolean
  character: Character
}>()

const emit = defineEmits<{
  save: [Pick<Character, 'initiative' | 'initiativeBonuses'>]
  close: []
}>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const draft = ref<InitiativeBonuses>({})
/** Shown once unfolded — a hand-entered total that ignores everything else. */
const showOverride = ref(false)
const overrideValue = ref(0)

watch(() => props.open, (open) => {
  if (!open) return
  // Filled in rather than left sparse, so every number input has somewhere to write; the
  // zeroes are compacted away again on save.
  draft.value = { ...props.character.initiativeBonuses }
  showOverride.value = props.character.initiative !== null && props.character.initiative !== undefined
  overrideValue.value = props.character.initiative ?? stats.initiative.value
}, { immediate: true })

/**
 * The sum as the draft would leave it: the stored character with this editor's slots, so
 * the total moves while the player types rather than only after a save.
 */
const breakdown = computed(() => initiativeBreakdown(
  { ...props.character, initiative: null, initiativeBonuses: draft.value },
  { modifiers: stats.abilityModifiers.value, proficiencyBonus: stats.profBonus.value },
))

const effectiveTotal = computed(() =>
  showOverride.value ? (overrideValue.value || 0) : breakdown.value.total)

function save() {
  emit('save', {
    initiative: showOverride.value ? (overrideValue.value || 0) : null,
    initiativeBonuses: compactBonusSet(draft.value),
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:max-w-md
            rounded-t-2xl sm:rounded-xl shadow-xl max-h-[88vh] flex flex-col"
        >
          <!-- Header -->
          <div class="flex items-start gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-white leading-tight">Initiative</p>
              <p class="text-xs text-slate-400 mt-0.5 truncate">
                <span class="font-mono text-primary-300 text-sm">{{ formatSigned(effectiveTotal) }}</span>
                · rolled with the d20
              </p>
            </div>
            <button class="btn-ghost p-1.5 flex-shrink-0 -mt-1 -mr-1" title="Close" @click="emit('close')">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="overflow-y-auto p-4 space-y-4">
            <!-- Bonuses: the same three slots an attack and an armour class keep apart -->
            <div class="space-y-2">
              <p class="section-header mb-0">Bonuses</p>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="kind in INITIATIVE_BONUS_KINDS" :key="kind">
                  <label class="label" :title="INITIATIVE_BONUS_LABELS[kind].hint">
                    {{ INITIATIVE_BONUS_LABELS[kind].label }}
                  </label>
                  <input v-model.number="draft[kind]" type="number" class="input" placeholder="0" />
                </div>
              </div>
              <p class="text-[10px] text-slate-500">
                Only what the sheet below has not already counted — a feature that says it
                moves your initiative is read off the feature itself.
              </p>
            </div>

            <!-- The sum, shown working -->
            <div class="card space-y-1" :class="{ 'opacity-50': showOverride }">
              <div
                v-for="(part, i) in breakdown.parts"
                :key="`${part.label}-${i}`"
                class="flex items-baseline gap-2 text-xs"
              >
                <span class="text-slate-400 flex-1 min-w-0 truncate">{{ part.label }}</span>
                <span class="font-mono tabular-nums" :class="part.value < 0 ? 'text-danger-400' : 'text-slate-200'">
                  {{ formatSigned(part.value) }}
                </span>
              </div>
              <div class="flex items-baseline gap-2 pt-1 border-t border-surface-700 text-sm">
                <span class="text-slate-300 flex-1 font-medium">Initiative</span>
                <span class="font-mono tabular-nums font-bold text-primary-300">
                  {{ formatSigned(breakdown.total) }}
                </span>
              </div>
            </div>

            <!-- The escape hatch, folded away: a total that ignores everything above. -->
            <div>
              <button
                class="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                @click="showOverride = !showOverride"
              >
                {{ showOverride ? 'Use the calculated initiative' : 'Override the initiative' }}
              </button>
              <div v-if="showOverride" class="mt-2">
                <input v-model.number="overrideValue" type="number" class="input" placeholder="e.g. 5" />
                <p class="text-[10px] text-slate-500 mt-1">
                  Replaces everything above. The bonuses are kept, so you can switch back.
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-2 p-4 pt-3 border-t border-surface-700/60">
            <div class="flex-1" />
            <button class="btn-ghost text-xs" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-xs" @click="save">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
