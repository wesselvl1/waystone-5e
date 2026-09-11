<script setup lang="ts">
/**
 * Taking a feat outside a level-up.
 *
 * Feats reached the sheet only through the ASI step of the level-up wizard, which left a
 * character who gained one any other way — a DM's reward, a correction to a level already
 * taken — with nowhere to record it.
 *
 * The applying is not done here: it builds a `RESOLVED_CHOOSE_FEAT` and hands it to
 * `applyResolvedChoices`, the same call the wizard makes, so the ability increases, the
 * retroactive HP, the granted spells and the feat's own automatic events all land exactly
 * as they would at level 4. What it cannot do is ask the feat's *own* questions — Magic
 * Initiate's cantrips, Skilled's three skills — which need the wizard's pickers; those are
 * named up front instead, with the part of the sheet that can still answer them by hand.
 */
import { useRulepacksStore } from '~/stores/rulepacks'
import { filterBySearch } from '~/services/searchFilter'
import { isChoiceSatisfied, type AbilityPicks } from '~/services/abilityScoreChoice'
import {
  applyResolvedChoices,
  checkFeatPrerequisite,
  featIncreasedAbility,
  getChoiceEvents,
  resolveFeatEvents,
} from '~/services/levelUpService'
import type { Character } from '~/types/character'
import type { ChoiceLevelUpEvent } from '~/types/events'
import type { FeatDefinition } from '~/types/rulepack'

const props = defineProps<{
  /** Whether the modal is on screen; the parent owns this. */
  open: boolean
  character: Character
}>()

const emit = defineEmits<{
  /** The character with the feat applied — a whole one, as the wizard produces. */
  apply: [Character]
  close: []
}>()

const rulepackStore = useRulepacksStore()

const query = ref('')
const selectedFeatId = ref('')
const abilityPicks = ref<AbilityPicks>({})

const allFeats = computed(() => rulepackStore.getAllFeats())

const filteredFeats = computed(() => filterBySearch(allFeats.value, query.value,
  f => [f.name, f.sourceName, f.description, f.prerequisite]))

const selectedFeat = computed(() => (selectedFeatId.value
  ? (rulepackStore.getFeat(selectedFeatId.value) as FeatDefinition | undefined)
  : undefined))

/** The increases the feat leaves to the player, if any. */
const abilityChoice = computed(() => selectedFeat.value?.abilityScoreChoice)

/**
 * A feat already on the sheet cannot be taken again here: its feature is stored under the
 * feat's own id, so a second copy would collide. Retaking a repeatable feat is rare enough
 * to leave to the level-up wizard, which is where the rules put the second one anyway.
 */
function alreadyTaken(featId: string): boolean {
  return props.character.features.some(f => f.id === featId)
}

/**
 * The questions the feat raises that this modal has no picker for. Resolved against the
 * character as stored — the feat is not applied yet — which is the same footing the
 * wizard queues them on.
 */
const pendingChoices = computed<ChoiceLevelUpEvent[]>(() => {
  const feat = selectedFeat.value
  if (!feat) return []
  return getChoiceEvents(resolveFeatEvents(
    props.character,
    feat,
    rulepackStore.composedPack(),
    featIncreasedAbility(feat, abilityPicks.value),
  ))
})

/** What a pending question asks for, and where on the sheet it can still be answered. */
function pendingLabel(event: ChoiceLevelUpEvent): string {
  switch (event.type) {
    case 'CHOOSE_SPELL': {
      const what = event.cantrip ? 'cantrip' : 'spell'
      return event.count > 1
        ? `${event.count} ${what}s — add them from the Spells tab`
        : `1 ${what} — add it from the Spells tab`
    }
    case 'CHOOSE_SPELLCASTING_ABILITY':
      return 'a spellcasting ability — set it from the Spells tab'
    case 'CHOOSE_SKILL':
      return event.count > 1
        ? `${event.count} skill proficiencies — tap them on the Skills card`
        : '1 skill proficiency — tap it on the Skills card'
    case 'CHOOSE_EXPERTISE':
      return `${event.label.toLowerCase()} — tap those skills again for expertise`
    case 'ABILITY_SCORE_IMPROVEMENT':
      return `${event.points} more ability points — set them on the Ability Scores card`
    case 'CHOOSE_OPTION':
      return event.label.toLowerCase()
    default:
      return 'a further choice'
  }
}

const canAdd = computed(() =>
  !!selectedFeat.value && isChoiceSatisfied(abilityChoice.value, abilityPicks.value))

function select(featId: string) {
  if (alreadyTaken(featId)) return
  selectedFeatId.value = featId
  abilityPicks.value = {}
}

function add() {
  const feat = selectedFeat.value
  if (!feat || !canAdd.value) return
  // `applyResolvedChoices` structuredClones its input, which a reactive character is not.
  // toRaw is what the level-up wizard passes, but it only lifts the outermost proxy —
  // enough there, because the wizard hands on a character straight out of the store. The
  // sheet's has been rebuilt by spreading a reactive one (every backfill and every saved
  // patch does), so its nested objects are proxies too and only a deep copy sheds them.
  // Same JSON round-trip both stores use before writing to Dexie, for the same reason.
  const updated = applyResolvedChoices(
    JSON.parse(JSON.stringify(props.character)) as Character,
    [{
      type: 'RESOLVED_CHOOSE_FEAT',
      featId: feat.id,
      abilityBonus: Object.keys(abilityPicks.value).length > 0 ? { ...abilityPicks.value } : undefined,
    }],
    rulepackStore.composedPack(),
  )
  emit('apply', updated)
}

// A modal that kept its last pick would offer it again the next time it opens.
watch(() => props.open, (open) => {
  if (open) return
  query.value = ''
  selectedFeatId.value = ''
  abilityPicks.value = {}
})
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
          <div class="flex-shrink-0 flex items-start gap-3 p-4 pb-3 border-b border-surface-700/60">
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-white leading-tight">Add a feat</p>
              <p class="text-xs text-slate-400 mt-0.5">
                Applied straight to the sheet, outside a level-up.
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

          <!-- Feat list — the only part that gives up room, so the panel below it cannot be
               squeezed to nothing by a long list (flex shrinks siblings in proportion). -->
          <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            <SearchBox
              v-if="allFeats.length > 6"
              v-model="query"
              placeholder="Search feats…"
              :matches="filteredFeats.length"
              :total="allFeats.length"
            />

            <p v-if="allFeats.length === 0" class="text-sm text-slate-400">
              No loaded rulepack lists any feats. Import one to pick from.
            </p>

            <div class="space-y-2">
              <button
                v-for="feat in filteredFeats"
                :key="`${feat.sourceName}-${feat.id}`"
                class="card w-full text-left transition-colors"
                :class="alreadyTaken(feat.id)
                  ? 'opacity-50 cursor-default'
                  : selectedFeatId === feat.id
                    ? 'border-primary-500 bg-primary-400/10'
                    : 'hover:border-primary-500/50'"
                :disabled="alreadyTaken(feat.id)"
                @click="select(feat.id)"
              >
                <div class="flex items-baseline gap-2">
                  <p class="text-sm font-semibold text-white flex-1 min-w-0">{{ feat.name }}</p>
                  <span v-if="alreadyTaken(feat.id)" class="text-[10px] text-slate-500 flex-shrink-0">Taken</span>
                </div>
                <p class="text-[10px] text-slate-500">{{ feat.sourceName }}</p>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ feat.description.slice(0, 120) }}{{ feat.description.length > 120 ? '…' : '' }}
                </p>
                <p
                  v-if="feat.prerequisite"
                  class="text-xs mt-0.5"
                  :class="checkFeatPrerequisite(character, feat as FeatDefinition)
                    ? 'text-slate-500'
                    : 'text-danger-400 font-medium'"
                >
                  Req: {{ feat.prerequisite }}
                </p>
              </button>
              <p v-if="allFeats.length > 0 && filteredFeats.length === 0" class="text-slate-500 text-sm text-center py-4">
                Nothing matches “{{ query }}”.
              </p>
            </div>
          </div>

          <!-- What the pick still needs, and what it cannot finish -->
          <div
            v-if="selectedFeat"
            class="flex-shrink-0 max-h-[40vh] overflow-y-auto border-t border-surface-700/60 p-4 space-y-3"
          >
            <AbilityScoreChoicePicker
              v-if="abilityChoice"
              v-model="abilityPicks"
              :choice="abilityChoice"
              :base-scores="character.abilityScores"
            />

            <div v-if="pendingChoices.length > 0" class="rounded-lg border border-accent-500/40 bg-accent-400/10 p-3">
              <p class="text-xs font-medium text-accent-400">{{ selectedFeat.name }} also asks you to choose:</p>
              <ul class="mt-1 space-y-0.5 text-xs text-slate-400 list-disc list-inside">
                <li v-for="(choice, i) in pendingChoices" :key="i">{{ pendingLabel(choice) }}</li>
              </ul>
              <p class="mt-1.5 text-[11px] text-slate-500">
                The feat itself is added now; record those by hand.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex-shrink-0 flex items-center gap-2 p-4 pt-3 border-t border-surface-700/60">
            <div class="flex-1" />
            <button class="btn-ghost text-xs" @click="emit('close')">Cancel</button>
            <button class="btn-primary text-xs" :disabled="!canAdd" @click="add">Add feat</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
