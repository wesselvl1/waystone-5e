<script setup lang="ts">
/**
 * The editor behind every attack on the sheet — new ones and, which was the gap, ones
 * already there. An attack used to be write-once: a mistyped die or a newly-found +1
 * meant deleting the row and retyping it.
 *
 * It opens on the weapon list rather than an empty form, because most attacks are a
 * weapon out of the book. Picking one fills the dice, type, properties and range, and
 * guesses the ability and proficiency from the weapon and the character — every one of
 * which the player can then override, since the guess is right until the table says
 * otherwise.
 */
import type { AbilityKey, AttackEntry, AttackAbility, Character } from '~/types/character'
import type { WeaponDefinition } from '~/types/rulepack'
import { useRulepacksStore } from '~/stores/rulepacks'
import { useCharacterStats } from '~/composables/useCharacterStats'
import {
  ATTACK_BONUS_KINDS,
  ATTACK_BONUS_LABELS,
  attackBonus,
  attackFromWeapon,
  compactBonusSet,
  formatDamage,
  formatSigned,
  isProficientWithWeapon,
} from '~/services/attacks'

const props = defineProps<{
  /** Whether the modal is on screen; the parent owns this. */
  open: boolean
  /** The attack being edited, or null to build a new one. */
  attack: AttackEntry | null
  character: Character
}>()

const emit = defineEmits<{
  save: [AttackEntry]
  remove: [string]
  close: []
}>()

const rulepackStore = useRulepacksStore()
const characterRef = computed(() => props.character)
const stats = useCharacterStats(characterRef)

const ABILITY_OPTIONS: { value: AttackAbility; label: string }[] = [
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'con', label: 'Constitution' },
  { value: 'int', label: 'Intelligence' },
  { value: 'wis', label: 'Wisdom' },
  { value: 'cha', label: 'Charisma' },
  { value: 'none', label: 'None (flat)' },
]

/** A blank attack: a custom one-off, until a weapon is picked. */
function blankDraft(): AttackEntry {
  return {
    id: '',
    name: '',
    bonus: null,
    ability: 'str',
    proficient: true,
    attackBonuses: {},
    damageAbility: 'str',
    damageBonuses: {},
    damageDice: '1d6',
    damageType: 'slashing',
    notes: '',
  }
}

const draft = ref<AttackEntry>(blankDraft())
/** The weapon list is the landing screen for a new attack, skipped when editing one. */
const picking = ref(false)
const query = ref('')
const confirmingDelete = ref(false)
/** Shown once the player unfolds it — an override most sheets never need. */
const showOverride = ref(false)

const isNew = computed(() => props.attack === null)

watch(() => props.open, (open) => {
  if (!open) return
  query.value = ''
  confirmingDelete.value = false
  picking.value = props.attack === null
  showOverride.value = props.attack?.bonus !== null && props.attack?.bonus !== undefined
  draft.value = props.attack
    // Bonus sets are filled in so the number inputs have somewhere to write; they are
    // compacted away again on save.
    ? {
        ...props.attack,
        attackBonuses: { ...props.attack.attackBonuses },
        damageBonuses: { ...props.attack.damageBonuses },
      }
    : blankDraft()
}, { immediate: true })

const weapons = computed(() => rulepackStore.getAllWeapons())

const filteredWeapons = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q
    ? weapons.value.filter(w =>
        w.name.toLowerCase().includes(q)
        || w.damageType.toLowerCase().includes(q)
        || (w.properties ?? []).some(p => p.includes(q)))
    : weapons.value
  return list
})

/** Grouped the way the equipment table prints them, so a picker scans like the book. */
const weaponGroups = computed(() => {
  const groups: { key: string; label: string; weapons: Array<WeaponDefinition & { sourceName: string }> }[] = [
    { key: 'simple-melee', label: 'Simple Melee', weapons: [] },
    { key: 'simple-ranged', label: 'Simple Ranged', weapons: [] },
    { key: 'martial-melee', label: 'Martial Melee', weapons: [] },
    { key: 'martial-ranged', label: 'Martial Ranged', weapons: [] },
  ]
  for (const weapon of filteredWeapons.value) {
    groups.find(g => g.key === `${weapon.category}-${weapon.rangeType}`)?.weapons.push(weapon)
  }
  return groups.filter(g => g.weapons.length > 0)
})

const proficiencies = computed(() => props.character.otherProficiencies ?? [])

function chooseWeapon(weapon: WeaponDefinition) {
  const built = attackFromWeapon(weapon, props.character, stats.abilityModifiers.value)
  draft.value = {
    ...draft.value,
    ...built,
    attackBonuses: { ...draft.value.attackBonuses },
    damageBonuses: { ...draft.value.damageBonuses },
    notes: draft.value.notes,
  }
  picking.value = false
}

/** Start from nothing — a breath weapon, an improvised chandelier. */
function chooseCustom() {
  draft.value = { ...blankDraft(), id: draft.value.id, notes: draft.value.notes }
  picking.value = false
}

/** The weapon a versatile attack was built from, so its two-handed dice can be offered. */
const sourceWeapon = computed(() =>
  draft.value.weaponId ? rulepackStore.getWeapon(draft.value.weaponId) : undefined)

const versatileDice = computed(() => {
  const weapon = sourceWeapon.value
  if (!weapon?.versatileDamage) return null
  return draft.value.damageDice === weapon.versatileDamage
    ? { label: `One-handed (${weapon.damageDice})`, dice: weapon.damageDice }
    : { label: `Two-handed (${weapon.versatileDamage})`, dice: weapon.versatileDamage }
})

/** Live preview, computed from the draft exactly as the sheet will compute the saved row. */
const previewContext = computed(() => ({
  modifiers: stats.abilityModifiers.value,
  proficiencyBonus: stats.profBonus.value,
}))

const previewToHit = computed(() => formatSigned(attackBonus(draft.value, previewContext.value)))
const previewDamage = computed(() => formatDamage(draft.value, previewContext.value))

const canSave = computed(() => draft.value.name.trim().length > 0)

function save() {
  if (!canSave.value) return
  const entry: AttackEntry = {
    ...draft.value,
    id: draft.value.id || crypto.randomUUID(),
    name: draft.value.name.trim(),
    damageDice: draft.value.damageDice.trim(),
    damageType: draft.value.damageType.trim(),
    attackBonuses: compactBonusSet(draft.value.attackBonuses),
    damageBonuses: compactBonusSet(draft.value.damageBonuses),
    bonus: showOverride.value ? draft.value.bonus : null,
    notes: draft.value.notes?.trim() || undefined,
  }
  emit('save', entry)
}

function requestRemove() {
  if (!props.attack) return
  confirmingDelete.value = true
}

function confirmRemove() {
  confirmingDelete.value = false
  if (props.attack) emit('remove', props.attack.id)
}

/**
 * Escape closes the editor, as it does the spell detail modal — unless the delete
 * confirmation is up, which owns the key while it is.
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && !confirmingDelete.value) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

/** Shown under the ability select, so the player can see what they are choosing between. */
function abilityHint(ability: AttackAbility): string {
  if (ability === 'none') return ''
  return formatSigned(stats.abilityModifiers.value[ability as AbilityKey])
}
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
                {{ picking ? 'Choose a weapon' : isNew ? 'New attack' : 'Edit attack' }}
              </p>
              <p v-if="!picking" class="text-xs text-slate-400 mt-0.5">
                <span class="font-mono text-primary-300">{{ previewToHit }}</span>
                to hit ·
                <span class="text-slate-300">{{ previewDamage }}</span>&nbsp;<span
                  v-if="draft.damageType"
                  class="capitalize"
                >{{ draft.damageType }}</span>
              </p>
            </div>
            <button
              class="btn-ghost p-1.5 flex-shrink-0 -mt-1 -mr-1"
              title="Close"
              @click="emit('close')"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Weapon picker -->
          <div v-if="picking" class="overflow-y-auto p-4 space-y-3">
            <SearchBox
              v-model="query"
              placeholder="Search weapons…"
              :matches="filteredWeapons.length"
              :total="weapons.length"
            />

            <button class="btn-ghost w-full justify-start text-sm border border-surface-600" @click="chooseCustom">
              Custom attack — enter everything by hand
            </button>

            <p v-if="weapons.length === 0" class="text-sm text-slate-400">
              No loaded rulepack lists any weapons. Import one, or build the attack by hand.
            </p>

            <div v-for="group in weaponGroups" :key="group.key" class="space-y-1">
              <p class="section-header mb-1">{{ group.label }}</p>
              <button
                v-for="weapon in group.weapons"
                :key="`${weapon.sourceName}-${weapon.id}`"
                class="w-full text-left rounded-lg px-3 py-2 bg-surface-700/40 hover:bg-surface-700
                  border border-surface-700 transition-colors"
                @click="chooseWeapon(weapon)"
              >
                <div class="flex items-baseline gap-2">
                  <span class="text-sm font-medium text-white flex-1 min-w-0 truncate">{{ weapon.name }}</span>
                  <span class="text-xs font-mono text-slate-300">{{ weapon.damageDice || '—' }}</span>
                  <span class="text-[10px] text-slate-500 capitalize">{{ weapon.damageType }}</span>
                </div>
                <p class="text-[10px] text-slate-500 mt-0.5 truncate">
                  <span v-if="!isProficientWithWeapon(weapon, proficiencies)" class="text-amber-400/80">
                    Not proficient ·
                  </span>
                  <span class="capitalize">{{ (weapon.properties ?? []).join(', ') || 'no properties' }}</span>
                  <span v-if="weapon.range"> · {{ weapon.range }} ft.</span>
                  <span v-if="weapons.some(w => w.id === weapon.id && w.sourceName !== weapon.sourceName)">
                    · {{ weapon.sourceName }}
                  </span>
                </p>
              </button>
            </div>
          </div>

          <!-- Editor -->
          <div v-else class="overflow-y-auto p-4 space-y-4">
            <div>
              <label class="label">Name</label>
              <div class="flex gap-2">
                <input v-model="draft.name" class="input" placeholder="Attack name" />
                <button class="btn-ghost text-xs whitespace-nowrap border border-surface-600" @click="picking = true">
                  Weapons
                </button>
              </div>
              <!-- Only the property tags are capitalised: "150/600 ft." is not a title. -->
              <p v-if="draft.properties?.length || draft.range" class="text-[10px] text-slate-500 mt-1">
                <span class="capitalize">{{ draft.properties?.join(', ') }}</span>
                <span v-if="draft.properties?.length && draft.range"> · </span>
                <span v-if="draft.range">{{ draft.range }} ft.</span>
              </p>
            </div>

            <!-- To hit -->
            <div class="space-y-2">
              <p class="section-header mb-0">Attack roll</p>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="label">Ability</label>
                  <select v-model="draft.ability" class="input">
                    <option v-for="opt in ABILITY_OPTIONS" :key="opt.value" :value="opt.value">
                      {{ opt.label }} {{ abilityHint(opt.value) }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="label">Proficiency</label>
                  <button
                    class="input flex items-center gap-2 text-left"
                    :class="draft.proficient ? 'text-white' : 'text-slate-400'"
                    @click="draft.proficient = !draft.proficient"
                  >
                    <span class="proficiency-dot" :class="{ active: draft.proficient }" />
                    <span>{{ draft.proficient ? `Proficient (${formatSigned(stats.profBonus.value)})` : 'Not proficient' }}</span>
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="kind in ATTACK_BONUS_KINDS" :key="`hit-${kind}`">
                  <label class="label">{{ ATTACK_BONUS_LABELS[kind] }}</label>
                  <input
                    v-model.number="draft.attackBonuses![kind]"
                    type="number"
                    class="input"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <!-- Damage -->
            <div class="space-y-2">
              <p class="section-header mb-0">Damage</p>
              <!-- The ability select drops to its own row on a phone: "Strength +3" does
                   not fit a third of 375px, and a truncated modifier is worse than a wrap. -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label class="label">Dice</label>
                  <input v-model="draft.damageDice" class="input" placeholder="1d8" />
                </div>
                <div>
                  <label class="label">Type</label>
                  <input v-model="draft.damageType" class="input" placeholder="slashing" />
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <label class="label">Ability</label>
                  <select v-model="draft.damageAbility" class="input">
                    <option v-for="opt in ABILITY_OPTIONS" :key="`dmg-${opt.value}`" :value="opt.value">
                      {{ opt.label }} {{ abilityHint(opt.value) }}
                    </option>
                  </select>
                </div>
              </div>
              <button
                v-if="versatileDice"
                class="btn-ghost text-xs w-full border border-surface-600"
                @click="draft.damageDice = versatileDice.dice"
              >
                Use {{ versatileDice.label }}
              </button>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="kind in ATTACK_BONUS_KINDS" :key="`dmg-${kind}`">
                  <label class="label">{{ ATTACK_BONUS_LABELS[kind] }}</label>
                  <input
                    v-model.number="draft.damageBonuses![kind]"
                    type="number"
                    class="input"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="label">Notes</label>
              <input v-model="draft.notes" class="input" placeholder="optional" />
            </div>

            <!-- The escape hatch, folded away: a total that ignores everything above. -->
            <div>
              <button
                class="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                @click="showOverride = !showOverride"
              >
                {{ showOverride ? 'Use the calculated attack bonus' : 'Override the attack bonus' }}
              </button>
              <div v-if="showOverride" class="mt-2">
                <input
                  v-model.number="draft.bonus"
                  type="number"
                  class="input"
                  placeholder="e.g. 7"
                />
                <p class="text-[10px] text-slate-500 mt-1">
                  Replaces the ability, proficiency and bonuses above for the attack roll.
                  Damage still uses the fields above.
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="!picking" class="flex items-center gap-2 p-4 pt-3 border-t border-surface-700/60">
            <button v-if="!isNew" class="btn-danger text-xs" @click="requestRemove">Delete</button>
            <div class="flex-1" />
            <button class="btn-ghost text-xs" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-xs" :disabled="!canSave" @click="save">
              {{ isNew ? 'Add attack' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog
    :open="confirmingDelete"
    title="Delete this attack?"
    :message="`${attack?.name ?? 'This attack'} will be removed from the sheet.`"
    confirm-label="Delete"
    danger
    @confirm="confirmRemove"
    @cancel="confirmingDelete = false"
  />
</template>
