<script setup lang="ts">
import type { Character, Feature } from '~/types/character'

/** The `source` every feat's feature carries, set where RESOLVED_CHOOSE_FEAT applies it. */
const FEAT_SOURCE = 'Feat'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const expanded = ref<Set<string>>(new Set())
const addingFeat = ref(false)

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

/**
 * One section per source, feats always last and always present.
 *
 * Feats used to be just another source group, which meant the section only existed once
 * the character already had one — and the button that adds one had nowhere to live. So it
 * is built here rather than fallen out of the grouping, and keeps its place on a sheet
 * with no feats at all.
 */
const sections = computed(() => {
  const groups = new Map<string, Feature[]>()
  for (const f of props.character.features) {
    if (f.source === FEAT_SOURCE) continue
    if (!groups.has(f.source)) groups.set(f.source, [])
    groups.get(f.source)!.push(f)
  }
  const out = [...groups].map(([source, features]) => ({ source, features, feats: false }))
  out.push({
    source: 'Feats',
    features: props.character.features.filter(f => f.source === FEAT_SOURCE),
    feats: true,
  })
  return out
})

/** The modal hands back a whole character; the page saves it like any other patch. */
function applyFeat(updated: Character) {
  addingFeat.value = false
  emit('update', updated)
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="section in sections" :key="section.source">
      <div class="flex items-center justify-between mb-2">
        <p class="section-header mb-0">{{ section.source }}</p>
        <button v-if="section.feats" class="btn-ghost text-xs py-1 px-2" @click="addingFeat = true">
          + Add Feat
        </button>
      </div>

      <div class="card divide-y divide-surface-700/50 space-y-0">
        <div v-if="section.feats && section.features.length === 0" class="text-slate-500 text-sm py-2 text-center">
          No feats yet
        </div>
        <div
          v-for="feature in section.features"
          :key="feature.id"
          class="py-2 first:pt-0 last:pb-0"
        >
          <div class="flex items-start gap-2 cursor-pointer" @click="toggle(feature.id)">
            <svg
              class="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5 transition-transform"
              :class="{ 'rotate-90': expanded.has(feature.id) }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white">{{ feature.name }}</p>
            </div>
          </div>
          <div v-if="expanded.has(feature.id) && feature.description" class="mt-2 ml-6 text-sm text-slate-400 leading-relaxed">
            {{ feature.description }}
          </div>
        </div>
      </div>
    </div>

    <SheetAddFeatModal
      :open="addingFeat"
      :character="character"
      @apply="applyFeat"
      @close="addingFeat = false"
    />
  </div>
</template>
