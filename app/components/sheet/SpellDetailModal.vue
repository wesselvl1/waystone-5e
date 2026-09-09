<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import type { AbilityKey, SpellEntry } from '~/types/character'

const props = defineProps<{
  /** The spell to describe, or null when the modal is closed. */
  spellId: string | null
  /**
   * The character's own entry for it, when opened from their list. Carries what the
   * rulepack cannot know: a race grant's free casts and the level it is cast at.
   */
  entry?: SpellEntry | null
}>()
const emit = defineEmits<{ close: [] }>()

const rulepackStore = useRulepacksStore()

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

const spell = computed(() =>
  props.spellId ? rulepackStore.getSpell(props.spellId) : undefined)

const subtitle = computed(() =>
  spell.value ? spellSubtitle(spell.value.level, spell.value.school) : '')

const blocks = computed(() =>
  descriptionBlocks(spell.value?.description ?? ''))

/** Class lists are stored as ids; show the loaded pack's names where it has them. */
const classNames = computed(() =>
  (spell.value?.classes ?? []).map(id => rulepackStore.getClass(id)?.name ?? id))

const properties = computed(() => {
  if (!spell.value) return []
  return [
    { label: 'Casting Time', value: spell.value.castingTime },
    { label: 'Range', value: spell.value.range },
    { label: 'Components', value: spell.value.components },
    { label: 'Duration', value: spell.value.duration },
  ]
})

/** Escape closes it, matching the other modals on the sheet. */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.spellId) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="spellId"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:max-w-lg
            rounded-t-2xl sm:rounded-xl shadow-xl max-h-[85vh] flex flex-col"
        >
          <!-- Header stays put while the description scrolls -->
          <div class="flex items-start gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-white leading-tight">
                {{ spell?.name ?? entry?.name ?? spellId }}
              </p>
              <p v-if="spell" class="text-xs text-slate-400 italic mt-0.5">{{ subtitle }}</p>
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

          <div class="overflow-y-auto p-4 space-y-3">
            <!-- A character keeps the spell's name even with no pack loaded for it -->
            <p v-if="!spell" class="text-sm text-slate-400">
              No loaded rulepack describes this spell. Import the pack it came from to see
              its casting time, range and description.
            </p>

            <template v-else>
              <div v-if="spell.concentration || spell.ritual" class="flex gap-1.5 flex-wrap">
                <span
                  v-if="spell.concentration"
                  class="text-[10px] font-medium rounded px-1.5 py-0.5 bg-accent-500/20 border border-accent-500/40 text-accent-400"
                >Concentration</span>
                <span
                  v-if="spell.ritual"
                  class="text-[10px] font-medium rounded px-1.5 py-0.5 bg-surface-700 border border-surface-600 text-slate-300"
                >Ritual</span>
              </div>

              <dl class="grid grid-cols-2 gap-x-3 gap-y-2">
                <div v-for="prop in properties" :key="prop.label">
                  <dt class="text-[10px] uppercase tracking-widest text-slate-500">{{ prop.label }}</dt>
                  <dd class="text-xs text-slate-200 leading-snug">{{ prop.value }}</dd>
                </div>
              </dl>

              <div v-if="spell.savingThrow || spell.attackRoll" class="text-xs text-slate-300">
                <span v-if="spell.attackRoll">
                  Resolved with a
                  <span class="text-orange-300">{{ spell.attackRoll }} spell attack</span>.
                </span>
                <span v-else-if="spell.savingThrow">
                  The target makes a
                  <span class="text-blue-300">{{ ABILITY_LABELS[spell.savingThrow] }} saving throw</span>
                  against your spell save DC.
                </span>
              </div>

              <div class="space-y-2 pt-1">
                <template v-for="(block, i) in blocks" :key="i">
                  <p v-if="block.kind === 'text'" class="text-sm text-slate-300 leading-relaxed">
                    <span v-if="splitLeadIn(block.text).label" class="font-semibold text-slate-100">
                      {{ splitLeadIn(block.text).label }}
                    </span>
                    {{ splitLeadIn(block.text).rest }}
                  </p>
                  <!-- Thaumaturgy and friends list their options as bullet lines -->
                  <ul v-else class="list-disc pl-5 space-y-1">
                    <li
                      v-for="(item, j) in block.items"
                      :key="j"
                      class="text-sm text-slate-300 leading-relaxed"
                    >{{ item }}</li>
                  </ul>
                </template>
              </div>

              <p v-if="classNames.length > 0" class="text-[11px] text-slate-500 pt-1">
                {{ classNames.join(' · ') }}
              </p>
            </template>

            <!-- What this character's copy of the spell adds on top of the definition -->
            <div
              v-if="entry && (entry.castAtLevel || entry.uses || entry.alwaysPrepared)"
              class="border-t border-surface-700/60 pt-3 space-y-1"
            >
              <p class="text-[10px] uppercase tracking-widest text-slate-500">On this sheet</p>
              <p v-if="entry.castAtLevel" class="text-xs text-slate-300">
                Cast as a {{ levelOrdinal(entry.castAtLevel) }}-level spell.
              </p>
              <p v-if="entry.uses" class="text-xs text-slate-300">
                {{ entry.uses.remaining }} of {{ entry.uses.max }} free
                {{ entry.uses.max === 1 ? 'cast' : 'casts' }} left, back on a
                {{ entry.uses.recharge }} rest — no slot spent.
              </p>
              <p v-if="entry.alwaysPrepared" class="text-xs text-slate-300">
                Always prepared; it does not count against your prepared spells.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
