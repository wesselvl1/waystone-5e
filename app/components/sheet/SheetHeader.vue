<script setup lang="ts">
import type { Character } from '~/types/character'
import { useRulepacksStore } from '~/stores/rulepacks'
import { xpProgress } from '~/utils/experience'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rulepackStore = useRulepacksStore()

const raceName = computed(() => rulepackStore.getRace(props.character.race)?.name ?? props.character.race)
// The stored value is the background's id, which by convention carries a source
// abbreviation ("tce-guild-artisan"). The sheet names the background; the source belongs
// to the picker in the creation wizard, where it tells two books' versions apart.
const backgroundName = computed(() =>
  rulepackStore.getBackground(props.character.background)?.name ?? props.character.background)
const classLabel = computed(() =>
  props.character.classes
    .map(c => {
      const cls = rulepackStore.getClass(c.classId)
      const sub = c.subclassId ? rulepackStore.getSubclass(c.subclassId) : undefined
      const subLabel = sub ? ` (${sub.name})` : ''
      return `${cls?.name ?? c.classId}${subLabel} ${c.level}`
    })
    .join(' / '),
)
const totalLevel = computed(() => props.character.classes.reduce((s, c) => s + c.level, 0))

const editingName = ref(false)
const draftName = ref(props.character.name)

watch(() => props.character.name, (newName) => {
  if (!editingName.value) draftName.value = newName
})

function saveName() {
  if (draftName.value.trim()) emit('update', { name: draftName.value.trim() })
  editingName.value = false
}

function cancelEdit() {
  draftName.value = props.character.name
  editingName.value = false
}

const xp = computed(() => xpProgress(props.character.experiencePoints, totalLevel.value))

const editingXp = ref(false)
// `v-model` on a number input hands back a number, or '' while the field is empty.
const xpDraft = ref<number | string>('')
const xpInput = ref<HTMLInputElement | null>(null)

function openXpEditor() {
  editingXp.value = true
  xpDraft.value = ''
  nextTick(() => xpInput.value?.focus())
}

function closeXpEditor() {
  editingXp.value = false
  xpDraft.value = ''
}

/** The typed amount, or undefined when the field is empty or not a number. */
const xpAmount = computed(() => {
  const raw = String(xpDraft.value).trim()
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
})

/** Award (or, with a negative amount, take back) XP. Total XP never goes below zero. */
function addXp() {
  const amount = xpAmount.value
  if (amount === undefined) { closeXpEditor(); return }
  emit('update', { experiencePoints: Math.max(0, props.character.experiencePoints + amount) })
  closeXpEditor()
}

/** Overwrite the total, for a sheet copied in from elsewhere. */
function setXp() {
  const amount = xpAmount.value
  if (amount === undefined) { closeXpEditor(); return }
  emit('update', { experiencePoints: Math.max(0, amount) })
  closeXpEditor()
}

const numberFormat = new Intl.NumberFormat()
function fmt(n: number) {
  return numberFormat.format(n)
}
</script>

<template>
  <div class="card space-y-1">
    <!-- Name row -->
    <div class="flex items-center gap-2">
      <template v-if="editingName">
        <input
          v-model="draftName"
          class="input flex-1 text-lg font-semibold"
          autofocus
          @blur="saveName"
          @keydown.enter="saveName"
          @keydown.esc="cancelEdit"
        />
      </template>
      <template v-else>
        <button
          type="button"
          class="flex-1 text-xl font-semibold text-white truncate text-left cursor-pointer hover:text-primary-300 transition-colors"
          @click="editingName = true"
        >
          {{ character.name }}
        </button>
      </template>
      <div
        class="px-2 py-0.5 rounded-full text-xs font-bold border"
        :class="character.inspiration ? 'bg-accent-400/20 border-accent-400/60 text-accent-400' : 'bg-surface-700 border-surface-600 text-slate-500'"
        title="Inspiration"
        @click="emit('update', { inspiration: !character.inspiration })"
      >
        ★
      </div>
    </div>

    <!-- Meta row -->
    <div class="flex items-center gap-2 flex-wrap text-sm text-slate-400">
      <span class="text-primary-300 font-medium">{{ classLabel }}</span>
      <span class="text-slate-600">·</span>
      <span>{{ raceName }}</span>
      <span class="text-slate-600">·</span>
      <span class="text-slate-500">Level {{ totalLevel }}</span>
      <span v-if="character.background" class="text-slate-600">·</span>
      <span v-if="character.background" class="text-slate-500">{{ backgroundName }}</span>
    </div>

    <!-- XP bar -->
    <div class="pt-1">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-1 hover:text-slate-300 transition-colors"
        :title="editingXp ? 'Close the XP editor' : 'Add or set experience points'"
        @click="editingXp ? closeXpEditor() : openXpEditor()"
      >
        <span class="flex items-center gap-1.5">
          <span>XP</span>
          <span v-if="xp.canLevelUp" class="text-success-400 font-medium">Level up ready</span>
        </span>
        <span class="tabular-nums">
          {{ fmt(character.experiencePoints) }}
          <template v-if="xp.nextLevelAt !== undefined">
            <span class="text-slate-600">/ {{ fmt(xp.nextLevelAt) }}</span>
          </template>
        </span>
      </button>
      <div class="h-1 bg-surface-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="xp.canLevelUp ? 'bg-success-500' : 'bg-primary-600'"
          :style="{ width: `${xp.fraction * 100}%` }"
        />
      </div>

      <div v-if="editingXp" class="mt-2 flex items-center gap-1.5">
        <input
          ref="xpInput"
          v-model="xpDraft"
          type="number"
          inputmode="numeric"
          class="input flex-1 py-1.5 tabular-nums"
          placeholder="Amount"
          @keydown.enter="addXp"
          @keydown.esc="closeXpEditor"
        />
        <button type="button" class="btn-primary px-3 py-1.5" :disabled="xpAmount === undefined" @click="addXp">
          Add
        </button>
        <button type="button" class="btn-ghost px-3 py-1.5" :disabled="xpAmount === undefined" title="Replace the total instead of adding to it" @click="setXp">
          Set
        </button>
      </div>
    </div>
  </div>
</template>
