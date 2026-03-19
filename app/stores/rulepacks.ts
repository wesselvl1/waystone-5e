import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Rulepack, Race, ClassDefinition, SubclassDefinition, SpellDefinition, FeatDefinition, OptionalClassFeature } from '~/types/rulepack'
import type { RulepackFragment } from '~/schemas/rulepackSchema'

/** Merge two arrays by id — incoming items overwrite existing ones with the same id. */
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map(item => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

/**
 * Apply a parsed rulepack fragment onto an existing fully-hydrated Rulepack.
 * Top-level subclass patch entries are distributed into the matching class.
 */
function applyFragment(existing: Rulepack, fragment: RulepackFragment): Rulepack {
  // Merge all regular content arrays (incoming overwrites by id)
  let classes = mergeById(existing.classes, fragment.classes ?? [])

  // Distribute top-level subclass patches to their target classes
  for (const { classId, ...subclassDef } of fragment.subclasses ?? []) {
    const cls = classes.find(c => c.id === classId)
    if (cls) {
      cls.subclasses = mergeById(cls.subclasses ?? [], [subclassDef])
    }
    else {
      console.warn(`[Waystone] Subclass "${subclassDef.id}" targets class "${classId}" which is not in rulepack "${existing.id}".`)
    }
  }

  let races = mergeById(existing.races, fragment.races ?? [])

  // Distribute top-level subrace patches to their target races
  for (const { raceId, ...subraceDef } of fragment.subraces ?? []) {
    const race = races.find(r => r.id === raceId)
    if (race) {
      race.subraces = mergeById(race.subraces ?? [], [subraceDef])
    }
    else {
      console.warn(`[Waystone] Subrace "${subraceDef.id}" targets race "${raceId}" which is not in rulepack "${existing.id}".`)
    }
  }

  return {
    ...existing,
    races,
    classes,
    backgrounds: mergeById(existing.backgrounds, fragment.backgrounds ?? []),
    feats: mergeById(existing.feats, fragment.feats ?? []),
    spells: mergeById(existing.spells, fragment.spells ?? []),
    optionalFeatures: mergeById(existing.optionalFeatures, fragment.optionalFeatures ?? []),
  }
}

/** Convert a fragment into a fresh Rulepack, distributing any top-level subclass patches. */
function fragmentToRulepack(fragment: RulepackFragment): Rulepack {
  const classes = (fragment.classes ?? []).map(cls => ({ ...cls }))

  for (const { classId, ...subclassDef } of fragment.subclasses ?? []) {
    const cls = classes.find(c => c.id === classId)
    if (cls) {
      cls.subclasses = mergeById(cls.subclasses ?? [], [subclassDef])
    }
    else {
      console.warn(`[Waystone] Subclass "${subclassDef.id}" targets class "${classId}" which was not found in the fragment.`)
    }
  }

  const races = (fragment.races ?? []).map(r => ({ ...r }))

  for (const { raceId, ...subraceDef } of fragment.subraces ?? []) {
    const race = races.find(r => r.id === raceId)
    if (race) {
      race.subraces = mergeById(race.subraces ?? [], [subraceDef])
    }
    else {
      console.warn(`[Waystone] Subrace "${subraceDef.id}" targets race "${raceId}" which was not found in the fragment.`)
    }
  }

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
    optionalFeatures: fragment.optionalFeatures ?? [],
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

  function getRace(raceId: string): Race | undefined {
    for (const pack of rulepacks.value) {
      const race = pack.races.find(r => r.id === raceId)
      if (race) return race
    }
  }

  function getClass(classId: string): ClassDefinition | undefined {
    for (const pack of rulepacks.value) {
      const cls = pack.classes.find(c => c.id === classId)
      if (cls) return cls
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

  function getAllRaces(): Race[] {
    return rulepacks.value.flatMap(p => p.races)
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
    getAllBackgrounds,
    getSubclassesForClass,
    getSubclass,
    getOptionalFeaturesForClass,
  }
})
