<script setup lang="ts">
import type { Character, Feature } from '~/types/character'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const expanded = ref<Set<string>>(new Set())

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

const grouped = computed(() => {
  const groups = new Map<string, Feature[]>()
  for (const f of props.character.features) {
    const source = f.source
    if (!groups.has(source)) groups.set(source, [])
    groups.get(source)!.push(f)
  }
  return groups
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="character.features.length === 0" class="text-slate-500 text-sm text-center py-6">
      No features yet
    </div>

    <template v-for="[source, features] in grouped" :key="source">
      <div>
        <p class="section-header">{{ source }}</p>
        <div class="card divide-y divide-surface-700/50 space-y-0">
          <div
            v-for="feature in features"
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
    </template>
  </div>
</template>
