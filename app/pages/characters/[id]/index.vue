<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import { exportCharacter } from '~/services/characterIO'
import type { Character } from '~/types/character'
import type { ClassDefinition } from '~/types/rulepack'

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
  if (!character.value) { router.replace('/'); return }
  character.value = repairFeatures(character.value)
  loading.value = false
})

/**
 * Back-fills missing descriptions, usesMax, and recharge on class features
 * by looking them up in the rulepack's featureDefinitions.
 */
function repairFeatures(char: Character): Character {
  const allClasses = rulepackStore.rulepacks.flatMap(r => r.classes) as ClassDefinition[]
  const repaired = char.features.map(f => {
    if (f.description && f.usesMax !== undefined) return f
    const classDef = allClasses.find(c => c.name === f.source)
    if (!classDef?.featureDefinitions) return f
    const def = classDef.featureDefinitions.find(d => d.name === f.name)
    if (!def) return f
    return {
      ...f,
      description: f.description || def.description,
      usesMax: f.usesMax ?? def.usesMax,
      usesRemaining: f.usesRemaining ?? def.usesMax,
      recharge: f.recharge ?? def.recharge,
    }
  })
  // Only persist if something actually changed
  const changed = repaired.some((f, i) => f !== char.features[i])
  if (!changed) return char
  const patched = { ...char, features: repaired }
  characterStore.save(patched)
  return patched
}

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

// ── Three-dot menu ────────────────────────────────────────────────────────────
const menuOpen = ref(false)

function closeMenu() { menuOpen.value = false }

async function doShortRest() {
  closeMenu()
  if (!character.value) return
  const features = character.value.features.map(f => {
    if (f.recharge === 'short' && f.usesMax !== undefined)
      return { ...f, usesRemaining: f.usesMax }
    return f
  })
  // Warlock pact magic slots recharge on a short rest
  const warlockSlots = character.value.warlockSlots
    ? { ...character.value.warlockSlots, used: 0 }
    : undefined
  await onUpdate({ features, ...(warlockSlots ? { warlockSlots } : {}) })
}

async function doLongRest() {
  closeMenu()
  if (!character.value) return
  const features = character.value.features.map(f => {
    if ((f.recharge === 'long' || f.recharge === 'short') && f.usesMax !== undefined)
      return { ...f, usesRemaining: f.usesMax }
    return f
  })
  const hitDice = {
    ...character.value.hitDice,
    remaining: Math.min(
      character.value.hitDice.total,
      character.value.hitDice.remaining + Math.max(1, Math.floor(character.value.hitDice.total / 2)),
    ),
  }
  const hp = { ...character.value.hp, current: character.value.hp.max }
  // Regular spell slots recharge on a long rest
  const spellSlots = Object.fromEntries(
    Object.entries(character.value.spellSlots).map(([lvl, slot]) => [lvl, { ...slot, used: 0 }]),
  ) as Character['spellSlots']
  // Warlock slots also recharge on a long rest
  const warlockSlots = character.value.warlockSlots
    ? { ...character.value.warlockSlots, used: 0 }
    : undefined
  await onUpdate({ features, hitDice, hp, spellSlots, ...(warlockSlots ? { warlockSlots } : {}) })
}

function doLevelUp() {
  closeMenu()
  if (character.value) router.push(`/characters/${character.value.id}/levelup`)
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
        <!-- Three-dot menu -->
        <div v-if="character" class="relative">
          <button class="btn-ghost p-2" @click="menuOpen = !menuOpen">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          <Transition name="fade">
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-1 w-44 bg-surface-800 border border-surface-600 rounded-xl shadow-xl z-50 overflow-hidden py-1"
              @click.stop
            >
              <button class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-surface-700 transition-colors text-left" @click="doShortRest">
                <svg class="w-4 h-4 text-accent-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                Short Rest
              </button>
              <button class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-surface-700 transition-colors text-left" @click="doLongRest">
                <svg class="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3" /></svg>
                Long Rest
              </button>
              <div class="border-t border-surface-700/60 my-1" />
              <button class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-surface-700 transition-colors text-left" @click="doLevelUp">
                <svg class="w-4 h-4 text-success-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
                Level Up
              </button>
              <button class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-surface-700 transition-colors text-left" @click="doExport(); closeMenu()">
                <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
            </div>
          </Transition>
          <!-- backdrop to close on outside click -->
          <div v-if="menuOpen" class="fixed inset-0 z-40" @click="closeMenu" />
        </div>
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
