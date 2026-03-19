<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import type { AbilityKey } from '~/types/character'

const props = defineProps<{ spellId: string }>()

const rulepackStore = useRulepacksStore()

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

const badge = computed(() => {
  const spell = rulepackStore.getSpell(props.spellId)
  if (!spell) return null
  if (spell.attackRoll) {
    return { label: spell.attackRoll === 'melee' ? 'Melee' : 'Ranged', kind: 'attack' }
  }
  if (spell.savingThrow) {
    return { label: `${ABILITY_LABELS[spell.savingThrow]} Save`, kind: 'save' }
  }
  return null
})
</script>

<template>
  <span
    v-if="badge"
    class="text-[10px] font-medium rounded px-1.5 py-0.5 flex-shrink-0"
    :class="badge.kind === 'attack'
      ? 'bg-orange-700/30 border border-orange-600/40 text-orange-300'
      : 'bg-blue-700/30 border border-blue-600/40 text-blue-300'"
  >{{ badge.label }}</span>
</template>
