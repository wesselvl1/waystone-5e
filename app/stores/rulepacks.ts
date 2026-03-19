import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Rulepack, Race, ClassDefinition, SubclassDefinition, SpellDefinition, FeatDefinition } from '~/types/rulepack'

export const useRulepacksStore = defineStore('rulepacks', () => {
  const rulepacks = ref<Rulepack[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    rulepacks.value = await db.rulepacks.toArray()
    loading.value = false
  }

  async function add(rulepack: Rulepack): Promise<void> {
    await db.rulepacks.put(rulepack)
    const idx = rulepacks.value.findIndex(r => r.id === rulepack.id)
    if (idx >= 0) {
      rulepacks.value[idx] = rulepack
    }
    else {
      rulepacks.value.push(rulepack)
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
  }
})
