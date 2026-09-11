<script setup lang="ts">
import type { Character, CharacterImage } from '~/types/character'
import { MAX_IMAGES, formatBytes, imagesBytes, readCharacterImage } from '~/services/characterArt'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const images = computed(() => props.character.images ?? [])
const totalSize = computed(() => formatBytes(imagesBytes(images.value)))
const full = computed(() => images.value.length >= MAX_IMAGES)

const fileInput = ref<HTMLInputElement | null>(null)
const reading = ref(false)
/** One line per file that could not be stored; cleared on the next pick. */
const failures = ref<string[]>([])

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  // Cleared immediately so re-picking the same file after a delete still fires `change`.
  input.value = ''
  if (files.length === 0) return

  failures.value = []
  reading.value = true
  const added: CharacterImage[] = []

  try {
    for (const file of files) {
      if (images.value.length + added.length >= MAX_IMAGES) {
        failures.value.push(`${file.name}: no room — ${MAX_IMAGES} pictures is the limit`)
        continue
      }
      try {
        added.push(await readCharacterImage(file))
      }
      catch (error) {
        failures.value.push(`${file.name}: ${(error as Error).message}`)
      }
    }
  }
  finally {
    reading.value = false
  }

  if (added.length > 0) emit('update', { images: [...images.value, ...added] })
}

// ── viewer ────────────────────────────────────────────────────────────────────
// Addressed by id rather than index so a delete from underneath cannot leave the viewer
// showing a different picture than the one that was open.
const viewingId = ref<string | null>(null)
const viewing = computed(() => images.value.find(i => i.id === viewingId.value) ?? null)
const viewingIndex = computed(() => images.value.findIndex(i => i.id === viewingId.value))

const draftLabel = ref('')

function open(id: string) {
  viewingId.value = id
  draftLabel.value = images.value.find(i => i.id === id)?.label ?? ''
}

function close() {
  viewingId.value = null
}

function step(delta: number) {
  const next = images.value[viewingIndex.value + delta]
  if (next) open(next.id)
}

function saveLabel() {
  const image = viewing.value
  if (!image) return
  const label = draftLabel.value.trim().slice(0, 60)
  if (label === image.label) return
  emit('update', {
    images: images.value.map(i => (i.id === image.id ? { ...i, label } : i)),
  })
}

const confirmingDelete = ref(false)

function remove() {
  const image = viewing.value
  confirmingDelete.value = false
  if (!image) return
  const remaining = images.value.filter(i => i.id !== image.id)
  // Land on the neighbour rather than dropping the player back to the grid mid-cull.
  const next = remaining[Math.min(viewingIndex.value, remaining.length - 1)]
  emit('update', { images: remaining })
  if (next) open(next.id)
  else close()
}

function onKeydown(event: KeyboardEvent) {
  if (!viewingId.value) return
  // The arrows are the viewer's, except while the caption field has them.
  const inField = (event.target as HTMLElement | null)?.tagName === 'INPUT'
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowRight' && !inField) step(1)
  else if (event.key === 'ArrowLeft' && !inField) step(-1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="card space-y-3">
    <div class="flex items-baseline justify-between gap-2">
      <p class="section-header mb-0">Character Art</p>
      <span v-if="images.length" class="text-[11px] text-slate-500 tabular-nums">
        {{ images.length }}/{{ MAX_IMAGES }} · {{ totalSize }}
      </span>
    </div>

    <div v-if="images.length" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <button
        v-for="image in images"
        :key="image.id"
        type="button"
        class="relative aspect-square rounded-lg overflow-hidden bg-surface-700 border border-surface-600
          hover:border-primary-500 transition-colors"
        :title="image.label || 'Untitled'"
        @click="open(image.id)"
      >
        <img :src="image.data" :alt="image.label" class="w-full h-full object-cover" />
        <span
          v-if="image.label"
          class="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] leading-tight text-left text-slate-100
            bg-gradient-to-t from-black/80 to-transparent truncate"
        >
          {{ image.label }}
        </span>
      </button>
    </div>

    <p v-else class="text-sm text-slate-500">
      A portrait, the same character in armor and out of it, a form they take — add as many as you keep track of.
    </p>

    <div class="flex items-center gap-2 flex-wrap">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onFilesPicked"
      />
      <button
        type="button"
        class="btn-ghost border border-surface-600 px-3 py-1.5 text-xs"
        :disabled="reading || full"
        :title="full ? `${MAX_IMAGES} pictures is the limit` : 'Pick one or more image files'"
        @click="fileInput?.click()"
      >
        {{ reading ? 'Adding…' : 'Add pictures' }}
      </button>
      <span class="text-[11px] text-slate-500">Kept on this device and in the export file.</span>
    </div>

    <ul v-if="failures.length" class="space-y-0.5">
      <li v-for="failure in failures" :key="failure" class="text-xs text-danger-400">{{ failure }}</li>
    </ul>

    <!-- Viewer -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="viewing"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Character art"
          @click.self="close()"
        >
          <div
            class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:max-w-2xl
              rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90vh] flex flex-col"
          >
            <div class="flex items-center gap-2 p-3 border-b border-surface-700/60">
              <span class="text-xs text-slate-500 tabular-nums flex-shrink-0">
                {{ viewingIndex + 1 }} / {{ images.length }}
              </span>
              <input
                v-model="draftLabel"
                class="input flex-1 py-1.5 text-sm"
                placeholder="Label — in armor, bear form…"
                maxlength="60"
                @blur="saveLabel"
                @keydown.enter="saveLabel"
              />
              <button class="btn-ghost p-1.5 flex-shrink-0" title="Close" @click="close()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex-1 min-h-0 overflow-auto p-3">
              <img :src="viewing.data" :alt="viewing.label" class="mx-auto max-h-[65vh] rounded-lg" />
            </div>

            <div class="flex items-center gap-2 p-3 pt-0">
              <button
                class="btn-ghost px-3 py-1.5 text-xs"
                :disabled="viewingIndex <= 0"
                @click="step(-1)"
              >
                ← Previous
              </button>
              <button
                class="btn-ghost px-3 py-1.5 text-xs"
                :disabled="viewingIndex >= images.length - 1"
                @click="step(1)"
              >
                Next →
              </button>
              <button class="btn-danger px-3 py-1.5 text-xs ml-auto" @click="confirmingDelete = true">
                Delete
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      :open="confirmingDelete"
      title="Delete this picture?"
      message="It is kept nowhere else — an export made before now is the only other copy."
      confirm-label="Delete"
      danger
      @confirm="remove()"
      @cancel="confirmingDelete = false"
    />
  </div>
</template>
