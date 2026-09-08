<script setup lang="ts">
import type { Character, SpellEntry, SpellSlotLevel, AbilityKey } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { useRulepacksStore } from '~/stores/rulepacks'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)
const rulepackStore = useRulepacksStore()

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as SpellSlotLevel[]

// ── Class tabs ────────────────────────────────────────────────────────────────

// Collect distinct classIds that have spells assigned
const spellClassIds = computed(() => {
  const ids = new Set<string>()
  for (const spell of props.character.spells) {
    if (spell.classId) ids.add(spell.classId)
  }
  return [...ids]
})

interface ClassTab { id: string; name: string }

const classTabs = computed<ClassTab[]>(() => {
  const tabs: ClassTab[] = []
  for (const classId of spellClassIds.value) {
    const cls = rulepackStore.getClass(classId)
    tabs.push({ id: classId, name: cls?.name ?? classId })
  }
  return tabs
})

// Show tabs only when there are multiple distinct class lists
const showTabs = computed(() => classTabs.value.length > 1)

const activeTab = ref<string>('all')

// Reset to 'all' when tabs disappear
watch(showTabs, (show) => { if (!show) activeTab.value = 'all' })

const visibleSpells = computed(() =>
  activeTab.value === 'all'
    ? props.character.spells
    : props.character.spells.filter(s => s.classId === activeTab.value),
)

const spellsByLevel = computed(() => {
  const map = new Map<number, SpellEntry[]>()
  map.set(0, [])
  for (const lvl of SLOT_LEVELS) map.set(lvl, [])
  for (const spell of visibleSpells.value) {
    const list = map.get(spell.level) ?? []
    list.push(spell)
    map.set(spell.level, list)
  }
  return map
})

// Whether any regular (non-warlock) spell slots exist
const hasRegularSlots = computed(() =>
  SLOT_LEVELS.some(lvl => (props.character.spellSlots[lvl]?.max ?? 0) > 0),
)

// ── Regular slot actions ──────────────────────────────────────────────────────

function useSlot(lvl: SpellSlotLevel) {
  const slots = { ...props.character.spellSlots }
  const current = slots[lvl] ?? { max: 0, used: 0 }
  if (current.used >= current.max) return
  slots[lvl] = { ...current, used: current.used + 1 }
  emit('update', { spellSlots: slots })
}

function restoreSlot(lvl: SpellSlotLevel) {
  const slots = { ...props.character.spellSlots }
  const current = slots[lvl] ?? { max: 0, used: 0 }
  if (current.used === 0) return
  slots[lvl] = { ...current, used: current.used - 1 }
  emit('update', { spellSlots: slots })
}

// ── Warlock (pact magic) slot actions ────────────────────────────────────────

function usePactSlot() {
  const ws = props.character.warlockSlots
  if (!ws || ws.used >= ws.max) return
  emit('update', { warlockSlots: { ...ws, used: ws.used + 1 } })
}

function restorePactSlot() {
  const ws = props.character.warlockSlots
  if (!ws || ws.used === 0) return
  emit('update', { warlockSlots: { ...ws, used: ws.used - 1 } })
}

// ── Spell list actions ────────────────────────────────────────────────────────

function togglePrepared(spellId: string) {
  const updated = props.character.spells.map(s =>
    s.id === spellId ? { ...s, prepared: !s.prepared } : s,
  )
  emit('update', { spells: updated })
}

function removeSpell(spellId: string) {
  emit('update', { spells: props.character.spells.filter(s => s.id !== spellId) })
}

// ── Add spell form ────────────────────────────────────────────────────────────

const showAddForm = ref(false)
const addLevel = ref(0)
const addClassId = ref<string>('')
const searchQuery = ref('')

// Default the add-class selector to the active tab class (if applicable)
watch(activeTab, (tab) => { addClassId.value = tab === 'all' ? '' : tab })

const allSpells = computed(() => rulepackStore.getAllSpells())

const filteredSpells = computed(() =>
  allSpells.value.filter(s =>
    s.level === addLevel.value
    && !props.character.spells.some(cs => cs.spellId === s.id)
    && (searchQuery.value === '' || s.name.toLowerCase().includes(searchQuery.value.toLowerCase())),
  ),
)

function addSpellFromList(spellDef: { id: string; name: string; level: number }) {
  const entry: SpellEntry = {
    id: crypto.randomUUID(),
    spellId: spellDef.id,
    name: spellDef.name,
    level: spellDef.level,
    prepared: spellDef.level === 0,
    classId: addClassId.value || undefined,
  }
  emit('update', { spells: [...props.character.spells, entry] })
}

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}
</script>

<template>
  <div class="space-y-3">
    <!-- Spellcasting header -->
    <div class="card flex items-center gap-4 flex-wrap">
      <div>
        <p class="stat-label">Ability</p>
        <p class="text-sm font-semibold text-white">{{ character.spellcastingAbility ? ABILITY_LABELS[character.spellcastingAbility] : '—' }}</p>
      </div>
      <div>
        <p class="stat-label">Spell Save DC</p>
        <p class="text-sm font-semibold text-white">{{ stats.spellSaveDC.value ?? '—' }}</p>
      </div>
      <div>
        <p class="stat-label">Spell Attack</p>
        <p class="text-sm font-semibold text-white">
          {{ stats.spellAttackBonus.value !== null ? (stats.spellAttackBonus.value >= 0 ? '+' : '') + stats.spellAttackBonus.value : '—' }}
        </p>
      </div>
    </div>

    <!-- Regular spell slots (only shown when character has them) -->
    <div v-if="hasRegularSlots" class="card">
      <p class="section-header">Spell Slots</p>
      <div class="space-y-2">
        <div
          v-for="lvl in SLOT_LEVELS"
          :key="lvl"
          class="flex items-center gap-2"
        >
          <span class="text-xs text-slate-500 w-4 flex-shrink-0">{{ lvl }}</span>
          <div class="flex gap-1.5 flex-wrap flex-1">
            <button
              v-for="i in (character.spellSlots[lvl]?.max ?? 0)"
              :key="i"
              class="w-5 h-5 rounded-full border text-xs transition-colors"
              :class="i <= (character.spellSlots[lvl]?.used ?? 0)
                ? 'bg-surface-700 border-surface-600'
                : 'bg-primary-600/40 border-primary-500/70'"
              :title="i <= (character.spellSlots[lvl]?.used ?? 0) ? 'Restore slot' : 'Use slot'"
              @click="i <= (character.spellSlots[lvl]?.used ?? 0) ? restoreSlot(lvl) : useSlot(lvl)"
            />
            <span v-if="!character.spellSlots[lvl]?.max" class="text-slate-600 text-xs">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pact magic slots (Warlock) -->
    <div v-if="character.warlockSlots" class="card">
      <p class="section-header">Pact Magic Slots
        <span class="text-slate-500 font-normal text-xs ml-1">(Level {{ character.warlockSlots.slotLevel }} · Short Rest)</span>
      </p>
      <div class="flex gap-1.5 flex-wrap mt-1">
        <button
          v-for="i in character.warlockSlots.max"
          :key="i"
          class="w-5 h-5 rounded-full border text-xs transition-colors"
          :class="i <= character.warlockSlots.used
            ? 'bg-surface-700 border-surface-600'
            : 'bg-violet-600/40 border-violet-500/70'"
          :title="i <= character.warlockSlots.used ? 'Restore pact slot' : 'Use pact slot'"
          @click="i <= character.warlockSlots!.used ? restorePactSlot() : usePactSlot()"
        />
        <span v-if="!character.warlockSlots.max" class="text-slate-600 text-xs">—</span>
      </div>
    </div>

    <!-- Class tabs (shown only when spells from multiple classes exist) -->
    <div v-if="showTabs" class="flex gap-1 border-b border-surface-700 pb-0">
      <button
        class="px-3 py-1.5 text-xs font-medium transition-colors rounded-t"
        :class="activeTab === 'all'
          ? 'text-white bg-surface-700'
          : 'text-slate-400 hover:text-slate-200'"
        @click="activeTab = 'all'"
      >
        All
      </button>
      <button
        v-for="tab in classTabs"
        :key="tab.id"
        class="px-3 py-1.5 text-xs font-medium transition-colors rounded-t"
        :class="activeTab === tab.id
          ? 'text-white bg-surface-700'
          : 'text-slate-400 hover:text-slate-200'"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
      </button>
    </div>

    <!-- Spells by level -->
    <div v-for="[lvl, spells] in spellsByLevel" :key="lvl">
      <div v-if="spells.length > 0">
        <p class="section-header">{{ lvl === 0 ? 'Cantrips' : `Level ${lvl}` }}</p>
        <div class="card divide-y divide-surface-700/50">
          <div
            v-for="spell in spells"
            :key="spell.id"
            class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <button
              v-if="lvl > 0"
              class="proficiency-dot flex-shrink-0"
              :class="{ active: spell.prepared }"
              title="Toggle prepared"
              @click="togglePrepared(spell.id)"
            />
            <div v-else class="w-3 h-3 flex-shrink-0" />
            <span class="flex-1 text-sm text-slate-200">{{ spell.name }}</span>
            <SpellRollBadge :spell-id="spell.spellId" />
            <button class="btn-danger p-1" @click="removeSpell(spell.id)">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add spell -->
    <div>
      <button class="btn-ghost text-xs w-full" @click="showAddForm = !showAddForm">
        {{ showAddForm ? 'Cancel' : '+ Add Spell' }}
      </button>
      <div v-if="showAddForm" class="card mt-2 space-y-2">
        <div class="flex gap-2 flex-wrap">
          <select v-model.number="addLevel" class="input w-28">
            <option :value="0">Cantrip</option>
            <option v-for="l in 9" :key="l" :value="l">Level {{ l }}</option>
          </select>
          <!-- Class selector for the spell being added -->
          <select v-if="character.classes.length > 1 || spellClassIds.length > 0" v-model="addClassId" class="input w-32">
            <option value="">No class</option>
            <option
              v-for="cls in character.classes"
              :key="cls.classId"
              :value="cls.classId"
            >
              {{ rulepackStore.getClass(cls.classId)?.name ?? cls.classId }}
            </option>
          </select>
          <input v-model="searchQuery" class="input flex-1 min-w-24" placeholder="Search spells…" />
        </div>
        <div class="max-h-40 overflow-y-auto space-y-0.5">
          <button
            v-for="spell in filteredSpells.slice(0, 50)"
            :key="spell.id"
            class="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-surface-700 rounded transition-colors"
            @click="addSpellFromList(spell)"
          >
            {{ spell.name }}
          </button>
          <p v-if="filteredSpells.length === 0" class="text-slate-500 text-xs text-center py-2">
            {{ allSpells.length === 0 ? 'No rulepacks loaded' : 'No matching spells' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
