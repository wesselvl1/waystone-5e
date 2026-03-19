<script setup lang="ts">
import type { Character, AttackEntry } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const showAddForm = ref(false)
const newAttack = reactive<Omit<AttackEntry, 'id'>>({
  name: '',
  bonus: null,
  damageDice: '1d6',
  damageType: 'slashing',
  notes: '',
})

function addAttack() {
  if (!newAttack.name.trim()) return
  const entry: AttackEntry = { ...newAttack, id: crypto.randomUUID() }
  emit('update', { attacks: [...props.character.attacks, entry] })
  Object.assign(newAttack, { name: '', bonus: null, damageDice: '1d6', damageType: 'slashing', notes: '' })
  showAddForm.value = false
}

function removeAttack(id: string) {
  emit('update', { attacks: props.character.attacks.filter(a => a.id !== id) })
}

function displayBonus(attack: AttackEntry): string {
  if (attack.bonus !== null) {
    return attack.bonus >= 0 ? `+${attack.bonus}` : `${attack.bonus}`
  }
  // Use spell attack bonus if available, else STR or DEX
  const b = stats.spellAttackBonus.value ?? Math.max(stats.abilityModifiers.value.str, stats.abilityModifiers.value.dex) + stats.profBonus.value
  return b >= 0 ? `+${b}` : `${b}`
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <p class="section-header mb-0">Attacks</p>
      <button class="btn-ghost text-xs py-1 px-2" @click="showAddForm = !showAddForm">+ Add</button>
    </div>

    <div class="card space-y-0 divide-y divide-surface-700/50">
      <div v-if="character.attacks.length === 0 && !showAddForm" class="text-slate-500 text-sm py-2 text-center">
        No attacks yet
      </div>

      <div
        v-for="attack in character.attacks"
        :key="attack.id"
        class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{{ attack.name }}</p>
          <p v-if="attack.notes" class="text-xs text-slate-500 truncate">{{ attack.notes }}</p>
        </div>
        <div class="flex items-center gap-2 text-sm flex-shrink-0">
          <span class="font-mono text-primary-300">{{ displayBonus(attack) }}</span>
          <span class="text-slate-400">{{ attack.damageDice }}</span>
          <span class="text-xs text-slate-500 capitalize">{{ attack.damageType }}</span>
        </div>
        <button class="btn-danger p-1 text-xs" @click="removeAttack(attack.id)">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Add form -->
      <div v-if="showAddForm" class="pt-3 space-y-2">
        <input v-model="newAttack.name" class="input" placeholder="Attack name" />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label">Bonus (blank = auto)</label>
            <input v-model.number="newAttack.bonus" type="number" class="input" placeholder="auto" />
          </div>
          <div>
            <label class="label">Damage Dice</label>
            <input v-model="newAttack.damageDice" class="input" placeholder="1d6+3" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label">Damage Type</label>
            <input v-model="newAttack.damageType" class="input" placeholder="slashing" />
          </div>
          <div>
            <label class="label">Notes</label>
            <input v-model="newAttack.notes" class="input" placeholder="optional" />
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button class="btn-ghost text-xs" @click="showAddForm = false">Cancel</button>
          <button class="btn-primary text-xs" @click="addAttack">Add Attack</button>
        </div>
      </div>
    </div>
  </div>
</template>
