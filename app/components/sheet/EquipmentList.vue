<script setup lang="ts">
import type { Character, EquipmentEntry, Currency } from '~/types/character'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const showAddForm = ref(false)
const newItem = reactive({ name: '', quantity: 1, notes: '' })

function addItem() {
  if (!newItem.name.trim()) return
  const entry: EquipmentEntry = {
    id: crypto.randomUUID(),
    name: newItem.name.trim(),
    quantity: newItem.quantity,
    notes: newItem.notes,
  }
  emit('update', { equipment: [...props.character.equipment, entry] })
  Object.assign(newItem, { name: '', quantity: 1, notes: '' })
  showAddForm.value = false
}

function removeItem(id: string) {
  emit('update', { equipment: props.character.equipment.filter(e => e.id !== id) })
}

function updateQty(id: string, delta: number) {
  const updated = props.character.equipment.map(e =>
    e.id === id ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e,
  )
  emit('update', { equipment: updated })
}

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

        <div
          v-for="item in character.equipment"
          :key="item.id"
          class="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">{{ item.name }}</p>
            <p v-if="item.notes" class="text-xs text-slate-500 truncate">{{ item.notes }}</p>
          </div>
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

        <div v-if="showAddForm" class="pt-3 space-y-2">
          <input v-model="newItem.name" class="input" placeholder="Item name" />
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Quantity</label>
              <input v-model.number="newItem.quantity" type="number" min="1" class="input" />
            </div>
            <div>
              <label class="label">Notes</label>
              <input v-model="newItem.notes" class="input" placeholder="optional" />
            </div>
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
