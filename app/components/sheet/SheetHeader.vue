<script setup lang="ts">
import type { Character } from '~/types/character'
import { useRulepacksStore } from '~/stores/rulepacks'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rulepackStore = useRulepacksStore()

const raceName = computed(() => rulepackStore.getRace(props.character.race)?.name ?? props.character.race)
const classLabel = computed(() =>
  props.character.classes
    .map(c => {
      const cls = rulepackStore.getClass(c.classId)
      const sub = c.subclassId ? rulepackStore.getSubclass(c.subclassId) : undefined
      const subLabel = sub ? ` (${sub.name})` : ''
      return `${cls?.name ?? c.classId}${subLabel} ${c.level}`
    })
    .join(' / '),
)
const totalLevel = computed(() => props.character.classes.reduce((s, c) => s + c.level, 0))

const editingName = ref(false)
const draftName = ref(props.character.name)

function saveName() {
  if (draftName.value.trim()) emit('update', { name: draftName.value.trim() })
  editingName.value = false
}
</script>

<template>
  <div class="card space-y-1">
    <!-- Name row -->
    <div class="flex items-center gap-2">
      <template v-if="editingName">
        <input
          v-model="draftName"
          class="input flex-1 text-lg font-semibold"
          autofocus
          @blur="saveName"
          @keydown.enter="saveName"
          @keydown.esc="editingName = false"
        />
      </template>
      <template v-else>
        <h2
          class="flex-1 text-xl font-semibold text-white truncate cursor-pointer hover:text-primary-300 transition-colors"
          @click="editingName = true"
        >
          {{ character.name }}
        </h2>
      </template>
      <div
        class="px-2 py-0.5 rounded-full text-xs font-bold border"
        :class="character.inspiration ? 'bg-accent-400/20 border-accent-400/60 text-accent-400' : 'bg-surface-700 border-surface-600 text-slate-500'"
        title="Inspiration"
        @click="emit('update', { inspiration: !character.inspiration })"
      >
        ★
      </div>
    </div>

    <!-- Meta row -->
    <div class="flex items-center gap-2 flex-wrap text-sm text-slate-400">
      <span class="text-primary-300 font-medium">{{ classLabel }}</span>
      <span class="text-slate-600">·</span>
      <span>{{ raceName }}</span>
      <span class="text-slate-600">·</span>
      <span class="text-slate-500">Level {{ totalLevel }}</span>
      <span v-if="character.background" class="text-slate-600">·</span>
      <span v-if="character.background" class="text-slate-500 capitalize">{{ character.background }}</span>
    </div>

    <!-- XP bar -->
    <div class="pt-1">
      <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span>XP</span>
        <span>{{ character.experiencePoints }}</span>
      </div>
      <div class="h-1 bg-surface-700 rounded-full overflow-hidden">
        <div class="h-full bg-primary-600 rounded-full transition-all" style="width: 30%" />
      </div>
    </div>
  </div>
</template>
