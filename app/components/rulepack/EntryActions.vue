<script setup lang="ts">
/**
 * The edit / duplicate / delete row on a rulepack entry.
 *
 * One component rather than the same three buttons written into every card, because the
 * rules about which are offered are the interesting part: nothing is ever deleted out of
 * a book — a book is only ever copied out of — so delete belongs to the player's own pack
 * alone, and a pool patch has no id of its own to duplicate under.
 */
// Defaulted explicitly: Vue casts an absent boolean prop to `false`, which would hide
// the duplicate button everywhere it is not named.
withDefaults(defineProps<{
  /** False on a book: its entries are copied, never removed. */
  canDelete?: boolean
  /** False where the entry has no id to mint a second one under (a pool patch). */
  canDuplicate?: boolean
  /** Set on a book's entry the player has already copied and edited. */
  edited?: boolean
}>(), {
  canDelete: false,
  canDuplicate: true,
  edited: false,
})

const emit = defineEmits<{ edit: []; duplicate: []; delete: [] }>()
</script>

<template>
  <div class="flex items-center gap-1 flex-shrink-0">
    <span
      v-if="edited"
      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-900/40 text-accent-400"
      title="You have an edited copy of this in your Homebrew pack, and that is the one the app uses."
    >Edited</span>

    <button class="btn-ghost p-1.5" title="Edit" aria-label="Edit" @click.stop="emit('edit')">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>

    <button
      v-if="canDuplicate"
      class="btn-ghost p-1.5"
      title="Duplicate into Homebrew"
      aria-label="Duplicate into Homebrew"
      @click.stop="emit('duplicate')"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>

    <button
      v-if="canDelete"
      class="btn-danger p-1.5"
      title="Delete"
      aria-label="Delete"
      @click.stop="emit('delete')"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</template>
