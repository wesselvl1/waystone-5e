<script setup lang="ts">
/**
 * A class's "Starting Equipment" bullets, one card each, with the background's lines
 * beneath. The creation wizard owns the answer and decides whether it is complete — call
 * `isSelectionComplete` there, since a stale pick from another class has to fail the
 * same test.
 */
import { useRulepacksStore } from '~/stores/rulepacks'
import { cleanEquipmentName } from '~/services/equipment'
import {
  availableOptions,
  weaponsForChoice,
  type EquipmentSelection,
} from '~/services/startingEquipment'
import type { StartingEquipmentChoice, StartingItem, WeaponDefinition } from '~/types/rulepack'

const props = defineProps<{
  choices: StartingEquipmentChoice[]
  /**
   * Every 1st-level grant — class, subclass, race, subrace and background — which decide
   * what an "(if proficient)" option offers.
   */
  proficiencies: string[]
  backgroundName?: string
  backgroundEquipment: string[]
  modelValue: EquipmentSelection
}>()

const emit = defineEmits<{ 'update:modelValue': [EquipmentSelection] }>()

const rulepackStore = useRulepacksStore()
const allWeapons = computed(() => rulepackStore.getAllWeapons())

/** Per bullet, the options the player may take — a Life cleric's chain mail among them. */
const offered = computed(() =>
  props.choices.map(choice => availableOptions(choice, props.proficiencies, rulepackStore)))

/** Two books printing a longsword are told apart by source, as every other picker does. */
const sharedNames = computed(() => {
  const seen = new Map<string, number>()
  for (const w of allWeapons.value) seen.set(w.name, (seen.get(w.name) ?? 0) + 1)
  return seen
})
function weaponLabel(weapon: WeaponDefinition & { sourceName?: string }) {
  return (sharedNames.value.get(weapon.name) ?? 0) > 1 && weapon.sourceName
    ? `${weapon.name} (${weapon.sourceName})`
    : weapon.name
}

/** "Any martial melee weapon" — the wording the bullet itself would use. */
function weaponChoiceLabel(item: Extract<StartingItem, { kind: 'weaponChoice' }>) {
  return ['Any', item.category, item.rangeType, 'weapon'].filter(Boolean).join(' ')
}

function chosenItems(index: number) {
  const pick = props.modelValue[index]
  return pick ? props.choices[index]?.options[pick.option]?.items ?? [] : []
}

// Another option's weapon or item would not answer this one's slots.
function chooseOption(index: number, option: number) {
  const next = [...props.modelValue]
  next[index] = { option, picks: {} }
  emit('update:modelValue', next)
}

function setPick(index: number, itemIndex: number, value: string) {
  const pick = props.modelValue[index]
  if (!pick) return
  const next = [...props.modelValue]
  next[index] = { ...pick, picks: { ...pick.picks, [itemIndex]: value } }
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="choices.length === 0" class="card text-sm text-slate-400">
      This class lists no starting equipment.
    </p>

    <div v-for="(choice, ci) in choices" :key="ci" class="card space-y-2">
      <p class="section-header">{{ choice.options.length > 1 ? 'Choose one' : 'You get' }}</p>
      <!-- Every option "(if proficient)" and none of them yours: the bullet is skipped. -->
      <p v-if="offered[ci]?.length === 0" class="text-sm text-slate-400">
        None available — you aren't proficient with these.
      </p>
      <template v-else-if="choice.options.length > 1">
        <label
          v-for="oi in offered[ci]"
          :key="oi"
          class="flex items-start gap-3 rounded-lg px-2 py-2 -mx-2 cursor-pointer transition-colors hover:bg-surface-800/60"
        >
          <input
            type="radio"
            :name="`starting-equipment-${ci}`"
            class="mt-0.5 w-4 h-4 shrink-0 accent-primary-500"
            :checked="modelValue[ci]?.option === oi"
            @change="chooseOption(ci, oi)"
          />
          <span class="text-sm text-slate-300 first-letter:uppercase">{{ choice.options[oi]?.label }}</span>
        </label>
      </template>
      <p v-else class="text-sm text-slate-300 first-letter:uppercase">{{ choice.options[0]?.label }}</p>

      <!-- The slots of the option taken: "a martial weapon", "a holy symbol". -->
      <template v-for="(item, ii) in offered[ci]?.length ? chosenItems(ci) : []" :key="`${ci}-${ii}`">
        <select
          v-if="item.kind === 'weaponChoice'"
          class="input w-full"
          :aria-label="weaponChoiceLabel(item)"
          :value="modelValue[ci]?.picks[ii] ?? ''"
          @change="setPick(ci, ii, ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>{{ weaponChoiceLabel(item) }}…</option>
          <option v-for="(weapon, wi) in weaponsForChoice(item, allWeapons)" :key="wi" :value="weapon.id">
            {{ weaponLabel(weapon) }}
          </option>
        </select>
        <template v-else-if="item.kind === 'itemChoice'">
          <select
            v-if="item.options?.length"
            class="input w-full"
            :aria-label="item.label"
            :value="modelValue[ci]?.picks[ii] ?? ''"
            @change="setPick(ci, ii, ($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>{{ item.label }}…</option>
            <option v-for="name in item.options" :key="name" :value="name">{{ name }}</option>
          </select>
          <input
            v-else
            class="input w-full"
            :aria-label="item.label"
            :placeholder="item.label"
            :value="modelValue[ci]?.picks[ii] ?? ''"
            @input="setPick(ci, ii, ($event.target as HTMLInputElement).value)"
          />
        </template>
      </template>
    </div>

    <div v-if="backgroundEquipment.length" class="card">
      <p class="section-header">From your background{{ backgroundName ? ` (${backgroundName})` : '' }}</p>
      <ul class="text-sm text-slate-300 space-y-0.5 list-disc list-inside">
        <li v-for="(line, li) in backgroundEquipment" :key="li">{{ cleanEquipmentName(line) }}</li>
      </ul>
    </div>
  </div>
</template>
