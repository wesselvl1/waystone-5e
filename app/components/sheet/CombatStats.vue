<script setup lang="ts">
import type { Character } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const editingHP = ref<'current' | 'max' | 'temp' | null>(null)
const draftHP = ref(0)
const editingAC = ref(false)
const draftAC = ref(0)
const editingSpeed = ref(false)
const draftSpeed = ref(30)

function startHPEdit(field: 'current' | 'max' | 'temp') {
  editingHP.value = field
  draftHP.value = props.character.hp[field]
}

function commitHPEdit(field: 'current' | 'max' | 'temp') {
  emit('update', { hp: { ...props.character.hp, [field]: draftHP.value } })
  editingHP.value = null
}

function startACEdit() {
  editingAC.value = true
  draftAC.value = stats.armorClass.value
}

function commitACEdit() {
  emit('update', { armorClass: draftAC.value })
  editingAC.value = false
}

function startSpeedEdit() {
  editingSpeed.value = true
  draftSpeed.value = props.character.speed
}

function commitSpeedEdit() {
  emit('update', { speed: draftSpeed.value })
  editingSpeed.value = false
}

const hpPercent = computed(() => {
  const max = props.character.hp.max
  return max > 0 ? Math.max(0, Math.min(100, (props.character.hp.current / max) * 100)) : 0
})

const hpColor = computed(() => {
  if (hpPercent.value > 50) return 'bg-success-500'
  if (hpPercent.value > 25) return 'bg-accent-500'
  return 'bg-danger-500'
})

const hitDice = computed(() => props.character.hitDice)

function checkDeathSave(type: 'successes' | 'failures', idx: number) {
  const current = props.character.deathSaves[type]
  const newVal = current === idx + 1 ? idx : idx + 1
  emit('update', { deathSaves: { ...props.character.deathSaves, [type]: newVal } })
}

// ── Damage / Heal modal ───────────────────────────────────────────────────────
const hpModalMode = ref<'damage' | 'heal' | null>(null)
const hpModalAmount = ref(0)

function openHpModal(mode: 'damage' | 'heal') {
  hpModalMode.value = mode
  hpModalAmount.value = 0
  nextTick(() => {
    const el = document.getElementById('hp-modal-input')
    el?.focus()
  })
}

function closeHpModal() {
  hpModalMode.value = null
}

const hpModalNewCurrent = computed(() => {
  const { current, max } = props.character.hp
  const amount = hpModalAmount.value || 0
  if (hpModalMode.value === 'damage') return Math.max(0, current - amount)
  if (hpModalMode.value === 'heal') return Math.min(max, current + amount)
  return current
})

function applyHpChange() {
  if (!hpModalMode.value || hpModalAmount.value <= 0) { closeHpModal(); return }
  emit('update', { hp: { ...props.character.hp, current: hpModalNewCurrent.value } })
  closeHpModal()
}
</script>

<template>
  <div class="space-y-3">
    <!-- HP -->
    <div class="card space-y-2">
      <div class="flex items-center justify-between">
        <p class="section-header mb-0">Hit Points</p>
        <span class="text-xs text-slate-500 font-mono">{{ character.hp.current }} / {{ character.hp.max }}</span>
      </div>
      <div class="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-300" :class="hpColor" :style="{ width: `${hpPercent}%` }" />
      </div>
      <div class="flex gap-2 mb-1">
        <button class="flex-1 py-1.5 rounded-md text-xs font-semibold bg-danger-600/20 border border-danger-500/40 text-danger-300 hover:bg-danger-600/40 transition-colors" @click="openHpModal('damage')">Damage</button>
        <button class="flex-1 py-1.5 rounded-md text-xs font-semibold bg-success-600/20 border border-success-500/40 text-success-300 hover:bg-success-600/40 transition-colors" @click="openHpModal('heal')">Heal</button>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="stat-box cursor-pointer" @click="startHPEdit('current')">
          <span class="stat-label">Current</span>
          <template v-if="editingHP === 'current'">
            <input v-model.number="draftHP" type="number" class="input text-center text-lg w-16 px-1 py-0" autofocus @blur="commitHPEdit('current')" @keydown.enter="commitHPEdit('current')" @click.stop />
          </template>
          <span v-else class="stat-value">{{ character.hp.current }}</span>
        </div>
        <div class="stat-box cursor-pointer" @click="startHPEdit('max')">
          <span class="stat-label">Max</span>
          <template v-if="editingHP === 'max'">
            <input v-model.number="draftHP" type="number" class="input text-center text-lg w-16 px-1 py-0" autofocus @blur="commitHPEdit('max')" @keydown.enter="commitHPEdit('max')" @click.stop />
          </template>
          <span v-else class="stat-value">{{ character.hp.max }}</span>
        </div>
        <div class="stat-box cursor-pointer" @click="startHPEdit('temp')">
          <span class="stat-label">Temp</span>
          <template v-if="editingHP === 'temp'">
            <input v-model.number="draftHP" type="number" class="input text-center text-lg w-16 px-1 py-0" autofocus @blur="commitHPEdit('temp')" @keydown.enter="commitHPEdit('temp')" @click.stop />
          </template>
          <span v-else class="stat-value text-accent-400">{{ character.hp.temp || '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Combat stats grid -->
    <div class="grid grid-cols-4 gap-2">
      <div class="stat-box cursor-pointer col-span-1" @click="startACEdit">
        <span class="stat-label">AC</span>
        <template v-if="editingAC">
          <input v-model.number="draftAC" type="number" class="input text-center text-lg w-14 px-1 py-0" autofocus @blur="commitACEdit" @keydown.enter="commitACEdit" @click.stop />
        </template>
        <span v-else class="stat-value">{{ stats.armorClass.value }}</span>
      </div>
      <div class="stat-box col-span-1">
        <span class="stat-label">Init</span>
        <span class="stat-value">{{ stats.initiative.value >= 0 ? '+' : '' }}{{ stats.initiative.value }}</span>
      </div>
      <div class="stat-box cursor-pointer col-span-1" @click="startSpeedEdit">
        <span class="stat-label">Speed</span>
        <template v-if="editingSpeed">
          <input v-model.number="draftSpeed" type="number" class="input text-center text-lg w-14 px-1 py-0" autofocus @blur="commitSpeedEdit" @keydown.enter="commitSpeedEdit" @click.stop />
        </template>
        <span v-else class="stat-value">{{ character.speed }}</span>
      </div>
      <div class="stat-box col-span-1">
        <span class="stat-label">Passive</span>
        <span class="stat-value">{{ stats.passivePerception.value }}</span>
      </div>
    </div>

    <!-- Hit Dice -->
    <div class="card">
      <div class="flex items-center justify-between">
        <p class="section-header mb-0">Hit Dice ({{ hitDice.die }})</p>
        <span class="text-xs text-slate-500">{{ hitDice.remaining }}/{{ hitDice.total }}</span>
      </div>
      <div class="flex gap-1.5 flex-wrap mt-2">
        <div
          v-for="i in hitDice.total"
          :key="i"
          class="w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
          :class="i <= hitDice.remaining ? 'bg-primary-600/30 border-primary-500/60 text-primary-300' : 'bg-surface-700 border-surface-600 text-slate-600'"
          @click="emit('update', { hitDice: { ...character.hitDice, remaining: i <= hitDice.remaining ? hitDice.remaining - 1 : hitDice.remaining + 1 } })"
        >
          {{ hitDice.die.replace('d', '') }}
        </div>
      </div>
    </div>

    <!-- Death saves -->
    <div v-if="character.hp.current <= 0" class="card">
      <p class="section-header">Death Saves</p>
      <div class="flex gap-4">
        <div class="flex-1">
          <p class="text-xs text-success-400 mb-1">Successes</p>
          <div class="flex gap-2">
            <div
              v-for="i in 3"
              :key="i"
              class="w-6 h-6 rounded-full border cursor-pointer transition-colors"
              :class="i <= character.deathSaves.successes ? 'bg-success-500 border-success-400' : 'border-slate-600'"
              @click="checkDeathSave('successes', i - 1)"
            />
          </div>
        </div>
        <div class="flex-1">
          <p class="text-xs text-danger-400 mb-1">Failures</p>
          <div class="flex gap-2">
            <div
              v-for="i in 3"
              :key="i"
              class="w-6 h-6 rounded-full border cursor-pointer transition-colors"
              :class="i <= character.deathSaves.failures ? 'bg-danger-500 border-danger-400' : 'border-slate-600'"
              @click="checkDeathSave('failures', i - 1)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Damage / Heal modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="hpModalMode" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="closeHpModal">
        <div class="bg-surface-800 border border-surface-600 rounded-xl p-5 w-72 shadow-xl">
          <p class="text-sm font-semibold mb-3" :class="hpModalMode === 'damage' ? 'text-danger-300' : 'text-success-300'">
            {{ hpModalMode === 'damage' ? '⚔ Apply Damage' : '✚ Heal' }}
          </p>
          <input
            id="hp-modal-input"
            v-model.number="hpModalAmount"
            type="number"
            min="0"
            class="input w-full text-center text-2xl font-bold mb-3"
            @keydown.enter="applyHpChange"
            @keydown.esc="closeHpModal"
          />
          <div class="flex items-center justify-between text-xs mb-4 px-1">
            <div class="text-center">
              <p class="text-slate-500 uppercase tracking-wider mb-0.5">Current</p>
              <p class="text-lg font-bold text-slate-200">{{ character.hp.current }}</p>
            </div>
            <div class="text-slate-500 text-base">&rarr;</div>
            <div class="text-center">
              <p class="text-slate-500 uppercase tracking-wider mb-0.5">New</p>
              <p class="text-lg font-bold" :class="hpModalMode === 'damage' ? 'text-danger-300' : 'text-success-300'">{{ hpModalNewCurrent }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="flex-1 btn-ghost text-sm py-1.5" @click="closeHpModal">Cancel</button>
            <button
              class="flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors"
              :class="hpModalMode === 'damage' ? 'bg-danger-600 hover:bg-danger-500 text-white' : 'bg-success-600 hover:bg-success-500 text-white'"
              @click="applyHpChange"
            >
              {{ hpModalMode === 'damage' ? 'Apply Damage' : 'Heal' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
