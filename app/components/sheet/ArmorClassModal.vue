<script setup lang="ts">
/**
 * The armour class calculator.
 *
 * AC used to be a number box: whatever the player typed, with no record of how they got
 * there, so a new breastplate or a raised Dexterity meant working it out on paper again.
 * Here the parts are picked and the number follows — and because the parts are stored,
 * the sheet re-derives it when an ability score moves.
 *
 * The armour list is one dropdown covering armour and the features that stand in for it,
 * since a barbarian choosing between Unarmored Defense and a breastplate is making one
 * choice, not two. Each row carries the AC it would produce for this character, which is
 * the question actually being asked.
 */
import type { AbilityKey, ArmorClassConfig, Character } from '~/types/character'
import type { ArmorCategory, ArmorDefinition } from '~/types/rulepack'
import { useRulepacksStore } from '~/stores/rulepacks'
import { useCharacterStats } from '~/composables/useCharacterStats'
import {
  AC_BONUS_KINDS,
  AC_BONUS_LABELS,
  armorClassBreakdown,
  armorWarnings,
  compactAcBonuses,
  configFromArmor,
  defaultArmorClassConfig,
  formatSigned,
  isProficientWithArmor,
  previewArmorClass,
  shieldAllowed,
} from '~/services/armorClass'

const props = defineProps<{
  open: boolean
  character: Character
}>()

const emit = defineEmits<{
  save: [Pick<Character, 'armorClass' | 'armorClassConfig'>]
  close: []
}>()

const rulepackStore = useRulepacksStore()
const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const draft = ref<ArmorClassConfig>(defaultArmorClassConfig())
/** The armour list is a screen of its own, the way the weapon picker is. */
const picking = ref(false)
const query = ref('')
/** Shown once unfolded — a hand-entered total that ignores everything else. */
const showOverride = ref(false)
const overrideValue = ref(10)

watch(() => props.open, (open) => {
  if (!open) return
  query.value = ''
  picking.value = false
  const stored = props.character.armorClassConfig
  draft.value = stored
    // The bonus map is filled in so the number inputs have somewhere to write; it is
    // compacted away again on save.
    ? { ...stored, shield: stored.shield ? { ...stored.shield } : undefined, bonuses: { ...stored.bonuses } }
    : { ...defaultArmorClassConfig(), bonuses: {} }
  showOverride.value = props.character.armorClass !== null && props.character.armorClass !== undefined
  overrideValue.value = props.character.armorClass ?? stats.armorClass.value
}, { immediate: true })

const ctx = computed(() => ({ modifiers: stats.abilityModifiers.value }))

const allArmor = computed(() => rulepackStore.getAllArmor())
const shieldOptions = computed(() => allArmor.value.filter(a => a.category === 'shield'))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const wearable = allArmor.value.filter(a => a.category !== 'shield')
  if (!q) return wearable
  return wearable.filter(a =>
    a.name.toLowerCase().includes(q)
    || a.category.includes(q)
    || (a.description ?? '').toLowerCase().includes(q))
})

/**
 * Grouped the way the equipment table prints them, with the features that replace armour
 * gathered under Misc — Unarmored Defense is not light armour, but it belongs in the same
 * list as the thing it is chosen instead of.
 */
const GROUP_LABELS: { key: ArmorCategory; label: string }[] = [
  { key: 'light', label: 'Light Armor' },
  { key: 'medium', label: 'Medium Armor' },
  { key: 'heavy', label: 'Heavy Armor' },
  { key: 'unarmored', label: 'Misc' },
]

const armorGroups = computed(() =>
  GROUP_LABELS
    .map(g => ({ ...g, armor: filtered.value.filter(a => a.category === g.key) }))
    .filter(g => g.armor.length > 0))

const proficiencies = computed(() => props.character.otherProficiencies ?? [])

/** The AC each row would produce, keeping the shield and bonuses already configured. */
function rowArmorClass(armor: ArmorDefinition): number {
  return previewArmorClass(armor, draft.value, ctx.value)
}

/** The classes this character actually has, so a row can be marked as fitting the build. */
const classIds = computed(() => new Set(props.character.classes.map(c => c.classId)))

function chooseArmor(armor: ArmorDefinition) {
  draft.value = configFromArmor(armor, draft.value)
  draft.value.bonuses = { ...draft.value.bonuses }
  picking.value = false
}

/** The entry the draft was built from, for the Stealth and Strength notes. */
const currentArmor = computed(() => rulepackStore.getArmor(draft.value.armorId))

const wearingWarnings = computed(() =>
  currentArmor.value ? armorWarnings(currentArmor.value, stats.scores.value) : [])

const notProficient = computed(() =>
  !!currentArmor.value && !isProficientWithArmor(currentArmor.value, proficiencies.value))

// ── Shield ────────────────────────────────────────────────────────────────────
const canUseShield = computed(() => shieldAllowed(draft.value))

function toggleShield() {
  const existing = draft.value.shield
  if (existing) {
    draft.value.shield = { ...existing, equipped: !existing.equipped }
    return
  }
  const definition = shieldOptions.value[0]
  draft.value.shield = {
    equipped: true,
    armorId: definition?.id,
    name: definition?.name ?? 'Shield',
    bonus: definition?.baseAC ?? 2,
  }
}

// ── Dexterity cap ─────────────────────────────────────────────────────────────
/** Empty means uncapped, which is not the same as a cap of 0 — heavy armour allows none. */
const dexCapInput = computed({
  get: () => (draft.value.dexCap === null ? '' : String(draft.value.dexCap)),
  set: (value: string) => {
    const trimmed = value.trim()
    draft.value.dexCap = trimmed === '' ? null : Math.max(0, Number.parseInt(trimmed, 10) || 0)
  },
})

const EXTRA_ABILITY_OPTIONS: { value: AbilityKey | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'con', label: 'Constitution' },
  { value: 'int', label: 'Intelligence' },
  { value: 'wis', label: 'Wisdom' },
  { value: 'cha', label: 'Charisma' },
]

const extraAbilityInput = computed({
  get: () => draft.value.extraAbility ?? '',
  set: (value: AbilityKey | '') => {
    draft.value.extraAbility = value === '' ? undefined : value
  },
})

// ── Result ────────────────────────────────────────────────────────────────────
const breakdown = computed(() => armorClassBreakdown(draft.value, ctx.value))

const effectiveTotal = computed(() =>
  showOverride.value ? (overrideValue.value || 0) : breakdown.value.total)

function save() {
  emit('save', {
    armorClass: showOverride.value ? (overrideValue.value || 0) : null,
    armorClassConfig: {
      ...draft.value,
      bonuses: compactAcBonuses(draft.value.bonuses),
      shield: draft.value.shield?.equipped || draft.value.shield?.bonus
        ? draft.value.shield
        : undefined,
    },
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:max-w-lg
            rounded-t-2xl sm:rounded-xl shadow-xl max-h-[88vh] flex flex-col"
        >
          <!-- Header -->
          <div class="flex items-start gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-white leading-tight">
                {{ picking ? 'Choose armor' : 'Armor Class' }}
              </p>
              <p class="text-xs text-slate-400 mt-0.5 truncate">
                <span class="font-mono text-primary-300 text-sm">{{ effectiveTotal }}</span>
                · {{ draft.armorName }}
                <span v-if="draft.shield?.equipped && canUseShield"> + shield</span>
              </p>
            </div>
            <button class="btn-ghost p-1.5 flex-shrink-0 -mt-1 -mr-1" title="Close" @click="emit('close')">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Armor picker -->
          <div v-if="picking" class="overflow-y-auto p-4 space-y-3">
            <SearchBox
              v-model="query"
              placeholder="Search armor…"
              :matches="filtered.length"
              :total="allArmor.filter(a => a.category !== 'shield').length"
            />

            <p v-if="allArmor.length === 0" class="text-sm text-slate-400">
              No loaded rulepack lists any armor. Set the base and Dexterity cap by hand instead.
            </p>

            <div v-for="group in armorGroups" :key="group.key" class="space-y-1">
              <p class="section-header mb-1">{{ group.label }}</p>
              <button
                v-for="armor in group.armor"
                :key="`${armor.sourceName}-${armor.id}`"
                class="w-full text-left rounded-lg px-3 py-2 border transition-colors"
                :class="armor.id === draft.armorId
                  ? 'bg-primary-600/20 border-primary-500/60'
                  : 'bg-surface-700/40 hover:bg-surface-700 border-surface-700'"
                @click="chooseArmor(armor)"
              >
                <div class="flex items-baseline gap-2">
                  <span class="text-sm font-medium text-white flex-1 min-w-0 truncate">{{ armor.name }}</span>
                  <span class="text-xs text-slate-500">
                    {{ armor.baseAC }}<span v-if="armor.maxDexBonus !== 0"> + Dex</span>
                    <span v-if="armor.maxDexBonus"> (max {{ armor.maxDexBonus }})</span>
                    <span v-if="armor.extraAbility"> + {{ armor.extraAbility.toUpperCase() }}</span>
                  </span>
                  <span class="text-sm font-mono text-primary-300 tabular-nums">AC {{ rowArmorClass(armor) }}</span>
                </div>
                <p class="text-[10px] text-slate-500 mt-0.5 truncate">
                  <span v-if="armor.classId && classIds.has(armor.classId)" class="text-success-400">Your class · </span>
                  <span v-if="!isProficientWithArmor(armor, proficiencies)" class="text-amber-400/80">Not proficient · </span>
                  <span v-if="armor.shieldAllowed === false" class="text-amber-400/80">No shield · </span>
                  <span v-if="armor.stealthDisadvantage">Stealth disadv. · </span>
                  <span v-if="armor.strengthRequirement">Str {{ armor.strengthRequirement }} · </span>
                  <span v-if="armor.cost">{{ armor.cost }}</span>
                  <span v-else-if="armor.description">{{ armor.description }}</span>
                </p>
              </button>
            </div>
          </div>

          <!-- Editor -->
          <div v-else class="overflow-y-auto p-4 space-y-4">
            <!-- Armor -->
            <div>
              <label class="label">Armor</label>
              <button
                class="input flex items-center gap-2 text-left w-full"
                @click="picking = true"
              >
                <span class="flex-1 min-w-0 truncate text-white">{{ draft.armorName }}</span>
                <span class="text-xs text-slate-400">Change</span>
              </button>
              <p v-if="notProficient || wearingWarnings.length" class="text-[10px] mt-1 space-x-1">
                <span v-if="notProficient" class="text-amber-400/80">Not proficient with this armor.</span>
                <span v-for="warning in wearingWarnings" :key="warning" class="text-slate-500">{{ warning }}</span>
              </p>
            </div>

            <!-- The parts of the sum, editable: a natural armor's base and cap vary by
                 race, and a Medium Armor Master raises the cap the armor prints. -->
            <!-- The ability select drops to its own row on a phone, as the attack editor's
                 does: "Constitution" does not fit a third of 375px. -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label class="label">Base</label>
                <input v-model.number="draft.baseValue" type="number" class="input" />
              </div>
              <div>
                <label class="label">Max Dex</label>
                <input v-model="dexCapInput" type="number" min="0" class="input" placeholder="Any" />
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="label">Plus ability</label>
                <select v-model="extraAbilityInput" class="input">
                  <option v-for="opt in EXTRA_ABILITY_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Shield -->
            <div>
              <label class="label">Shield</label>
              <div class="flex gap-2">
                <button
                  class="input flex items-center gap-2 text-left flex-1"
                  :class="draft.shield?.equipped && canUseShield ? 'text-white' : 'text-slate-400'"
                  :disabled="!canUseShield"
                  @click="toggleShield"
                >
                  <span class="proficiency-dot" :class="{ active: draft.shield?.equipped && canUseShield }" />
                  <span class="truncate">
                    {{ draft.shield?.equipped ? (draft.shield.name || 'Shield') : 'No shield' }}
                  </span>
                </button>
                <input
                  v-if="draft.shield?.equipped"
                  v-model.number="draft.shield.bonus"
                  type="number"
                  class="input w-20"
                  :disabled="!canUseShield"
                />
              </div>
              <p v-if="!canUseShield" class="text-[10px] text-amber-400/80 mt-1">
                {{ draft.armorName }} applies only while you wield no shield.
              </p>
              <p v-else-if="draft.shield?.equipped" class="text-[10px] text-slate-500 mt-1">
                The whole of what the shield is worth, enchantment included — a +1 shield is 3.
              </p>
            </div>

            <!-- Bonuses: the same three slots an attack keeps apart, for the same reason -->
            <div class="space-y-2">
              <p class="section-header mb-0">Bonuses</p>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="kind in AC_BONUS_KINDS" :key="kind">
                  <label class="label" :title="AC_BONUS_LABELS[kind].hint">{{ AC_BONUS_LABELS[kind].label }}</label>
                  <input
                    v-model.number="draft.bonuses![kind]"
                    type="number"
                    class="input"
                    placeholder="0"
                  />
                </div>
              </div>
              <p class="text-[10px] text-slate-500">
                What you wear and carry, not what you cast: leave Shield, Blade Song and
                other spells and stances off — they last a minute, and this is the number
                on the sheet.
              </p>
            </div>

            <!-- The sum, shown working -->
            <div class="card space-y-1" :class="{ 'opacity-50': showOverride }">
              <div
                v-for="(part, i) in breakdown.parts"
                :key="`${part.label}-${i}`"
                class="flex items-baseline gap-2 text-xs"
              >
                <span class="text-slate-400 flex-1 min-w-0 truncate">
                  {{ part.label }}
                  <span v-if="part.note" class="text-slate-600">({{ part.note }})</span>
                </span>
                <span class="font-mono tabular-nums" :class="part.value < 0 ? 'text-danger-400' : 'text-slate-200'">
                  {{ i === 0 ? part.value : formatSigned(part.value) }}
                </span>
              </div>
              <div class="flex items-baseline gap-2 pt-1 border-t border-surface-700 text-sm">
                <span class="text-slate-300 flex-1 font-medium">Armor Class</span>
                <span class="font-mono tabular-nums font-bold text-primary-300">{{ breakdown.total }}</span>
              </div>
              <p v-for="warning in breakdown.warnings" :key="warning" class="text-[10px] text-amber-400/80 pt-1">
                {{ warning }}
              </p>
            </div>

            <!-- The escape hatch, folded away: a total that ignores everything above. -->
            <div>
              <button
                class="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                @click="showOverride = !showOverride"
              >
                {{ showOverride ? 'Use the calculated armor class' : 'Override the armor class' }}
              </button>
              <div v-if="showOverride" class="mt-2">
                <input v-model.number="overrideValue" type="number" class="input" placeholder="e.g. 17" />
                <p class="text-[10px] text-slate-500 mt-1">
                  Replaces everything above. The setup is kept, so you can switch back.
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="!picking" class="flex items-center gap-2 p-4 pt-3 border-t border-surface-700/60">
            <div class="flex-1" />
            <button class="btn-ghost text-xs" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-xs" @click="save">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
