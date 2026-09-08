import Dexie, { type Table } from 'dexie'
import type { Character } from '~/types/character'
import type { Rulepack } from '~/types/rulepack'

export class WaystoneDatabase extends Dexie {
  characters!: Table<Character, string>
  rulepacks!: Table<Rulepack, string>

  constructor() {
    super('WaystoneDB')

    this.version(1).stores({
      characters: 'id, name, updatedAt',
      rulepacks: 'id, name',
    })
  }
}

export const db = new WaystoneDatabase()
