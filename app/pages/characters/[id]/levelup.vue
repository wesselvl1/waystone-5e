<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import {
  resolveLevelUpEvents,
  applyAutomaticEvents,
  applyResolvedChoices,
  getChoiceEvents,
  getAutomaticEvents,
  checkFeatPrerequisite,
} from '~/services/levelUpService'
import type { Character, AbilityKey } from '~/types/character'
import type { FeatDefinition } from '~/types/rulepack'
import type {
  LevelUpEvent,
  ChoiceLevelUpEvent,
  ResolvedChoice,
  AbilityScoreImprovementEvent,
  ChooseSpellEvent,
  ChooseSubclassEvent,
  OfferOptionalFeaturesEvent,
} from '~/types/events'

const route = useRoute()
const router = useRouter()
const characterStore = useCharactersStore()
const rulepackStore = useRulepacksStore()

const character = ref<Character | null>(null)
const loading = ref(true)

onMounted(async () => {
  await Promise.all([characterStore.loadAll(), rulepackStore.loadAll()])
  const id = route.params.id as string
  character.value = (await characterStore.getById(id)) ?? null
  if (!character.value) { router.replace('/'); return }
  loading.value = false
  initWizard()
})

// ── Wizard state ──────────────────────────────────────────────────────────────
const targetClassId = ref('')
const allEvents = ref<LevelUpEvent[]>([])
const automaticEvents = ref<ReturnType<typeof getAutomaticEvents>>([])
const choiceEvents = ref<ChoiceLevelUpEvent[]>([])
const resolvedChoices = ref<ResolvedChoice[]>([])
const hpChoice = ref<'roll' | 'average' | 'max' | 'manual'>('average')
const manualHp = ref<number>(1)
const wizardStep = ref<'select-class' | 'choices' | 'summary'>('select-class')
const currentChoiceIdx = ref(0)
const saving = ref(false)

function initWizard() {
  if (!character.value) return
  // If only one class, skip class selection
  if (character.value.classes.length === 1) {
    targetClassId.value = character.value.classes[0]!.classId
    resolveEvents()
    wizardStep.value = choiceEvents.value.length > 0 ? 'choices' : 'summary'
  }
}

function resolveEvents() {
  if (!character.value) return
  const cls = rulepackStore.getClass(targetClassId.value)
  if (!cls) return
  const currentEntry = character.value.classes.find(c => c.classId === targetClassId.value)
  const newLevel = ((currentEntry?.level) ?? 0) + 1

  // Find the rulepack that has this class
  const pack = rulepackStore.rulepacks.find(r => r.classes.some(c => c.id === targetClassId.value))
  if (!pack) return

  allEvents.value = resolveLevelUpEvents(
    character.value,
    targetClassId.value,
    newLevel,
    pack,
    rulepackStore.getOptionalFeaturesForClass(targetClassId.value, newLevel),
  )
  automaticEvents.value = getAutomaticEvents(allEvents.value)
  choiceEvents.value = getChoiceEvents(allEvents.value)
  resolvedChoices.value = []
  currentChoiceIdx.value = 0
}

function selectClass(classId: string) {
  targetClassId.value = classId
  resolveEvents()
  if (choiceEvents.value.length > 0) {
    wizardStep.value = 'choices'
  }
  else {
    wizardStep.value = 'summary'
  }
}

// ── Choice handling ───────────────────────────────────────────────────────────
const currentChoice = computed<ChoiceLevelUpEvent | null>(() =>
  choiceEvents.value[currentChoiceIdx.value] ?? null,
)

// ASI
const asiSelections = ref<Partial<Record<AbilityKey, number>>>({})
const asiFeatMode = ref(false)
const selectedFeatId = ref('')
const featAsiChoice = ref<Partial<Record<AbilityKey, number>>>({})
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

const asiPointsUsed = computed(() => Object.values(asiSelections.value).reduce((s, v) => s + (v ?? 0), 0))
const asiPoints = computed(() => (currentChoice.value as AbilityScoreImprovementEvent | null)?.points ?? 2)

function setASI(key: AbilityKey, value: number) {
  asiSelections.value = { ...asiSelections.value, [key]: value }
}

function confirmASI() {
  if (asiFeatMode.value && selectedFeatId.value) {
    resolvedChoices.value.push({
      type: 'RESOLVED_CHOOSE_FEAT',
      featId: selectedFeatId.value,
      abilityBonus: Object.keys(featAsiChoice.value).length > 0 ? { ...featAsiChoice.value } : undefined,
    })
  }
  else {
    resolvedChoices.value.push({ type: 'RESOLVED_ASI', bonuses: { ...asiSelections.value } })
  }
  featAsiChoice.value = {}
  nextChoice()
}

// Choose spell
const spellSelections = ref<string[]>([])

function toggleSpell(spellId: string) {
  const choiceEvent = currentChoice.value as ChooseSpellEvent | null
  const maxChoices = choiceEvent?.count ?? 1
  if (spellSelections.value.includes(spellId)) {
    spellSelections.value = spellSelections.value.filter(s => s !== spellId)
  }
  else if (spellSelections.value.length < maxChoices) {
    spellSelections.value.push(spellId)
  }
}

const availableSpells = computed(() => {
  const choiceEvent = currentChoice.value as ChooseSpellEvent | null
  if (!choiceEvent) return []
  const allSpells = rulepackStore.getAllSpells()
  const existing = new Set(character.value?.spells.map(s => s.spellId) ?? [])
  return allSpells.filter(s => {
    if (existing.has(s.id)) return false
    if (choiceEvent.cantrip) return s.level === 0
    if (choiceEvent.fromList?.length) return choiceEvent.fromList.includes(s.id)
    const classSpells = rulepackStore.getClass(targetClassId.value)
    return classSpells ? s.classes.includes(targetClassId.value) : true
  })
})

function confirmSpells() {
  resolvedChoices.value.push({
    type: 'RESOLVED_CHOOSE_SPELL',
    spellIds: spellSelections.value,
    removedSpellIds: [],
    classId: targetClassId.value || undefined,
  })
  spellSelections.value = []
  nextChoice()
}

// Choose feat
function confirmFeat() {
  if (!selectedFeatId.value) return
  resolvedChoices.value.push({
    type: 'RESOLVED_CHOOSE_FEAT',
    featId: selectedFeatId.value,
    abilityBonus: Object.keys(featAsiChoice.value).length > 0 ? { ...featAsiChoice.value } : undefined,
  })
  selectedFeatId.value = ''
  featAsiChoice.value = {}
  nextChoice()
}

// Choose subclass
const selectedSubclassId = ref('')

// Optional features — toggled by the player
const optionalFeatureToggles = ref<Record<string, boolean>>({})

function initOptionalToggles(event: OfferOptionalFeaturesEvent) {
  const toggles: Record<string, boolean> = {}
  for (const f of event.features) toggles[f.id] = false
  optionalFeatureToggles.value = toggles
}

function confirmOptionalFeatures() {
  const choiceEvent = currentChoice.value as OfferOptionalFeaturesEvent
  const taken = choiceEvent.features.filter(f => optionalFeatureToggles.value[f.id])
  resolvedChoices.value.push({ type: 'RESOLVED_OPTIONAL_FEATURES', taken })
  optionalFeatureToggles.value = {}
  nextChoice()
}

watch(currentChoice, (choice) => {
  if (choice?.type === 'OFFER_OPTIONAL_FEATURES') {
    initOptionalToggles(choice as OfferOptionalFeaturesEvent)
  }
})

const availableSubclasses = computed(() => rulepackStore.getSubclassesForClass(targetClassId.value))

function confirmSubclass() {
  if (!selectedSubclassId.value) return
  resolvedChoices.value.push({ type: 'RESOLVED_SUBCLASS', subclassId: selectedSubclassId.value, classId: targetClassId.value })
  selectedSubclassId.value = ''
  nextChoice()
}

function nextChoice() {
  if (currentChoiceIdx.value < choiceEvents.value.length - 1) {
    currentChoiceIdx.value++
  }
  else {
    wizardStep.value = 'summary'
  }
}

function skipChoice() {
  nextChoice()
}

// ── Apply & save ──────────────────────────────────────────────────────────────
async function applyLevelUp() {
  if (!character.value) return
  saving.value = true

  // Find the rulepack
  const pack = rulepackStore.rulepacks.find(r => r.classes.some(c => c.id === targetClassId.value))
  if (!pack) { saving.value = false; return }

  // Apply automatic events (toRaw strips the Vue Proxy so structuredClone can clone it)
  let updated = applyAutomaticEvents(toRaw(character.value), automaticEvents.value, hpChoice.value, hpChoice.value === 'manual' ? manualHp.value : undefined)

  // Bump class level
  updated = {
    ...updated,
    classes: updated.classes.map(c =>
      c.classId === targetClassId.value ? { ...c, level: c.level + 1 } : c,
    ),
  }

  // Apply resolved choices
  updated = applyResolvedChoices(updated, resolvedChoices.value, pack)

  await characterStore.save(updated)
  router.push(`/characters/${updated.id}`)
}

const addHpEvent = computed(() => automaticEvents.value.find(e => e.type === 'ADD_HP') as { type: 'ADD_HP'; roll: number; average: number; max: number; conBonus: number; hpFlatBonus: number } | undefined)
const newFeatures = computed(() => automaticEvents.value.filter(e => e.type === 'ADD_FEATURE'))
const newSpellSlots = computed(() => automaticEvents.value.find(e => e.type === 'UPDATE_SPELL_SLOTS') as { type: 'UPDATE_SPELL_SLOTS'; slots: Record<number, number> } | undefined)

const targetLevel = computed(() => {
  if (!character.value) return 1
  const entry = character.value.classes.find(c => c.classId === targetClassId.value)
  return (entry?.level ?? 0) + 1
})
</script>

<template>
  <div class="min-h-screen pb-8">
    <header class="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <NuxtLink :to="`/characters/${route.params.id}`" class="btn-ghost p-2">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <span class="flex-1 text-sm font-semibold text-white">Level Up</span>
      <span v-if="character" class="text-xs text-slate-400">{{ character.name }}</span>
    </header>

    <div v-if="loading" class="flex items-center justify-center pt-24 text-slate-500">Loading…</div>

    <div v-else-if="character" class="px-4 pt-4 space-y-4">

      <!-- ── Select class ── -->
      <template v-if="wizardStep === 'select-class'">
        <p class="section-header">Which class levels up?</p>
        <div class="space-y-2">
          <button
            v-for="cls in character.classes"
            :key="cls.classId"
            class="card w-full text-left hover:border-primary-500/50 transition-colors"
            @click="selectClass(cls.classId)"
          >
            <p class="font-semibold text-white">{{ rulepackStore.getClass(cls.classId)?.name ?? cls.classId }}</p>
            <p class="text-sm text-slate-400">Level {{ cls.level }} → {{ cls.level + 1 }}</p>
          </button>
        </div>
      </template>

      <!-- ── Choices ── -->
      <template v-if="wizardStep === 'choices' && currentChoice">
        <div class="text-xs text-slate-500 uppercase tracking-widest">
          Choice {{ currentChoiceIdx + 1 }} of {{ choiceEvents.length }}
        </div>

        <!-- ASI -->
        <template v-if="currentChoice.type === 'ABILITY_SCORE_IMPROVEMENT'">
          <h2 class="font-semibold text-white text-lg">Ability Score Improvement</h2>
          <div class="flex gap-2 mb-3">
            <button
              class="btn text-xs flex-1"
              :class="!asiFeatMode ? 'btn-primary' : 'btn-ghost'"
              @click="asiFeatMode = false; selectedFeatId = ''"
            >+{{ asiPoints }} to Abilities</button>
            <button
              class="btn text-xs flex-1"
              :class="asiFeatMode ? 'btn-primary' : 'btn-ghost'"
              @click="asiFeatMode = true; asiSelections = {}"
            >Choose a Feat</button>
          </div>

          <template v-if="!asiFeatMode">
            <p class="text-sm text-slate-400 mb-3">
              Points remaining: <span class="font-bold text-white">{{ asiPoints - asiPointsUsed }}</span>
            </p>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="key in ABILITY_KEYS" :key="key" class="stat-box">
                <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                <span class="text-lg font-bold text-white">{{ (character.abilityScores[key] ?? 10) + (asiSelections[key] ?? 0) }}</span>
                <div class="flex items-center gap-1 mt-1">
                  <button
                    class="w-5 h-5 rounded bg-surface-700 text-xs hover:bg-surface-600"
                    :disabled="!asiSelections[key]"
                    @click="setASI(key, Math.max(0, (asiSelections[key] ?? 0) - 1))"
                  >-</button>
                  <span class="text-xs text-accent-400 w-4 text-center">{{ asiSelections[key] ? `+${asiSelections[key]}` : '' }}</span>
                  <button
                    class="w-5 h-5 rounded bg-surface-700 text-xs hover:bg-surface-600"
                    :disabled="asiPointsUsed >= asiPoints || (character.abilityScores[key] ?? 10) + (asiSelections[key] ?? 0) >= 20"
                    @click="setASI(key, (asiSelections[key] ?? 0) + 1)"
                  >+</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="space-y-2 max-h-72 overflow-y-auto">
              <button
                v-for="feat in rulepackStore.getAllFeats()"
                :key="feat.id"
                class="card w-full text-left transition-colors hover:border-primary-500/50"
                :class="selectedFeatId === feat.id ? 'border-primary-500 bg-primary-900/20' : ''"
                @click="selectedFeatId = feat.id; featAsiChoice = {}"
              >
                <p class="text-sm font-semibold text-white">{{ feat.name }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ feat.description.slice(0, 100) }}…</p>
                <p v-if="feat.prerequisite" class="text-xs mt-0.5" :class="checkFeatPrerequisite(character!, feat as FeatDefinition) ? 'text-slate-500' : 'text-red-400 font-medium'">Req: {{ feat.prerequisite }}</p>
              </button>
            </div>
            <!-- Ability score choice for selected feat -->
            <template v-if="selectedFeatId && (rulepackStore.getFeat(selectedFeatId) as FeatDefinition | undefined)?.abilityScoreChoice">
              <p class="text-sm text-slate-300 mt-3 mb-1">
                Choose {{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count }}
                ability score{{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count > 1 ? 's' : '' }}
                to increase by +{{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.bonus }}:
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="key in (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.from"
                  :key="key"
                  class="stat-box cursor-pointer transition-colors"
                  :class="featAsiChoice[key] ? 'border-primary-500 bg-primary-900/20' : 'hover:border-primary-500/50'"
                  @click="() => {
                    const choice = (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!
                    const already = !!featAsiChoice[key]
                    const picked = Object.values(featAsiChoice).filter(Boolean).length
                    if (already) { const next = { ...featAsiChoice }; delete next[key]; featAsiChoice = next }
                    else if (picked < choice.count) { featAsiChoice = { ...featAsiChoice, [key]: choice.bonus } }
                  }"
                >
                  <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                  <span class="text-lg font-bold text-white">{{ (character!.abilityScores[key] ?? 10) + (featAsiChoice[key] ?? 0) }}</span>
                  <span v-if="featAsiChoice[key]" class="text-xs text-accent-400">+{{ featAsiChoice[key] }}</span>
                </button>
              </div>
            </template>
          </template>

          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="asiFeatMode
                ? !selectedFeatId || (
                    !!(rulepackStore.getFeat(selectedFeatId) as FeatDefinition | undefined)?.abilityScoreChoice &&
                    Object.values(featAsiChoice).filter(Boolean).length < (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count
                  )
                : asiPointsUsed < asiPoints"
              @click="confirmASI"
            >Confirm</button>
          </div>
        </template>

        <!-- Choose Spell -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SPELL'">
          <h2 class="font-semibold text-white text-lg">Choose {{ currentChoice.count }} {{ currentChoice.cantrip ? 'Cantrip' : 'Spell' }}{{ currentChoice.count > 1 ? 's' : '' }}</h2>
          <p class="text-sm text-slate-400 mb-3">{{ spellSelections.length }}/{{ currentChoice.count }} selected</p>
          <div class="space-y-1.5 max-h-80 overflow-y-auto">
            <button
              v-for="spell in availableSpells"
              :key="spell.id"
              class="card w-full text-left text-sm py-2 hover:border-primary-500/50 transition-colors"
              :class="spellSelections.includes(spell.id) ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="toggleSpell(spell.id)"
            >
              <span class="font-medium text-white">{{ spell.name }}</span>
              <span class="text-slate-500 ml-2 text-xs">{{ spell.school }} · {{ spell.castingTime }}</span>
            </button>
          </div>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button class="btn-primary flex-1 text-sm" :disabled="spellSelections.length === 0" @click="confirmSpells">Confirm</button>
          </div>
        </template>

        <!-- Choose Feat -->
        <template v-else-if="currentChoice.type === 'CHOOSE_FEAT'">
          <h2 class="font-semibold text-white text-lg">Choose a Feat</h2>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <button
              v-for="feat in rulepackStore.getAllFeats()"
              :key="feat.id"
              class="card w-full text-left transition-colors hover:border-primary-500/50"
              :class="selectedFeatId === feat.id ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="selectedFeatId = feat.id; featAsiChoice = {}"
            >
              <p class="text-sm font-semibold text-white">{{ feat.name }}</p>
              <p class="text-xs text-slate-400 mt-0.5">{{ feat.description.slice(0, 120) }}…</p>
              <p v-if="feat.prerequisite" class="text-xs mt-0.5" :class="checkFeatPrerequisite(character!, feat as FeatDefinition) ? 'text-slate-500' : 'text-red-400 font-medium'">Prerequisite: {{ feat.prerequisite }}</p>
            </button>
          </div>
          <!-- Ability score choice for selected feat -->
          <template v-if="selectedFeatId && (rulepackStore.getFeat(selectedFeatId) as FeatDefinition | undefined)?.abilityScoreChoice">
            <p class="text-sm text-slate-300 mt-3 mb-1">
              Choose {{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count }}
              ability score{{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count > 1 ? 's' : '' }}
              to increase by +{{ (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.bonus }}:
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="key in (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.from"
                :key="key"
                class="stat-box cursor-pointer transition-colors"
                :class="featAsiChoice[key] ? 'border-primary-500 bg-primary-900/20' : 'hover:border-primary-500/50'"
                @click="() => {
                  const choice = (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!
                  const already = !!featAsiChoice[key]
                  const picked = Object.values(featAsiChoice).filter(Boolean).length
                  if (already) { const next = { ...featAsiChoice }; delete next[key]; featAsiChoice = next }
                  else if (picked < choice.count) { featAsiChoice = { ...featAsiChoice, [key]: choice.bonus } }
                }"
              >
                <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                <span class="text-lg font-bold text-white">{{ (character!.abilityScores[key] ?? 10) + (featAsiChoice[key] ?? 0) }}</span>
                <span v-if="featAsiChoice[key]" class="text-xs text-accent-400">+{{ featAsiChoice[key] }}</span>
              </button>
            </div>
          </template>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="!selectedFeatId || (
                !!(rulepackStore.getFeat(selectedFeatId) as FeatDefinition | undefined)?.abilityScoreChoice &&
                Object.values(featAsiChoice).filter(Boolean).length < (rulepackStore.getFeat(selectedFeatId) as FeatDefinition).abilityScoreChoice!.count
              )"
              @click="confirmFeat"
            >Confirm</button>
          </div>
        </template>

        <!-- Choose Subclass -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SUBCLASS'">
          <h2 class="font-semibold text-white text-lg">{{ (currentChoice as ChooseSubclassEvent).label }}</h2>
          <div v-if="availableSubclasses.length > 0" class="space-y-2 max-h-[28rem] overflow-y-auto">
            <button
              v-for="sub in availableSubclasses"
              :key="sub.id"
              class="card w-full text-left hover:border-primary-500/50 transition-colors"
              :class="selectedSubclassId === sub.id ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="selectedSubclassId = sub.id"
            >
              <p class="font-semibold text-white">{{ sub.name }}</p>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">{{ sub.description }}</p>
              <div v-if="selectedSubclassId === sub.id" class="mt-2 space-y-1.5">
                <p class="text-xs font-medium text-accent-400 uppercase tracking-wide">Level {{ targetLevel }} Features</p>
                <div v-for="feat in sub.levels.find(l => l.level === targetLevel)?.features ?? []" :key="feat.name" class="text-xs text-slate-300 bg-surface-800/60 rounded p-2">
                  <span class="font-semibold text-white">{{ feat.name }}.</span> {{ feat.description.slice(0, 180) }}{{ feat.description.length > 180 ? '…' : '' }}
                </div>
              </div>
            </button>
          </div>
          <p v-else class="text-slate-500 text-sm text-center py-4">
            No subclasses available in the loaded rulepacks.
          </p>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="!selectedSubclassId"
              @click="confirmSubclass"
            >Confirm</button>
          </div>
        </template>

        <!-- Optional Features -->
        <template v-else-if="currentChoice.type === 'OFFER_OPTIONAL_FEATURES'">
          <h2 class="font-semibold text-white text-lg">Optional Class Features</h2>
          <p class="text-sm text-slate-400 mb-3">These optional features are available from your loaded rulepacks. Toggle any you'd like to take.</p>
          <div class="space-y-2 max-h-[28rem] overflow-y-auto">
            <div
              v-for="feat in (currentChoice as OfferOptionalFeaturesEvent).features"
              :key="feat.id"
              class="card cursor-pointer hover:border-surface-500 transition-colors"
              :class="optionalFeatureToggles[feat.id] ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="optionalFeatureToggles[feat.id] = !optionalFeatureToggles[feat.id]"
            >
              <div class="flex items-start gap-3">
                <div class="mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors"
                  :class="optionalFeatureToggles[feat.id] ? 'bg-primary-500 border-primary-500' : 'border-slate-600'"
                >
                  <svg v-if="optionalFeatureToggles[feat.id]" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-semibold text-white text-sm">{{ feat.name }}</p>
                    <span class="text-[10px] bg-accent-700/30 border border-accent-600/40 text-accent-300 rounded px-1.5 py-0.5">{{ feat.sourceName }}</span>
                    <span v-if="feat.replaces" class="text-[10px] text-slate-500">replaces {{ feat.replaces }}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1 leading-relaxed">{{ feat.description.slice(0, 200) }}{{ feat.description.length > 200 ? '\u2026' : '' }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip All</button>
            <button class="btn-primary flex-1 text-sm" @click="confirmOptionalFeatures">Confirm</button>
          </div>
        </template>
      </template>

      <!-- ── Summary ── -->
      <template v-if="wizardStep === 'summary'">
        <h2 class="font-semibold text-white text-lg">
          Level {{ targetLevel }} — Summary
        </h2>

        <!-- HP gain -->
        <div v-if="addHpEvent" class="card space-y-3">
          <p class="section-header">Hit Points</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="card text-center transition-colors cursor-pointer"
              :class="hpChoice === 'average' ? 'border-primary-500 bg-primary-900/20' : 'hover:border-surface-600'"
              @click="hpChoice = 'average'"
            >
              <p class="text-2xl font-bold text-white">+{{ Math.max(1, addHpEvent.average + addHpEvent.conBonus + addHpEvent.hpFlatBonus) }}</p>
              <p class="text-xs text-slate-400 mt-1">Take Average</p>
            </button>
            <button
              class="card text-center transition-colors cursor-pointer"
              :class="hpChoice === 'roll' ? 'border-primary-500 bg-primary-900/20' : 'hover:border-surface-600'"
              @click="hpChoice = 'roll'"
            >
              <p class="text-2xl font-bold text-white">+{{ Math.max(1, addHpEvent.roll + addHpEvent.conBonus + addHpEvent.hpFlatBonus) }}</p>
              <p class="text-xs text-slate-400 mt-1">Rolled ({{ addHpEvent.roll }})</p>
            </button>
            <button
              class="card text-center transition-colors cursor-pointer"
              :class="hpChoice === 'max' ? 'border-primary-500 bg-primary-900/20' : 'hover:border-surface-600'"
              @click="hpChoice = 'max'"
            >
              <p class="text-2xl font-bold text-white">+{{ Math.max(1, addHpEvent.max + addHpEvent.conBonus + addHpEvent.hpFlatBonus) }}</p>
              <p class="text-xs text-slate-400 mt-1">Maximum</p>
            </button>
            <button
              class="card text-center transition-colors cursor-pointer"
              :class="hpChoice === 'manual' ? 'border-primary-500 bg-primary-900/20' : 'hover:border-surface-600'"
              @click="hpChoice = 'manual'; manualHp = addHpEvent.average"
            >
              <p class="text-2xl font-bold text-white">+{{ hpChoice === 'manual' ? Math.max(1, manualHp + addHpEvent.conBonus + addHpEvent.hpFlatBonus) : '?' }}</p>
              <p class="text-xs text-slate-400 mt-1">Manual</p>
            </button>
          </div>
          <div v-if="hpChoice === 'manual'" class="flex items-center gap-3 pt-1">
            <label for="manual-hp-input" class="text-sm text-slate-400">Roll value (before CON):</label>
            <input
              id="manual-hp-input"
              v-model.number="manualHp"
              type="number"
              min="1"
              :max="addHpEvent.max"
              class="w-20 bg-surface-700 border border-surface-600 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <!-- New features -->
        <div v-if="newFeatures.length" class="card">
          <p class="section-header">New Features</p>
          <div class="space-y-1">
            <div v-for="(e) in newFeatures" :key="(e as { feature: { id: string } }).feature.id" class="flex items-center gap-2">
              <svg class="w-4 h-4 text-success-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-white">{{ (e as { feature: { name: string } }).feature.name }}</span>
            </div>
          </div>
        </div>

        <!-- Spell slots -->
        <div v-if="newSpellSlots" class="card">
          <p class="section-header">Spell Slots Updated</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="[lvl, count] in Object.entries(newSpellSlots.slots)"
              :key="lvl"
              class="text-xs bg-primary-600/20 border border-primary-600/40 text-primary-300 rounded px-2 py-0.5"
            >
              Level {{ lvl }}: {{ count }} slots
            </span>
          </div>
        </div>

        <!-- Resolved choices summary -->
        <div v-if="resolvedChoices.length" class="card">
          <p class="section-header">Your Choices</p>
          <div class="space-y-1 text-sm text-slate-300">
            <div v-for="(choice, i) in resolvedChoices" :key="i">
              <span v-if="choice.type === 'RESOLVED_ASI'">
                ASI: {{ Object.entries(choice.bonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_CHOOSE_FEAT'">
                Feat: {{ rulepackStore.getFeat(choice.featId)?.name ?? choice.featId }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_CHOOSE_SPELL'">
                Spells: {{ choice.spellIds.map(id => rulepackStore.getSpell(id)?.name ?? id).join(', ') }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_SUBCLASS'">
                Subclass: {{ choice.subclassId }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_OPTIONAL_FEATURES' && choice.taken.length > 0">
                Optional features: {{ choice.taken.map(f => f.name).join(', ') }}
              </span>
            </div>
          </div>
        </div>

        <button class="btn-primary w-full mt-2" :disabled="saving" @click="applyLevelUp">
          {{ saving ? 'Saving…' : 'Apply Level Up' }}
        </button>
      </template>
    </div>
  </div>
</template>
