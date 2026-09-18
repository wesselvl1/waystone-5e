import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Rulepack, Race, ClassDefinition, SubclassDefinition, SubclassPatchEntry, SubracePatchEntry, Background, SpellDefinition, FeatDefinition, ForkOrigin, OptionalClassFeature, CreatureDefinition, CreatureFilter, WeaponDefinition, ArmorDefinition } from '~/types/rulepack'
import type { RulepackFragment } from '~/schemas/rulepackSchema'
import { mergeById, mergeOptionPools, distributeSubclasses, distributeSubraces } from '~/services/rulepackMerge'
import type { EntryKind, ForkStatus } from '~/services/homebrew'
import {
  HOMEBREW_PACK_ID,
  blankHomebrewPack,
  claimedIds,
  deleteEntry,
  entryId,
  forkStatuses,
  hashEntry,
  inLookupOrder,
  listEntries,
  unshadowed,
  upsertEntry,
} from '~/services/homebrew'

/** A rulepack entry carrying the name of the pack that defines it, for display. */
export type WithSource<T> = T & { sourceName: string }

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
    weapons: mergeById(existing.weapons ?? [], fragment.weapons ?? []),
    armor: mergeById(existing.armor ?? [], fragment.armor ?? []),
    optionalFeatures: mergeById(existing.optionalFeatures, fragment.optionalFeatures ?? []),
    subclasses: mergeById(existing.subclasses ?? [], pendingSubclasses),
    subraces: mergeById(existing.subraces ?? [], pendingSubraces),
    optionPools: mergeOptionPools(existing.optionPools ?? [], fragment.optionPools ?? []),
    // Carried across a re-import: a pack moved to another browser still knows which of
    // its entries are copies, and of what.
    forkedFrom: { ...(existing.forkedFrom ?? {}), ...(fragment.forkedFrom ?? {}) },
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
    weapons: fragment.weapons ?? [],
    armor: fragment.armor ?? [],
    optionalFeatures: fragment.optionalFeatures ?? [],
    subclasses: pendingSubclasses,
    subraces: pendingSubraces,
    optionPools: mergeOptionPools([], fragment.optionPools ?? []),
    forkedFrom: fragment.forkedFrom,
  }
}

/** Dexie cannot structured-clone Vue reactive proxies, and nor can `put`. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useRulepacksStore = defineStore('rulepacks', () => {
  const rulepacks = ref<Rulepack[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    rulepacks.value = inLookupOrder(await db.rulepacks.toArray())
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
    const existing = existingReactive ? plain(existingReactive) : undefined
    const resolved = existing ? applyFragment(existing, fragment) : fragmentToRulepack(fragment)

    await db.rulepacks.put(resolved)
    const idx = rulepacks.value.findIndex(r => r.id === resolved.id)
    if (idx >= 0) {
      rulepacks.value[idx] = resolved
    }
    else {
      rulepacks.value = inLookupOrder([...rulepacks.value, resolved])
    }
  }

  async function remove(id: string): Promise<void> {
    await db.rulepacks.delete(id)
    rulepacks.value = rulepacks.value.filter(r => r.id !== id)
  }

  /**
   * Drop every stored pack, the bundled SRD included. The SRD loader re-seeds on the next
   * startup because its version check finds no stored pack, so this is how a user clears
   * dev fragments or a half-merged book that `remove` alone cannot separate out again.
   */
  async function removeAll(): Promise<void> {
    await db.rulepacks.clear()
    rulepacks.value = []
  }

  function getById(id: string): Rulepack | undefined {
    return rulepacks.value.find(r => r.id === id)
  }

  // -------------------------------------------------------------------------
  // The player's own pack, and how it shadows the books
  // -------------------------------------------------------------------------

  /** The pack the in-app editor writes to. Absent until something is written. */
  function homebrewPack(): Rulepack | undefined {
    return rulepacks.value.find(r => r.id === HOMEBREW_PACK_ID)
  }

  /** Ids the player's own pack claims for a kind; see `claimedIds`. */
  function claimedByHomebrew(kind: EntryKind): Set<string> {
    return claimedIds(rulepacks.value, kind)
  }

  /** Cross-pack subclass patches aimed at a class, from every loaded pack. */
  function pendingSubclassesFor(classId: string): SubclassDefinition[] {
    const claimed = claimedByHomebrew('subclasses')
    return rulepacks.value.flatMap(p =>
      unshadowed(p, 'subclasses', p.subclasses ?? [], claimed)
        .filter(entry => entry.classId === classId)
        .map(({ classId: _classId, ...sub }) => sub),
    )
  }

  /** Cross-pack subrace patches aimed at a race, from every loaded pack. */
  function pendingSubracesFor(raceId: string) {
    const claimed = claimedByHomebrew('subraces')
    return rulepacks.value.flatMap(p =>
      unshadowed(p, 'subraces', p.subraces ?? [], claimed)
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
   * Everything of one kind across all loaded packs, each entry tagged with the name of
   * the pack it came from. Two packs' takes on the same content are both listed — pack
   * ids are namespaced (`mpmm-satyr`), so a second book's Satyr is a separate entry
   * rather than an override, and `sourceName` is what tells the two apart in a picker.
   * The one exception is the player's own pack, whose entries shadow the ones they were
   * copied from; see `claimedByHomebrew`.
   */
  function withSource<T>(kind: EntryKind, pick: (pack: Rulepack) => T[]): Array<WithSource<T>> {
    const claimed = claimedByHomebrew(kind)
    return rulepacks.value.flatMap(p =>
      unshadowed(p, kind, pick(p), claimed).map(entry => ({ ...entry, sourceName: p.name })))
  }

  /** Sorted the way the pickers list them, so merging a pack in never reshuffles. */
  function byName(a: { name: string }, b: { name: string }) {
    return a.name.localeCompare(b.name)
  }

  function getAllRaces(): Array<WithSource<Race>> {
    return withSource('races', p => p.races).sort(byName)
  }

  function getAllClasses(): Array<WithSource<ClassDefinition>> {
    return withSource('classes', p => p.classes).sort(byName)
  }

  /** By level first: the level-up picker shows several levels at once. */
  function getAllSpells(): Array<WithSource<SpellDefinition>> {
    return withSource('spells', p => p.spells).sort((a, b) => a.level - b.level || byName(a, b))
  }

  function getAllFeats(): Array<WithSource<FeatDefinition>> {
    return withSource('feats', p => p.feats).sort(byName)
  }

  /**
   * Every creature statblock across all loaded packs. Later packs win on id, so a user
   * pack can override an SRD statblock without the SRD pack being edited — the same way
   * custom packs already extend or override classes and spells. The player's own pack is
   * read last whatever its position, since it sorts first for the singular getters.
   */
  function getAllCreatures(): CreatureDefinition[] {
    const byId = new Map<string, CreatureDefinition>()
    const claimed = claimedByHomebrew('creatures')
    for (const pack of rulepacks.value) {
      if (pack.id === HOMEBREW_PACK_ID) continue
      for (const creature of unshadowed(pack, 'creatures', pack.creatures ?? [], claimed)) {
        byId.set(creature.id, creature)
      }
    }
    for (const creature of homebrewPack()?.creatures ?? []) byId.set(creature.id, creature)
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

  /**
   * Every weapon across all loaded packs, for the sheet's attack picker. Tagged with its
   * source like the other pick-lists, since two books' takes on the same weapon are two
   * entries and the label is what tells them apart.
   */
  function getAllWeapons(): Array<WithSource<WeaponDefinition>> {
    return withSource('weapons', p => p.weapons ?? []).sort(byName)
  }

  function getWeapon(weaponId: string): WeaponDefinition | undefined {
    for (const pack of rulepacks.value) {
      const weapon = (pack.weapons ?? []).find(w => w.id === weaponId)
      if (weapon) return weapon
    }
  }

  /**
   * Every armour, shield and unarmored base across all loaded packs, for the AC
   * calculator's one dropdown. Tagged with its source like the other pick-lists.
   */
  function getAllArmor(): Array<WithSource<ArmorDefinition>> {
    return withSource('armor', p => p.armor ?? []).sort(byName)
  }

  function getArmor(armorId: string): ArmorDefinition | undefined {
    for (const pack of rulepacks.value) {
      const armor = (pack.armor ?? []).find(a => a.id === armorId)
      if (armor) return armor
    }
  }

  function getAllBackgrounds(): Array<WithSource<Background>> {
    return withSource('backgrounds', p => p.backgrounds).sort(byName)
  }

  function getBackground(backgroundId: string): Background | undefined {
    for (const pack of rulepacks.value) {
      const background = pack.backgrounds.find(b => b.id === backgroundId)
      if (background) return background
    }
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
   *
   * Shadowed entries are dropped here too. Leaving both in would hand the pipeline two
   * classes with one id, and which of them it found would depend on array order.
   */
  function composedPack(): Rulepack {
    const composed = <T>(kind: EntryKind, pick: (pack: Rulepack) => T[]): T[] => {
      const claimed = claimedByHomebrew(kind)
      return rulepacks.value.flatMap(p => unshadowed(p, kind, pick(p), claimed))
    }

    const classes = composed('classes', p => p.classes).map(c => ({ ...c }))
    const races = composed('races', p => p.races).map(r => ({ ...r }))
    distributeSubclasses(classes, composed('subclasses', p => p.subclasses ?? []))
    distributeSubraces(races, composed('subraces', p => p.subraces ?? []))

    return {
      id: 'composed',
      name: 'All loaded rulepacks',
      version: '0',
      races,
      classes,
      backgrounds: composed('backgrounds', p => p.backgrounds),
      feats: composed('feats', p => p.feats),
      spells: composed('spells', p => p.spells),
      creatures: getAllCreatures(),
      weapons: composed('weapons', p => p.weapons ?? []),
      armor: composed('armor', p => p.armor ?? []),
      optionalFeatures: composed('optionalFeatures', p => p.optionalFeatures),
      // Not distributed into anything: a pool patch is resolved where the pool is
      // offered, so it only has to reach the composed pack to widen an SRD class's list.
      optionPools: composed('optionPools', p => p.optionPools ?? []),
    }
  }

  /**
   * Return all optional features across all loaded rulepacks for a given class + level.
   * Includes the name of the source pack so the player knows where the feature comes from.
   */
  function getOptionalFeaturesForClass(
    classId: string,
    level: number,
  ): Array<WithSource<OptionalClassFeature>> {
    return withSource('optionalFeatures', p => p.optionalFeatures)
      .filter(feature => feature.classId === classId && feature.level === level)
  }

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  /** Write a whole pack back to IndexedDB and into the store's list. */
  async function savePack(pack: Rulepack): Promise<void> {
    const stored = plain(pack)
    await db.rulepacks.put(stored)
    const idx = rulepacks.value.findIndex(p => p.id === stored.id)
    if (idx >= 0) rulepacks.value[idx] = stored
    else rulepacks.value = inLookupOrder([...rulepacks.value, stored])
  }

  /** The player's own pack, created empty the first time something is written to it. */
  async function ensureHomebrewPack(): Promise<Rulepack> {
    const existing = homebrewPack()
    if (existing) return plain(existing)
    const created = blankHomebrewPack()
    await savePack(created)
    return created
  }

  /**
   * The entry a copy was made from, as the book has it *now*.
   *
   * Read straight off the stored pack rather than through `getRace`/`getClass`, which
   * fold in patches from other packs: what a copy has to be compared against is the
   * entry as it was copied, and that is what the copy button had in its hands.
   */
  function sourceEntry(packId: string, kind: EntryKind, id: string): unknown {
    const pack = getById(packId)
    if (!pack) return undefined
    return listEntries(pack, kind).find(entry => entryId(kind, entry) === id)
  }

  /** What to record about the book an entry is being copied out of. */
  function forkOriginFor(packId: string, kind: EntryKind, id: string): ForkOrigin | undefined {
    const pack = getById(packId)
    const entry = sourceEntry(packId, kind, id)
    if (!pack || entry === undefined) return undefined
    return {
      packId: pack.id,
      packName: pack.name,
      packVersion: pack.version,
      hash: hashEntry(entry),
    }
  }

  /**
   * Save an entry into the player's own pack, creating that pack if this is the first.
   *
   * `origin` is passed when the entry came out of a book — on the first copy, and again
   * whenever the player looks at a changed source and decides to keep their version,
   * which re-snapshots the hash and quiets the notice until the book moves again.
   */
  async function saveHomebrewEntry(
    kind: EntryKind,
    entry: Record<string, unknown>,
    origin?: ForkOrigin,
  ): Promise<void> {
    const pack = await ensureHomebrewPack()
    await savePack(upsertEntry(pack, kind, plain(entry), origin))
  }

  /**
   * Drop an entry from the player's own pack. For a copy this is how the book's own
   * version comes back: nothing was ever written to the book, so removing the copy that
   * shadowed it is the whole of the undo.
   */
  async function removeHomebrewEntry(kind: EntryKind, id: string): Promise<void> {
    const pack = homebrewPack()
    if (!pack) return
    await savePack(deleteEntry(plain(pack), kind, id))
  }

  /** Which copies have fallen behind the books they were taken from. */
  function homebrewForkStatuses(): ForkStatus[] {
    const pack = homebrewPack()
    return pack ? forkStatuses(pack, sourceEntry) : []
  }

  return {
    rulepacks,
    loading,
    loadAll,
    add,
    remove,
    removeAll,
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
    getAllWeapons,
    getWeapon,
    getAllArmor,
    getArmor,
    getAllBackgrounds,
    getBackground,
    getSubclassesForClass,
    getSubclass,
    composedPack,
    getOptionalFeaturesForClass,
    homebrewPack,
    ensureHomebrewPack,
    savePack,
    sourceEntry,
    forkOriginFor,
    saveHomebrewEntry,
    removeHomebrewEntry,
    homebrewForkStatuses,
  }
})
