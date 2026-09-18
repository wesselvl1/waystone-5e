<script setup lang="ts">
/**
 * What one saving throw is made of.
 *
 * Built like the initiative modal: the ability, the proficiency and whatever the features
 * say are derived and shown read-only — a paladin whose Wisdom save reads +9 off a +1
 * modifier is owed the reason — and below sit the parts the player can actually set.
 *
 * Both of those parts apply to every save rather than this one, which the labels say out
 * loud. A cloak of protection is a +1 to all six, and asking for it once per ability
 * would be six chances to enter it differently.
 */
import type { AbilityKey, Character, SavingThrowBonuses } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { compactBonusSet, formatSigned } from '~/services/attacks'
import {
  SAVING_THROW_ABILITY_LABELS,
  SAVING_THROW_BONUS_KINDS,
  SAVING_THROW_BONUS_LABELS,
  savingThrowBreakdown,
} from '~/services/savingThrows'

const props = defineProps<{
  open: boolean
  character: Character
  ability: AbilityKey
}>()

const emit = defineEmits<{
  save: [Pick<Character, 'savingThrowBonuses' | 'savingThrowAbilityBonus'>]
  close: []
}>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const draft = ref<SavingThrowBonuses>({})
/** 'derive' reads the aura off the features; anything else overrides that reading. */
const abilityChoice = ref<AbilityKey | 'none' | 'derive'>('derive')
const minimum = ref(0)

const ABILITY_OPTIONS = Object.entries(SAVING_THROW_ABILITY_LABELS) as [AbilityKey, string][]

watch(() => props.open, (open) => {
  if (!open) return
  // Filled in rather than left sparse, so every number input has somewhere to write; the
  // zeroes are compacted away again on save.
  draft.value = { ...props.character.savingThrowBonuses }
  const setting = props.character.savingThrowAbilityBonus
  abilityChoice.value = setting ? setting.ability : 'derive'
  minimum.value = setting?.minimum ?? 0
}, { immediate: true })

const abilityBonusSetting = computed(() => {
  if (abilityChoice.value === 'derive') return null
  if (abilityChoice.value === 'none') return { ability: 'none' as const }
  return {
    ability: abilityChoice.value,
    ...(minimum.value ? { minimum: minimum.value } : {}),
  }
})

/**
 * The sum as the draft would leave it: the stored character with this editor's settings,
 * so the total moves while the player types rather than only after a save.
 */
const preview = computed<Character>(() => ({
  ...props.character,
  savingThrowBonuses: draft.value,
  savingThrowAbilityBonus: abilityBonusSetting.value,
}))

const ctx = computed(() => ({
  modifiers: stats.abilityModifiers.value,
  proficiencyBonus: stats.profBonus.value,
}))

const breakdown = computed(() => savingThrowBreakdown(preview.value, props.ability, ctx.value))

/** The other five, so a change that touches all six can be seen doing it. */
const otherSaves = computed(() => ABILITY_OPTIONS
  .filter(([key]) => key !== props.ability)
  .map(([key, label]) => ({
    key,
    label,
    total: savingThrowBreakdown(preview.value, key, ctx.value).total,
  })))

function save() {
  emit('save', {
    savingThrowBonuses: compactBonusSet(draft.value),
    savingThrowAbilityBonus: abilityBonusSetting.value,
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
              <p class="text-base font-semibold text-white leading-tight">
                {{ SAVING_THROW_ABILITY_LABELS[ability] }} Save
              </p>
              <p class="text-xs text-slate-400 mt-0.5 truncate">
                <span class="font-mono text-primary-300 text-sm">{{ formatSigned(breakdown.total) }}</span>
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
            <!-- The sum, shown working -->
            <div class="card space-y-1">
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
                <span class="text-slate-300 flex-1 font-medium">
                  {{ SAVING_THROW_ABILITY_LABELS[ability] }} save
                </span>
                <span class="font-mono tabular-nums font-bold text-primary-300">
                  {{ formatSigned(breakdown.total) }}
                </span>
              </div>
            </div>

            <!-- Bonuses: the same three slots an attack and an armour class keep apart -->
            <div class="space-y-2">
              <p class="section-header mb-0">Bonuses to every save</p>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="kind in SAVING_THROW_BONUS_KINDS" :key="kind">
                  <label class="label" :title="SAVING_THROW_BONUS_LABELS[kind].hint">
                    {{ SAVING_THROW_BONUS_LABELS[kind].label }}
                  </label>
                  <input v-model.number="draft[kind]" type="number" class="input" placeholder="0" />
                </div>
              </div>
              <p class="text-[10px] text-slate-500">
                Only what the features below have not already counted — a feature that says
                it adds to your saves is read off the feature itself.
              </p>
            </div>

            <!-- The aura: an ability modifier on every save -->
            <div class="space-y-2">
              <p class="section-header mb-0">Ability modifier on every save</p>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="label">Ability</label>
                  <select v-model="abilityChoice" class="input">
                    <option value="derive">From your features</option>
                    <option value="none">None</option>
                    <option v-for="[key, label] in ABILITY_OPTIONS" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select>
                </div>
                <div v-if="abilityChoice !== 'derive' && abilityChoice !== 'none'">
                  <label class="label" title="Aura of Protection's minimum bonus of +1">
                    Minimum
                  </label>
                  <input v-model.number="minimum" type="number" class="input" placeholder="0" />
                </div>
              </div>
              <p class="text-[10px] text-slate-500">
                A paladin's Aura of Protection is read off the feature already. Set one
                here for a homebrew the sheet cannot read, or for the round you spend
                inside someone else's aura — it replaces what was read, rather than
                stacking with it.
              </p>
            </div>

            <!-- What the same change did to the other five -->
            <div class="space-y-1">
              <p class="section-header mb-0">The other saves</p>
              <div class="card grid grid-cols-2 gap-x-4 gap-y-1">
                <div
                  v-for="save_ in otherSaves"
                  :key="save_.key"
                  class="flex items-baseline gap-2 text-xs"
                >
                  <span class="text-slate-400 flex-1 min-w-0 truncate">{{ save_.label }}</span>
                  <span class="font-mono tabular-nums" :class="save_.total < 0 ? 'text-danger-400' : 'text-slate-200'">
                    {{ formatSigned(save_.total) }}
                  </span>
                </div>
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
