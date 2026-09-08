import { migrateCharacterShape } from '~/services/characterMigration'
import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Character } from '~/types/character'

export const useCharactersStore = defineStore('characters', () => {
  const characters = ref<Character[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    const stored = await db.characters.orderBy('updatedAt').reverse().toArray()
    // Characters are read raw from Dexie, so shape migrations have to happen here as
    // well as in CharacterSchema — the schema only guards the import boundary.
    characters.value = stored.map(c => migrateCharacterShape(c))
    loading.value = false
  }

  async function getById(id: string): Promise<Character | undefined> {
    // Also migrates: this reads straight from Dexie rather than the loaded array, so
    // skipping it here hands callers the stored shape even after loadAll() migrated.
    const stored = await db.characters.get(id)
    return stored ? migrateCharacterShape(stored) : undefined
  }

  async function save(character: Character): Promise<void> {
    character.updatedAt = new Date().toISOString()
    await db.characters.put(JSON.parse(JSON.stringify(character)))
    const idx = characters.value.findIndex(c => c.id === character.id)
    if (idx >= 0) {
      characters.value[idx] = character
    }
    else {
      characters.value.unshift(character)
    }
  }

  async function remove(id: string): Promise<void> {
    await db.characters.delete(id)
    characters.value = characters.value.filter(c => c.id !== id)
  }

  return { characters, loading, loadAll, getById, save, remove }
})
