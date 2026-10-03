<script setup lang="ts">
import { evaluateAmount, halveExpression, isExpression } from '~/services/hpMath'

/**
 * The amount box of a Damage / Heal modal, shared by the character's and a wild-shape
 * form's. It takes a sum rather than a number — `37/2` for a resisted hit, `8+7/2` for
 * one half resisted — and shows what it comes to.
 *
 * It brings its own keypad and keeps the phone's keyboard shut (`inputmode="none"`).
 * A phone's number pad has no operators, its full keyboard hides them a page away, and
 * either one covers the bottom half of the screen — the New total and the Apply button
 * with it. A physical keyboard still types into the box as normal.
 */
const props = defineProps<{ modelValue: string; inputId: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; submit: []; cancel: [] }>()

const input = ref<HTMLInputElement | null>(null)

const amount = computed(() => evaluateAmount(props.modelValue))
const showsResult = computed(() => isExpression(props.modelValue))

type Key = { label: string; insert?: string; action?: 'halve' | 'back' | 'clear'; wide?: boolean; tone?: 'op' | 'fn' }

const KEYS: Key[] = [
  { label: '(', insert: '(', tone: 'fn' },
  { label: ')', insert: ')', tone: 'fn' },
  { label: '½', action: 'halve', tone: 'fn' },
  { label: '⌫', action: 'back', tone: 'fn' },
  { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
  { label: '÷', insert: '/', tone: 'op' },
  { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
  { label: '×', insert: '*', tone: 'op' },
  { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
  { label: '−', insert: '-', tone: 'op' },
  { label: 'C', action: 'clear', tone: 'fn' },
  { label: '0', insert: '0', wide: true },
  { label: '+', insert: '+', tone: 'op' },
]

/** Where the caret is, falling back to the end when the box has never been focused. */
function selection(): [number, number] {
  const el = input.value
  const end = props.modelValue.length
  return [el?.selectionStart ?? end, el?.selectionEnd ?? end]
}

function write(value: string, caret: number) {
  emit('update:modelValue', value)
  nextTick(() => {
    input.value?.focus()
    input.value?.setSelectionRange(caret, caret)
  })
}

function press(key: Key) {
  const value = props.modelValue
  const [start, end] = selection()
  if (key.insert !== undefined) {
    // Inserted at the caret, so a forgotten bracket can be put where it belongs.
    write(value.slice(0, start) + key.insert + value.slice(end), start + key.insert.length)
  }
  else if (key.action === 'back') {
    if (start !== end) write(value.slice(0, start) + value.slice(end), start)
    else if (start > 0) write(value.slice(0, start - 1) + value.slice(start), start - 1)
  }
  else if (key.action === 'clear') {
    write('', 0)
  }
  else if (key.action === 'halve') {
    const next = halveExpression(value)
    write(next, next.length)
  }
}

function keyClass(key: Key): string {
  const tone = key.tone === 'op'
    ? 'text-primary-300 bg-surface-700/70'
    : key.tone === 'fn'
      ? 'text-accent-300 bg-surface-700/70'
      : 'text-slate-100 bg-surface-700'
  return `${tone}${key.wide ? ' col-span-2' : ''}`
}
</script>

<template>
  <div class="mb-3">
    <!-- Text, not number: a number input rejects "8+7/2" outright. -->
    <input
      :id="inputId"
      ref="input"
      :value="modelValue"
      type="text"
      inputmode="none"
      autocomplete="off"
      placeholder="0"
      class="input w-full text-center text-2xl font-bold"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="emit('submit')"
      @keydown.esc="emit('cancel')"
    >
    <p class="h-4 mt-1 text-center text-xs font-mono" :class="amount === null ? 'text-slate-600' : 'text-slate-400'">
      <template v-if="showsResult">= {{ amount ?? '…' }}</template>
    </p>
    <!-- mousedown.prevent keeps focus (and the caret) in the box between presses. -->
    <div class="grid grid-cols-4 gap-1.5 mt-2">
      <button
        v-for="key in KEYS"
        :key="key.label"
        type="button"
        class="h-11 rounded-md border border-surface-600 hover:bg-surface-600 active:bg-surface-600 text-lg leading-none select-none touch-manipulation transition-colors"
        :class="keyClass(key)"
        :title="key.action === 'halve' ? 'Halve everything typed so far, rounded down' : undefined"
        @mousedown.prevent
        @click="press(key)"
      >{{ key.label }}</button>
    </div>
  </div>
</template>
