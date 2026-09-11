<script setup lang="ts">
import type { Character, EquipmentEntry, Currency } from '~/types/character'
import { useRulepacksStore } from '~/stores/rulepacks'
import { carriedWeight, carryingCapacity, entryWeight } from '~/services/equipment'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rulepackStore = useRulepacksStore()

const showAddForm = ref(false)
const newItem = reactive({ name: '', quantity: 1, weight: null as number | null, notes: '' })

/**
 * Weights the books already print, so a longsword does not have to be looked up.
 *
 * Keyed by name rather than id because this list is free text — a player types "Chain
 * Mail", they do not pick it from the armour table — and the name is the only thing the
 * two sides share.
 */
const knownItems = computed(() => {
  const byName = new Map<string, { name: string; weight: number }>()
  const add = (name: string, weight: number | undefined) => {
    if (typeof weight !== 'number') return
    const key = name.toLowerCase()
    if (!byName.has(key)) byName.set(key, { name, weight })
  }
  for (const w of rulepackStore.getAllWeapons()) add(w.name, w.weight)
  for (const a of rulepackStore.getAllArmor()) add(a.name, a.weight)
  return byName
})

const knownItemNames = computed(() => [...knownItems.value.values()].map(i => i.name))

function suggestWeight(name: string): number | undefined {
  return knownItems.value.get(name.trim().toLowerCase())?.weight
}

/** Fill the weight box from the books, but only while the player has left it empty. */
watch(() => newItem.name, (name) => {
  if (newItem.weight !== null) return
  const suggested = suggestWeight(name)
  if (suggested !== undefined) newItem.weight = suggested
})

function addItem() {
  if (!newItem.name.trim()) return
  const entry: EquipmentEntry = {
    id: crypto.randomUUID(),
    name: newItem.name.trim(),
    quantity: newItem.quantity,
    notes: newItem.notes,
    ...(newItem.weight !== null && newItem.weight >= 0 ? { weight: newItem.weight } : {}),
  }
  emit('update', { equipment: [...props.character.equipment, entry] })
  Object.assign(newItem, { name: '', quantity: 1, weight: null, notes: '' })
  showAddForm.value = false
}

function removeItem(id: string) {
  emit('update', { equipment: props.character.equipment.filter(e => e.id !== id) })
  if (editingId.value === id) editingId.value = null
}

function updateQty(id: string, delta: number) {
  const updated = props.character.equipment.map(e =>
    e.id === id ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e,
  )
  emit('update', { equipment: updated })
}

// --- Editing an item already on the list ---------------------------------------------

const editingId = ref<string | null>(null)
const draft = reactive({ name: '', quantity: 1, weight: null as number | null, notes: '' })

function startEdit(item: EquipmentEntry) {
  if (editingId.value === item.id) {
    editingId.value = null
    return
  }
  editingId.value = item.id
  showAddForm.value = false
  Object.assign(draft, {
    name: item.name,
    quantity: item.quantity,
    weight: typeof item.weight === 'number' ? item.weight : null,
    notes: item.notes ?? '',
  })
}

function saveEdit() {
  const id = editingId.value
  if (!id || !draft.name.trim()) return
  const updated = props.character.equipment.map((e) => {
    if (e.id !== id) return e
    const { weight: _dropped, ...rest } = e
    return {
      ...rest,
      name: draft.name.trim(),
      quantity: Math.max(0, draft.quantity || 0),
      notes: draft.notes,
      ...(draft.weight !== null && draft.weight >= 0 ? { weight: draft.weight } : {}),
    }
  })
  emit('update', { equipment: updated })
  editingId.value = null
}

// --- Weight and capacity ---------------------------------------------------------------

const carried = computed(() => carriedWeight(props.character))
const capacity = computed(() => carryingCapacity(props.character))

const overCapacity = computed(() => carried.value.total > capacity.value.capacity)

const fillPercent = computed(() => {
  const max = capacity.value.capacity
  if (max <= 0) return 0
  return Math.min(100, (carried.value.total / max) * 100)
})

const showCapacityDetail = ref(false)

/** Multiplier choices: "Auto" hands it back to the features, the rest are stated. */
const MULTIPLIERS = [
  { value: null, label: 'Auto' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
]

function setMultiplier(value: number | null) {
  emit('update', { carryingCapacityMultiplier: value })
}

const activeMultiplier = computed(() =>
  capacity.value.manual ? props.character.carryingCapacityMultiplier ?? null : null,
)

/** Pounds, without a trailing ".0" on the whole numbers that most of them are. */
function lb(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

// --- Currency -------------------------------------------------------------------------

const draftCurrency = reactive({ ...props.character.currency })
watch(() => props.character.currency, v => Object.assign(draftCurrency, v), { deep: true })

function saveCurrency() {
  emit('update', { currency: { ...draftCurrency } })
}

const CURRENCY: { key: keyof Currency; label: string; color: string }[] = [
  { key: 'cp', label: 'CP', color: 'text-orange-400' },
  { key: 'sp', label: 'SP', color: 'text-slate-300' },
  { key: 'ep', label: 'EP', color: 'text-blue-300' },
  { key: 'gp', label: 'GP', color: 'text-accent-400' },
  { key: 'pp', label: 'PP', color: 'text-purple-300' },
]
</script>

<template>
  <div class="space-y-3">
    <!-- Currency -->
    <div class="card">
      <p class="section-header">Currency</p>
      <div class="grid grid-cols-5 gap-2">
        <div v-for="c in CURRENCY" :key="c.key" class="flex flex-col items-center gap-1">
          <span class="text-[10px] uppercase tracking-wider" :class="c.color">{{ c.label }}</span>
          <input
            v-model.number="draftCurrency[c.key]"
            type="number"
            min="0"
            class="input text-center px-1 py-1 text-sm w-full"
            @blur="saveCurrency"
            @keydown.enter="saveCurrency"
          />
        </div>
      </div>
    </div>

    <!-- Carrying capacity -->
    <div class="card">
      <button class="w-full flex items-center justify-between" @click="showCapacityDetail = !showCapacityDetail">
        <p class="section-header mb-0">Carrying Capacity</p>
        <span class="text-xs" :class="overCapacity ? 'text-danger-400' : 'text-slate-400'">
          {{ lb(carried.total) }} / {{ lb(capacity.capacity) }} lb
        </span>
      </button>

      <div class="mt-2 h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="overCapacity ? 'bg-danger-500' : 'bg-primary-500'"
          :style="{ width: `${fillPercent}%` }"
        />
      </div>

      <p v-if="overCapacity" class="text-xs text-danger-400 mt-1.5">
        Over capacity by {{ lb(carried.total - capacity.capacity) }} lb.
      </p>
      <p v-else-if="carried.unweighed > 0" class="text-xs text-slate-500 mt-1.5">
        {{ carried.unweighed }} item{{ carried.unweighed === 1 ? '' : 's' }} without a weight.
      </p>

      <div v-if="showCapacityDetail" class="mt-3 space-y-2 border-t border-surface-700/50 pt-3">
        <div class="space-y-1 text-xs">
          <div class="flex justify-between text-slate-400">
            <span>Strength {{ capacity.strength }} &times; 15</span>
            <span>{{ lb(capacity.base) }} lb</span>
          </div>
          <div v-for="source in capacity.sources" :key="source" class="flex justify-between text-slate-400">
            <span>{{ source }}</span>
            <span>&times;2</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Push, drag or lift</span>
            <span>{{ lb(capacity.pushDragLift) }} lb</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Gear</span>
            <span>{{ lb(carried.gear) }} lb</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Coins</span>
            <span>{{ lb(carried.coins) }} lb</span>
          </div>
        </div>

        <div>
          <label class="label">Multiplier</label>
          <div class="flex gap-1">
            <button
              v-for="option in MULTIPLIERS"
              :key="String(option.value)"
              class="flex-1 py-1 text-xs rounded"
              :class="activeMultiplier === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-surface-700 text-slate-400 hover:text-white'"
              @click="setMultiplier(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="text-[11px] text-slate-500 mt-1">
            Auto doubles it for each feature that says it does — Powerful Build, a bear totem.
          </p>
        </div>
      </div>
    </div>

    <!-- Equipment list -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="section-header mb-0">Equipment</p>
        <button class="btn-ghost text-xs py-1 px-2" @click="showAddForm = !showAddForm">+ Add</button>
      </div>

      <div class="card divide-y divide-surface-700/50">
        <div v-if="character.equipment.length === 0 && !showAddForm" class="text-slate-500 text-sm py-2 text-center">
          No equipment yet
        </div>

        <div v-for="item in character.equipment" :key="item.id" class="py-2 first:pt-0 last:pb-0">
          <div class="flex items-center gap-2">
            <button class="flex-1 min-w-0 text-left" @click="startEdit(item)">
              <p class="text-sm text-white truncate">{{ item.name }}</p>
              <p class="text-xs text-slate-500 truncate">
                <span v-if="item.weight !== undefined">{{ lb(entryWeight(item)) }} lb</span>
                <span v-if="item.weight !== undefined && item.notes"> &middot; </span>
                <span v-if="item.notes">{{ item.notes }}</span>
              </p>
            </button>
            <div class="flex items-center gap-1">
              <button class="w-6 h-6 rounded bg-surface-700 text-slate-400 hover:text-white text-xs" @click="updateQty(item.id, -1)">-</button>
              <span class="text-sm text-slate-300 w-6 text-center">{{ item.quantity }}</span>
              <button class="w-6 h-6 rounded bg-surface-700 text-slate-400 hover:text-white text-xs" @click="updateQty(item.id, 1)">+</button>
            </div>
            <button class="btn-danger p-1" @click="removeItem(item.id)">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="editingId === item.id" class="mt-2 space-y-2">
            <input v-model="draft.name" class="input" placeholder="Item name" @keydown.enter="saveEdit" />
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="label">Quantity</label>
                <input v-model.number="draft.quantity" type="number" min="0" class="input" />
              </div>
              <div>
                <label class="label">Weight (lb each)</label>
                <input v-model.number="draft.weight" type="number" min="0" step="0.1" class="input" placeholder="optional" />
              </div>
            </div>
            <div>
              <label class="label">Notes</label>
              <input v-model="draft.notes" class="input" placeholder="optional" @keydown.enter="saveEdit" />
            </div>
            <div class="flex gap-2 justify-end">
              <button class="btn-ghost text-xs" @click="editingId = null">Cancel</button>
              <button class="btn-primary text-xs" @click="saveEdit">Save</button>
            </div>
          </div>
        </div>

        <div v-if="showAddForm" class="pt-3 space-y-2">
          <input v-model="newItem.name" class="input" placeholder="Item name" list="known-equipment" />
          <datalist id="known-equipment">
            <option v-for="name in knownItemNames" :key="name" :value="name" />
          </datalist>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Quantity</label>
              <input v-model.number="newItem.quantity" type="number" min="1" class="input" />
            </div>
            <div>
              <label class="label">Weight (lb each)</label>
              <input v-model.number="newItem.weight" type="number" min="0" step="0.1" class="input" placeholder="optional" />
            </div>
          </div>
          <div>
            <label class="label">Notes</label>
            <input v-model="newItem.notes" class="input" placeholder="optional" />
          </div>
          <div class="flex gap-2 justify-end">
            <button class="btn-ghost text-xs" @click="showAddForm = false">Cancel</button>
            <button class="btn-primary text-xs" @click="addItem">Add Item</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
