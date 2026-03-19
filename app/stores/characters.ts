import { defineStore } from 'pinia'
import { db } from '~/db'
import type { Character } from '~/types/character'

export const useCharactersStore = defineStore('characters', () => {
  const characters = ref<Character[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    characters.value = await db.characters.orderBy('updatedAt').reverse().toArray()
    loading.value = false
  }

  async function getById(id: string): Promise<Character | undefined> {
    return db.characters.get(id)
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
