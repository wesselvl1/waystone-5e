<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import { multiclassOptions, describeMulticlassPrerequisites, effectiveScores, projectClassLevel } from '~/services/multiclass'
import { maxSpellLevelForClass, clampSpellSlots, spellSaveDCFor, spellAttackBonusFor, expandedSpellIdsFor } from '~/services/spellcasting'
import { abilityMod, proficiencyBonus } from '~/composables/useCharacterStats'
import { isChoiceSatisfied, type AbilityPicks } from '~/services/abilityScoreChoice'
import { filterBySearch } from '~/services/searchFilter'
import {
  resolveLevelUpEvents,
  resolveOptionChoice,
  resolveFeatEvents,
  featIncreasedAbility,
  chooseSpellEvent,
  resolveUnlockedChoices,
  applyAutomaticEvents,
  applyResolvedChoices,
  getChoiceEvents,
  getAutomaticEvents,
  checkFeatPrerequisite,
} from '~/services/levelUpService'
import type { Character, AbilityKey, SkillKey } from '~/types/character'
import type { FeatDefinition, LevelUpEventDef } from '~/types/rulepack'
import type {
  LevelUpEvent,
  ChoiceLevelUpEvent,
  ResolvedChoice,
  AbilityScoreImprovementEvent,
  ChooseSpellEvent,
  ChooseSubclassEvent,
  ChooseOptionEvent,
  OfferOptionalFeaturesEvent,
  ChooseSkillEvent,
  ChooseExpertiseEvent,
  ChooseSpellcastingAbilityEvent,
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
  // The class step is always shown, even with a single class: skipping it was the reason
  // there was no way to multiclass. A character still mid-creation (level 0) has nothing
  // to choose between, so that case advances straight through.
  const started = character.value.classes.filter(c => c.level > 0)
  if (started.length === 0 && character.value.classes.length === 1) {
    targetClassId.value = character.value.classes[0]!.classId
    resolveEvents()
    wizardStep.value = choiceEvents.value.length > 0 ? 'choices' : 'summary'
  }
}

/**
 * All loaded packs as one, since a class may come from any of them — and a sourcebook
 * pack may attach a subclass to a class defined in another pack, so picking the single
 * pack that declares the class would lose that subclass.
 */
function mergedPack() {
  return rulepackStore.composedPack()
}

// ── Multiclassing ─────────────────────────────────────────────────────────────

const showMulticlass = ref(false)

/** Classes the character does not have yet, each with its prerequisite state. */
const multiclassChoices = computed(() => {
  if (!character.value) return []
  const pack = mergedPack()
  return multiclassOptions(character.value, pack)
})

function prerequisiteText(classId: string): string {
  const def = rulepackStore.getClass(classId)
  return def ? describeMulticlassPrerequisites(def) : ''
}

/** Take the first level in a class the character does not have. */
function selectNewClass(classId: string) {
  if (!character.value) return
  // Recorded at level 0 so resolveEvents computes level 1 for it; the level itself is
  // applied on confirm like any other, so abandoning the wizard leaves nothing behind.
  pendingNewClassId.value = classId
  selectClass(classId)
}

const pendingNewClassId = ref<string | null>(null)


function resolveEvents() {
  if (!character.value) return
  const cls = rulepackStore.getClass(targetClassId.value)
  if (!cls) return
  const currentEntry = character.value.classes.find(c => c.classId === targetClassId.value)
  const newLevel = ((currentEntry?.level) ?? 0) + 1

  const pack = mergedPack()

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
const featAsiChoice = ref<AbilityPicks>({})
/** The ability increases the selected feat leaves to the player, if any. */
const selectedFeatChoice = computed(() => (selectedFeatId.value
  ? (rulepackStore.getFeat(selectedFeatId.value) as FeatDefinition | undefined)?.abilityScoreChoice
  : undefined))
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

const asiPointsUsed = computed(() => Object.values(asiSelections.value).reduce((s, v) => s + (v ?? 0), 0))
const asiPoints = computed(() => (currentChoice.value as AbilityScoreImprovementEvent | null)?.points ?? 2)

function setASI(key: AbilityKey, value: number) {
  asiSelections.value = { ...asiSelections.value, [key]: value }
}

/**
 * A feat's own choices — Magic Initiate's cantrips, Fey Touched's spell — can only be
 * known once the feat is picked, so they are appended to the run here and visited by the
 * steps that follow. Its automatic half is applied by RESOLVED_CHOOSE_FEAT and so is
 * deliberately not added to `automaticEvents`, which would apply it twice.
 */
function queueFeatChoices(featId: string) {
  if (!character.value) return
  const feat = rulepackStore.getFeat(featId) as FeatDefinition | undefined
  if (!feat?.levelUpEvents?.length) return
  const increased = featIncreasedAbility(feat, featAsiChoice.value)
  const queued = getChoiceEvents(
    resolveFeatEvents(character.value, feat, mergedPack(), increased),
  )
  if (queued.length > 0) choiceEvents.value = [...choiceEvents.value, ...queued]
}

function confirmASI() {
  if (asiFeatMode.value && selectedFeatId.value) {
    resolvedChoices.value.push({
      type: 'RESOLVED_CHOOSE_FEAT',
      featId: selectedFeatId.value,
      abilityBonus: Object.keys(featAsiChoice.value).length > 0 ? { ...featAsiChoice.value } : undefined,
    })
    queueFeatChoices(selectedFeatId.value)
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

/** Highest spell level the targeted class can learn at the level being gained. */
/** The subclass picked in this run, before it has been committed to the character. */
const pendingSubclassId = computed(() => resolvedChoices.value
  .find((c): c is Extract<ResolvedChoice, { type: 'RESOLVED_SUBCLASS' }> =>
    c.type === 'RESOLVED_SUBCLASS' && c.classId === targetClassId.value)
  ?.subclassId)

/**
 * Class levels as they will be *after* this level-up, for the spell-level cap.
 *
 * The subclass has to be projected too, not just the level: an Eldritch Knight's slots
 * live on the subclass, so a fighter who picks it at 3rd would otherwise be capped at 0
 * on the very level-up that makes them a caster, and every 1st-level spell would be
 * filtered out of the picker.
 */
const projectedClasses = computed(() => {
  if (!character.value) return []
  const classes = projectClassLevel(
    character.value.classes, targetClassId.value, targetLevel.value)
  const subclassId = pendingSubclassId.value
  if (!subclassId) return classes
  return classes.map(c => (c.classId === targetClassId.value ? { ...c, subclassId } : c))
})

const maxLearnableSpellLevel = computed(() =>
  character.value
    ? maxSpellLevelForClass(targetClassId.value, projectedClasses.value, mergedPack())
    : 0)

/**
 * Spells a standing rule adds to this list on top of its class list — a Ravnica guild
 * background, a Divine Soul's cleric access. Derived from the character's sources, so a
 * background picked at creation still reaches a class taken at this level-up.
 */
const expandedForChoice = computed(() => {
  const choiceEvent = currentChoice.value as ChooseSpellEvent | null
  if (!choiceEvent || !character.value) return new Set<string>()
  const listId = choiceEvent.addTo || targetClassId.value
  // Projected, so a rule that unlocks at this very level — or with the subclass picked
  // moments ago — counts
  const projected = { ...character.value, classes: projectedClasses.value }
  return expandedSpellIdsFor(listId, projected, mergedPack())
})

const allFeats = computed(() => rulepackStore.getAllFeats())

const availableSpells = computed(() => {
  const choiceEvent = currentChoice.value as ChooseSpellEvent | null
  if (!choiceEvent) return []
  const allSpells = rulepackStore.getAllSpells()
  const existing = new Set(character.value?.spells.map(s => s.spellId) ?? [])
  const expanded = expandedForChoice.value
  return allSpells.filter(s => {
    if (existing.has(s.id)) return false
    if (choiceEvent.cantrip !== (s.level === 0)) return false
    // Cap by the *class's* own level, not the character's slots: a cleric 1 / wizard 1
    // has a 2nd-level slot but may only take 1st-level spells from either list. A source
    // with no class level to cap by states its own maxLevel — a feat grants a 1st-level
    // spell to a fighter whose class cap is 0.
    const cap = choiceEvent.maxLevel ?? maxLearnableSpellLevel.value
    if (!choiceEvent.cantrip && s.level > cap) return false
    // An expansion widens which spells count as being ON a list, which is what
    // EXPAND_SPELL_LIST means — so it is folded into the class-list test rather than
    // short-circuiting ahead of every restriction. Returning true up front let a guild
    // background's spells satisfy a pick they have nothing to do with: Fey Touched asks
    // for divination or enchantment, and would have offered whatever the guild added.
    if (choiceEvent.fromList?.length) return choiceEvent.fromList.includes(s.id)
    if (choiceEvent.classes?.length) {
      return s.classes.some(c => choiceEvent.classes!.includes(c)) || expanded.has(s.id)
    }
    if (choiceEvent.schools?.length) return choiceEvent.schools.includes(s.school)
    return true
  })
})

function confirmSpells() {
  resolvedChoices.value.push({
    type: 'RESOLVED_CHOOSE_SPELL',
    spellIds: spellSelections.value,
    removedSpellIds: [],
    classId: (currentChoice.value as ChooseSpellEvent).addTo || targetClassId.value || undefined,
    ability: (currentChoice.value as ChooseSpellEvent).ability,
    origin: (currentChoice.value as ChooseSpellEvent).origin,
    label: (currentChoice.value as ChooseSpellEvent).label,
    uses: (currentChoice.value as ChooseSpellEvent).uses,
    cost: (currentChoice.value as ChooseSpellEvent).cost,
    castAtLevel: (currentChoice.value as ChooseSpellEvent).castAtLevel,
  })
  spellSelections.value = []
  nextChoice()
}

// ── Choose spellcasting ability ────────────────────────────────────────────────
const selectedCastingAbility = ref<AbilityKey | ''>('')

/**
 * The DC and attack bonus each candidate would give, so the choice is made on its
 * effect rather than on the ability's name. Proficiency comes from the level being
 * gained, since that is the level the character will be on once this is applied.
 */
function castingAbilityPreview(key: AbilityKey) {
  const total = projectClassLevel(
    character.value?.classes ?? [], targetClassId.value, targetLevel.value,
  ).reduce((sum, c) => sum + c.level, 0)
  const prof = proficiencyBonus(Math.max(total, 1))
  const mod = abilityMod(character.value?.abilityScores[key] ?? 10)
  return { mod, saveDC: spellSaveDCFor(key, mod, prof), attack: spellAttackBonusFor(mod, prof) }
}

function confirmCastingAbility() {
  const choice = currentChoice.value as ChooseSpellcastingAbilityEvent
  if (!selectedCastingAbility.value) return
  resolvedChoices.value.push({
    type: 'RESOLVED_SPELLCASTING_ABILITY',
    sourceId: choice.addTo,
    ability: selectedCastingAbility.value,
    origin: choice.origin,
    label: choice.label,
  })
  selectedCastingAbility.value = ''
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
  queueFeatChoices(selectedFeatId.value)
  selectedFeatId.value = ''
  featAsiChoice.value = {}
  nextChoice()
}

// Choose option (e.g. totem spirit)
const selectedOptionId = ref('')

// CHOOSE_SKILL had no UI, so emitting one would have stalled the wizard. A multiclassing
// bard, ranger or rogue gains one skill, so the picker is needed for those.
const selectedSkills = ref<SkillKey[]>([])

const SKILL_LABELS: Record<string, string> = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History', insight: 'Insight',
  intimidation: 'Intimidation', investigation: 'Investigation', medicine: 'Medicine',
  nature: 'Nature', perception: 'Perception', performance: 'Performance',
  persuasion: 'Persuasion', religion: 'Religion', sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth', survival: 'Survival',
}

function toggleSkill(skill: SkillKey, count: number) {
  const picked = selectedSkills.value
  if (picked.includes(skill)) selectedSkills.value = picked.filter(s => s !== skill)
  else if (picked.length < count) selectedSkills.value = [...picked, skill]
}

/** Skills the character already has, which cannot be picked again. */
function alreadyProficient(skill: SkillKey): boolean {
  return (character.value?.skillProficiencies[skill] ?? 0) > 0
}

const selectedExpertise = ref<SkillKey[]>([])

/**
 * Expertise doubles an existing proficiency, so only skills the character is already
 * proficient in are eligible, and ones already at expertise are excluded.
 */
function expertiseCandidates(options: SkillKey[]): SkillKey[] {
  const profs = character.value?.skillProficiencies
  if (!profs) return []
  return options.filter(s => (profs[s] ?? 0) === 1)
}

function toggleExpertise(skill: SkillKey, count: number) {
  const picked = selectedExpertise.value
  if (picked.includes(skill)) selectedExpertise.value = picked.filter(s => s !== skill)
  else if (picked.length < count) selectedExpertise.value = [...picked, skill]
}

function confirmExpertise() {
  resolvedChoices.value.push({ type: 'RESOLVED_EXPERTISE', skills: [...selectedExpertise.value] })
  selectedExpertise.value = []
  nextChoice()
}

function confirmSkills() {
  resolvedChoices.value.push({ type: 'RESOLVED_SKILL', skills: [...selectedSkills.value] })
  selectedSkills.value = []
  nextChoice()
}

/**
 * The options still open for the current choice.
 *
 * The service already drops options taken on an earlier level. Two picks from the same pool
 * on the *same* level (Metamagic at 3rd, Eldritch Invocations at 2nd) are two choices in one
 * wizard run, and nothing is stored until the run is applied, so the second prompt has to
 * exclude what the first one just took.
 */
const availableOptions = computed(() => {
  const choiceEvent = currentChoice.value as ChooseOptionEvent | null
  if (!choiceEvent || choiceEvent.type !== 'CHOOSE_OPTION') return []

  // An option can open later than the pool that offers it.
  const classLevel = projectedClasses.value
    .find(c => c.classId === targetClassId.value)?.level ?? targetLevel.value
  const unlocked = choiceEvent.options.filter(o => !o.minLevel || o.minLevel <= classLevel)
  if (!choiceEvent.group) return unlocked

  const groupOf = (choiceId: string) => choiceEvents.value
    .find((e): e is ChooseOptionEvent => e.type === 'CHOOSE_OPTION' && e.id === choiceId)
    ?.group
  const takenThisRun = new Set(
    resolvedChoices.value
      .filter(c => c.type === 'RESOLVED_OPTION' && groupOf(c.choiceId) === choiceEvent.group)
      .map(c => (c as { optionId: string }).optionId),
  )
  const taken = new Set([...takenThisRun, ...takenInGroup(choiceEvent.group)])
  return unlocked.filter(o => !taken.has(o.id))
})

/**
 * What earlier level-ups already took from a shared pool.
 *
 * The run-local check alone was enough while a pool was picked from twice on one
 * level; an artificer's twelve infusions are picked across five levels, so a pick made
 * at 2nd has to be off the table at 6th. The stored answer is keyed by the individual
 * choice id, so the group each id belongs to is looked back up in the pack.
 */
function takenInGroup(group: string): string[] {
  if (!character.value?.chosenOptions) return []
  const pack = mergedPack()
  const groupById = new Map<string, string>()
  const scan = (levels: Array<{ levelUpEvents?: LevelUpEventDef[] }> | undefined) => {
    for (const lvl of levels ?? []) {
      for (const def of lvl.levelUpEvents ?? []) {
        if (def.type === 'CHOOSE_OPTION' && def.group) groupById.set(def.id, def.group)
      }
    }
  }
  for (const cls of pack.classes) {
    scan(cls.levels)
    for (const sub of cls.subclasses ?? []) scan(sub.levels)
  }
  return Object.entries(character.value.chosenOptions)
    .filter(([choiceId]) => groupById.get(choiceId) === group)
    .map(([, optionId]) => optionId)
}

/**
 * How a resolved option reads on the summary. The picks were missing from it entirely,
 * so a sorcerer confirmed two Metamagic options without seeing either.
 */
function optionSummary(choiceId: string, optionId: string): string {
  const event = choiceEvents.value
    .find((e): e is ChooseOptionEvent => e.type === 'CHOOSE_OPTION' && e.id === choiceId)
  const name = event?.options.find(o => o.id === optionId)?.name ?? optionId
  const label = (event?.label ?? choiceId).replace(/^Choose (a|an|your|the) /i, '')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${name}`
}

function confirmOption() {
  const choiceEvent = currentChoice.value as ChooseOptionEvent
  if (!selectedOptionId.value) return
  const optionId = selectedOptionId.value
  resolvedChoices.value.push({ type: 'RESOLVED_OPTION', choiceId: choiceEvent.id, optionId })
  selectedOptionId.value = ''
  queueUnlockedChoices(choiceEvent.id, optionId)
  nextChoice()
}

/**
 * The run's second stage. A guarded grant can be replayed once its option is answered,
 * but a guarded *question* has to be asked — and by the time the option is answered the
 * list of questions has already been built. So the answer reopens it: whatever the pick
 * unlocked is appended and visited by the steps that follow.
 *
 * Magic Initiate is the shape: pick a class, then pick that class's cantrips.
 */
function queueUnlockedChoices(choiceId: string, optionId: string) {
  if (!character.value) return
  // Neither the subclass nor the feat is on the character yet — both live in this run's
  // resolved choices until it is applied.
  const subclassId = resolvedChoices.value
    .find((c): c is Extract<ResolvedChoice, { type: 'RESOLVED_SUBCLASS' }> =>
      c.type === 'RESOLVED_SUBCLASS' && c.classId === targetClassId.value)
    ?.subclassId
  const feats = resolvedChoices.value
    .filter((c): c is Extract<ResolvedChoice, { type: 'RESOLVED_CHOOSE_FEAT' }> =>
      c.type === 'RESOLVED_CHOOSE_FEAT')
    .map(c => rulepackStore.getFeat(c.featId) as FeatDefinition | undefined)
    .filter((f): f is FeatDefinition => !!f)

  const unlocked = resolveUnlockedChoices(
    toRaw(character.value),
    { choiceId, optionId },
    targetClassId.value,
    targetLevel.value,
    mergedPack(),
    { subclassId, feats },
  )
  if (unlocked.length > 0) {
    choiceEvents.value.splice(currentChoiceIdx.value + 1, 0, ...unlocked)
  }
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

// ── Search ────────────────────────────────────────────────────────────────────
// Every long pick-list in the wizard gets a filter box: the feat and spell lists run
// to hundreds of entries with a few sourcebooks loaded, and a warlock picking from
// two dozen invocations was scrolling blind. Each list keeps its own query, and all
// of them reset when the wizard moves on so a filter never carries into the next
// question.
const featSearch = ref('')
const spellSearch = ref('')
const subclassSearch = ref('')
const optionSearch = ref('')
const optionalFeatureSearch = ref('')
const multiclassSearch = ref('')

const filteredFeats = computed(() => filterBySearch(allFeats.value, featSearch.value,
  f => [f.name, f.sourceName, f.description, f.prerequisite]))

const filteredSpells = computed(() => filterBySearch(availableSpells.value, spellSearch.value,
  s => [s.name, s.school, s.castingTime, s.sourceName, s.level === 0 ? 'cantrip' : `level ${s.level}`]))

const filteredSubclasses = computed(() => filterBySearch(availableSubclasses.value, subclassSearch.value,
  sub => [sub.name, sub.description]))

const filteredOptions = computed(() => filterBySearch(availableOptions.value, optionSearch.value,
  o => [o.name, o.description]))

/** The optional features on offer live on the event rather than in a store getter. */
const offeredOptionalFeatures = computed(() =>
  (currentChoice.value?.type === 'OFFER_OPTIONAL_FEATURES'
    ? (currentChoice.value as OfferOptionalFeaturesEvent).features
    : []))

const filteredOptionalFeatures = computed(() =>
  filterBySearch(offeredOptionalFeatures.value, optionalFeatureSearch.value,
    f => [f.name, f.description, f.sourceName, f.replaces]))

const filteredMulticlassChoices = computed(() => filterBySearch(multiclassChoices.value, multiclassSearch.value,
  o => [o.classDef.name, ...o.classDef.primaryAbility]))

/** A query answered one question is meaningless in the next. */
watch(currentChoiceIdx, () => {
  featSearch.value = ''
  spellSearch.value = ''
  subclassSearch.value = ''
  optionSearch.value = ''
  optionalFeatureSearch.value = ''
})

function confirmSubclass() {
  if (!selectedSubclassId.value) return
  const subclassId = selectedSubclassId.value
  resolvedChoices.value.push({ type: 'RESOLVED_SUBCLASS', subclassId, classId: targetClassId.value })
  selectedSubclassId.value = ''

  // Inject subclass-level choice events for this level now that we know the subclass
  const pack = mergedPack()
  const subclassDef = pack.classes.flatMap(c => c.subclasses ?? []).find(s => s.id === subclassId)
  const subclassLevelDef = subclassDef?.levels.find(l => l.level === targetLevel.value)
  const injected: ChoiceLevelUpEvent[] = []
  for (const eventDef of subclassLevelDef?.levelUpEvents ?? []) {
    if (eventDef.type === 'CHOOSE_OPTION') {
      // Through the service, so an option already taken from the same pool is dropped here
      // too rather than only on the paths that go via resolveLevelUpEvents.
      const choice = character.value
        ? resolveOptionChoice(eventDef, toRaw(character.value), pack)
        : undefined
      if (choice) injected.push(choice)
    }
    else if (eventDef.type === 'CHOOSE_SPELL') {
      // Through the service, like the CHOOSE_OPTION above. Hand-building it here
      // dropped the whenOption guard — so a subclass shaped like Divine Soul asked
      // every one of its guarded spell questions at once — along with the free-cast
      // terms and the source metadata a pick has to carry to the answer.
      const choice = character.value
        ? chooseSpellEvent(eventDef, toRaw(character.value), {
            addTo: eventDef.addTo || targetClassId.value,
            label: subclassDef?.name,
          })
        : undefined
      if (choice) injected.push(choice)
    }
    else if (eventDef.type === 'ABILITY_SCORE_IMPROVEMENT')
      injected.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
  }
  if (injected.length > 0)
    choiceEvents.value.splice(currentChoiceIdx.value + 1, 0, ...injected)

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

  const pack = mergedPack()

  // Apply automatic events (toRaw strips the Vue Proxy so structuredClone can clone it)
  let updated = applyAutomaticEvents(toRaw(character.value), automaticEvents.value, hpChoice.value, hpChoice.value === 'manual' ? manualHp.value : undefined)

  // Bump the class level, or add the class when this is a first level in it. Without the
  // append a multiclass level-up silently did nothing: map() only touches existing entries.
  updated = {
    ...updated,
    classes: projectClassLevel(updated.classes, targetClassId.value, targetLevel.value),
  }

  // Apply resolved choices
  updated = applyResolvedChoices(updated, resolvedChoices.value, pack)

  // Slots are derived from the classes, so the base may have moved; keep `used` in range.
  updated = { ...updated, spellSlots: clampSpellSlots(updated, mergedPack()) }

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

// True when this level-up is the character's very first level (not multiclassing into a new class)
const isFirstCharacterLevel = computed(() => {
  if (!character.value) return false
  if (targetLevel.value !== 1) return false
  return character.value.classes
    .filter(c => c.classId !== targetClassId.value)
    .every(c => c.level === 0)
})

watch(isFirstCharacterLevel, (val) => {
  if (val) hpChoice.value = 'max'
}, { immediate: true })
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
            v-for="cls in character.classes.filter(c => c.level > 0)"
            :key="cls.classId"
            class="card w-full text-left hover:border-primary-500/50 transition-colors"
            @click="selectClass(cls.classId)"
          >
            <p class="font-semibold text-white">{{ rulepackStore.getClass(cls.classId)?.name ?? cls.classId }}</p>
            <p class="text-sm text-slate-400">Level {{ cls.level }} → {{ cls.level + 1 }}</p>
          </button>
        </div>

        <!-- Multiclassing: behind a toggle, since levelling an existing class is the common case -->
        <div v-if="multiclassChoices.length > 0" class="mt-4">
          <button
            class="text-sm text-primary-400 hover:text-primary-300"
            @click="showMulticlass = !showMulticlass"
          >
            {{ showMulticlass ? '−' : '+' }} Take a level in a new class
          </button>

          <div v-if="showMulticlass" class="space-y-2 mt-2">
            <p class="text-xs text-slate-500">
              Multiclassing grants a reduced set of proficiencies and never saving throws.
            </p>
            <SearchBox
              v-if="multiclassChoices.length > 6"
              v-model="multiclassSearch"
              placeholder="Search classes…"
              :matches="filteredMulticlassChoices.length"
              :total="multiclassChoices.length"
            />
            <button
              v-for="opt in filteredMulticlassChoices"
              :key="opt.classDef.id"
              class="card w-full text-left transition-colors"
              :class="opt.eligibility.eligible
                ? 'hover:border-primary-500/50'
                : 'border-accent-500/40 hover:border-accent-500/70'"
              @click="selectNewClass(opt.classDef.id)"
            >
              <div class="flex items-baseline justify-between gap-2">
                <p class="font-semibold text-white">{{ opt.classDef.name }}</p>
                <span class="text-xs text-slate-500">Level 0 → 1</span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Requires {{ prerequisiteText(opt.classDef.id) }}
              </p>
              <!-- Warn rather than block: variant rules and DM rulings are common -->
              <p v-if="!opt.eligibility.eligible" class="text-xs text-accent-400 mt-1">
                ⚠ Prerequisite not met —
                <span v-for="(u, i) in opt.eligibility.unmet" :key="u.ability">
                  <template v-if="i > 0"> / </template>{{ u.ability.toUpperCase() }} {{ u.actual }} of {{ u.minimum }}
                </span>. You can still proceed.
              </p>
            </button>
          </div>
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
            <SearchBox
              v-if="allFeats.length > 6"
              v-model="featSearch"
              class="mb-2"
              placeholder="Search feats…"
              :matches="filteredFeats.length"
              :total="allFeats.length"
            />
            <div class="space-y-2 max-h-72 overflow-y-auto">
              <button
                v-for="feat in filteredFeats"
                :key="feat.id"
                class="card w-full text-left transition-colors hover:border-primary-500/50"
                :class="selectedFeatId === feat.id ? 'border-primary-500 bg-primary-900/20' : ''"
                @click="selectedFeatId = feat.id; featAsiChoice = {}"
              >
                <p class="text-sm font-semibold text-white">{{ feat.name }}</p>
                <p class="text-[10px] text-slate-500">{{ feat.sourceName }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ feat.description.slice(0, 100) }}…</p>
                <p v-if="feat.prerequisite" class="text-xs mt-0.5" :class="checkFeatPrerequisite(character!, feat as FeatDefinition) ? 'text-slate-500' : 'text-red-400 font-medium'">Req: {{ feat.prerequisite }}</p>
              </button>
              <p v-if="filteredFeats.length === 0" class="text-slate-500 text-sm text-center py-4">Nothing matches “{{ featSearch }}”.</p>
            </div>
            <!-- Ability score choice for selected feat -->
            <AbilityScoreChoicePicker
              v-if="selectedFeatChoice"
              v-model="featAsiChoice"
              class="mt-3"
              :choice="selectedFeatChoice"
              :base-scores="character!.abilityScores"
            />
          </template>

          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="asiFeatMode
                ? !selectedFeatId || !isChoiceSatisfied(selectedFeatChoice, featAsiChoice)
                : asiPointsUsed < asiPoints"
              @click="confirmASI"
            >Confirm</button>
          </div>
        </template>

        <!-- Choose Spell -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SPELL'">
          <h2 class="font-semibold text-white text-lg">Choose {{ currentChoice.count }} {{ currentChoice.cantrip ? 'Cantrip' : 'Spell' }}{{ currentChoice.count > 1 ? 's' : '' }}</h2>
          <p class="text-sm text-slate-400 mb-2">{{ spellSelections.length }}/{{ currentChoice.count }} selected</p>
          <SearchBox
            v-if="availableSpells.length > 6"
            v-model="spellSearch"
            class="mb-2"
            placeholder="Search by name, school or casting time…"
            :matches="filteredSpells.length"
            :total="availableSpells.length"
          />
          <div class="space-y-1.5 max-h-80 overflow-y-auto">
            <button
              v-for="spell in filteredSpells"
              :key="spell.id"
              class="card w-full text-left text-sm py-2 hover:border-primary-500/50 transition-colors"
              :class="spellSelections.includes(spell.id) ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="toggleSpell(spell.id)"
            >
              <span class="font-medium text-white">{{ spell.name }}</span>
              <span class="text-slate-500 ml-2 text-xs">{{ spell.school }} · {{ spell.castingTime }} · {{ spell.sourceName }}</span>
            </button>
            <p v-if="filteredSpells.length === 0" class="text-slate-500 text-sm text-center py-4">Nothing matches “{{ spellSearch }}”.</p>
          </div>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button class="btn-primary flex-1 text-sm" :disabled="spellSelections.length === 0" @click="confirmSpells">Confirm</button>
          </div>
        </template>

        <!-- Choose Feat -->
        <template v-else-if="currentChoice.type === 'CHOOSE_FEAT'">
          <h2 class="font-semibold text-white text-lg">Choose a Feat</h2>
          <SearchBox
            v-if="allFeats.length > 6"
            v-model="featSearch"
            class="my-2"
            placeholder="Search feats…"
            :matches="filteredFeats.length"
            :total="allFeats.length"
          />
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <button
              v-for="feat in filteredFeats"
              :key="feat.id"
              class="card w-full text-left transition-colors hover:border-primary-500/50"
              :class="selectedFeatId === feat.id ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="selectedFeatId = feat.id; featAsiChoice = {}"
            >
              <p class="text-sm font-semibold text-white">{{ feat.name }}</p>
              <p class="text-[10px] text-slate-500">{{ feat.sourceName }}</p>
              <p class="text-xs text-slate-400 mt-0.5">{{ feat.description.slice(0, 120) }}…</p>
              <p v-if="feat.prerequisite" class="text-xs mt-0.5" :class="checkFeatPrerequisite(character!, feat as FeatDefinition) ? 'text-slate-500' : 'text-red-400 font-medium'">Prerequisite: {{ feat.prerequisite }}</p>
            </button>
            <p v-if="filteredFeats.length === 0" class="text-slate-500 text-sm text-center py-4">Nothing matches “{{ featSearch }}”.</p>
          </div>
          <!-- Ability score choice for selected feat -->
          <AbilityScoreChoicePicker
            v-if="selectedFeatChoice"
            v-model="featAsiChoice"
            class="mt-3"
            :choice="selectedFeatChoice"
            :base-scores="character!.abilityScores"
          />
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="!selectedFeatId || !isChoiceSatisfied(selectedFeatChoice, featAsiChoice)"
              @click="confirmFeat"
            >Confirm</button>
          </div>
        </template>

        <!-- Choose Subclass -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SUBCLASS'">
          <h2 class="font-semibold text-white text-lg">{{ (currentChoice as ChooseSubclassEvent).label }}</h2>
          <SearchBox
            v-if="availableSubclasses.length > 6"
            v-model="subclassSearch"
            class="my-2"
            placeholder="Search subclasses…"
            :matches="filteredSubclasses.length"
            :total="availableSubclasses.length"
          />
          <div v-if="filteredSubclasses.length > 0" class="space-y-2 max-h-[28rem] overflow-y-auto">
            <button
              v-for="sub in filteredSubclasses"
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
            <template v-if="availableSubclasses.length === 0">No subclasses available in the loaded rulepacks.</template>
            <template v-else>Nothing matches “{{ subclassSearch }}”.</template>
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

        <!-- Choose Option (e.g. Totem Spirit) -->
        <template v-else-if="currentChoice.type === 'CHOOSE_OPTION'">
          <h2 class="font-semibold text-white text-lg">{{ (currentChoice as ChooseOptionEvent).label }}</h2>
          <SearchBox
            v-if="availableOptions.length > 6"
            v-model="optionSearch"
            class="mt-2"
            placeholder="Search options…"
            :matches="filteredOptions.length"
            :total="availableOptions.length"
          />
          <div class="space-y-2 mt-3">
            <button
              v-for="opt in filteredOptions"
              :key="opt.id"
              class="card w-full text-left hover:border-primary-500/50 transition-colors"
              :class="selectedOptionId === opt.id ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="selectedOptionId = opt.id"
            >
              <p class="font-semibold text-white">{{ opt.name }}</p>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">{{ opt.description }}</p>
            </button>
            <p v-if="availableOptions.length && filteredOptions.length === 0" class="text-slate-500 text-sm text-center py-4">
              Nothing matches “{{ optionSearch }}”.
            </p>
          </div>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button class="btn-primary flex-1 text-sm" :disabled="!selectedOptionId" @click="confirmOption">Confirm</button>
          </div>
        </template>

        <!-- Expertise -->
        <!-- Spellcasting ability, for a source that leaves it to the player -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SPELLCASTING_ABILITY'">
          <h2 class="font-semibold text-white text-lg">
            {{ (currentChoice as ChooseSpellcastingAbilityEvent).label ?? 'Spellcasting Ability' }}
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Which ability casts these spells? This sets their save DC and attack bonus.
          </p>
          <div class="grid grid-cols-3 gap-2 mt-3">
            <button
              v-for="key in (currentChoice as ChooseSpellcastingAbilityEvent).from"
              :key="key"
              class="card text-center transition-colors"
              :class="selectedCastingAbility === key ? 'border-primary-500 bg-primary-900/20' : 'hover:border-primary-500/50'"
              @click="selectedCastingAbility = key"
            >
              <span class="block text-xs text-slate-400">{{ ABILITY_LABELS[key] }}</span>
              <span class="block text-lg font-bold text-white">{{ character!.abilityScores[key] ?? 10 }}</span>
              <span class="block text-[10px] text-slate-500">
                DC {{ castingAbilityPreview(key).saveDC }} ·
                {{ castingAbilityPreview(key).attack >= 0 ? '+' : '' }}{{ castingAbilityPreview(key).attack }} atk
              </span>
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="!selectedCastingAbility"
              @click="confirmCastingAbility"
            >Confirm</button>
          </div>
        </template>

        <template v-else-if="currentChoice.type === 'CHOOSE_EXPERTISE'">
          <h2 class="font-semibold text-white text-lg">{{ (currentChoice as ChooseExpertiseEvent).label }}</h2>
          <p class="text-xs text-slate-500 mt-1">
            {{ selectedExpertise.length }}/{{ (currentChoice as ChooseExpertiseEvent).count }} selected
            · doubles your proficiency bonus for the chosen skills
          </p>
          <div
            v-if="expertiseCandidates((currentChoice as ChooseExpertiseEvent).options).length === 0"
            class="text-sm text-slate-500 py-4 text-center"
          >
            No eligible skills — expertise applies only to skills you are already proficient in.
          </div>
          <div v-else class="grid grid-cols-2 gap-2 mt-3">
            <button
              v-for="skill in expertiseCandidates((currentChoice as ChooseExpertiseEvent).options)"
              :key="skill"
              class="card text-left text-sm transition-colors"
              :class="selectedExpertise.includes(skill) ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="toggleExpertise(skill, (currentChoice as ChooseExpertiseEvent).count)"
            >
              <span class="text-white">{{ SKILL_LABELS[skill] ?? skill }}</span>
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="selectedExpertise.length !== (currentChoice as ChooseExpertiseEvent).count"
              @click="confirmExpertise"
            >Confirm</button>
          </div>
        </template>

        <!-- Skill choice (multiclass proficiency) -->
        <template v-else-if="currentChoice.type === 'CHOOSE_SKILL'">
          <h2 class="font-semibold text-white text-lg">
            Choose {{ (currentChoice as ChooseSkillEvent).count }}
            {{ (currentChoice as ChooseSkillEvent).count === 1 ? 'Skill' : 'Skills' }}
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            {{ selectedSkills.length }}/{{ (currentChoice as ChooseSkillEvent).count }} selected
          </p>
          <div class="grid grid-cols-2 gap-2 mt-3">
            <button
              v-for="skill in (currentChoice as ChooseSkillEvent).from"
              :key="skill"
              class="card text-left text-sm transition-colors disabled:opacity-40"
              :class="selectedSkills.includes(skill) ? 'border-primary-500 bg-primary-900/20' : ''"
              :disabled="alreadyProficient(skill)"
              :title="alreadyProficient(skill) ? 'Already proficient' : ''"
              @click="toggleSkill(skill, (currentChoice as ChooseSkillEvent).count)"
            >
              <span class="text-white">{{ SKILL_LABELS[skill] ?? skill }}</span>
              <span v-if="alreadyProficient(skill)" class="block text-[10px] text-slate-500">already proficient</span>
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn-ghost flex-1 text-sm" @click="skipChoice">Skip</button>
            <button
              class="btn-primary flex-1 text-sm"
              :disabled="selectedSkills.length !== (currentChoice as ChooseSkillEvent).count"
              @click="confirmSkills"
            >Confirm</button>
          </div>
        </template>

        <!-- Optional Features -->
        <template v-else-if="currentChoice.type === 'OFFER_OPTIONAL_FEATURES'">
          <h2 class="font-semibold text-white text-lg">Optional Class Features</h2>
          <p class="text-sm text-slate-400 mb-2">These optional features are available from your loaded rulepacks. Toggle any you'd like to take.</p>
          <SearchBox
            v-if="offeredOptionalFeatures.length > 6"
            v-model="optionalFeatureSearch"
            class="mb-2"
            placeholder="Search optional features…"
            :matches="filteredOptionalFeatures.length"
            :total="offeredOptionalFeatures.length"
          />
          <div class="space-y-2 max-h-[28rem] overflow-y-auto">
            <div
              v-for="feat in filteredOptionalFeatures"
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

        <!-- HP gain: first character level always gets max, no choice needed -->
        <div v-if="addHpEvent && isFirstCharacterLevel" class="card space-y-2">
          <p class="section-header">Hit Points</p>
          <p class="text-xs text-slate-400">You gain maximum hit points at 1st level.</p>
          <p class="text-2xl font-bold text-white">+{{ Math.max(1, addHpEvent.max + addHpEvent.conBonus + addHpEvent.hpFlatBonus) }}</p>
        </div>

        <!-- HP gain: multiclass or higher levels — player chooses -->
        <div v-if="addHpEvent && !isFirstCharacterLevel" class="card space-y-3">
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
              <span v-else-if="choice.type === 'RESOLVED_SPELLCASTING_ABILITY'">
                {{ choice.label ?? 'Spellcasting' }} ability: {{ ABILITY_LABELS[choice.ability] }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_SUBCLASS'">
                Subclass: {{ choice.subclassId }}
              </span>
              <span v-else-if="choice.type === 'RESOLVED_OPTION'">
                {{ optionSummary(choice.choiceId, choice.optionId) }}
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
