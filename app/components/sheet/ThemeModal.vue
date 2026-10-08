<script setup lang="ts">
/**
 * The sheet's two colours, for this character or as the default for every character.
 *
 * Both are drafts until Save, but the page moves with them as they change: the modal
 * emits the fully resolved colours as a `preview`, which the page paints over everything
 * else, so dragging a picker does not write to IndexedDB on every frame and Cancel puts
 * the page back exactly as it was.
 */
import type { Character, CharacterTheme } from '~/types/character'
import { useDefaultTheme } from '~/composables/useTheme'
import {
  compactTheme,
  isHexColor,
  resolveTheme,
  THEME_COLORS,
  THEME_LABELS,
  THEME_PRESETS,
  type ThemeColor,
} from '~/services/theme'

const props = defineProps<{
  open: boolean
  character: Character
}>()

const emit = defineEmits<{
  save: [CharacterTheme | undefined]
  preview: [Required<CharacterTheme> | null]
  close: []
}>()

const { defaultTheme, setDefaultTheme } = useDefaultTheme()

type Scope = 'character' | 'default'
const scope = ref<Scope>('character')
const characterDraft = ref<CharacterTheme>({})
const defaultDraft = ref<CharacterTheme>({})

watch(() => props.open, (open) => {
  if (!open) { emit('preview', null); return }
  scope.value = 'character'
  characterDraft.value = { ...props.character.theme }
  defaultDraft.value = { ...defaultTheme.value }
}, { immediate: true })

/** What each tab shows: the character's falls through to the default being edited beside it. */
const shown = computed(() => scope.value === 'character'
  ? resolveTheme(characterDraft.value, defaultDraft.value)
  : resolveTheme(defaultDraft.value))

watch(shown, (theme) => {
  if (props.open) emit('preview', theme)
}, { immediate: true })

const draft = computed(() => scope.value === 'character' ? characterDraft.value : defaultDraft.value)

function setColor(color: ThemeColor, value: string) {
  if (!isHexColor(value)) return
  const target = scope.value === 'character' ? characterDraft : defaultDraft
  target.value = { ...target.value, [color]: value.toLowerCase() }
}

function clearColor(color: ThemeColor) {
  const target = scope.value === 'character' ? characterDraft : defaultDraft
  const { [color]: _, ...rest } = target.value
  target.value = rest
}

/** This character's colours become everyone's, and the character goes back to following them. */
function makeDefault() {
  defaultDraft.value = { ...shown.value }
  characterDraft.value = {}
  scope.value = 'default'
}

/** Colours this character sets for itself, which the Default tab cannot reach on this sheet. */
const ownColors = computed(() =>
  THEME_COLORS.filter(c => characterDraft.value[c]).map(c => THEME_LABELS[c].label.toLowerCase()))

function save() {
  setDefaultTheme(defaultDraft.value)
  emit('save', compactTheme(characterDraft.value))
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
              <p class="text-base font-semibold text-white leading-tight">Colours</p>
              <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                <span class="flex items-center gap-1.5"><span class="proficiency-dot active cursor-default" /> Proficient</span>
                <span class="flex items-center gap-1.5"><span class="proficiency-dot expertise cursor-default" /> Expertise</span>
              </p>
            </div>
            <button class="btn-ghost p-1.5 flex-shrink-0 -mt-1 -mr-1" title="Close" @click="emit('close')">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="overflow-y-auto p-4 space-y-4">
            <!-- Which colours are being edited -->
            <div class="grid grid-cols-2 gap-1 rounded-lg bg-surface-900 p-1">
              <button
                v-for="s in (['character', 'default'] as const)"
                :key="s"
                class="rounded-md py-1.5 text-xs font-medium transition-colors"
                :class="scope === s ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-slate-200'"
                @click="scope = s"
              >
                {{ s === 'character' ? character.name || 'This character' : 'Default' }}
              </button>
            </div>

            <div v-for="color in THEME_COLORS" :key="color" class="space-y-2">
              <div class="flex items-center gap-3">
                <input
                  type="color"
                  class="theme-swatch"
                  :value="shown[color]"
                  :aria-label="THEME_LABELS[color].label"
                  @input="setColor(color, ($event.target as HTMLInputElement).value)"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-200">{{ THEME_LABELS[color].label }}</p>
                  <p class="text-[10px] text-slate-500 truncate">{{ THEME_LABELS[color].hint }}</p>
                </div>
                <button
                  v-if="draft[color]"
                  class="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 flex-shrink-0"
                  @click="clearColor(color)"
                >
                  {{ scope === 'character' ? 'Use default' : 'Reset' }}
                </button>
                <span v-else class="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0">
                  {{ scope === 'character' ? 'Default' : 'Built-in' }}
                </span>
              </div>
              <div class="flex flex-wrap gap-2 pl-[3.25rem]">
                <button
                  v-for="preset in THEME_PRESETS[color]"
                  :key="preset"
                  class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  :class="shown[color] === preset ? 'border-white' : 'border-transparent'"
                  :style="{ backgroundColor: preset }"
                  :title="preset"
                  @click="setColor(color, preset)"
                />
              </div>
            </div>

            <p v-if="scope === 'character'" class="text-[10px] text-slate-500">
              Saved with this character, so an export carries it. A colour left on
              default follows the Default tab.
              <button class="underline underline-offset-2 text-slate-400 hover:text-slate-200" @click="makeDefault">
                Make these the default
              </button>
            </p>
            <p v-else class="text-[10px] text-slate-500">
              For every character without colours of its own, on this device.
              <template v-if="ownColors.length > 0">
                This character keeps its own {{ ownColors.join(' and ') }}.
              </template>
            </p>
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

<style scoped>
.theme-swatch {
  @apply w-10 h-10 flex-shrink-0 rounded-lg border border-surface-600 bg-transparent p-0.5 cursor-pointer;
}
.theme-swatch::-webkit-color-swatch-wrapper { padding: 0; }
.theme-swatch::-webkit-color-swatch { border: none; border-radius: 0.375rem; }
.theme-swatch::-moz-color-swatch { border: none; border-radius: 0.375rem; }
</style>
