<script setup lang="ts">
/**
 * A whole-number field that can go negative on a phone.
 *
 * `type="number"` brings up a keypad, and on many Android keyboards (Samsung's among
 * them) that keypad has no minus key — so Sharpshooter's −5 could not be typed at all. This
 * is a text field asking for the same digit keypad, with a ± button beside it that flips
 * the sign, which works on every keyboard.
 *
 * It also never hands back a string: an emptied field is `undefined`, where
 * `v-model.number` left `""` behind and the sum downstream concatenated it ("5" + "0").
 */
const props = withDefaults(defineProps<{
  modelValue?: number | null | ''
  placeholder?: string
  inputClass?: string
  disabled?: boolean
  ariaLabel?: string
}>(), {
  modelValue: undefined,
  placeholder: '0',
  inputClass: 'input',
  disabled: false,
  ariaLabel: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: number | undefined] }>()

const inputEl = ref<HTMLInputElement | null>(null)

function format(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

// The text is kept apart from the number so a lone "-" can sit in the field while the
// player is still typing the digits after it.
const text = ref(format(props.modelValue))

watch(() => props.modelValue, (value) => {
  if (parse(text.value) !== (typeof value === 'number' ? value : undefined)) text.value = format(value)
})

function parse(raw: string): number | undefined {
  const match = /^-?\d+$/.exec(raw)
  return match ? Number(raw) : undefined
}

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  // Keep digits and one leading minus; a typographic minus or a dash counts as one.
  const raw = el.value.replace(/[−–]/g, '-')
  const negative = raw.trimStart().startsWith('-')
  const cleaned = (negative ? '-' : '') + raw.replace(/\D/g, '')
  if (cleaned !== el.value) el.value = cleaned
  text.value = cleaned
  emit('update:modelValue', parse(cleaned))
}

function onBlur() {
  // A minus with nothing after it means nothing; don't leave it looking like a value.
  if (parse(text.value) === undefined) text.value = ''
}

function flipSign() {
  if (props.disabled) return
  const current = parse(text.value)
  if (current === undefined) {
    // Nothing to negate yet: start the number with a minus and let them type the rest.
    text.value = text.value === '-' ? '' : '-'
    inputEl.value?.focus()
    return
  }
  const flipped = current === 0 ? 0 : -current
  text.value = String(flipped)
  emit('update:modelValue', flipped)
}
</script>

<template>
  <div class="relative">
    <input
      ref="inputEl"
      :value="text"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      :placeholder="placeholder"
      :class="[inputClass, 'pr-9']"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput"
      @blur="onBlur"
    />
    <button
      type="button"
      tabindex="-1"
      class="absolute inset-y-0 right-0 w-8 flex items-center justify-center text-slate-400
        hover:text-slate-100 disabled:opacity-40"
      :disabled="disabled"
      aria-label="Make negative or positive"
      @mousedown.prevent
      @click="flipSign"
    >
      ±
    </button>
  </div>
</template>
