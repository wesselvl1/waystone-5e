<script setup lang="ts">
/**
 * Editing one rulepack entry.
 *
 * Two tabs, because there are two different things a player comes here to do. Details is
 * the wording — the entry's own name and description, the scalars printed beside them,
 * and every named description nested inside it, whether that is a race's traits or a
 * subclass's features at 6th level. JSON is everything else, validated against the pack's
 * own schema: level tables and levelUpEvents have no honest form, and a half-right one
 * would be worse than sending the reader to the data.
 *
 * The draft is the single source of truth. The JSON textarea is read back into it when
 * the reader leaves that tab or saves from it, so the two views can never disagree about
 * what is about to be written.
 */
import type { EntryKind } from '~/services/homebrew'
import {
  applyField,
  entriesEqual,
  entryKindMeta,
  entryName,
  fieldValue,
  parseEntryJson,
  proseBlocks,
  setAtPath,
  validateEntry,
} from '~/services/homebrew'
import type { EntryField, ProseBlock } from '~/services/homebrew'

const props = defineProps<{
  open: boolean
  kind: EntryKind
  /** The entry as it stands. For a duplicate or a new entry, the id is left blank. */
  entry: Record<string, unknown>
  /**
   * 'edit' keeps the id, so the saved entry shadows the one it came from. 'duplicate' and
   * 'new' leave the id to the caller to mint, so they stand beside it instead.
   */
  mode: 'edit' | 'duplicate' | 'new'
  /** Name of the pack the entry is being taken out of, for the copy notice. */
  sourcePackName?: string
  /** Set when saving will copy the entry out of a book rather than edit one in place. */
  copiesOnSave?: boolean
}>()

const emit = defineEmits<{ save: [Record<string, unknown>]; close: [] }>()

const meta = computed(() => entryKindMeta(props.kind))

const draft = ref<Record<string, unknown>>({})
const tab = ref<'details' | 'json'>('details')
const jsonText = ref('')
const issues = ref<string[]>([])

watch(() => props.open, (open) => {
  if (!open) return
  draft.value = JSON.parse(JSON.stringify(props.entry))
  tab.value = 'details'
  jsonText.value = JSON.stringify(draft.value, null, 2)
  issues.value = []
}, { immediate: true })

const prose = computed<ProseBlock[]>(() => proseBlocks(draft.value))

/** Prose grouped by where it sits, so a class's subclass features do not run together. */
const proseGroups = computed(() => {
  const groups = new Map<string, ProseBlock[]>()
  for (const block of prose.value) {
    if (!groups.has(block.context)) groups.set(block.context, [])
    groups.get(block.context)!.push(block)
  }
  return [...groups.entries()]
})

function setField(field: EntryField, value: string | boolean) {
  draft.value = applyField(draft.value, field, value)
}

function setProse(path: Array<string | number>, value: string) {
  draft.value = setAtPath(draft.value, path, value)
}

/** Read the JSON tab back into the draft. Returns false and shows why when it will not parse. */
function absorbJson(): boolean {
  const result = parseEntryJson(props.kind, jsonText.value)
  if (!result.ok) {
    issues.value = result.issues
    return false
  }
  draft.value = result.value
  issues.value = []
  return true
}

/**
 * The draft as it currently stands, the JSON tab included.
 *
 * The draft proper only takes the JSON tab's text on absorb, so asking it whether
 * anything has changed would answer for the Details tab alone. Undefined while the JSON
 * will not parse — nothing is known about an edit that cannot be read.
 */
const effectiveDraft = computed<Record<string, unknown> | undefined>(() => {
  if (tab.value !== 'json') return draft.value
  const result = parseEntryJson(props.kind, jsonText.value)
  return result.ok ? result.value : undefined
})

/**
 * Nothing to save.
 *
 * Only while editing: a duplicate of an entry left exactly as it is, is still a new
 * entry the reader asked for. An *edit* that changes nothing is not — saving it would
 * copy a book's entry into the homebrew pack to say the same thing the book says.
 */
const unchanged = computed(() =>
  props.mode === 'edit'
  && effectiveDraft.value !== undefined
  && entriesEqual(props.kind, effectiveDraft.value, props.entry))

function switchTo(next: 'details' | 'json') {
  if (next === tab.value) return
  if (tab.value === 'json' && !absorbJson()) return
  if (next === 'json') jsonText.value = JSON.stringify(draft.value, null, 2)
  tab.value = next
}

function save() {
  if (unchanged.value) return
  if (tab.value === 'json' && !absorbJson()) return
  const result = validateEntry(props.kind, draft.value)
  if (!result.ok) {
    issues.value = result.issues
    return
  }
  emit('save', result.value)
}

const title = computed(() => {
  const what = meta.value.singular
  if (props.mode === 'new') return `New ${what}`
  if (props.mode === 'duplicate') return `Duplicate ${what}`
  return `Edit ${entryName(props.kind, draft.value)}`
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

/** Roughly as tall as the text it holds, so a long trait is not read through a slot. */
function rowsFor(text: unknown): number {
  const lines = String(text ?? '').split('\n').length
  return Math.min(16, Math.max(3, lines + Math.floor(String(text ?? '').length / 70)))
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="emit('close')"
      >
        <div
          class="bg-surface-800 border border-surface-600 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl
            shadow-xl flex flex-col max-h-[92vh]"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="min-w-0">
              <p class="text-base font-semibold text-white leading-tight truncate">{{ title }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ meta.label }}</p>
            </div>
            <button class="btn-ghost p-2 -mr-2 flex-shrink-0" aria-label="Close" @click="emit('close')">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex gap-1 px-4 pt-3">
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              :class="tab === 'details' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-surface-700 hover:text-white'"
              @click="switchTo('details')"
            >Details</button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              :class="tab === 'json' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-surface-700 hover:text-white'"
              @click="switchTo('json')"
            >JSON</button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            <p
              v-if="copiesOnSave"
              class="text-xs text-slate-400 bg-surface-900/60 border border-surface-700/50 rounded-lg px-3 py-2"
            >
              Saving copies this into your <span class="text-slate-200">Homebrew</span> pack, where it
              replaces the version in <span class="text-slate-200">{{ sourcePackName }}</span> everywhere
              the app looks it up. The book itself is left alone — delete the copy to go back to it.
            </p>

            <template v-if="tab === 'details'">
              <div class="space-y-3">
                <div v-for="field in meta.fields" :key="field.key">
                  <label v-if="field.kind !== 'boolean'" class="label" :for="`field-${field.key}`">{{ field.label }}</label>

                  <textarea
                    v-if="field.kind === 'multiline'"
                    :id="`field-${field.key}`"
                    class="input font-normal leading-relaxed"
                    :rows="rowsFor(fieldValue(draft, field))"
                    :value="fieldValue(draft, field) as string"
                    :placeholder="field.placeholder"
                    @input="setField(field, ($event.target as HTMLTextAreaElement).value)"
                  />

                  <label
                    v-else-if="field.kind === 'boolean'"
                    class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded bg-surface-700 border-surface-600 text-primary-500 focus:ring-primary-500"
                      :checked="fieldValue(draft, field) as boolean"
                      @change="setField(field, ($event.target as HTMLInputElement).checked)"
                    />
                    {{ field.label }}
                  </label>

                  <input
                    v-else
                    :id="`field-${field.key}`"
                    class="input"
                    :inputmode="field.kind === 'number' ? 'decimal' : undefined"
                    :value="fieldValue(draft, field) as string"
                    :placeholder="field.placeholder"
                    @input="setField(field, ($event.target as HTMLInputElement).value)"
                  />

                  <p v-if="field.help" class="text-[11px] text-slate-500 mt-1">{{ field.help }}</p>
                </div>
              </div>

              <!-- Nested prose: traits, features, actions, pool options — whatever the entry holds -->
              <div v-for="[context, blocks] in proseGroups" :key="context || 'root'" class="space-y-3">
                <p v-if="context" class="section-header pt-1">{{ context }}</p>
                <div v-for="block in blocks" :key="block.path.join('.')">
                  <label class="label">{{ block.name }}</label>
                  <textarea
                    class="input leading-relaxed"
                    :rows="rowsFor(block.value)"
                    :value="block.value"
                    @input="setProse(block.path, ($event.target as HTMLTextAreaElement).value)"
                  />
                </div>
              </div>

              <p class="text-[11px] text-slate-500 pt-1">
                Everything else — level tables, level-up events, ability distributions — is on the
                JSON tab.
              </p>
            </template>

            <template v-else>
              <textarea
                v-model="jsonText"
                spellcheck="false"
                class="input font-mono text-xs leading-relaxed"
                rows="22"
              />
              <p class="text-[11px] text-slate-500">
                Checked against the rulepack schema when you leave this tab or save.
              </p>
            </template>

            <ul v-if="issues.length" class="text-xs text-danger-400 bg-danger-500/10 rounded-lg px-3 py-2 space-y-1">
              <li v-for="issue in issues" :key="issue">{{ issue }}</li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="flex gap-2 justify-end p-4 pt-3 border-t border-surface-700/60">
            <button class="btn-ghost" @click="emit('close')">{{ unchanged ? 'Close' : 'Cancel' }}</button>
            <button class="btn-primary" :disabled="unchanged" @click="save">
              {{ unchanged ? 'No changes' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
