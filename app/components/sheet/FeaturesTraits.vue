<script setup lang="ts">
import type { Character, Feature } from '~/types/character'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const expanded = ref<Set<string>>(new Set())

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

function useCharge(id: string) {
  const updated = props.character.features.map(f => {
    if (f.id !== id || f.usesRemaining === undefined) return f
    return { ...f, usesRemaining: Math.max(0, f.usesRemaining - 1) }
  })
  emit('update', { features: updated })
}

function restoreCharge(id: string) {
  const updated = props.character.features.map(f => {
    if (f.id !== id || f.usesMax === undefined || f.usesRemaining === undefined) return f
    return { ...f, usesRemaining: Math.min(f.usesMax, f.usesRemaining + 1) }
  })
  emit('update', { features: updated })
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
                <!-- Uses -->
                <div v-if="feature.usesMax !== undefined" class="flex items-center gap-1.5 mt-1" @click.stop>
                  <div
                    v-for="i in feature.usesMax"
                    :key="i"
                    class="w-4 h-4 rounded-sm border cursor-pointer transition-colors"
                    :class="i <= (feature.usesRemaining ?? 0)
                      ? 'bg-primary-600/40 border-primary-500/70'
                      : 'bg-surface-700 border-surface-600'"
                    @click="i <= (feature.usesRemaining ?? 0) ? useCharge(feature.id) : restoreCharge(feature.id)"
                  />
                  <span class="text-xs text-slate-500">{{ feature.usesRemaining }}/{{ feature.usesMax }}
                    <span v-if="feature.recharge" class="capitalize">({{ feature.recharge }} rest)</span>
                  </span>
                </div>
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
