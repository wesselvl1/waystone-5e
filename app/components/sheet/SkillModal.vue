<script setup lang="ts">
/**
 * What one skill is made of, and the only place its proficiency changes.
 *
 * A tap on the Skills card's dot used to cycle it, and a thumb scrolling the sheet tapped
 * them by accident; the card now opens this on a hold. The proficiency, the ability and
 * the bonus are laid out the way the total adds them up, and the total moves as the
 * boxes are ticked. Half, whole and expertise are three boxes but one answer, so ticking
 * one clears the other two. There is no Cancel: whatever is on screen when it closes is
 * kept, since it was opened on purpose and Done is the only way out it offers.
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
  save: [Pick<Character, 'skillProficiencies' | 'skillBonuses' | 'skillHalfProficiency'>]
  close: []
}>()

/**
 * One of four, since the three boxes are one answer: ticking one clears the others, and
 * clearing the ticked one leaves none.
 */
type Mode = 'none' | 'half' | 'full' | 'expertise'
const mode = ref<Mode>('none')
const misc = ref<number | ''>('')

const stats = useCharacterStats(computed(() => props.character))

watch(() => props.open, (open) => {
  if (!open) return
  const level = props.character.skillProficiencies[props.skill] ?? 0
  mode.value = level === 2
    ? 'expertise'
    : level === 1
      ? 'full'
      : stats.skillHalfProficiency.value[props.skill] ? 'half' : 'none'
  misc.value = props.character.skillBonuses?.[props.skill] || ''
}, { immediate: true })

function toggle(next: Exclude<Mode, 'none'>) {
  mode.value = mode.value === next ? 'none' : next
}

const miscValue = computed(() => typeof misc.value === 'number' && Number.isFinite(misc.value) ? misc.value : 0)

/** Whether the features alone give this skill half — what "derived" means for the box. */
const featureHalf = computed(() => stats.skillBreakdowns.value[props.skill]?.featureHalf ?? false)

/**
 * What the draft writes. Half is stored only where it disagrees with the features, so a
 * bard's Jack of All Trades stays derived and a later level that changes it still shows;
 * a whole proficiency leaves the half setting alone, since half never applies under it.
 */
const patch = computed<Pick<Character, 'skillProficiencies' | 'skillBonuses' | 'skillHalfProficiency'>>(() => {
  const level: ProficiencyLevel = mode.value === 'expertise' ? 2 : mode.value === 'full' ? 1 : 0

  const bonuses = { ...props.character.skillBonuses }
  if (miscValue.value) bonuses[props.skill] = miscValue.value
  else delete bonuses[props.skill]

  const halves = { ...props.character.skillHalfProficiency }
  if (mode.value === 'half' || mode.value === 'none') {
    const wanted = mode.value === 'half'
    if (wanted === featureHalf.value) delete halves[props.skill]
    else halves[props.skill] = wanted
  }

  return {
    skillProficiencies: { ...props.character.skillProficiencies, [props.skill]: level },
    skillBonuses: Object.keys(bonuses).length > 0 ? bonuses : undefined,
    skillHalfProficiency: Object.keys(halves).length > 0 ? halves : undefined,
  }
})

/** The character as the draft would leave it, so the total moves while boxes are ticked. */
const preview = computed<Character>(() => ({ ...props.character, ...patch.value }))
const previewStats = useCharacterStats(preview)

const parts = computed(() => previewStats.skillBreakdowns.value[props.skill])

function close() {
  const before = JSON.stringify([
    props.character.skillProficiencies[props.skill] ?? 0,
    props.character.skillBonuses?.[props.skill] ?? 0,
    props.character.skillHalfProficiency?.[props.skill],
  ])
  const after = JSON.stringify([
    patch.value.skillProficiencies[props.skill],
    patch.value.skillBonuses?.[props.skill] ?? 0,
    patch.value.skillHalfProficiency?.[props.skill],
  ])
  if (before !== after) emit('save', patch.value)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const BOXES: { mode: Exclude<Mode, 'none'>, label: string }[] = [
  { mode: 'half', label: 'Half' },
  { mode: 'full', label: 'Full' },
  { mode: 'expertise', label: 'Expertise' },
]

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
                <p class="text-[11px] text-slate-400 mt-1 leading-tight">{{ mode === 'half' ? 'Half Prof' : 'Prof Bonus' }}</p>
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
              <label
                v-for="box in BOXES"
                :key="box.mode"
                class="flex items-center gap-3 text-sm text-slate-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="w-5 h-5 rounded"
                  :class="box.mode === 'expertise' ? 'accent-accent-400' : 'accent-primary-500'"
                  :checked="mode === box.mode"
                  @change="toggle(box.mode)"
                />
                {{ box.label }}
              </label>
            </div>

            <p v-if="featureHalf" class="text-[11px] text-slate-500 mt-3">
              Your features give this skill half proficiency while it has none.
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
