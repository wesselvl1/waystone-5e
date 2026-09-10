import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Rulepack, Race, ClassDefinition, SubclassDefinition, SubclassPatchEntry, SubracePatchEntry, SpellDefinition, FeatDefinition, OptionalClassFeature, CreatureDefinition, CreatureFilter } from '~/types/rulepack'
import type { RulepackFragment } from '~/schemas/rulepackSchema'
import { mergeById, distributeSubclasses, distributeSubraces } from '~/services/rulepackMerge'

/**
 * Apply a parsed rulepack fragment onto an existing fully-hydrated Rulepack.
 * Top-level subclass patch entries are distributed into the matching class.
 */
function applyFragment(existing: Rulepack, fragment: RulepackFragment): Rulepack {
  // Merge all regular content arrays (incoming overwrites by id)
  const classes = mergeById(existing.classes, fragment.classes ?? [])
  const pendingSubclasses = distributeSubclasses(classes, fragment.subclasses ?? [])

  const races = mergeById(existing.races, fragment.races ?? [])
  const pendingSubraces = distributeSubraces(races, fragment.subraces ?? [])

  return {
    ...existing,
    // Adopt the fragment's version — otherwise the stored pack keeps its old version
    // forever and the SRD loader's version check re-seeds on every startup.
    version: fragment.version,
    races,
    classes,
    backgrounds: mergeById(existing.backgrounds, fragment.backgrounds ?? []),
    feats: mergeById(existing.feats, fragment.feats ?? []),
    spells: mergeById(existing.spells, fragment.spells ?? []),
    creatures: mergeById(existing.creatures ?? [], fragment.creatures ?? []),
    optionalFeatures: mergeById(existing.optionalFeatures, fragment.optionalFeatures ?? []),
    subclasses: mergeById(existing.subclasses ?? [], pendingSubclasses),
    subraces: mergeById(existing.subraces ?? [], pendingSubraces),
  }
}

/** Convert a fragment into a fresh Rulepack, distributing any top-level subclass patches. */
function fragmentToRulepack(fragment: RulepackFragment): Rulepack {
  const classes = (fragment.classes ?? []).map(cls => ({ ...cls }))
  const pendingSubclasses = distributeSubclasses(classes, fragment.subclasses ?? [])

  const races = (fragment.races ?? []).map(r => ({ ...r }))
  const pendingSubraces = distributeSubraces(races, fragment.subraces ?? [])

  return {
    id: fragment.id,
    name: fragment.name,
    version: fragment.version,
    description: fragment.description,
    author: fragment.author,
    races,
    classes,
    backgrounds: fragment.backgrounds ?? [],
    feats: fragment.feats ?? [],
    spells: fragment.spells ?? [],
    creatures: fragment.creatures ?? [],
    optionalFeatures: fragment.optionalFeatures ?? [],
    subclasses: pendingSubclasses,
    subraces: pendingSubraces,
  }
}

export const useRulepacksStore = defineStore('rulepacks', () => {
  const rulepacks = ref<Rulepack[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    rulepacks.value = await db.rulepacks.toArray()
    loading.value = false
  }

  /**
   * Add or merge a rulepack fragment into the store.
   * If a rulepack with the same id already exists, the fragment's content is merged in;
   * otherwise a new rulepack is created from the fragment.
   */
  async function add(fragment: RulepackFragment): Promise<void> {
    const existingReactive = rulepacks.value.find(r => r.id === fragment.id)
    // Deep-clone to strip Vue reactive proxies — IndexedDB cannot serialize Proxy objects
    const existing = existingReactive ? JSON.parse(JSON.stringify(existingReactive)) as Rulepack : undefined
    const resolved = existing ? applyFragment(existing, fragment) : fragmentToRulepack(fragment)

    await db.rulepacks.put(resolved)
    const idx = rulepacks.value.findIndex(r => r.id === resolved.id)
    if (idx >= 0) {
      rulepacks.value[idx] = resolved
    }
    else {
      rulepacks.value.push(resolved)
    }
  }

  async function remove(id: string): Promise<void> {
    await db.rulepacks.delete(id)
    rulepacks.value = rulepacks.value.filter(r => r.id !== id)
  }

  function getById(id: string): Rulepack | undefined {
    return rulepacks.value.find(r => r.id === id)
  }

  /** Cross-pack subclass patches aimed at a class, from every loaded pack. */
  function pendingSubclassesFor(classId: string): SubclassDefinition[] {
    return rulepacks.value.flatMap(p =>
      (p.subclasses ?? [])
        .filter(entry => entry.classId === classId)
        .map(({ classId: _classId, ...sub }) => sub),
    )
  }

  /** Cross-pack subrace patches aimed at a race, from every loaded pack. */
  function pendingSubracesFor(raceId: string) {
    return rulepacks.value.flatMap(p =>
      (p.subraces ?? [])
        .filter(entry => entry.raceId === raceId)
        .map(({ raceId: _raceId, ...sub }) => sub),
    )
  }

  /**
   * A race with subraces contributed by other packs folded in. The stored pack is never
   * written to, so removing the pack that supplied a subrace removes the subrace with it.
   */
  function getRace(raceId: string): Race | undefined {
    for (const pack of rulepacks.value) {
      const race = pack.races.find(r => r.id === raceId)
      if (!race) continue
      const pending = pendingSubracesFor(raceId)
      if (pending.length === 0) return race
      return { ...race, subraces: mergeById(race.subraces ?? [], pending) }
    }
  }

  /** As getRace, for classes: subclasses from sourcebook packs are folded in on read. */
  function getClass(classId: string): ClassDefinition | undefined {
    for (const pack of rulepacks.value) {
      const cls = pack.classes.find(c => c.id === classId)
      if (!cls) continue
      const pending = pendingSubclassesFor(classId)
      if (pending.length === 0) return cls
      return { ...cls, subclasses: mergeById(cls.subclasses ?? [], pending) }
    }
  }

  function getSpell(spellId: string): SpellDefinition | undefined {
    for (const pack of rulepacks.value) {
      const spell = pack.spells.find(s => s.id === spellId)
      if (spell) return spell
    }
  }

  function getFeat(featId: string): FeatDefinition | undefined {
    for (const pack of rulepacks.value) {
      const feat = pack.feats.find(f => f.id === featId)
      if (feat) return feat
    }
  }

  /**
   * Every race across all loaded packs, alphabetical, each tagged with the name of the
   * pack it came from so the creation picker can say where a race is defined.
   */
  function getAllRaces(): Array<Race & { sourceName: string }> {
    return rulepacks.value
      .flatMap(p => p.races.map(race => ({ ...race, sourceName: p.name })))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function getAllClasses(): ClassDefinition[] {
    return rulepacks.value.flatMap(p => p.classes)
  }

  function getAllSpells(): SpellDefinition[] {
    return rulepacks.value.flatMap(p => p.spells)
  }

  function getAllFeats(): FeatDefinition[] {
    return rulepacks.value.flatMap(p => p.feats)
  }

  /**
   * Every creature statblock across all loaded packs. Later packs win on id, so a user
   * pack can override an SRD statblock without the SRD pack being edited — the same way
   * custom packs already extend or override classes and spells.
   */
  function getAllCreatures(): CreatureDefinition[] {
    const byId = new Map<string, CreatureDefinition>()
    for (const pack of rulepacks.value) {
      for (const creature of pack.creatures ?? []) byId.set(creature.id, creature)
    }
    return [...byId.values()]
  }

  function getCreature(creatureId: string): CreatureDefinition | undefined {
    return getAllCreatures().find(c => c.id === creatureId)
  }

  /**
   * Creatures a feature may select, given its filter. An explicit id list short-circuits
   * everything else (Find Familiar names its forms); otherwise the type, CR and movement
   * gates apply. allowSwim/allowFly default to permitting the speed, so a filter that
   * does not mention them is unrestricted — only Wild Shape's early levels set them false.
   */
  function getCreaturesMatching(filter: CreatureFilter): CreatureDefinition[] {
    const all = getAllCreatures()
    if (filter.ids) {
      const wanted = new Set(filter.ids)
      return all.filter(c => wanted.has(c.id))
    }
    return all.filter((c) => {
      if (filter.types && !filter.types.includes(c.type)) return false
      if (filter.sizes && !filter.sizes.includes(c.size)) return false
      if (filter.maxCR !== undefined && c.challengeRating > filter.maxCR) return false
      if (filter.minCR !== undefined && c.challengeRating < filter.minCR) return false
      if (filter.allowSwim === false && (c.speeds.swim ?? 0) > 0) return false
      if (filter.allowFly === false && (c.speeds.fly ?? 0) > 0) return false
      return true
    })
  }


  function getAllBackgrounds() {
    return rulepacks.value.flatMap(p => p.backgrounds)
  }

  function getSubclassesForClass(classId: string): SubclassDefinition[] {
    const cls = getClass(classId)
    return cls?.subclasses ?? []
  }

  function getSubclass(subclassId: string): SubclassDefinition | undefined {
    for (const pack of rulepacks.value) {
      for (const cls of pack.classes) {
        const sub = cls.subclasses?.find(s => s.id === subclassId)
        if (sub) return sub
      }
      const { classId: _classId, ...patch }
        = (pack.subclasses ?? []).find(s => s.id === subclassId) ?? { classId: '' }
      if ('id' in patch) return patch as SubclassDefinition
    }
  }

  /**
   * Every loaded pack folded into one, with cross-pack patches resolved. The level-up
   * pipeline takes a single Rulepack, so anything spanning packs — a sourcebook subclass
   * on an SRD class, a feature granting an SRD spell — has to be handed this rather than
   * whichever individual pack happened to define the class.
   */
  function composedPack(): Rulepack {
    const classes = rulepacks.value.flatMap(p => p.classes.map(c => ({ ...c })))
    const races = rulepacks.value.flatMap(p => p.races.map(r => ({ ...r })))
    distributeSubclasses(classes, rulepacks.value.flatMap(p => p.subclasses ?? []))
    distributeSubraces(races, rulepacks.value.flatMap(p => p.subraces ?? []))

    return {
      id: 'composed',
      name: 'All loaded rulepacks',
      version: '0',
      races,
      classes,
      backgrounds: getAllBackgrounds(),
      feats: getAllFeats(),
      spells: getAllSpells(),
      creatures: getAllCreatures(),
      optionalFeatures: rulepacks.value.flatMap(p => p.optionalFeatures),
    }
  }

  /**
   * Return all optional features across all loaded rulepacks for a given class + level.
   * Includes the name of the source pack so the player knows where the feature comes from.
   */
  function getOptionalFeaturesForClass(
    classId: string,
    level: number,
  ): Array<OptionalClassFeature & { sourceName: string }> {
    const results: Array<OptionalClassFeature & { sourceName: string }> = []
    for (const pack of rulepacks.value) {
      for (const feat of pack.optionalFeatures) {
        if (feat.classId === classId && feat.level === level) {
          results.push({ ...feat, sourceName: pack.name })
        }
      }
    }
    return results
  }

  return {
    rulepacks,
    loading,
    loadAll,
    add,
    remove,
    getById,
    getRace,
    getClass,
    getSpell,
    getFeat,
    getAllRaces,
    getAllClasses,
    getAllSpells,
    getAllFeats,
    getAllCreatures,
    getCreature,
    getCreaturesMatching,
    getAllBackgrounds,
    getSubclassesForClass,
    getSubclass,
    composedPack,
    getOptionalFeaturesForClass,
  }
})
