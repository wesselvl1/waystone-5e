<script setup lang="ts">
import type { Character, SpellEntry, SpellSlotLevel, AbilityKey } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { useRulepacksStore } from '~/stores/rulepacks'
import { spellSlotMax, spellSaveDCFor, spellAttackBonusFor } from '~/services/spellcasting'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)
const rulepackStore = useRulepacksStore()

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as SpellSlotLevel[]

// ── Spellcasting sources ─────────────────────────────────────────────

interface SpellcastingSource {
  id: string
  name: string
  ability: AbilityKey
  saveDC: number
  attackBonus: number
}

/**
 * One entry per spellcasting source, each with its own DC and attack bonus.
 *
 * A cleric/sorcerer has two: the DC is not a character-wide number. The ability comes
 * from classSpellcasting[sourceId].ability, recorded per class on level-up, and falls
 * back to the class definition so a character whose data predates that still resolves.
 */
const spellcastingSources = computed<SpellcastingSource[]>(() => {
  const char = props.character
  const prof = stats.profBonus.value
  const mods = stats.abilityModifiers.value
  const seen = new Map<string, SpellcastingSource>()

  const add = (id: string, name: string, ability: AbilityKey) => {
    if (seen.has(id)) return
    seen.set(id, {
      id,
      name,
      ability,
      saveDC: spellSaveDCFor(ability, mods[ability], prof),
      attackBonus: spellAttackBonusFor(mods[ability], prof),
    })
  }

  // Classes first, in the character's own order, so the list reads predictably
  for (const entry of char.classes) {
    const def = rulepackStore.getClass(entry.classId)
    const ability = char.classSpellcasting[entry.classId]?.ability ?? def?.spellcastingAbility
    if (ability) add(entry.classId, def?.name ?? entry.classId, ability)
  }

  // Then any non-class source (a race or background grant), which has no class entry
  for (const [id, source] of Object.entries(char.classSpellcasting)) {
    add(id, source.label ?? rulepackStore.getClass(id)?.name ?? id, source.ability)
  }

  return [...seen.values()]
})

const classTabs = computed(() => spellcastingSources.value.map(s => ({ id: s.id, name: s.name })))

// Tabs only earn their space once there is more than one list
const showTabs = computed(() => classTabs.value.length > 1)

const activeTab = ref<string>('all')

watch(showTabs, (show) => { if (!show) activeTab.value = 'all' })

/** The source whose header is shown, or null on the All tab where every source is listed. */
const activeSource = computed(() =>
  spellcastingSources.value.find(s => s.id === activeTab.value) ?? null)

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
/**
 * Slots are derived from the character's classes against the multiclass caster-level
 * table rather than stored, so a new class level changes them without a migration.
 * The merged pack is used because a class may come from any loaded rulepack.
 */
const mergedPack = computed(() => ({
  id: 'merged',
  name: 'merged',
  version: '0',
  races: [],
  classes: rulepackStore.rulepacks.flatMap(p => p.classes),
  backgrounds: [],
  feats: [],
  spells: [],
  creatures: [],
  optionalFeatures: [],
}))

function slotMax(lvl: SpellSlotLevel): number {
  return spellSlotMax(lvl, props.character, mergedPack.value)
}

const hasRegularSlots = computed(() => SLOT_LEVELS.some(lvl => slotMax(lvl) > 0))

// ── Regular slot actions ──────────────────────────────────────────────────────

function useSlot(lvl: SpellSlotLevel) {
  const slots = { ...props.character.spellSlots }
  const current = slots[lvl] ?? { used: 0 }
  if (current.used >= slotMax(lvl)) return
  slots[lvl] = { ...current, used: current.used + 1 }
  emit('update', { spellSlots: slots })
}

function restoreSlot(lvl: SpellSlotLevel) {
  const slots = { ...props.character.spellSlots }
  const current = slots[lvl] ?? { used: 0 }
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

/**
 * Spend or restore a free cast. These come from a race, background or feat and are
 * castable without a slot, so they are tracked on the spell rather than in spellSlots.
 */
function adjustSpellUse(spellId: string, delta: number) {
  const updated = props.character.spells.map((sp) => {
    if (sp.id !== spellId || !sp.uses) return sp
    const remaining = Math.max(0, Math.min(sp.uses.max, sp.uses.remaining + delta))
    return { ...sp, uses: { ...sp.uses, remaining } }
  })
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
    <!-- Spellcasting: per source, because a multiclass caster has a DC per class -->
    <div v-if="spellcastingSources.length > 0" class="card space-y-2">
      <div
        v-for="source in (activeSource ? [activeSource] : spellcastingSources)"
        :key="source.id"
        class="flex items-center gap-4 flex-wrap"
      >
        <div v-if="spellcastingSources.length > 1" class="min-w-[4.5rem]">
          <p class="stat-label">List</p>
          <p class="text-sm font-semibold text-white">{{ source.name }}</p>
        </div>
        <div>
          <p class="stat-label">Ability</p>
          <p class="text-sm font-semibold text-white">{{ ABILITY_LABELS[source.ability] }}</p>
        </div>
        <div>
          <p class="stat-label">Spell Save DC</p>
          <p class="text-sm font-semibold text-white">{{ source.saveDC }}</p>
        </div>
        <div>
          <p class="stat-label">Spell Attack</p>
          <p class="text-sm font-semibold text-white">
            {{ source.attackBonus >= 0 ? '+' : '' }}{{ source.attackBonus }}
          </p>
        </div>
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
              v-for="i in slotMax(lvl)"
              :key="i"
              class="w-5 h-5 rounded-full border text-xs transition-colors"
              :class="i <= (character.spellSlots[lvl]?.used ?? 0)
                ? 'bg-surface-700 border-surface-600'
                : 'bg-primary-600/40 border-primary-500/70'"
              :title="i <= (character.spellSlots[lvl]?.used ?? 0) ? 'Restore slot' : 'Use slot'"
              @click="i <= (character.spellSlots[lvl]?.used ?? 0) ? restoreSlot(lvl) : useSlot(lvl)"
            />
            <span v-if="slotMax(lvl) === 0" class="text-slate-600 text-xs">—</span>
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
            <span class="flex-1 text-sm text-slate-200">
              {{ spell.name }}
              <span v-if="spell.castAtLevel" class="text-[10px] text-slate-500">
                (as level {{ spell.castAtLevel }})
              </span>
            </span>

            <!-- Free casts from a race or background: no slot spent, tracked here -->
            <div v-if="spell.uses" class="flex items-center gap-1 flex-shrink-0">
              <button
                class="w-5 h-5 rounded border border-surface-600 bg-surface-700 text-slate-300 text-xs leading-none disabled:opacity-30"
                :disabled="spell.uses.remaining === 0"
                title="Use a free cast"
                @click="adjustSpellUse(spell.id, -1)"
              >−</button>
              <span class="text-[10px] font-mono tabular-nums"
                :class="spell.uses.remaining === 0 ? 'text-slate-600' : 'text-accent-400'"
              >{{ spell.uses.remaining }}/{{ spell.uses.max }}</span>
              <button
                class="w-5 h-5 rounded border border-surface-600 bg-surface-700 text-slate-300 text-xs leading-none disabled:opacity-30"
                :disabled="spell.uses.remaining >= spell.uses.max"
                :title="`Recharges on a ${spell.uses.recharge} rest`"
                @click="adjustSpellUse(spell.id, 1)"
              >+</button>
            </div>

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
          <select v-if="spellcastingSources.length > 0" v-model="addClassId" class="input w-32">
            <option value="">No list</option>
            <option
              v-for="cls in spellcastingSources"
              :key="cls.id"
              :value="cls.id"
            >
              {{ cls.name }}
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
