import type { Character, AbilityKey, Feature, SkillKey, SpellcastingOrigin, SpellSlotLevel } from '~/types/character'
import type {
  Rulepack,
  OptionalClassFeature,
  FeatDefinition,
  FeatPrerequisite,
  LevelUpEventDef,
  SpellAbilityRef,
} from '~/types/rulepack'
import { addHitDieForClass, multiclassProficiencies } from '~/services/multiclass'
import type {
  LevelUpEvent,
  AutomaticLevelUpEvent,
  ChoiceLevelUpEvent,
  AddHpEvent,
  AddFeatureEvent,
  GainProficiencyEvent,
  UpdateSpellSlotsEvent,
  UpdateWarlockSlotsEvent,
  UpdateHitDieEvent,
  SetSpellcastingAbilityEvent,
  ChooseExpertiseEvent,
  ChooseSkillEvent,
  ChooseOptionEvent,
  PoolOption,
  ReplaceOptionEvent,
  ChooseSpellEvent,
  ChooseSpellcastingAbilityEvent,
  GrantSpellcastingEvent,
  ExpandSpellListEvent,
  UpdateFeatureUsesEvent,
  GrantSpellsEvent,
  SetWildShapeLimitsEvent,
  SetSpeedEvent,
  ResolvedChoice,
} from '~/types/events'

/**
 * Every skill, the fallback for a `CHOOSE_SKILL` that names no list: "two skills of your
 * choice" is the printed wording for the half-elf, Skilled and most race grants, and
 * restating all eighteen in every pack that says it would be noise.
 */
const ALL_SKILL_KEYS: SkillKey[] = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleightOfHand',
  'stealth', 'survival',
]

/**
 * The skill question, unless it is guarded by an option the character has not picked.
 *
 * Guarded the same way a GRANT_SPELLS is, and with the same ordering caveat: a choice
 * answered during this very run is not on the character yet, so `resolveUnlockedChoices`
 * re-asks for it once the option is confirmed.
 *
 * The list is copied, not aliased: the runtime event is stored, and ALL_SKILL_KEYS is shared.
 */
function chooseSkillEvent(
  def: Extract<LevelUpEventDef, { type: 'CHOOSE_SKILL' }>,
  character: Character,
): ChooseSkillEvent | undefined {
  if (def.whenOption
    && character.chosenOptions?.[def.whenOption.choiceId] !== def.whenOption.optionId) {
    return undefined
  }
  return { type: 'CHOOSE_SKILL', count: def.count, from: [...(def.from ?? ALL_SKILL_KEYS)] }
}

/**
 * The proficiency, unless an option the character has not picked guards it. Same gate,
 * and same ordering caveat, as a guarded spell grant: an answer given during this run is
 * applied by RESOLVED_OPTION instead.
 */
function gainProficiencyEvent(
  def: Extract<LevelUpEventDef, { type: 'GAIN_PROFICIENCY' }>,
  character: Character,
): GainProficiencyEvent | undefined {
  if (def.whenOption
    && character.chosenOptions?.[def.whenOption.choiceId] !== def.whenOption.optionId) {
    return undefined
  }
  // The category is 'skill' at every def-driven call site and nothing reads it.
  return { type: 'GAIN_PROFICIENCY', proficiency: def.proficiency, category: 'skill' }
}

/** The speed, unless an option the character has not picked guards it. */
function setSpeedEvent(
  def: Extract<LevelUpEventDef, { type: 'SET_SPEED' }>,
  character: Character,
): SetSpeedEvent | undefined {
  if (def.whenOption
    && character.chosenOptions?.[def.whenOption.choiceId] !== def.whenOption.optionId) {
    return undefined
  }
  return { type: 'SET_SPEED', mode: def.mode, speed: def.speed }
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Whether a character satisfies every machine-checkable prerequisite of a feat. True for
 * a feat that declares none.
 *
 * Tolerant of a partial character on purpose. This runs from the feat picker inside a
 * `v-for` over every loaded feat, so a field a stored record happens to be missing threw
 * out of the render and left the list blank — losing the whole step over one absent
 * array. A missing field now reads as "not satisfied", which greys one feat out and is
 * recoverable. Prerequisites from a pack are read the same way: Zod guards the import
 * boundary, but a pack assembled in code never passes through it.
 */
export function checkFeatPrerequisite(character: Character, feat: FeatDefinition): boolean {
  const check: FeatPrerequisite | undefined = feat.prerequisiteCheck
  if (!check) return true

  if (check.minAbilityScore) {
    const scores = character.abilityScores ?? {}
    for (const [ability, min] of Object.entries(check.minAbilityScore)) {
      if ((scores[ability as AbilityKey] ?? 0) < (min ?? 0)) return false
    }
  }

  if (check.spellcasting && !character.spellcastingAbility) return false

  // An empty list is no requirement at all. Read as a list of alternatives it was one
  // nothing could satisfy, which hid the feat for good.
  if (Array.isArray(check.proficiency) && check.proficiency.length > 0) {
    const held = new Set(
      (character.otherProficiencies ?? []).map(p => String(p).toLowerCase()),
    )
    if (!check.proficiency.some(p => held.has(String(p).toLowerCase()))) return false
  }

  return true
}

// Feature names in class level tables that are placeholders for subclass features
const SUBCLASS_PLACEHOLDER_PATTERN = /\bpath\b|\barchetype\b|\bpatron\b|\bcircle\b|\bdomain\b|\bcollege\b|\bprimal path feature\b|\bsacred oath feature\b|\bwarlord presence\b| feature$/i

function isSubclassPlaceholder(featureName: string): boolean {
  return SUBCLASS_PLACEHOLDER_PATTERN.test(featureName)
}

function parseDieSides(die: string): number {
  const match = die.match(/d(\d+)/)
  return (match && match[1]) ? parseInt(match[1]) : 8
}

/** Turn spell ids into the denormalized shape a GRANT_SPELLS event carries. */
function resolveGrantedSpells(spellIds: string[], rulepack: Rulepack) {
  return spellIds
    .map(id => rulepack.spells.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map(s => ({ spellId: s.id, name: s.name, level: s.level }))
}

interface GrantSource {
  ability?: AbilityKey
  origin?: SpellcastingOrigin
  label?: string
  uses?: { max: number; recharge: 'short' | 'long' | 'dawn' }
  cost?: { resource: string; amount: number }
  castAtLevel?: number
}

/**
 * Add granted spells to a character in place, skipping ones already known.
 *
 * When the grant names its own ability the source is registered in classSpellcasting,
 * so a race or background gets its own DC rather than borrowing a class's.
 */
function grantSpellsTo(
  character: Character,
  addTo: string,
  spells: Array<{ spellId: string; name: string; level: number }>,
  alwaysPrepared: boolean,
  source: GrantSource = {},
): void {
  // Through registerSpellcasting rather than writing the entry here: it is the one
  // place that leaves an ability the player chose alone, which a grant must not undo.
  if (source.ability) registerSpellcasting(character, addTo, source.ability, source)

  for (const spell of spells) {
    const existing = character.spells.find(s => s.spellId === spell.spellId)
    if (existing) {
      if (alwaysPrepared) {
        existing.alwaysPrepared = true
        existing.prepared = true
      }
      continue
    }
    character.spells.push({
      id: crypto.randomUUID(),
      spellId: spell.spellId,
      name: spell.name,
      level: spell.level,
      prepared: alwaysPrepared || spell.level === 0,
      alwaysPrepared: alwaysPrepared || undefined,
      classId: addTo,
      // A free cast arrives with its uses full
      ...(source.uses ? { uses: { ...source.uses, remaining: source.uses.max } } : {}),
      // A resource-metered cast has no pool of its own: the feature it names holds it
      ...(source.cost ? { cost: { ...source.cost } } : {}),
      ...(source.castAtLevel ? { castAtLevel: source.castAtLevel } : {}),
    })
  }
}

/**
 * Record a spellcasting source on a character, in place.
 *
 * An ability the player chose wins over one the source states, so replaying this on a
 * later level-up — or on the level where the subclass is picked — cannot overwrite it.
 * Slots are never touched: they stay derived from the class or subclass table.
 */
function registerSpellcasting(
  character: Character,
  addTo: string,
  ability: AbilityKey,
  source: { origin?: SpellcastingOrigin; label?: string } = {},
): void {
  const existing = character.classSpellcasting?.[addTo]
  const label = source.label ?? existing?.label
  character.classSpellcasting = {
    ...character.classSpellcasting,
    [addTo]: {
      ...existing,
      ability: existing?.abilityChosen ? existing.ability : ability,
      origin: source.origin ?? existing?.origin ?? 'class',
      ...(label ? { label } : {}),
      spells: existing?.spells ?? [],
    },
  }
}

type ChooseOptionDefEvent = Extract<LevelUpEventDef, { type: 'CHOOSE_OPTION' }>

/** Every CHOOSE_OPTION definition anywhere in a pack, so a stored answer can be traced. */
function allOptionChoices(rulepack: Rulepack): ChooseOptionDefEvent[] {
  const out: ChooseOptionDefEvent[] = []
  const collect = (defs: LevelUpEventDef[] | undefined) => {
    for (const def of defs ?? []) if (def.type === 'CHOOSE_OPTION') out.push(def)
  }
  for (const cls of rulepack.classes) {
    for (const level of cls.levels) collect(level.levelUpEvents)
    for (const sub of cls.subclasses ?? []) {
      for (const level of sub.levels) collect(level.levelUpEvents)
    }
  }
  for (const source of [...rulepack.races, ...rulepack.backgrounds]) {
    for (const level of source.levelUpEvents ?? []) collect(level.levelUpEvents)
  }
  for (const race of rulepack.races) {
    for (const sub of race.subraces ?? []) {
      for (const level of sub.levelUpEvents ?? []) collect(level.levelUpEvents)
    }
  }
  return out
}

/**
 * Whether an option's prerequisites are met.
 *
 * An option can be gated on three things, and the SRD's Eldritch Invocations use all
 * three: a level (Thirsting Blade at 5th), another choice's answer (Pact of the Blade),
 * and a spell the option modifies (Agonizing Blast needs eldritch blast). Without this
 * every prompt offered the whole pool, so a 2nd-level warlock could take Lifedrinker.
 *
 * `level` is the level in the class that opened the pool, since a class's gates are
 * written against its own table, not the character's total.
 *
 * Everything is read off the character, so a caller mid-level-up — where the answer to a
 * gate is not stored yet — passes a character projected to include this run's picks.
 */
export function optionAvailable(
  option: PoolOption,
  character: Character,
  level: number,
): boolean {
  if (option.minLevel && level < option.minLevel) return false
  if (option.requiresOption) {
    const { choiceId, optionId } = option.requiresOption
    if (character.chosenOptions?.[choiceId] !== optionId) return false
  }
  if (option.requiresSpell) {
    if (!(character.spells ?? []).some(sp => sp.spellId === option.requiresSpell)) return false
  }
  return true
}

/** Total level across every class, the yardstick for a race's or feat's own pools. */
function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0)
}

/** The choice ids that draw from one shared pool, in the order the pack declares them. */
function choiceIdsInGroup(rulepack: Rulepack, group: string): string[] {
  return allOptionChoices(rulepack).filter(d => d.group === group).map(d => d.id)
}

/**
 * Options another pack contributes to a pool, from `rulepack.optionPools`.
 *
 * A sourcebook's Eldritch Invocations cannot live on the warlock's own CHOOSE_OPTION
 * lists — those are printed inline in the SRD pack, and a fragment touching them would
 * have to redeclare the class. So a book names the pool instead and its options are
 * unioned in here, at every point the pool is read: the pick itself, the retraining
 * offer, and the feature a pick is worth on the sheet.
 *
 * Matched on `group` when the choice has one, and on the choice's own id otherwise, so a
 * book can also widen a single ungrouped choice — Tasha's adds Pact of the Talisman to
 * the SRD warlock's `pact-boon`.
 */
/**
 * Options as a player reads them: by name.
 *
 * A pack's own list is already alphabetical, but a patched-in option would otherwise land
 * wherever the union happened to append it — Tasha's invocations in a block after
 * Witch Sight rather than filed among the rest. Sorting at the point of offer is the same
 * rule the store's `getAll*` getters follow: merging a book in never reshuffles a list.
 */
function byName(options: PoolOption[]): PoolOption[] {
  return [...options].sort((a, b) => a.name.localeCompare(b.name))
}

function poolExtras(rulepack: Rulepack, group?: string, choiceId?: string): PoolOption[] {
  const out: PoolOption[] = []
  for (const pool of rulepack.optionPools ?? []) {
    const matches = (group !== undefined && pool.group === group)
      || (choiceId !== undefined && pool.choiceId === choiceId)
    if (matches) out.push(...pool.options)
  }
  return out
}

/**
 * Every option the pool offers, deduplicated by id.
 *
 * Each pick in a group repeats the whole list, so any one of them would do — except that
 * a pack is free to widen the list on a later pick, and a replacement offer has to know
 * about everything the pool can hold.
 */
function optionsInGroup(rulepack: Rulepack, group: string): PoolOption[] {
  const byId = new Map<string, PoolOption>()
  for (const def of allOptionChoices(rulepack)) {
    if (def.group !== group) continue
    for (const option of def.options) if (!byId.has(option.id)) byId.set(option.id, option)
  }
  for (const option of poolExtras(rulepack, group)) {
    if (!byId.has(option.id)) byId.set(option.id, option)
  }
  return byName([...byId.values()])
}

/**
 * Translates a CHOOSE_OPTION definition, dropping options the character cannot take —
 * whether because a prerequisite is unmet or because they already took it from the same
 * pool.
 *
 * Metamagic, Eldritch Invocations and Fighting Style are each picked more than once from
 * one list, and the SRD forbids taking an option twice. Each pick is a separate choice with
 * its own id (`metamagic-1`, `metamagic-2`, …) because a choice answers exactly one option,
 * so nothing tied them together and every prompt offered the whole list again.
 *
 * `chosenOptions` is keyed by choice id, so the pack's own definitions are what say which
 * ids belong to the group. Returns undefined when nothing is left to offer, rather than
 * an empty list.
 *
 * `level` defaults to the character's total level, which is the right yardstick for a
 * race's or a feat's own pool; a class pool passes the level in that class.
 */
export function resolveOptionChoice(
  eventDef: ChooseOptionDefEvent,
  character: Character,
  rulepack: Rulepack,
  level: number = totalLevel(character),
): ChooseOptionEvent | undefined {
  const siblings = eventDef.group ? choiceIdsInGroup(rulepack, eventDef.group) : []
  const taken = new Set(
    siblings
      .filter(id => id !== eventDef.id)
      .map(id => character.chosenOptions?.[id])
      .filter((id): id is string => !!id),
  )
  const offered = [...eventDef.options]
  const known = new Set(offered.map(o => o.id))
  for (const extra of poolExtras(rulepack, eventDef.group, eventDef.id)) {
    if (!known.has(extra.id)) {
      known.add(extra.id)
      offered.push(extra)
    }
  }
  const options = byName(offered.filter(o =>
    !taken.has(o.id) && optionAvailable(o, character, level)))
  if (options.length === 0) return undefined
  return {
    type: 'CHOOSE_OPTION',
    id: eventDef.id,
    label: eventDef.label,
    options,
    group: eventDef.group,
  }
}

/** Stable feature id for a pool pick, so a later swap overwrites it rather than piling up. */
function poolFeatureId(choiceId: string): string {
  return `option-${choiceId}`
}

/**
 * The feature a pool pick is worth on its own, or undefined when the choice is not a
 * class-level pool pick.
 *
 * A pick from a shared pool was recorded in `chosenOptions` and nowhere else, so the sheet
 * — which renders `features` — showed a warlock "Eldritch Invocations" without ever saying
 * which. Each pick therefore gets its own feature, which is also what a replacement
 * rewrites. Single choices like a Totem Spirit are left out: those already show up by
 * renaming the feature that raised them.
 */
function poolPickFeature(
  rulepack: Rulepack,
  choiceId: string,
  optionId: string,
): Feature | undefined {
  for (const cls of rulepack.classes) {
    for (const level of cls.levels) {
      for (const def of level.levelUpEvents ?? []) {
        if (def.type !== 'CHOOSE_OPTION' || def.id !== choiceId || !def.group) continue
        // Patched-in options too, or a sourcebook invocation would be picked and then
        // named nothing on the sheet.
        const option = def.options.find(o => o.id === optionId)
          ?? poolExtras(rulepack, def.group, def.id).find(o => o.id === optionId)
        if (!option) return undefined
        return {
          id: poolFeatureId(choiceId),
          name: option.name,
          source: cls.name,
          description: option.description,
        }
      }
    }
  }

  // A race or subrace variant gets one too, grouped or not: there is no feature of its
  // own to rename the way a class's Totem Spirit has, so without this a half-elf who
  // picked Drow Magic showed nothing for it.
  for (const race of rulepack.races) {
    for (const source of [race, ...(race.subraces ?? [])]) {
      for (const group of source.levelUpEvents ?? []) {
        for (const def of group.levelUpEvents) {
          if (def.type !== 'CHOOSE_OPTION' || def.id !== choiceId) continue
          const option = def.options.find(o => o.id === optionId)
            ?? poolExtras(rulepack, def.group, def.id).find(o => o.id === optionId)
          if (!option) return undefined
          return {
            id: poolFeatureId(choiceId),
            name: option.name,
            source: source.name,
            description: option.description,
          }
        }
      }
    }
  }
  return undefined
}

/**
 * Adds the features for pool picks a character made before those picks were recorded as
 * features, so an existing warlock's invocations appear on the sheet without re-levelling.
 * Returns the character unchanged when there is nothing to add, so the caller can skip
 * the save.
 */
export function backfillPoolPickFeatures(character: Character, rulepack: Rulepack): Character {
  const missing: Feature[] = []
  for (const [choiceId, optionId] of Object.entries(character.chosenOptions ?? {})) {
    const feature = poolPickFeature(rulepack, choiceId, optionId)
    if (!feature) continue
    if (character.features.some(f => f.id === feature.id)) continue
    missing.push(feature)
  }
  if (missing.length === 0) return character
  return { ...character, features: [...character.features, ...missing] }
}

/**
 * Translates a REPLACE_OPTION definition into the offer to retrain one pick.
 *
 * Returns undefined unless the trade is actually possible: nothing known from the pool
 * yet (a warlock's first invocations are gained, not traded), or nothing left that the
 * character qualifies for. An option already known is not offered as its own replacement.
 */
export function resolveOptionReplacement(
  eventDef: Extract<LevelUpEventDef, { type: 'REPLACE_OPTION' }>,
  character: Character,
  rulepack: Rulepack,
  level: number = totalLevel(character),
): ReplaceOptionEvent | undefined {
  const pool = optionsInGroup(rulepack, eventDef.group)
  const byId = new Map(pool.map(o => [o.id, o]))

  const current: ReplaceOptionEvent['current'] = []
  for (const choiceId of choiceIdsInGroup(rulepack, eventDef.group)) {
    const optionId = character.chosenOptions?.[choiceId]
    const option = optionId ? byId.get(optionId) : undefined
    if (option) current.push({ choiceId, option })
  }
  if (current.length === 0) return undefined

  const known = new Set(current.map(c => c.option.id))
  const options = pool.filter(o => !known.has(o.id) && optionAvailable(o, character, level))
  if (options.length === 0) return undefined

  return {
    type: 'REPLACE_OPTION',
    group: eventDef.group,
    label: eventDef.label ?? 'Replace a choice',
    current,
    options,
  }
}

/**
 * Translate a CHOOSE_SPELLCASTING_ABILITY definition, skipping it once the player has
 * answered for that source.
 *
 * The guard matters because a source's events fire per level: a Monsters of the
 * Multiverse race grants a cantrip at 1st and a levelled spell at 3rd and 5th, and
 * asking again at each would silently reset a DC the player had already set.
 */
function resolveSpellcastingAbilityChoice(
  eventDef: Extract<LevelUpEventDef, { type: 'CHOOSE_SPELLCASTING_ABILITY' }>,
  character: Character,
  fallbackLabel?: string,
): ChooseSpellcastingAbilityEvent | undefined {
  if (character.classSpellcasting?.[eventDef.addTo]?.abilityChosen) return undefined
  const label = eventDef.label ?? fallbackLabel
  return {
    type: 'CHOOSE_SPELLCASTING_ABILITY',
    addTo: eventDef.addTo,
    // Copy: eventDef belongs to the reactive rulepack store, and a Vue proxy stored on
    // the character makes the next structuredClone throw.
    from: [...eventDef.from],
    ...(eventDef.origin ? { origin: eventDef.origin } : {}),
    ...(label ? { label } : {}),
  }
}

/**
 * Translate a GRANT_SPELLCASTING definition. Automatic — there is nothing to ask; when
 * the ability is the player's to pick the pack pairs this with
 * CHOOSE_SPELLCASTING_ABILITY, which is applied after and wins.
 */
function grantSpellcastingEvent(
  eventDef: Extract<LevelUpEventDef, { type: 'GRANT_SPELLCASTING' }>,
  fallbackLabel?: string,
): GrantSpellcastingEvent {
  const label = eventDef.label ?? fallbackLabel
  return {
    type: 'GRANT_SPELLCASTING',
    addTo: eventDef.addTo,
    ability: eventDef.ability,
    ...(eventDef.list ? { list: eventDef.list } : {}),
    ...(eventDef.origin ? { origin: eventDef.origin } : {}),
    ...(label ? { label } : {}),
  }
}

/**
 * Translate a GRANT_SPELLS definition, or nothing when it waits on an option or names no
 * spell this pack knows.
 *
 * Shared by all four paths — class level, subclass level, race/background, feat. They
 * used to be four near-identical literals and had drifted: the class and subclass ones
 * carried neither `ability`, `uses`, `cost` nor `label`, so a Way of Shadow monk's 2-Ki
 * spells arrived with no cost and no DC behind them.
 */
/**
 * Resolve a spell's ability reference against the feat that granted it.
 *
 * `'increased'` is Tasha's "the ability increased by this feat", which is only known
 * once the player has answered the feat, so it arrives here rather than in the pack. A
 * feat whose increase has not been answered yet leaves the ability unset, which falls
 * back to the class's own — better than picking one on the player's behalf.
 */
function resolveAbilityRef(
  ref: SpellAbilityRef | undefined,
  increased: AbilityKey | undefined,
): AbilityKey | undefined {
  if (ref === 'increased') return increased
  return ref
}

/**
 * The ability a feat's own increase went to.
 *
 * The player's answer wins; a feat with a fixed single increase (rather than a choice)
 * supplies it directly.
 */
export function featIncreasedAbility(
  feat: Pick<FeatDefinition, 'abilityScoreBonus'>,
  chosen?: Partial<Record<AbilityKey, number>>,
): AbilityKey | undefined {
  const picked = Object.keys(chosen ?? {}).filter(k => (chosen?.[k as AbilityKey] ?? 0) > 0)
  if (picked.length === 1) return picked[0] as AbilityKey
  const fixed = Object.keys(feat.abilityScoreBonus ?? {})
  return fixed.length === 1 ? (fixed[0] as AbilityKey) : undefined
}

function grantSpellsEvent(
  eventDef: Extract<LevelUpEventDef, { type: 'GRANT_SPELLS' }>,
  character: Character,
  rulepack: Rulepack,
  defaults: {
    origin?: SpellcastingOrigin
    label?: string
    /** Answer to the feat's own increase, for `ability: 'increased'`. */
    increasedAbility?: AbilityKey
  } = {},
): GrantSpellsEvent | undefined {
  if (eventDef.whenOption
    && character.chosenOptions?.[eventDef.whenOption.choiceId] !== eventDef.whenOption.optionId) {
    return undefined
  }
  const spells = resolveGrantedSpells(eventDef.spellIds, rulepack)
  if (spells.length === 0) return undefined
  const label = eventDef.label ?? defaults.label
  const origin = eventDef.origin ?? defaults.origin
  return {
    type: 'GRANT_SPELLS',
    addTo: eventDef.addTo,
    spells,
    alwaysPrepared: eventDef.alwaysPrepared ?? false,
    ...(eventDef.whenOption ? { whenOption: eventDef.whenOption } : {}),
    ...((a => (a ? { ability: a } : {}))(resolveAbilityRef(eventDef.ability, defaults.increasedAbility))),
    ...(origin ? { origin } : {}),
    ...(label ? { label } : {}),
    ...(eventDef.uses ? { uses: eventDef.uses } : {}),
    ...(eventDef.cost ? { cost: eventDef.cost } : {}),
    ...(eventDef.castAtLevel ? { castAtLevel: eventDef.castAtLevel } : {}),
  }
}

/**
 * Translate a CHOOSE_SPELL definition, or nothing when it waits on an option.
 *
 * Exported for the same reason resolveOptionChoice is: the wizard injects a subclass
 * level's choices once the subclass is known, and hand-building them there dropped the
 * guard along with every field a grant carries.
 *
 * A guarded choice cannot be replayed the way a guarded grant is: a question has to be
 * asked, not applied. So it is simply not emitted here, and the wizard queues it in a
 * second stage once the option is answered (see `resolveUnlockedChoices`).
 */
export function chooseSpellEvent(
  eventDef: Extract<LevelUpEventDef, { type: 'CHOOSE_SPELL' }>,
  character: Character,
  defaults: {
    addTo?: string
    origin?: SpellcastingOrigin
    label?: string
    /** Answer to the feat's own increase, for `ability: 'increased'`. */
    increasedAbility?: AbilityKey
  } = {},
): ChooseSpellEvent | undefined {
  if (eventDef.whenOption
    && character.chosenOptions?.[eventDef.whenOption.choiceId] !== eventDef.whenOption.optionId) {
    return undefined
  }
  return {
    type: 'CHOOSE_SPELL',
    addTo: eventDef.addTo || defaults.addTo || '',
    count: eventDef.count,
    cantrip: eventDef.cantrip ?? false,
    fromList: eventDef.fromList,
    classes: eventDef.classes,
    schools: eventDef.schools,
    maxLevel: eventDef.maxLevel,
    ability: resolveAbilityRef(eventDef.ability, defaults.increasedAbility),
    origin: eventDef.origin ?? defaults.origin,
    label: eventDef.label ?? defaults.label,
    ...(eventDef.whenOption ? { whenOption: eventDef.whenOption } : {}),
    ...(eventDef.uses ? { uses: eventDef.uses } : {}),
    ...(eventDef.cost ? { cost: eventDef.cost } : {}),
    ...(eventDef.castAtLevel ? { castAtLevel: eventDef.castAtLevel } : {}),
  }
}

/**
 * Translate an EXPAND_SPELL_LIST definition. Informational only — the rule itself is
 * re-derived from the character's sources, so nothing is written when this is applied.
 */
function expandSpellListEvent(
  eventDef: Extract<LevelUpEventDef, { type: 'EXPAND_SPELL_LIST' }>,
  character: Character,
  fallbackLabel?: string,
): ExpandSpellListEvent | undefined {
  // Reported only once it is actually in force, on the same test activeExpansions
  // applies: the Genie's wish is declared at 1st level and arrives at 9th, and
  // announcing it on the level-up screen at 1st would promise a spell the list does
  // not yet have.
  if (eventDef.minLevel) {
    const total = character.classes.reduce((sum, c) => sum + c.level, 0)
    if (total < eventDef.minLevel) return undefined
  }
  // A guarded rule is only reported once its option is answered. Unlike GRANT_SPELLS
  // there is nothing to replay at the level the option is chosen: the rule is derived,
  // so it takes effect the moment the answer is recorded.
  if (eventDef.whenOption
    && character.chosenOptions?.[eventDef.whenOption.choiceId] !== eventDef.whenOption.optionId) {
    return undefined
  }
  const label = eventDef.label ?? fallbackLabel
  return {
    type: 'EXPAND_SPELL_LIST',
    addTo: eventDef.addTo,
    spellIds: [...(eventDef.spellIds ?? [])],
    ...(eventDef.classes ? { classes: [...eventDef.classes] } : {}),
    ...(eventDef.minLevel ? { minLevel: eventDef.minLevel } : {}),
    ...(eventDef.whenOption ? { whenOption: eventDef.whenOption } : {}),
    ...(label ? { label } : {}),
  }
}

export function resolveLevelUpEvents(
  character: Character,
  classId: string,
  newLevel: number,
  rulepack: Rulepack,
  optionalFeatures: Array<OptionalClassFeature & { sourceName: string }> = [],
): LevelUpEvent[] {
  const classDef = rulepack.classes.find(c => c.id === classId)
  if (!classDef) return []

  const levelData = classDef.levels.find(l => l.level === newLevel)
  if (!levelData) return []

  const events: LevelUpEvent[] = []
  const hitDieSides = parseDieSides(classDef.hitDie)
  const conMod = Math.floor((character.abilityScores.con - 10) / 2)
  const conBonus = Math.max(conMod, -5)

  // Always add HP event
  const roll = rollDie(hitDieSides)
  const average = Math.floor(hitDieSides / 2) + 1
  const max = hitDieSides
  events.push({
    type: 'ADD_HP',
    roll,
    average,
    max,
    conBonus,
    hpFlatBonus: character.hpBonusPerLevel ?? 0,
  } satisfies AddHpEvent)

  // Record this class's spellcasting ability against its own source, so a multiclass
  // caster gets a DC per class rather than one taken from whichever class came first.
  if (classDef.spellcastingAbility) {
    events.push({
      type: 'SET_SPELLCASTING_ABILITY',
      sourceId: classId,
      ability: classDef.spellcastingAbility,
    } satisfies SetSpellcastingAbilityEvent)
  }

  // Hit dice are pooled per class, since a fighter/wizard spends d10s and d6s separately
  events.push({
    type: 'UPDATE_HIT_DIE',
    classId,
    die: classDef.hitDie,
  } satisfies UpdateHitDieEvent)

  // Only pact magic is tracked on the character: warlock slots are absolute and separate.
  // Regular slots are derived from the combined caster level by baseSpellSlots(), so
  // nothing is emitted for them — a new class level changes the derivation instead.
  if (levelData.spellSlots && classDef.pactMagic) {
    const entries = Object.entries(levelData.spellSlots)
    if (entries.length > 0) {
      const [slotLvlStr, count] = entries.at(-1)! // highest (and only) key
      events.push({
        type: 'UPDATE_WARLOCK_SLOTS',
        slotLevel: Number.parseInt(slotLvlStr) as SpellSlotLevel,
        max: count ?? 0,
      } satisfies UpdateWarlockSlotsEvent)
    }
  }

  // Features — look up subclass definition for this character's subclass (if any)
  const subclassId = character.classes.find(c => c.classId === classId)?.subclassId
  const subclassDef = subclassId
    ? rulepack.classes.flatMap(c => c.subclasses ?? []).find(s => s.id === subclassId)
    : undefined
  const subclassLevelData = subclassDef?.levels.find(l => l.level === newLevel)
  const subclassLevelFeatures = subclassLevelData?.features ?? []
  const subclassLevelEvents = subclassLevelData?.levelUpEvents ?? []
  // Track which level-data feature names are placeholders replaced by subclass features
  const hasSubclassFeatures = subclassLevelFeatures.length > 0

  for (const featureName of levelData.features) {
    // Skip generic "Primal Path Feature" style placeholders when we have real subclass features
    if (hasSubclassFeatures && isSubclassPlaceholder(featureName)) continue

    const featDef = classDef.featureDefinitions?.find(d => d.name === featureName)
    events.push({
      type: 'ADD_FEATURE',
      feature: {
        id: `${classId}-${featureName.toLowerCase().replace(/\s+/g, '-')}-${newLevel}`,
        name: featureName,
        source: classDef.name,
        description: featDef?.description ?? '',
        usesMax: featDef?.usesMax,
        recharge: featDef?.recharge,
        replaces: featDef?.replaces,
      },
    } satisfies AddFeatureEvent)
  }

  // Add the actual subclass features for this level (if character already has a subclass)
  for (const feat of subclassLevelFeatures) {
    events.push({
      type: 'ADD_FEATURE',
      feature: {
        id: `${subclassId}-${feat.name.toLowerCase().replaceAll(' ', '-')}-${newLevel}`,
        name: feat.name,
        source: subclassDef!.name,
        description: feat.description,
        usesMax: feat.usesMax,
        recharge: feat.recharge,
      },
    } satisfies AddFeatureEvent)
  }

  // Process levelUpEvents from the rulepack definition
  // Taking a class as an additional class grants the SRD's reduced proficiency set, never
  // saving throws. Level 1 of the *first* class is handled at character creation instead,
  // so this only fires when the character already has levels elsewhere.
  const enteringAsMulticlass = newLevel === 1
    && character.classes.some(c => c.classId !== classId && c.level > 0)
  if (enteringAsMulticlass && classDef.multiclassing) {
    for (const proficiency of multiclassProficiencies(classDef)) {
      events.push({
        type: 'GAIN_PROFICIENCY',
        proficiency,
        category: 'armor',
      } satisfies GainProficiencyEvent)
    }
    const skills = classDef.multiclassing.skillChoices
    if (skills && skills.count > 0) {
      events.push({ type: 'CHOOSE_SKILL', count: skills.count, from: skills.from })
    }
  }

  for (const eventDef of levelData.levelUpEvents) {    switch (eventDef.type) {
      case 'ADD_FEATURE':
        // Already handled above via feature names; skip duplicate
        break
      case 'UPDATE_SPELL_SLOTS':
        // Already handled above
        break
      case 'GAIN_PROFICIENCY': {
        const proficiency = gainProficiencyEvent(eventDef, character)
        if (proficiency) events.push(proficiency)
        break
      }
      case 'SET_SPEED': {
        const speed = setSpeedEvent(eventDef, character)
        if (speed) events.push(speed)
        break
      }
      case 'CHOOSE_SPELL': {
        const choice = chooseSpellEvent(eventDef, character)
        if (choice) events.push(choice)
        break
      }
      case 'CHOOSE_SPELLCASTING_ABILITY': {
        const choice = resolveSpellcastingAbilityChoice(eventDef, character, classDef.name)
        if (choice) events.push(choice)
        break
      }
      case 'GRANT_SPELLCASTING':
        events.push(grantSpellcastingEvent(eventDef, classDef.name))
        break
      case 'EXPAND_SPELL_LIST': {
        const expand = expandSpellListEvent(eventDef, character, subclassDef?.name ?? classDef.name)
        if (expand) events.push(expand)
        break
      }
      case 'GRANT_SPELLS': {
        // A guarded grant only fires once the option it depends on has been picked. At
        // the level the option is chosen the answer is not known yet, so the grant is
        // skipped and applied by RESOLVED_OPTION or RESOLVED_SUBCLASS instead.
        const grant = grantSpellsEvent(eventDef, character, rulepack, {
          origin: 'class',
          label: subclassDef?.name ?? classDef.name,
        })
        if (grant) events.push(grant)
        break
      }
      case 'SET_WILD_SHAPE_LIMITS':
        events.push({
          type: 'SET_WILD_SHAPE_LIMITS',
          maxCR: eventDef.maxCR,
          // Unset means unrestricted, so a subclass that widens the limits can simply
          // omit the gates rather than having to re-state them as true.
          allowSwim: eventDef.allowSwim ?? true,
          allowFly: eventDef.allowFly ?? true,
          // Copy: eventDef belongs to the reactive rulepack store, and a Vue proxy
          // stored on the character makes the next structuredClone throw.
          types: eventDef.types ? [...eventDef.types] : undefined,
        } satisfies SetWildShapeLimitsEvent)
        break
      case 'CHOOSE_EXPERTISE':
        events.push({
          type: 'CHOOSE_EXPERTISE',
          label: eventDef.label,
          options: eventDef.options,
          count: eventDef.count,
        } satisfies ChooseExpertiseEvent)
        break
      case 'CHOOSE_SKILL': {
        const skills = chooseSkillEvent(eventDef, character)
        if (skills) events.push(skills)
        break
      }
      case 'CHOOSE_FEAT':
        events.push({ type: 'CHOOSE_FEAT' })
        break
      case 'ABILITY_SCORE_IMPROVEMENT':
        events.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
        break
      case 'CHOOSE_SUBCLASS':
        if (character.classes.find(c => c.classId === classId)?.subclassId === undefined) {
          events.push({ type: 'CHOOSE_SUBCLASS', label: eventDef.label })
        }
        break
      case 'CHOOSE_OPTION': {
        const choice = resolveOptionChoice(eventDef, character, rulepack, newLevel)
        if (choice) events.push(choice)
        break
      }
      case 'REPLACE_OPTION': {
        const choice = resolveOptionReplacement(eventDef, character, rulepack, newLevel)
        if (choice) events.push(choice)
        break
      }
      case 'UPDATE_FEATURE_USES':
        events.push({
          type: 'UPDATE_FEATURE_USES',
          featureName: eventDef.featureName,
          usesMax: eventDef.usesMax,
        } satisfies UpdateFeatureUsesEvent)
        break
    }
  }

  // Process levelUpEvents defined on the subclass level (e.g. totem/archetype choices)
  for (const eventDef of subclassLevelEvents) {
    switch (eventDef.type) {
      case 'CHOOSE_OPTION': {
        const choice = resolveOptionChoice(eventDef, character, rulepack, newLevel)
        if (choice) events.push(choice)
        break
      }
      case 'REPLACE_OPTION': {
        const choice = resolveOptionReplacement(eventDef, character, rulepack, newLevel)
        if (choice) events.push(choice)
        break
      }
      case 'CHOOSE_SPELL': {
        const choice = chooseSpellEvent(eventDef, character)
        if (choice) events.push(choice)
        break
      }
      case 'CHOOSE_SPELLCASTING_ABILITY': {
        const choice = resolveSpellcastingAbilityChoice(eventDef, character, classDef.name)
        if (choice) events.push(choice)
        break
      }
      case 'GRANT_SPELLCASTING':
        events.push(grantSpellcastingEvent(eventDef, classDef.name))
        break
      case 'EXPAND_SPELL_LIST': {
        const expand = expandSpellListEvent(eventDef, character, subclassDef?.name ?? classDef.name)
        if (expand) events.push(expand)
        break
      }
      case 'GRANT_SPELLS': {
        // A guarded grant only fires once the option it depends on has been picked. At
        // the level the option is chosen the answer is not known yet, so the grant is
        // skipped and applied by RESOLVED_OPTION or RESOLVED_SUBCLASS instead.
        const grant = grantSpellsEvent(eventDef, character, rulepack, {
          origin: 'class',
          label: subclassDef?.name ?? classDef.name,
        })
        if (grant) events.push(grant)
        break
      }
      case 'GAIN_PROFICIENCY': {
        const proficiency = gainProficiencyEvent(eventDef, character)
        if (proficiency) events.push(proficiency)
        break
      }
      case 'SET_SPEED': {
        const speed = setSpeedEvent(eventDef, character)
        if (speed) events.push(speed)
        break
      }
      case 'SET_WILD_SHAPE_LIMITS':
        events.push({
          type: 'SET_WILD_SHAPE_LIMITS',
          maxCR: eventDef.maxCR,
          // Unset means unrestricted, so a subclass that widens the limits can simply
          // omit the gates rather than having to re-state them as true.
          allowSwim: eventDef.allowSwim ?? true,
          allowFly: eventDef.allowFly ?? true,
          // Copy: eventDef belongs to the reactive rulepack store, and a Vue proxy
          // stored on the character makes the next structuredClone throw.
          types: eventDef.types ? [...eventDef.types] : undefined,
        } satisfies SetWildShapeLimitsEvent)
        break
      case 'ABILITY_SCORE_IMPROVEMENT':
        events.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
        break
    }
  }

  // Race, subrace and background events fire on TOTAL character level, not class level:
  // a tiefling gains hellish rebuke at 3rd character level however the levels are split.
  const newTotalLevel = character.classes.reduce(
    (sum, c) => sum + (c.classId === classId ? 0 : c.level), 0) + newLevel

  const race = rulepack.races.find(r => r.id === character.race)
  const subrace = race?.subraces?.find(sr => sr.id === character.subrace)
  const background = rulepack.backgrounds.find(b => b.id === character.background)

  // A subrace may supersede one of the race's traits — the SCAG tiefling bloodlines
  // replace Infernal Legacy, a half-elf descent replaces Skill Versatility. The trait's
  // events go with it, or the character would get both the race's version and the
  // subrace's.
  const replacedTraits = subrace?.replacesRaceTraits ?? []

  for (const source of [race, subrace, background]) {
    // Every group at this level, not just the first: tagging events by trait means a
    // source can legitimately declare more than one group per level.
    const groups = (source?.levelUpEvents ?? []).filter(e => e.level === newTotalLevel)
    for (const group of groups) {
      if (source === race && group.trait && replacedTraits.includes(group.trait)) continue
      for (const eventDef of group.levelUpEvents) {
        switch (eventDef.type) {
          case 'GRANT_SPELLS': {
            const grant = grantSpellsEvent(eventDef, character, rulepack, { label: source?.name })
            if (grant) events.push(grant)
            break
          }
          case 'CHOOSE_SPELL': {
            const choice = chooseSpellEvent(eventDef, character)
            if (choice) events.push(choice)
            break
          }
          case 'CHOOSE_SPELLCASTING_ABILITY': {
            const choice = resolveSpellcastingAbilityChoice(eventDef, character, source?.name)
            if (choice) events.push(choice)
            break
          }
          case 'GRANT_SPELLCASTING':
            events.push(grantSpellcastingEvent(eventDef, source?.name))
            break
          case 'EXPAND_SPELL_LIST': {
            const expand = expandSpellListEvent(eventDef, character, source?.name)
            if (expand) events.push(expand)
            break
          }
          case 'CHOOSE_OPTION': {
            // Skip a choice already answered, so it is not asked again on a later level
            if (character.chosenOptions?.[eventDef.id] === undefined) {
              const choice = resolveOptionChoice(eventDef, character, rulepack)
              if (choice) events.push(choice)
            }
            break
          }
          case 'GAIN_PROFICIENCY': {
            const proficiency = gainProficiencyEvent(eventDef, character)
            if (proficiency) events.push(proficiency)
            break
          }
          case 'SET_SPEED': {
            const speed = setSpeedEvent(eventDef, character)
            if (speed) events.push(speed)
            break
          }
          case 'CHOOSE_SKILL': {
            const skills = chooseSkillEvent(eventDef, character)
            if (skills) events.push(skills)
            break
          }
        }
      }
    }
  }

  // Offer optional features from supplemental rulepacks (e.g. Tasha's optional class features)
  if (optionalFeatures.length > 0) {
    events.push({ type: 'OFFER_OPTIONAL_FEATURES', features: optionalFeatures })
  }

  return events
}

/**
 * Translate a feat's `levelUpEvents` into runtime events.
 *
 * Unlike a class level, a feat fires everything the moment it is taken, so there is no
 * level to resolve against. `addTo` defaults to the feat's own id and `origin` to
 * `'feat'`, which is what registers the feat as its own spellcasting source rather than
 * letting it borrow whichever class happened to come first.
 *
 * Event types that presuppose a class — CHOOSE_SUBCLASS, UPDATE_HIT_DIE, spell slots,
 * a nested CHOOSE_FEAT — are ignored rather than half-applied.
 */
export function resolveFeatEvents(
  character: Character,
  feat: FeatDefinition,
  rulepack: Rulepack,
  /**
   * How the player answered the feat's own ability increase, for spells that cast with
   * "the ability increased by this feat". Omitted while the answer is still pending.
   */
  increasedAbility?: AbilityKey,
): LevelUpEvent[] {
  const events: LevelUpEvent[] = []

  for (const eventDef of feat.levelUpEvents ?? []) {
    switch (eventDef.type) {
      case 'GRANT_SPELLS': {
        // A guarded grant waits for its option, which the wizard queues right after the
        // feat itself. RESOLVED_OPTION applies it once the answer is in.
        const grant = grantSpellsEvent(
          { ...eventDef, addTo: eventDef.addTo || feat.id },
          character,
          rulepack,
          { origin: 'feat', label: feat.name, increasedAbility },
        )
        if (grant) events.push(grant)
        break
      }
      case 'CHOOSE_SPELL': {
        const choice = chooseSpellEvent(
          {
            ...eventDef,
            // A feat grants its spell level outright. Left unset the picker would fall
            // back to the class cap, which is 0 for a non-caster taking Magic Initiate.
            maxLevel: eventDef.maxLevel ?? (eventDef.cantrip ? 0 : 1),
          },
          character,
          { addTo: feat.id, origin: 'feat', label: feat.name, increasedAbility },
        )
        if (choice) events.push(choice)
        break
      }
      case 'CHOOSE_SPELLCASTING_ABILITY': {
        const choice = resolveSpellcastingAbilityChoice(
          { ...eventDef, addTo: eventDef.addTo || feat.id, origin: eventDef.origin ?? 'feat' },
          character,
          feat.name,
        )
        if (choice) events.push(choice)
        break
      }
      case 'GRANT_SPELLCASTING':
        events.push(grantSpellcastingEvent(
          { ...eventDef, addTo: eventDef.addTo || feat.id, origin: eventDef.origin ?? 'feat' },
          feat.name,
        ))
        break
      case 'EXPAND_SPELL_LIST': {
        const expand = expandSpellListEvent(eventDef, character, feat.name)
        if (expand) events.push(expand)
        break
      }
      case 'GAIN_PROFICIENCY': {
        const proficiency = gainProficiencyEvent(eventDef, character)
        if (proficiency) events.push(proficiency)
        break
      }
      case 'SET_SPEED': {
        const speed = setSpeedEvent(eventDef, character)
        if (speed) events.push(speed)
        break
      }
      case 'CHOOSE_EXPERTISE':
        events.push({
          type: 'CHOOSE_EXPERTISE',
          label: eventDef.label,
          options: eventDef.options,
          count: eventDef.count,
        } satisfies ChooseExpertiseEvent)
        break
      case 'CHOOSE_SKILL': {
        const skills = chooseSkillEvent(eventDef, character)
        if (skills) events.push(skills)
        break
      }
      case 'CHOOSE_OPTION': {
        // Skip a choice already answered, so retaking a repeatable feat does not re-ask
        if (character.chosenOptions?.[eventDef.id] === undefined) {
          const choice = resolveOptionChoice(eventDef, character, rulepack)
          if (choice) events.push(choice)
        }
        break
      }
      case 'UPDATE_FEATURE_USES':
        events.push({
          type: 'UPDATE_FEATURE_USES',
          featureName: eventDef.featureName,
          usesMax: eventDef.usesMax,
        } satisfies UpdateFeatureUsesEvent)
        break
      case 'ABILITY_SCORE_IMPROVEMENT':
        events.push({ type: 'ABILITY_SCORE_IMPROVEMENT', points: eventDef.points })
        break
    }
  }

  return events
}

/**
 * The choices a just-answered option unlocks — the second stage of the level-up run.
 *
 * A guarded GRANT_SPELLS can be replayed once the answer is in, because applying it is
 * just a write. A guarded CHOOSE_SPELL cannot: it is a *question*, and by the time the
 * option is answered the wizard has already built its list of questions. So the wizard
 * calls this when an option is confirmed and appends whatever it returns.
 *
 * `subclassId` and `feats` are passed in rather than read off the character because
 * during a level-up neither is committed yet: the subclass and the feat live in the
 * run's resolved choices until it is applied.
 */
export function resolveUnlockedChoices(
  character: Character,
  option: { choiceId: string; optionId: string },
  classId: string,
  newLevel: number,
  rulepack: Rulepack,
  opts: { subclassId?: string; feats?: FeatDefinition[] } = {},
): ChoiceLevelUpEvent[] {
  const answered: Character = {
    ...character,
    chosenOptions: { ...character.chosenOptions, [option.choiceId]: option.optionId },
  }

  const matches = (def: LevelUpEventDef) =>
    (def.type === 'CHOOSE_SPELL' || def.type === 'CHOOSE_SKILL')
    && def.whenOption?.choiceId === option.choiceId
    && def.whenOption?.optionId === option.optionId

  const out: ChoiceLevelUpEvent[] = []
  const take = (
    defs: LevelUpEventDef[] | undefined,
    defaults: { addTo?: string; origin?: SpellcastingOrigin; label?: string },
  ) => {
    for (const def of defs ?? []) {
      if (!matches(def)) continue
      if (def.type === 'CHOOSE_SKILL') {
        const skills = chooseSkillEvent(def, answered)
        if (skills) out.push(skills)
        continue
      }
      const choice = chooseSpellEvent(def as Extract<LevelUpEventDef, { type: 'CHOOSE_SPELL' }>, answered, defaults)
      if (choice) out.push(choice)
    }
  }

  const classDef = rulepack.classes.find(c => c.id === classId)
  take(classDef?.levels.find(l => l.level === newLevel)?.levelUpEvents, { addTo: classId })

  const subclassId = opts.subclassId
    ?? character.classes.find(c => c.classId === classId)?.subclassId
  const subclass = subclassId
    ? rulepack.classes.flatMap(c => c.subclasses ?? []).find(sub => sub.id === subclassId)
    : undefined
  take(subclass?.levels.find(l => l.level === newLevel)?.levelUpEvents, { addTo: classId })

  // Race, subrace and background fire on TOTAL level, as everywhere else
  const totalLevel = character.classes.reduce(
    (sum, c) => sum + (c.classId === classId ? 0 : c.level), 0) + newLevel
  const race = rulepack.races.find(r => r.id === character.race)
  const subrace = race?.subraces?.find(sr => sr.id === character.subrace)
  const background = rulepack.backgrounds.find(b => b.id === character.background)
  const replacedTraits = subrace?.replacesRaceTraits ?? []
  for (const source of [race, subrace, background]) {
    for (const group of (source?.levelUpEvents ?? []).filter(e => e.level === totalLevel)) {
      if (source === race && group.trait && replacedTraits.includes(group.trait)) continue
      take(group.levelUpEvents, { label: source?.name })
    }
  }

  for (const feat of opts.feats ?? []) {
    take(feat.levelUpEvents, { addTo: feat.id, origin: 'feat', label: feat.name })
  }

  return out
}

export function isChoiceEvent(event: LevelUpEvent): event is ChoiceLevelUpEvent {
  return ['CHOOSE_SPELL', 'CHOOSE_SPELLCASTING_ABILITY', 'CHANGE_SPELL', 'CHOOSE_EXPERTISE', 'CHOOSE_FEAT', 'ABILITY_SCORE_IMPROVEMENT', 'CHOOSE_SUBCLASS', 'CHOOSE_SKILL', 'CHOOSE_OPTION', 'REPLACE_OPTION', 'OFFER_OPTIONAL_FEATURES'].includes(event.type)
}

export function getChoiceEvents(events: LevelUpEvent[]): ChoiceLevelUpEvent[] {
  return events.filter(isChoiceEvent) as ChoiceLevelUpEvent[]
}

export function getAutomaticEvents(events: LevelUpEvent[]): AutomaticLevelUpEvent[] {
  return events.filter(e => !isChoiceEvent(e)) as AutomaticLevelUpEvent[]
}

export function applyAutomaticEvents(
  character: Character,
  events: AutomaticLevelUpEvent[],
  hpChoice: 'roll' | 'average' | 'max' | 'manual',
  manualHp?: number,
): Character {
  const updated = structuredClone(character)

  for (const event of events) {
    switch (event.type) {
      case 'ADD_HP': {
        let baseHp: number
        if (hpChoice === 'average') baseHp = event.average
        else if (hpChoice === 'max') baseHp = event.max
        else if (hpChoice === 'manual') baseHp = manualHp ?? event.average
        else baseHp = event.roll
        const gain = baseHp + event.conBonus + event.hpFlatBonus
        updated.hp.max += Math.max(gain, 1)
        updated.hp.current += Math.max(gain, 1)
        break
      }
      case 'UPDATE_WARLOCK_SLOTS': {
        // Pact magic slots — absolute values; preserve used count up to new max
        updated.warlockSlots = {
          slotLevel: event.slotLevel,
          max: event.max,
          used: Math.min(updated.warlockSlots?.used ?? 0, event.max),
        }
        break
      }
      case 'ADD_FEATURE': {
        const exists = updated.features.some(f => f.id === event.feature.id)
        if (!exists) {
          if (event.feature.replaces)
            updated.features = updated.features.filter(f => f.name !== event.feature.replaces)
          updated.features.push({
            ...event.feature,
            usesRemaining: event.feature.usesMax,
          })
        }
        break
      }
      case 'GRANT_SPELLCASTING':
        registerSpellcasting(updated, event.addTo, event.ability, event)
        break
      case 'EXPAND_SPELL_LIST':
        // Deliberately nothing. The rule lives on the source and is re-derived by
        // expandedSpellIdsFor, so writing a snapshot here would go stale the moment the
        // character multiclassed — which is exactly when a guild background must apply.
        break
      case 'GRANT_SPELLS': {
        grantSpellsTo(updated, event.addTo, event.spells, event.alwaysPrepared, {
          ability: event.ability,
          origin: event.origin,
          label: event.label,
          uses: event.uses,
          cost: event.cost,
          castAtLevel: event.castAtLevel,
        })
        break
      }
      case 'SET_WILD_SHAPE_LIMITS': {
        // Absolute, not a delta: a later level (or a subclass) replaces the limits.
        // An active form is preserved even if it would no longer qualify — dropping a
        // player out of a form mid-session because a limit narrowed would be worse.
        updated.wildShape = {
          ...updated.wildShape,
          limits: {
            maxCR: event.maxCR,
            allowSwim: event.allowSwim,
            allowFly: event.allowFly,
            ...(event.types ? { types: [...event.types] } : {}),
          },
        }
        break
      }
      case 'GAIN_PROFICIENCY': {
        if (!updated.otherProficiencies.includes(event.proficiency)) {
          updated.otherProficiencies.push(event.proficiency)
        }
        break
      }
      case 'SET_SPEED': {
        updated.speeds = { ...updated.speeds, [event.mode]: event.speed }
        break
      }
      case 'SET_SPELLCASTING_ABILITY': {
        // Recorded per source so a cleric/sorcerer has two DCs. The deprecated
        // character.spellcastingAbility is left alone: feat prerequisites still read it.
        // Absent on characters stored before per-source lists existed
        const sources = updated.classSpellcasting ?? {}
        const existing = sources[event.sourceId]
        updated.classSpellcasting = {
          ...sources,
          [event.sourceId]: existing
            ? { ...existing, ability: event.ability }
            : { ability: event.ability, origin: 'class', spells: [] },
        }
        break
      }
      case 'UPDATE_HIT_DIE': {
        updated.hitDice = addHitDieForClass(updated.hitDice, event.classId, event.die)
        break
      }
      case 'UPDATE_FEATURE_USES': {
        const feature = updated.features.find(f => f.name === event.featureName)
        if (feature) {
          if (event.usesMax === null) {
            delete feature.usesMax
            delete feature.usesRemaining
          }
          else {
            feature.usesMax = event.usesMax
            // Clamp against base + manual bonus, not the base alone, or a magic-item
            // bonus would be silently trimmed off on every level-up.
            const bonusTotal = Object.values(feature.usesBonuses ?? {})
              .reduce<number>((sum, n) => sum + (n ?? 0), 0)
            const effectiveMax = Math.max(0, event.usesMax + bonusTotal)
            feature.usesRemaining = Math.min(feature.usesRemaining ?? effectiveMax, effectiveMax)
          }
        }
        break
      }
    }
  }

  return updated
}

export function applyResolvedChoices(
  character: Character,
  choices: ResolvedChoice[],
  rulepack: Rulepack,
): Character {
  const updated = structuredClone(character)
  const oldConMod = Math.floor((updated.abilityScores.con - 10) / 2)

  for (const choice of choices) {
    switch (choice.type) {
      case 'RESOLVED_ASI': {
        for (const [ability, bonus] of Object.entries(choice.bonuses)) {
          const key = ability as AbilityKey
          updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
        }
        break
      }
      case 'RESOLVED_SPELLCASTING_ABILITY': {
        // `abilityChosen` marks this as the player's answer rather than the source's,
        // which is what stops it being asked again and lets the sheet offer to change it.
        registerSpellcasting(updated, choice.sourceId, choice.ability, choice)
        updated.classSpellcasting[choice.sourceId]!.ability = choice.ability
        updated.classSpellcasting[choice.sourceId]!.abilityChosen = true
        break
      }
      case 'RESOLVED_CHOOSE_FEAT': {
        const feat = rulepack.feats.find(f => f.id === choice.featId)
        if (feat) {
          updated.features.push({
            id: feat.id,
            name: feat.name,
            source: 'Feat',
            description: feat.description,
          })
          // Flat ability score bonuses (no player choice)
          if (feat.abilityScoreBonus) {
            for (const [ability, bonus] of Object.entries(feat.abilityScoreBonus)) {
              const key = ability as AbilityKey
              updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
            }
          }
          // Player-chosen ability score bonus (e.g. +1 to one of Wis/Int/Cha)
          if (choice.abilityBonus) {
            for (const [ability, bonus] of Object.entries(choice.abilityBonus)) {
              const key = ability as AbilityKey
              updated.abilityScores[key] = Math.min(20, updated.abilityScores[key] + (bonus ?? 0))
            }
          }
          // Spells granted by the feat
          if (feat.grantedSpells) {
            for (const spellId of feat.grantedSpells) {
              const spellDef = rulepack.spells.find(s => s.id === spellId)
              if (spellDef && !updated.spells.some(s => s.spellId === spellId)) {
                updated.spells.push({
                  id: crypto.randomUUID(),
                  spellId,
                  name: spellDef.name,
                  level: spellDef.level,
                  prepared: spellDef.level === 0,
                })
              }
            }
          }
          // Extra HP per level (retroactive for all current levels)
          if (feat.hpBonusPerLevel) {
            const totalLevel = updated.classes.reduce((s, c) => s + c.level, 0)
            const hpGain = feat.hpBonusPerLevel * totalLevel
            updated.hp.max += hpGain
            updated.hp.current += hpGain
            updated.hpBonusPerLevel = (updated.hpBonusPerLevel ?? 0) + feat.hpBonusPerLevel
          }
          // The feat's own levelUpEvents. Its automatic half is applied here rather than
          // by applyAutomaticEvents, which runs before the feat is even known — the same
          // reason RESOLVED_OPTION applies its deferred grants inline. The choices it
          // raises are collected by the wizard and arrive as later entries in `choices`.
          const increased = featIncreasedAbility(feat, choice.abilityBonus)
          for (const event of getAutomaticEvents(resolveFeatEvents(updated, feat, rulepack, increased))) {
            switch (event.type) {
              case 'GRANT_SPELLS':
                grantSpellsTo(updated, event.addTo, event.spells, event.alwaysPrepared, {
                  ability: event.ability,
                  origin: event.origin,
                  label: event.label,
                  uses: event.uses,
                  // Was missing while every other call site forwarded it, so a feat
                  // granting a resource-metered spell stored no price and the sheet
                  // offered no way to spend for it.
                  cost: event.cost,
                  castAtLevel: event.castAtLevel,
                })
                break
              // A feat can be what makes a character a caster at all. resolveFeatEvents
              // emits this and feat events never reach applyAutomaticEvents, so without
              // a case here the feat granted spells with no source behind them.
              case 'GRANT_SPELLCASTING':
                registerSpellcasting(updated, event.addTo, event.ability, event)
                break
              case 'GAIN_PROFICIENCY':
                if (!updated.otherProficiencies.includes(event.proficiency)) {
                  updated.otherProficiencies.push(event.proficiency)
                }
                break
              case 'UPDATE_FEATURE_USES': {
                const target = updated.features.find(f => f.name === event.featureName)
                if (target) {
                  if (event.usesMax === null) {
                    delete target.usesMax
                    delete target.usesRemaining
                  }
                  else {
                    target.usesMax = event.usesMax
                    target.usesRemaining = event.usesMax
                  }
                }
                break
              }
            }
          }
        }
        break
      }
      case 'RESOLVED_CHOOSE_SPELL': {
        // A cantrip chosen from a race or background registers that source, so its DC
        // is its own rather than borrowed from whichever class came first. Same writer
        // as every other path, so it cannot overwrite an ability the player chose.
        if (choice.ability && choice.classId) {
          registerSpellcasting(updated, choice.classId, choice.ability, choice)
        }
        const spellsToRemove = new Set(choice.removedSpellIds)
        updated.spells = updated.spells.filter(s => !spellsToRemove.has(s.spellId))
        for (const spellId of choice.spellIds) {
          const spellDef = rulepack.spells.find(s => s.id === spellId)
          if (spellDef && !updated.spells.some(s => s.spellId === spellId)) {
            updated.spells.push({
              id: crypto.randomUUID(),
              spellId,
              name: spellDef.name,
              level: spellDef.level,
              prepared: spellDef.level === 0,
              classId: choice.classId,
              // A free cast arrives with its uses full, as a granted one does.
              ...(choice.uses ? { uses: { ...choice.uses, remaining: choice.uses.max } } : {}),
              ...(choice.cost ? { cost: { ...choice.cost } } : {}),
              ...(choice.castAtLevel ? { castAtLevel: choice.castAtLevel } : {}),
            })
          }
        }
        break
      }
      case 'RESOLVED_SUBCLASS': {
        const classEntry = updated.classes.find(c => c.classId === choice.classId)
        if (classEntry) {
          classEntry.subclassId = choice.subclassId
          // Add subclass features for the current level (e.g. level 3 pick)
          const currentLevel = classEntry.level
          const subclassDef = rulepack.classes
            .flatMap(c => c.subclasses ?? [])
            .find(s => s.id === choice.subclassId)
          if (subclassDef) {
            const subclassLevel = subclassDef.levels.find(l => l.level === currentLevel)
            const levelFeatures = subclassLevel?.features ?? []
            for (const feat of levelFeatures) {
              const featId = `${choice.subclassId}-${feat.name.toLowerCase().replaceAll(' ', '-')}-${currentLevel}`
              if (!updated.features.some(f => f.id === featId)) {
                updated.features.push({
                  id: featId,
                  name: feat.name,
                  source: subclassDef.name,
                  description: feat.description,
                  usesMax: feat.usesMax,
                  usesRemaining: feat.usesMax,
                  recharge: feat.recharge,
                })
              }
            }
            // The subclass was unchosen when resolveLevelUpEvents ran, so its own
            // level events were never emitted. Apply the automatic ones here.
            for (const evt of subclassLevel?.levelUpEvents ?? []) {
              // A guarded grant belongs to RESOLVED_OPTION, which follows this in the
              // same run. Circle of the Land never exposed this — a druid picks the
              // Circle at 2nd and its guarded grants start at 3rd — but Divine Soul
              // declares both on the level the subclass itself is chosen, and replaying
              // them here handed out every affinity's spell at once.
              if ('whenOption' in evt && evt.whenOption
                && updated.chosenOptions?.[evt.whenOption.choiceId] !== evt.whenOption.optionId) {
                continue
              }
              if (evt.type === 'GRANT_SPELLS') {
                // Through grantSpellsTo rather than building entries by hand: the hand
                // -rolled version silently dropped `uses`, `cost` and the source's
                // ability/label, which a Way of Shadow monk needs — it grants its
                // 2-Ki spells on the very level the subclass is chosen.
                grantSpellsTo(
                  updated,
                  evt.addTo,
                  resolveGrantedSpells(evt.spellIds, rulepack),
                  evt.alwaysPrepared ?? false,
                  {
                    ability: resolveAbilityRef(evt.ability, undefined),
                    origin: evt.origin,
                    label: evt.label ?? subclassDef.name,
                    uses: evt.uses,
                    cost: evt.cost,
                    castAtLevel: evt.castAtLevel,
                  },
                )
              }
              else if (evt.type === 'GAIN_PROFICIENCY') {
                if (!updated.otherProficiencies.includes(evt.proficiency)) {
                  updated.otherProficiencies.push(evt.proficiency)
                }
              }
              else if (evt.type === 'GRANT_SPELLCASTING') {
                // An Eldritch Knight starts casting at the very level it is chosen, so
                // without this the fighter would gain slots with no DC behind them.
                registerSpellcasting(updated, evt.addTo, evt.ability, {
                  origin: evt.origin,
                  label: evt.label ?? subclassDef.name,
                })
              }
            }
          }
        }
        break
      }
      case 'RESOLVED_EXPERTISE': {
        for (const skill of choice.skills) {
          // Expertise doubles an existing proficiency, so it only applies where the
          // character is already proficient; granting it outright would be a free skill.
          if ((updated.skillProficiencies[skill] ?? 0) === 1) {
            updated.skillProficiencies[skill] = 2
          }
        }
        break
      }
      case 'RESOLVED_SKILL': {
        for (const skill of choice.skills) {
          // Never downgrade: a skill already at expertise (2) stays there.
          if ((updated.skillProficiencies[skill] ?? 0) === 0) {
            updated.skillProficiencies[skill] = 1
          }
        }
        break
      }
      case 'RESOLVED_OPTION': {
        // Record the choice so later levels can act on it. Previously the pick lived only
        // in a feature's name, which nothing could query.
        updated.chosenOptions = {
          ...updated.chosenOptions,
          [choice.choiceId]: choice.optionId,
        }

        // A pick from a shared pool gets its own feature, so the sheet names it.
        const poolFeature = poolPickFeature(rulepack, choice.choiceId, choice.optionId)
        if (poolFeature && !updated.features.some(f => f.id === poolFeature.id))
          updated.features.push(poolFeature)

        // Apply grants guarded by this option that sit on the level being gained.
        // resolveLevelUpEvents could not emit them: the option was still unanswered when
        // it ran, the same ordering problem RESOLVED_SUBCLASS has.
        for (const cls of rulepack.classes) {
          const entry = updated.classes.find(c => c.classId === cls.id)
          if (!entry) continue
          const levelEvents = [
            ...(cls.levels.find(l => l.level === entry.level)?.levelUpEvents ?? []),
            ...(cls.subclasses ?? [])
              .filter(sub => sub.id === entry.subclassId)
              .flatMap(sub => sub.levels.find(l => l.level === entry.level)?.levelUpEvents ?? []),
          ]
          for (const evt of levelEvents) {
            if (evt.type !== 'GRANT_SPELLS' && evt.type !== 'GAIN_PROFICIENCY') continue
            if (evt.whenOption?.choiceId !== choice.choiceId) continue
            if (evt.whenOption.optionId !== choice.optionId) continue
            if (evt.type === 'GAIN_PROFICIENCY') {
              if (!updated.otherProficiencies.includes(evt.proficiency)) {
                updated.otherProficiencies.push(evt.proficiency)
              }
              continue
            }
            grantSpellsTo(
              updated,
              evt.addTo,
              resolveGrantedSpells(evt.spellIds, rulepack),
              evt.alwaysPrepared ?? false,
            )
          }
        }

        // Guarded grants from the character's race or subrace, for the same reason: the
        // half-elf descents hang their cantrip on the variant feature, and the answer
        // lands in this very run.
        const optionRace = rulepack.races.find(r => r.id === updated.race)
        const optionSubrace = optionRace?.subraces?.find(sr => sr.id === updated.subrace)
        for (const source of [optionRace, optionSubrace]) {
          for (const group of source?.levelUpEvents ?? []) {
            // Only what this level grants: the answer is given once, at 1st, while the
            // same option also gates grants waiting at 3rd and 5th.
            if (group.level > totalLevel(updated)) continue
            for (const evt of group.levelUpEvents) {
              if (evt.type !== 'GRANT_SPELLS' && evt.type !== 'GAIN_PROFICIENCY'
                && evt.type !== 'SET_SPEED') continue
              if (evt.whenOption?.choiceId !== choice.choiceId) continue
              if (evt.whenOption.optionId !== choice.optionId) continue
              // Elf Weapon Training and Fleet of Foot: the arm grants a proficiency or a
              // speed rather than spells, and the answer landed in this very run.
              if (evt.type === 'GAIN_PROFICIENCY') {
                if (!updated.otherProficiencies.includes(evt.proficiency)) {
                  updated.otherProficiencies.push(evt.proficiency)
                }
                continue
              }
              if (evt.type === 'SET_SPEED') {
                updated.speeds = { ...updated.speeds, [evt.mode]: evt.speed }
                continue
              }
              // Through grantSpellsEvent, not by hand: it is what resolves the ability,
              // the free casts and the fixed slot level the grant was printed with, and
              // `updated` already carries the answer this case just recorded.
              const grant = grantSpellsEvent(evt, updated, rulepack, {
                origin: 'race',
                label: source?.name,
              })
              if (!grant) continue
              grantSpellsTo(updated, grant.addTo, grant.spells, grant.alwaysPrepared, {
                ability: grant.ability,
                origin: grant.origin,
                label: grant.label,
                uses: grant.uses,
                cost: grant.cost,
                castAtLevel: grant.castAtLevel,
              })
            }
          }
        }

        // The same for a feat's guarded grants. A feat is applied by
        // RESOLVED_CHOOSE_FEAT, which runs before the option it raises is answered — so
        // without this a Scion of the Outer Planes would end up with no cantrip at all.
        // The feat is already on `features` by now, since it is resolved earlier in this
        // same list.
        for (const feature of updated.features) {
          if (feature.source !== 'Feat') continue
          const feat = rulepack.feats.find(f => f.id === feature.id)
          if (!feat) continue
          for (const evt of feat.levelUpEvents ?? []) {
            // Name the pick on the feat's own feature, since the lookup below only walks
            // subclasses: "Scion of the Outer Planes (Good Outer Plane)".
            if (evt.type === 'CHOOSE_OPTION' && evt.id === choice.choiceId) {
              const opt = evt.options.find(o => o.id === choice.optionId)
              if (opt) {
                feature.name = `${feat.name} (${opt.name})`
                if (opt.description) feature.description = opt.description
              }
              continue
            }
            if (evt.type !== 'GRANT_SPELLS' || !evt.whenOption) continue
            if (evt.whenOption.choiceId !== choice.choiceId) continue
            if (evt.whenOption.optionId !== choice.optionId) continue
            grantSpellsTo(
              updated,
              evt.addTo || feat.id,
              resolveGrantedSpells(evt.spellIds, rulepack),
              evt.alwaysPrepared ?? false,
              {
                ability: resolveAbilityRef(
                  evt.ability,
                  updated.classSpellcasting?.[feat.id]?.ability,
                ),
                origin: evt.origin ?? 'feat',
                label: evt.label ?? feat.name,
                uses: evt.uses,
                cost: evt.cost,
                castAtLevel: evt.castAtLevel,
              },
            )
          }
        }

        // Find the option definition from the rulepack across all subclass level events
        let optionName: string | undefined
        let optionDescription: string | undefined
        outer: for (const cls of rulepack.classes) {
          for (const sub of cls.subclasses ?? []) {
            for (const lvl of sub.levels) {
              for (const evt of lvl.levelUpEvents ?? []) {
                if (evt.type === 'CHOOSE_OPTION' && evt.id === choice.choiceId) {
                  const opt = evt.options.find(o => o.id === choice.optionId)
                  if (opt) { optionName = opt.name; optionDescription = opt.description; break outer }
                }
              }
            }
          }
        }
        if (optionName) {
          // Update the feature whose id contains the choiceId (e.g. "totem-spirit" in the feature id)
          const feat = updated.features.find(f =>
            f.id !== poolFeatureId(choice.choiceId) && f.id.includes(choice.choiceId))
          if (feat) {
            feat.name = `${feat.name} (${optionName})`
            feat.description = optionDescription ?? feat.description
          }
        }
        break
      }
      case 'RESOLVED_OPTION_REPLACEMENT': {
        // Overwrite the traded pick in place: the pool keeps one answer per choice id, so
        // the number of picks a character holds cannot drift.
        updated.chosenOptions = {
          ...updated.chosenOptions,
          [choice.choiceId]: choice.optionId,
        }
        const swapped = poolPickFeature(rulepack, choice.choiceId, choice.optionId)
        if (swapped) {
          const at = updated.features.findIndex(f => f.id === swapped.id)
          if (at >= 0) updated.features[at] = { ...updated.features[at]!, ...swapped }
          else updated.features.push(swapped)
        }
        break
      }
      case 'RESOLVED_OPTIONAL_FEATURES': {
        for (const feat of choice.taken) {
          if (!updated.features.some(f => f.id === feat.id)) {
            updated.features.push({
              id: feat.id,
              name: feat.name,
              source: feat.sourceName,
              description: feat.description,
              usesMax: feat.usesMax,
              usesRemaining: feat.usesMax,
              recharge: feat.recharge,
            })
          }
        }
        break
      }
    }
  }

  // If the CON modifier changed (from ASI or feat), adjust HP for all existing levels.
  // Each level's HP was calculated with the old modifier, so we compensate the delta.
  const newConMod = Math.floor((updated.abilityScores.con - 10) / 2)
  if (newConMod !== oldConMod) {
    const totalLevel = updated.classes.reduce((s, c) => s + c.level, 0)
    const hpDelta = (newConMod - oldConMod) * totalLevel
    updated.hp.max = Math.max(updated.hp.max + hpDelta, totalLevel)
    updated.hp.current = Math.max(updated.hp.current + hpDelta, 1)
  }

  return updated
}
