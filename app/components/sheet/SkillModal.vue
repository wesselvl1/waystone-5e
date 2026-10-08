<script setup lang="ts">
/**
 * What one skill is made of, and the only place its proficiency changes.
 *
 * A tap on the Skills card's dot used to cycle it, and a thumb scrolling the sheet tapped
 * them by accident; the card now opens this on a hold. The proficiency, the ability and
 * the bonus are laid out the way the total adds them up, and the total moves as the
 * boxes are ticked. There is no Cancel: whatever is on screen when it closes is kept,
 * since it was opened on purpose and Done is the only way out it offers.
 */
import type { Character, ProficiencyLevel, SkillKey } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { formatSigned } from '~/services/attacks'

const props = defineProps<{
  open: boolean
  character: Character
  skill: SkillKey
  label: string
}>()

const emit = defineEmits<{
  save: [Pick<Character, 'skillProficiencies' | 'skillBonuses'>]
  close: []
}>()

const level = ref<ProficiencyLevel>(0)
const misc = ref<number | ''>('')

watch(() => props.open, (open) => {
  if (!open) return
  level.value = (props.character.skillProficiencies[props.skill] ?? 0) as ProficiencyLevel
  misc.value = props.character.skillBonuses?.[props.skill] || ''
}, { immediate: true })

const miscValue = computed(() => typeof misc.value === 'number' && Number.isFinite(misc.value) ? misc.value : 0)

/** The character as the draft would leave it, so the total moves while boxes are ticked. */
const preview = computed<Character>(() => ({
  ...props.character,
  skillProficiencies: { ...props.character.skillProficiencies, [props.skill]: level.value },
  skillBonuses: { ...props.character.skillBonuses, [props.skill]: miscValue.value },
}))
const stats = useCharacterStats(preview)

const parts = computed(() => stats.skillBreakdowns.value[props.skill])
const halfSource = computed(() => stats.skillHalfProficiency.value[props.skill] ?? null)

const proficient = computed({
  get: () => level.value >= 1,
  // Expertise is double the proficiency, so it goes with it
  set: (on: boolean) => { level.value = on ? Math.max(level.value, 1) as ProficiencyLevel : 0 },
})

const expertise = computed({
  get: () => level.value === 2,
  set: (on: boolean) => { level.value = on ? 2 : 1 },
})

function close() {
  const storedLevel = props.character.skillProficiencies[props.skill] ?? 0
  const storedMisc = props.character.skillBonuses?.[props.skill] ?? 0
  if (level.value !== storedLevel || miscValue.value !== storedMisc) {
    const bonuses = { ...props.character.skillBonuses }
    if (miscValue.value) bonuses[props.skill] = miscValue.value
    else delete bonuses[props.skill]
    emit('save', {
      skillProficiencies: { ...props.character.skillProficiencies, [props.skill]: level.value },
      skillBonuses: Object.keys(bonuses).length > 0 ? bonuses : undefined,
    })
  }
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const ABILITY_SHORT: Record<string, string> = {
  str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha',
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && parts"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="close"
      >
        <div class="bg-surface-800 border border-surface-600 w-full max-w-xs rounded-xl shadow-xl flex flex-col">
          <div class="p-5 pb-4 text-center">
            <p class="text-xl font-semibold text-white leading-tight">{{ label }}</p>
            <p class="font-mono text-3xl font-bold text-primary-400 mt-1">{{ formatSigned(parts.total) }}</p>

            <!-- The sum, in the order it adds up -->
            <div class="grid grid-cols-3 gap-3 mt-4">
              <div>
                <p class="font-mono text-lg pb-1 border-b border-surface-600" :class="parts.proficiency ? 'text-slate-100' : 'text-slate-500'">
                  {{ parts.proficiency }}
                </p>
                <p class="text-[11px] text-slate-400 mt-1 leading-tight">{{ halfSource ? 'Half Prof' : 'Prof Bonus' }}</p>
              </div>
              <div>
                <p class="font-mono text-lg pb-1 border-b border-surface-600 text-slate-500">
                  {{ parts.abilityMod }}
                </p>
                <p class="text-[11px] text-slate-400 mt-1 leading-tight">{{ ABILITY_SHORT[parts.ability] }}</p>
              </div>
              <div>
                <input
                  v-model.number="misc"
                  type="number"
                  inputmode="numeric"
                  placeholder="0"
                  class="w-full bg-transparent text-center font-mono text-lg text-slate-100 pb-1 border-b border-surface-600
                    focus:border-primary-500 focus:outline-none placeholder:text-slate-500
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Misc bonus"
                />
                <p class="text-[11px] text-slate-400 mt-1 leading-tight">Misc Bonus</p>
              </div>
            </div>

            <div class="mt-5 space-y-3 text-left inline-block">
              <label class="flex items-center gap-3 text-sm text-slate-200 cursor-pointer">
                <input v-model="proficient" type="checkbox" class="w-5 h-5 rounded accent-primary-500" />
                Skill Proficiency
              </label>
              <label
                class="flex items-center gap-3 text-sm cursor-pointer"
                :class="proficient ? 'text-slate-200' : 'text-slate-500'"
              >
                <input v-model="expertise" type="checkbox" class="w-5 h-5 rounded accent-accent-400" :disabled="!proficient" />
                Expertise <span class="text-[11px] text-slate-500">(double proficiency)</span>
              </label>
            </div>

            <p v-if="halfSource" class="text-[11px] text-slate-500 mt-3">
              {{ halfSource }} adds half your proficiency bonus while you have none.
            </p>
          </div>

          <button class="border-t border-surface-700/60 py-3 text-sm font-medium text-white hover:bg-surface-700/50 rounded-b-xl" @click="close">
            Done
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
