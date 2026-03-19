<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import { exportCharacter } from '~/services/characterIO'
import type { Character } from '~/types/character'

const route = useRoute()
const router = useRouter()
const characterStore = useCharactersStore()
const rulepackStore = useRulepacksStore()

const character = ref<Character | null>(null)
const loading = ref(true)

onMounted(async () => {
  await Promise.all([characterStore.loadAll(), rulepackStore.loadAll()])
  const id = route.params.id as string
  character.value = (await characterStore.getById(id)) ?? null
  if (!character.value) router.replace('/')
  loading.value = false
})

const activeTab = ref<'combat' | 'spells' | 'features' | 'equipment' | 'notes'>('combat')

const TABS = [
  { key: 'combat', label: 'Combat' },
  { key: 'spells', label: 'Spells' },
  { key: 'features', label: 'Features' },
  { key: 'equipment', label: 'Items' },
  { key: 'notes', label: 'Notes' },
] as const

const TAB_KEYS = TABS.map(t => t.key)
const slideDirection = ref<'left' | 'right'>('left')

function setActiveTab(key: typeof activeTab.value) {
  const oldIdx = TAB_KEYS.indexOf(activeTab.value)
  const newIdx = TAB_KEYS.indexOf(key)
  slideDirection.value = newIdx >= oldIdx ? 'left' : 'right'
  activeTab.value = key
}

// Touch swipe detection
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]!.clientX
  touchStartY = e.touches[0]!.clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0]!.clientX - touchStartX
  const dy = e.changedTouches[0]!.clientY - touchStartY
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
  const idx = TAB_KEYS.indexOf(activeTab.value)
  if (dx < 0 && idx < TAB_KEYS.length - 1) {
    setActiveTab(TAB_KEYS[idx + 1]!)
  } else if (dx > 0 && idx > 0) {
    setActiveTab(TAB_KEYS[idx - 1]!)
  }
}

async function onUpdate(patch: Partial<Character>) {
  if (!character.value) return
  character.value = { ...character.value, ...patch }
  await characterStore.save(character.value)
}

async function doExport() {
  if (character.value) exportCharacter(character.value)
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col">
    <!-- Sticky header: top bar + sheet header + tabs -->
    <div class="flex-shrink-0 z-40 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <!-- Top bar -->
      <header class="flex items-center gap-2 px-3 py-2">
        <NuxtLink to="/" class="btn-ghost p-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <span class="flex-1 text-sm font-semibold text-white truncate">{{ character?.name }}</span>
        <NuxtLink v-if="character" :to="`/characters/${character.id}/levelup`" class="btn-ghost text-xs p-2" title="Level Up">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </NuxtLink>
        <button class="btn-ghost text-xs p-2" title="Export JSON" @click="doExport">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </header>

      <!-- Sheet header + tab bar (only when character is loaded) -->
      <template v-if="character">
        <div class="px-4 pb-3 border-t border-surface-700/40">
          <SheetSheetHeader :character="character" class="pt-3" @update="onUpdate" />
        </div>

        <!-- Tab bar -->
        <div class="flex overflow-x-auto gap-1 px-4 no-scrollbar">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            class="flex-shrink-0 px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors whitespace-nowrap border-b-2 -mb-px"
            :class="activeTab === tab.key
              ? 'text-primary-400 border-primary-400'
              : 'text-slate-500 border-transparent hover:text-slate-300'"
            @click="setActiveTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>
    </div>

    <div v-if="loading" class="flex items-center justify-center pt-24 text-slate-500">
      Loading…
    </div>

    <template v-else-if="character">
      <!-- Tab content with swipe navigation -->
      <div class="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-none" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <Transition :name="`slide-${slideDirection}`">
          <div :key="activeTab" class="px-4 pt-4 pb-20 space-y-3 min-h-full">
            <template v-if="activeTab === 'combat'">
              <SheetAbilityScores :character="character" @update="onUpdate" />
              <SheetSavingThrows :character="character" @update="onUpdate" />
              <SheetSkills :character="character" @update="onUpdate" />
              <SheetCombatStats :character="character" @update="onUpdate" />
              <SheetAttacksList :character="character" @update="onUpdate" />
            </template>
            <SheetSpellsPanel v-else-if="activeTab === 'spells'" :character="character" @update="onUpdate" />
            <SheetFeaturesTraits v-else-if="activeTab === 'features'" :character="character" @update="onUpdate" />
            <SheetEquipmentList v-else-if="activeTab === 'equipment'" :character="character" @update="onUpdate" />
            <SheetConditionsNotes v-else-if="activeTab === 'notes'" :character="character" @update="onUpdate" />
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.slide-left-enter-from  { transform: translateX(40px);  opacity: 0; }
.slide-left-leave-to    { transform: translateX(-40px); opacity: 0; }
.slide-right-enter-from { transform: translateX(-40px); opacity: 0; }
.slide-right-leave-to   { transform: translateX(40px);  opacity: 0; }
</style>
