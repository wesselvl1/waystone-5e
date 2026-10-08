<script setup lang="ts" generic="K extends string">
/**
 * Where the skill and saving-throw dots are changed, now that the cards only show them.
 *
 * A dot on the sheet used to change on a single tap, and the sheet is a page that gets
 * scrolled with a thumb, so a proficiency could be lost on the way to something else.
 * The cards open this on a hold instead, and the changes are a draft until Save, so a
 * stray tap in here is undone by Cancel.
 */
import type { ProficiencyLevel } from '~/types/character'

interface ProficiencyRow<K extends string> {
  key: K
  label: string
  /** Printed small beside the label — the ability a skill rolls with. */
  detail?: string
  /** The feature lending this row half a proficiency bonus, shown on the dot. */
  half?: string | null
}

const props = defineProps<{
  open: boolean
  title: string
  rows: ProficiencyRow<K>[]
  value: Partial<Record<K, ProficiencyLevel>>
  /** Saves stop at proficient; skills go on to expertise. */
  allowExpertise?: boolean
}>()

const emit = defineEmits<{
  save: [Record<K, ProficiencyLevel>]
  close: []
}>()

/** Replaced whole on every tap, so it need not be deep. */
const draft = shallowRef({} as Record<K, ProficiencyLevel>)

watch(() => props.open, (open) => {
  if (!open) return
  const next = {} as Record<K, ProficiencyLevel>
  for (const row of props.rows) next[row.key] = props.value[row.key] ?? 0
  draft.value = next
}, { immediate: true })

function cycle(key: K) {
  const current = draft.value[key] ?? 0
  const next: ProficiencyLevel = current === 0 ? 1 : current === 1 && props.allowExpertise ? 2 : 0
  draft.value = { ...draft.value, [key]: next }
}

function stateLabel(row: ProficiencyRow<K>): string {
  const level = draft.value[row.key] ?? 0
  if (level === 2) return 'Expertise'
  if (level === 1) return 'Proficient'
  return row.half ? 'Half' : ''
}

const changed = computed(() =>
  props.rows.some(r => (draft.value[r.key] ?? 0) !== (props.value[r.key] ?? 0)))

function save() {
  emit('save', { ...draft.value })
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
          class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:min-w-[24rem] sm:max-w-md
            rounded-t-2xl sm:rounded-xl shadow-xl max-h-[88vh] flex flex-col"
        >
          <!-- Header -->
          <div class="flex items-start gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-white leading-tight">{{ title }}</p>
              <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                <span class="flex items-center gap-1.5"><span class="proficiency-dot active cursor-default" /> Proficient</span>
                <span v-if="allowExpertise" class="flex items-center gap-1.5"><span class="proficiency-dot expertise cursor-default" /> Expertise</span>
              </p>
            </div>
            <button class="btn-ghost p-1.5 flex-shrink-0 -mt-1 -mr-1" title="Close" @click="emit('close')">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="overflow-y-auto px-2 py-2">
            <button
              v-for="row in rows"
              :key="row.key"
              class="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-700/60 transition-colors"
              :title="row.half ? `${row.half}: half proficiency` : undefined"
              @click="cycle(row.key)"
            >
              <span
                class="proficiency-dot"
                :class="{
                  half: !!row.half,
                  active: draft[row.key] === 1,
                  expertise: draft[row.key] === 2,
                }"
              />
              <span class="flex-1 text-sm text-slate-200">{{ row.label }}</span>
              <span v-if="row.detail" class="text-[10px] text-slate-500 w-6 text-right">{{ row.detail }}</span>
              <span class="text-[10px] uppercase tracking-wider text-slate-500 w-16 text-right">{{ stateLabel(row) }}</span>
            </button>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-2 p-4 pt-3 border-t border-surface-700/60">
            <p class="flex-1 text-[10px] text-slate-500">
              Tap a row to change it.
            </p>
            <button class="btn-ghost text-xs" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-xs" :disabled="!changed" @click="save">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
