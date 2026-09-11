<script setup lang="ts">
import type { Character, FeatureUsesBonusSource } from '~/types/character'
import { useCharacterStats } from '~/composables/useCharacterStats'
import { useRulepacksStore } from '~/stores/rulepacks'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)
const rulepackStore = useRulepacksStore()

const editingHP = ref<'current' | 'max' | 'temp' | null>(null)
const draftHP = ref(0)
/** AC is a calculator rather than a number box, so it gets a modal like an attack. */
const acModalOpen = ref(false)
const editingSpeed = ref(false)
const draftSpeed = ref(30)
/** Initiative is derived like AC now, so it gets the same modal: its working, and the
    three bonus slots for what no rulepack models. */
const initiativeModalOpen = ref(false)

function startHPEdit(field: 'current' | 'max' | 'temp') {
  editingHP.value = field
  draftHP.value = props.character.hp[field]
}

function commitHPEdit(field: 'current' | 'max' | 'temp') {
  emit('update', { hp: { ...props.character.hp, [field]: draftHP.value } })
  editingHP.value = null
}

function saveArmorClass(patch: Pick<Character, 'armorClass' | 'armorClassConfig'>) {
  emit('update', patch)
  acModalOpen.value = false
}

function saveInitiative(patch: Pick<Character, 'initiative' | 'initiativeBonuses'>) {
  emit('update', patch)
  initiativeModalOpen.value = false
}

function startSpeedEdit() {
  editingSpeed.value = true
  draftSpeed.value = props.character.speeds.walk
}

function commitSpeedEdit() {
  emit('update', { speeds: { ...props.character.speeds, walk: draftSpeed.value } })
  editingSpeed.value = false
}

/** Fly, swim and climb, in the order a sheet prints them; walking has its own box. */
const otherSpeeds = computed(() => ([
  { label: 'Fly', value: props.character.speeds.fly },
  { label: 'Swim', value: props.character.speeds.swim },
  { label: 'Climb', value: props.character.speeds.climb },
].filter((s): s is { label: string; value: number } => typeof s.value === 'number' && s.value > 0)))

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

/** Spend or restore one die in a specific class's pool. */
function toggleHitDie(classId: string, index: number) {
  const pools = props.character.hitDice.map((p) => {
    if (p.classId !== classId) return p
    const remaining = index <= p.remaining ? p.remaining - 1 : p.remaining + 1
    return { ...p, remaining: Math.max(0, Math.min(p.total, remaining)) }
  })
  emit('update', { hitDice: pools })
}

function className(classId: string): string {
  return rulepackStore.getClass(classId)?.name ?? classId
}

// ── Limited-use abilities ─────────────────────────────────────────────────────
const limitedFeatures = computed(() =>
  props.character.features.filter(f => f.usesMax !== undefined || f.recharge !== undefined),
)

function useCharge(id: string) {
  const updated = props.character.features.map(f => {
    if (f.id !== id || f.usesRemaining === undefined) return f
    return { ...f, usesRemaining: Math.max(0, f.usesRemaining - 1) }
  })
  emit('update', { features: updated })
}

function restoreCharge(id: string) {
  const updated = props.character.features.map(f => {
    if (f.id !== id || f.usesMax === undefined || f.usesRemaining === undefined) return f
    return { ...f, usesRemaining: Math.min(featureUsesMax(f) ?? f.usesMax, f.usesRemaining + 1) }
  })
  emit('update', { features: updated })
}

// ── Manual bonus (magic items, curses) ───────────────────────────────────────

/** Which feature's bonus editor is open, by id. */
const editingBonus = ref<string | null>(null)

function toggleBonusEditor(id: string) {
  editingBonus.value = editingBonus.value === id ? null : id
}

function adjustBonus(id: string, source: FeatureUsesBonusSource, delta: number) {
  const updated = props.character.features.map((f) => {
    if (f.id !== id) return f
    return setFeatureUsesBonus(f, source, (f.usesBonuses?.[source] ?? 0) + delta)
  })
  emit('update', { features: updated })
}

function checkDeathSave(type: 'successes' | 'failures', idx: number) {
  const current = props.character.deathSaves[type]
  const newVal = current === idx + 1 ? idx : idx + 1
  emit('update', { deathSaves: { ...props.character.deathSaves, [type]: newVal } })
}

// ── Bardic Inspiration ────────────────────────────────────────────────────────
function useBardicInspiration() {
  const bi = stats.bardicInspiration.value
  if (!bi || bi.used >= bi.max) return
  emit('update', { bardicInspirationUsed: bi.used + 1 })
}

function restoreBardicInspiration() {
  const bi = stats.bardicInspiration.value
  if (!bi || bi.used <= 0) return
  emit('update', { bardicInspirationUsed: bi.used - 1 })
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
      <div class="stat-box cursor-pointer col-span-1" @click="acModalOpen = true">
        <span class="stat-label">AC</span>
        <span class="stat-value">{{ stats.armorClass.value }}</span>
      </div>
      <div class="stat-box cursor-pointer col-span-1" @click="initiativeModalOpen = true">
        <span class="stat-label">Init</span>
        <span class="stat-value">{{ stats.initiative.value >= 0 ? '+' : '' }}{{ stats.initiative.value }}</span>
      </div>
      <div class="stat-box cursor-pointer col-span-1" @click="startSpeedEdit">
        <span class="stat-label">Walk</span>
        <template v-if="editingSpeed">
          <input v-model.number="draftSpeed" type="number" class="input text-center text-lg w-14 px-1 py-0" autofocus @blur="commitSpeedEdit" @keydown.enter="commitSpeedEdit" @click.stop />
        </template>
        <span v-else class="stat-value">{{ character.speeds.walk }}</span>
      </div>
      <div class="stat-box col-span-1">
        <span class="stat-label">Passive</span>
        <span class="stat-value">{{ stats.passivePerception.value }}</span>
      </div>
    </div>

    <!-- Only the speeds beyond walking, which the grid above already shows. A winged
         tiefling's fly speed was stored and never rendered anywhere. -->
    <div v-if="otherSpeeds.length" class="flex flex-wrap gap-2">
      <span
        v-for="speed in otherSpeeds"
        :key="speed.label"
        class="text-xs text-slate-400 bg-surface-800/60 border border-surface-700/60 rounded px-2 py-1"
      >{{ speed.label }} <span class="text-white">{{ speed.value }}</span> ft</span>
    </div>

    <!-- Hit Dice: one pool per class, since a fighter/wizard spends d10s and d6s apart -->
    <div v-if="hitDice.length > 0" class="card space-y-2">
      <p class="section-header mb-0">Hit Dice</p>
      <div v-for="pool in hitDice" :key="pool.classId">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-400">
            <span v-if="hitDice.length > 1" class="text-slate-300">{{ className(pool.classId) }}</span>
            <span :class="hitDice.length > 1 ? 'ml-1.5' : ''">{{ pool.die }}</span>
          </p>
          <span class="text-xs text-slate-500">{{ pool.remaining }}/{{ pool.total }}</span>
        </div>
        <div class="flex gap-1.5 flex-wrap mt-1">
          <div
            v-for="i in pool.total"
            :key="i"
            class="w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
            :class="i <= pool.remaining ? 'bg-primary-600/30 border-primary-500/60 text-primary-300' : 'bg-surface-700 border-surface-600 text-slate-600'"
            @click="toggleHitDie(pool.classId, i)"
          >
            {{ pool.die.replace('d', '') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bardic Inspiration -->
    <div v-if="stats.bardicInspiration.value" class="card">
      <div class="flex items-center justify-between mb-2">
        <div>
          <p class="section-header mb-0">Bardic Inspiration</p>
          <p class="text-[10px] uppercase tracking-wider mt-0.5"
            :class="stats.bardicInspiration.value.recharge === 'short' ? 'text-accent-400' : 'text-primary-400'"
          >
            {{ stats.bardicInspiration.value.recharge }} rest &middot; {{ stats.bardicInspiration.value.die }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none transition-colors"
            :disabled="stats.bardicInspiration.value.used >= stats.bardicInspiration.value.max"
            @click="useBardicInspiration"
          >−</button>
          <span class="text-sm font-mono text-white tabular-nums w-10 text-center">
            {{ stats.bardicInspiration.value.max - stats.bardicInspiration.value.used }}/{{ stats.bardicInspiration.value.max }}
          </span>
          <button
            class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none transition-colors"
            :disabled="stats.bardicInspiration.value.used <= 0"
            @click="restoreBardicInspiration"
          >+</button>
        </div>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <div
          v-for="i in stats.bardicInspiration.value.max"
          :key="i"
          class="w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
          :class="i <= (stats.bardicInspiration.value.max - stats.bardicInspiration.value.used)
            ? 'bg-accent-600/30 border-accent-500/60 text-accent-300'
            : 'bg-surface-700 border-surface-600 text-slate-600'"
          @click="i <= (stats.bardicInspiration.value.max - stats.bardicInspiration.value.used)
            ? useBardicInspiration()
            : restoreBardicInspiration()"
        >
          {{ stats.bardicInspiration.value.die }}
        </div>
      </div>
    </div>

    <!-- Limited-use abilities -->
    <div v-if="limitedFeatures.length > 0" class="card space-y-0 divide-y divide-surface-700/50">
      <p class="section-header">Abilities</p>
      <div
        v-for="feature in limitedFeatures"
        :key="feature.id"
        class="py-2 first:pt-1 last:pb-0"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white leading-tight">{{ feature.name }}</p>
            <p v-if="feature.recharge" class="text-[10px] uppercase tracking-wider mt-0.5"
              :class="{
                'text-primary-400': feature.recharge === 'long',
                'text-accent-400': feature.recharge === 'short',
                'text-success-400': feature.recharge === 'dawn',
              }"
            >
              {{ feature.recharge }} rest
            </p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <template v-if="feature.usesMax !== undefined">
              <button
                class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none transition-colors"
                :disabled="(feature.usesRemaining ?? 0) <= 0"
                @click="useCharge(feature.id)"
              >−</button>
              <button
                class="text-sm font-mono text-white tabular-nums w-14 text-center"
                :title="featureUsesBonusTotal(feature) !== 0 ? `${feature.usesMax} base, ${featureUsesBonusTotal(feature) > 0 ? '+' : ''}${featureUsesBonusTotal(feature)} bonus` : 'Add a bonus'"
                @click="toggleBonusEditor(feature.id)"
              >
                {{ feature.usesRemaining }}/{{ featureUsesMax(feature) }}
                <span v-if="featureUsesBonusTotal(feature) !== 0" class="text-accent-400 text-[10px] align-super">
                  {{ featureUsesBonusTotal(feature) > 0 ? '+' : '' }}{{ featureUsesBonusTotal(feature) }}
                </span>
              </button>
              <button
                class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none transition-colors"
                :disabled="(feature.usesRemaining ?? 0) >= (featureUsesMax(feature) ?? 0)"
                @click="restoreCharge(feature.id)"
              >+</button>
            </template>
            <span v-else class="text-lg text-slate-400">∞</span>
          </div>
        </div>
        <!-- Manual bonus: survives level-ups, so a magic item is entered once -->
        <div
          v-if="editingBonus === feature.id && feature.usesMax !== undefined"
          class="flex items-center gap-2 mt-2 pt-2 border-t border-surface-700"
        >
          <div class="w-full space-y-1.5">
            <div
              v-for="src in FEATURE_USES_BONUS_SOURCES"
              :key="src.key"
              class="flex items-center gap-2"
            >
              <span class="stat-label flex-1" :title="src.hint">{{ src.label }}</span>
              <button
                class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 flex items-center justify-center text-base leading-none"
                @click="adjustBonus(feature.id, src.key, -1)"
              >−</button>
              <span
                class="text-sm font-mono tabular-nums w-10 text-center"
                :class="(feature.usesBonuses?.[src.key] ?? 0) === 0 ? 'text-slate-500' : 'text-accent-400'"
              >
                {{ (feature.usesBonuses?.[src.key] ?? 0) > 0 ? '+' : '' }}{{ feature.usesBonuses?.[src.key] ?? 0 }}
              </span>
              <button
                class="w-7 h-7 rounded-md border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600 flex items-center justify-center text-base leading-none"
                @click="adjustBonus(feature.id, src.key, 1)"
              >+</button>
            </div>
            <p class="text-[10px] text-slate-500 pt-0.5">
              Base {{ feature.usesMax }} · total {{ featureUsesMax(feature) }}. Bonuses persist through level-ups.
            </p>
          </div>
        </div>
      </div>

    </div>

    <!-- Death saves -->
    <div v-if="character.hp.current <= 0" class="card">      <p class="section-header">Death Saves</p>
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

  <SheetArmorClassModal
    :open="acModalOpen"
    :character="character"
    @save="saveArmorClass"
    @close="acModalOpen = false"
  />

  <SheetInitiativeModal
    :open="initiativeModalOpen"
    :character="character"
    @save="saveInitiative"
    @close="initiativeModalOpen = false"
  />

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
