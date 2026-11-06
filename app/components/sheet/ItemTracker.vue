<script setup lang="ts">
import type { Character, EquipmentEntry } from '~/types/character'
import {
  adjustTrackedQuantity,
  moveTrackedItem,
  trackItem,
  trackableItems,
  trackedItems,
  untrackItem,
} from '~/services/itemTracker'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rows = computed(() => trackedItems(props.character))
const addable = computed(() => trackableItems(props.character))

// Adding, removing and reordering all live behind Edit, so a thumb scrolling the sheet
// mid-fight can only ever press − or +.
const editing = ref(false)
const picking = ref(false)

function toggleEditing() {
  editing.value = !editing.value
  picking.value = false
  cancelDrag()
}

function spend(id: string, delta: number) {
  emit('update', adjustTrackedQuantity(props.character, id, delta))
}

function add(id: string) {
  emit('update', trackItem(props.character, id))
  if (addable.value.length <= 1) picking.value = false
}

function remove(id: string) {
  emit('update', untrackItem(props.character, id))
}

// ── Drag to reorder ──────────────────────────────────────────────────────────
// Started from the handle alone, then followed on the window rather than by pointer
// capture: the row moves in the DOM as the order previews, and moving a node releases its
// capture, which lost the drop. The handle also stops the touch from reaching the page,
// whose horizontal swipe would otherwise change tab halfway through a drag.
const listEl = ref<HTMLElement | null>(null)
const drag = ref<{ from: number; to: number; pointerId: number } | null>(null)

/** The list as it would land if the drag ended now, so the rows move under the finger. */
const displayed = computed<EquipmentEntry[]>(() => {
  const list = [...rows.value]
  if (!drag.value || drag.value.from === drag.value.to) return list
  const [moved] = list.splice(drag.value.from, 1)
  list.splice(drag.value.to, 0, moved!)
  return list
})

function startDrag(index: number, event: PointerEvent) {
  drag.value = { from: index, to: index, pointerId: event.pointerId }
  window.addEventListener('pointermove', moveDrag)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', cancelDrag)
}

function stopListening() {
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', cancelDrag)
}

onBeforeUnmount(stopListening)

function moveDrag(event: PointerEvent) {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return
  // Measured against the rows as currently shown, read off the DOM in document order; the
  // target is the last row whose middle the pointer has passed.
  let to = 0
  listEl.value?.querySelectorAll<HTMLElement>('[data-tracker-row]').forEach((el, i) => {
    const box = el.getBoundingClientRect()
    if (event.clientY > box.top + box.height / 2) to = i
  })
  drag.value = { ...drag.value, to: Math.min(to, rows.value.length - 1) }
}

function endDrag(event: PointerEvent) {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return
  const { from, to } = drag.value
  drag.value = null
  stopListening()
  if (from !== to) emit('update', moveTrackedItem(props.character, from, to))
}

function cancelDrag() {
  drag.value = null
  stopListening()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <p class="section-header mb-0">Tracked items</p>
      <button class="btn-ghost text-xs py-1 px-2" @click="toggleEditing">
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </div>

    <div ref="listEl" class="card space-y-0 divide-y divide-surface-700/50">
      <div v-if="rows.length === 0 && !editing" class="text-slate-500 text-sm py-2 text-center">
        Nothing tracked. Tap Edit to add items from your inventory.
      </div>

      <div
        v-for="(item, index) in displayed"
        :key="item.id"
        data-tracker-row
        class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
        :class="drag && displayed[drag.to]?.id === item.id ? 'opacity-60' : ''"
      >
        <button
          v-if="editing"
          class="w-7 h-7 -ml-1 flex items-center justify-center text-slate-500 cursor-grab active:cursor-grabbing touch-none select-none"
          :aria-label="`Drag to reorder ${item.name}`"
          @pointerdown.prevent="startDrag(index, $event)"
          @touchstart.stop
          @touchend.stop
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d="M4 8h16M4 16h16" />
          </svg>
        </button>

        <p class="flex-1 min-w-0 text-sm font-medium text-white truncate">{{ item.name }}</p>

        <button
          v-if="editing"
          class="text-xs text-danger-400 hover:text-danger-300 px-2 py-1"
          @click="remove(item.id)"
        >
          Remove
        </button>
        <div v-else class="flex items-center gap-2 flex-shrink-0">
          <button
            class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none transition-colors"
            :disabled="item.quantity <= 0"
            :aria-label="`Use one ${item.name}`"
            @click="spend(item.id, -1)"
          >−</button>
          <span class="text-sm font-mono text-white tabular-nums w-10 text-center">{{ item.quantity }}</span>
          <button
            class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 flex items-center justify-center text-base leading-none transition-colors"
            :aria-label="`Add one ${item.name}`"
            @click="spend(item.id, 1)"
          >+</button>
        </div>
      </div>

      <div v-if="editing" class="pt-2" :class="rows.length === 0 ? 'pt-0' : ''">
        <button
          v-if="!picking"
          class="btn-ghost text-xs py-1 px-2 w-full"
          :disabled="addable.length === 0"
          @click="picking = true"
        >
          {{ addable.length === 0 ? 'Everything in your inventory is tracked' : '+ Add item' }}
        </button>
        <div v-else class="space-y-1">
          <p class="text-xs text-slate-500">From your inventory</p>
          <button
            v-for="candidate in addable"
            :key="candidate.id"
            class="w-full flex items-center justify-between text-left text-sm text-slate-300 hover:bg-surface-700/50 rounded px-2 py-1.5"
            @click="add(candidate.id)"
          >
            <span class="truncate">{{ candidate.name }}</span>
            <span class="text-xs text-slate-500 font-mono tabular-nums">×{{ candidate.quantity }}</span>
          </button>
          <button class="text-xs text-slate-500 hover:text-slate-300 px-2 py-1" @click="picking = false">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
