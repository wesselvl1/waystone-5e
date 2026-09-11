<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import { exportCharacter } from '~/services/characterIO'
import { backfillRacialBonuses } from '~/services/characterMigration'
import { backfillPoolPickFeatures } from '~/services/levelUpService'
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
  character.value = await backfillRacialIncreases(character.value)
  character.value = await backfillPoolPicks(character.value)
  character.value = await backfillSubraceSpeeds(character.value)
  loading.value = false
})

/**
 * Names the picks a character made from a shared pool on the sheet. Invocations, Metamagic
 * and the like were recorded in `chosenOptions` only, so the sheet showed the pool's own
 * feature — "Eldritch Invocations" — and never which ones. Needs a loaded pack for the
 * option's name and description, so it runs here rather than as a shape migration.
 */
async function backfillPoolPicks(char: Character): Promise<Character> {
  const filled = backfillPoolPickFeatures(char, rulepackStore.composedPack())
  if (filled === char) return char
  await characterStore.save(filled)
  return filled
}

/**
 * Gives a character the movement its subrace grants beyond walking.
 *
 * `speedOverrides` went unread until recently, so a Winged Tiefling was stored with a
 * walking speed and nothing else. Walking is deliberately left alone: it is editable on
 * the sheet, and overwriting it here would undo a deliberate change.
 */
async function backfillSubraceSpeeds(char: Character): Promise<Character> {
  const race = rulepackStore.getRace(char.race)
  const overrides = race?.subraces?.find(s => s.id === char.subrace)?.speedOverrides
  if (!overrides) return char
  const missing = Object.entries(overrides)
    .filter(([key, value]) => key !== 'walk' && typeof value === 'number'
      && char.speeds[key as keyof Character['speeds']] === undefined)
  if (missing.length === 0) return char
  const filled = { ...char, speeds: { ...char.speeds, ...Object.fromEntries(missing) } }
  await characterStore.save(filled)
  return filled
}

/**
 * Adds the racial ability increases to a character created before they were stored.
 * Runs here rather than in the store because it needs the race out of a loaded pack,
 * and only saves when something actually changed.
 */
async function backfillRacialIncreases(char: Character): Promise<Character> {
  const race = rulepackStore.getRace(char.race)
  const subrace = race?.subraces?.find(s => s.id === char.subrace)
  const filled = backfillRacialBonuses(char, race, subrace)
  if (filled === char) return char
  await characterStore.save(filled)
  return filled
}

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
      return { ...f, usesRemaining: featureUsesMax(f) }
    return f
  })
  // Free casts granted by a race or background recharge like feature uses do
  const spells = character.value.spells.map(s =>
    s.uses && s.uses.recharge === 'short'
      ? { ...s, uses: { ...s.uses, remaining: s.uses.max } }
      : s)

  // Warlock pact magic slots recharge on a short rest
  const warlockSlots = character.value.warlockSlots
    ? { ...character.value.warlockSlots, used: 0 }
    : undefined
  await onUpdate({ features, spells, ...(warlockSlots ? { warlockSlots } : {}) })
}

async function doLongRest() {
  closeMenu()
  if (!character.value) return
  const features = character.value.features.map(f => {
    if ((f.recharge === 'long' || f.recharge === 'short') && f.usesMax !== undefined)
      return { ...f, usesRemaining: featureUsesMax(f) }
    return f
  })
  // A long rest recovers half the character's TOTAL hit dice, minimum one. Which pools
  // those come back in is the player's choice in the rules; recovering the largest dice
  // first is the conventional default and needs no prompt.
  const totalDice = character.value.hitDice.reduce((s, p) => s + p.total, 0)
  let toRecover = Math.max(1, Math.floor(totalDice / 2))
  const hitDice = [...character.value.hitDice]
    .sort((a, b) => Number.parseInt(b.die.slice(1)) - Number.parseInt(a.die.slice(1)))
    .map((p) => {
      const spent = p.total - p.remaining
      const give = Math.min(spent, toRecover)
      toRecover -= give
      return { ...p, remaining: p.remaining + give }
    })
  const hp = { ...character.value.hp, current: character.value.hp.max }
  // Regular spell slots recharge on a long rest
  const spellSlots = Object.fromEntries(
    Object.entries(character.value.spellSlots).map(([lvl, slot]) => [lvl, { ...slot, used: 0 }]),
  ) as Character['spellSlots']
  // Warlock slots also recharge on a long rest
  const warlockSlots = character.value.warlockSlots
    ? { ...character.value.warlockSlots, used: 0 }
    : undefined
  // A long rest recharges every free cast, whatever its recharge period
  const spells = character.value.spells.map(s =>
    s.uses ? { ...s, uses: { ...s.uses, remaining: s.uses.max } } : s)

  await onUpdate({ features, hitDice, hp, spellSlots, spells, ...(warlockSlots ? { warlockSlots } : {}) })
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
          <SheetHeader :character="character" class="pt-3" @update="onUpdate" />
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
            <template v-else-if="activeTab === 'features'">
              <SheetWildShapePanel :character="character" @update="onUpdate" />
              <SheetFeaturesTraits :character="character" @update="onUpdate" />
            </template>
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
