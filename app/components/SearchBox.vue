<script setup lang="ts">
/**
 * The filter box above a long pick-list. Purely presentational — the parent owns the
 * query and does the filtering, since what counts as a match differs per list.
 */
const query = defineModel<string>({ required: true })

withDefaults(defineProps<{
  placeholder?: string
  /** How many entries survive the filter, and how many there were. Shown while filtering. */
  matches?: number
  total?: number
}>(), {
  placeholder: 'Search…',
})
</script>

<template>
  <div class="space-y-1">
    <div class="relative">
      <svg
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        v-model="query"
        type="search"
        :placeholder="placeholder"
        class="input pl-9"
        :class="query ? 'pr-9' : ''"
      >
      <button
        v-if="query"
        type="button"
        aria-label="Clear search"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-slate-200"
        @click="query = ''"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <p v-if="query && matches !== undefined" class="text-[10px] text-slate-500 px-1">
      {{ matches }} of {{ total }} match “{{ query }}”
    </p>
  </div>
</template>

<style scoped>
/* The styled clear button below is the only one wanted; Chromium adds its own to
   `type="search"`, which would sit right next to it. */
input[type='search']::-webkit-search-cancel-button {
  display: none;
}
</style>
