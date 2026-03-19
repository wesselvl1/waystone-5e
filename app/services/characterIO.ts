import { CharacterSchema } from '~/schemas/characterSchema'
import type { Character } from '~/types/character'

export function exportCharacter(character: Character): void {
  const json = JSON.stringify(character, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${character.name.replace(/[^a-z0-9]/gi, '_')}_waystone.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importCharacter(source: File | string): Promise<Character> {
  let raw: unknown

  if (source instanceof File) {
    const text = await source.text()
    try {
      raw = JSON.parse(text)
    }
    catch {
      throw new Error('Invalid JSON file')
    }
  }
  else {
    try {
      raw = JSON.parse(source)
    }
    catch {
      throw new Error('Invalid JSON string')
    }
  }

  const result = CharacterSchema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`Character validation failed:\n${messages}`)
  }

  return result.data as Character
}
