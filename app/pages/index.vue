<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import { importCharacter } from '~/services/characterIO'

const characterStore = useCharactersStore()
const rulepackStore = useRulepacksStore()

onMounted(async () => {
  await Promise.all([characterStore.loadAll(), rulepackStore.loadAll()])
})

const fileInput = ref<HTMLInputElement | null>(null)

async function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const character = await importCharacter(file)
    character.id = crypto.randomUUID()
    await characterStore.save(character)
  }
  catch (err: unknown) {
    alert((err as Error).message)
  }
  finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function deleteCharacter(id: string, name: string) {
  if (!confirm(`Delete ${name}? This cannot be undone.`)) return
  await characterStore.remove(id)
}

function totalLevel(classes: { level: number }[]) {
  return classes.reduce((s, c) => s + c.level, 0)
}

function classLabel(character: { classes: { classId: string; level: number }[] }) {
  return character.classes
    .map(c => `${c.classId.charAt(0).toUpperCase() + c.classId.slice(1)} ${c.level}`)
    .join(' / ')
}

function raceName(raceId: string) {
  return rulepackStore.getRace(raceId)?.name ?? raceId
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <h1 class="font-display text-lg font-semibold text-primary-400 tracking-wide">Waystone</h1>
      <div class="flex gap-2">
        <button class="btn-ghost text-xs" @click="fileInput?.click()">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import
        </button>
        <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImportFile" />
        <NuxtLink to="/characters/new" class="btn-primary text-xs">
          + New Character
        </NuxtLink>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-20">
      <!-- Empty state -->
      <div v-if="!characterStore.loading && characterStore.characters.length === 0" class="flex flex-col items-center justify-center pt-24 gap-4 text-center">
        <div class="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center">
          <svg class="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p class="text-slate-300 font-medium">No characters yet</p>
          <p class="text-slate-500 text-sm mt-1">Create your first character or import a JSON file.</p>
        </div>
        <NuxtLink to="/characters/new" class="btn-primary mt-2">Create Character</NuxtLink>
      </div>

      <!-- Character list -->
      <div v-else class="grid gap-3">
        <div
          v-for="character in characterStore.characters"
          :key="character.id"
          class="card flex items-center gap-4 overflow-hidden cursor-pointer hover:border-primary-500/40 transition-colors active:scale-[0.99]"
          @click="$router.push(`/characters/${character.id}`)"
        >
          <!-- Level badge -->
          <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-600/20 border border-primary-600/40 flex flex-col items-center justify-center">
            <span class="text-xl font-bold text-primary-300 leading-none">{{ totalLevel(character.classes) }}</span>
            <span class="text-[9px] uppercase text-primary-400/70 tracking-wide">lvl</span>
          </div>

          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white truncate">{{ character.name }}</p>
            <p class="text-xs text-slate-400 truncate">{{ raceName(character.race) }} · {{ classLabel(character) }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1" @click.stop>
            <NuxtLink :to="`/characters/${character.id}/levelup`" class="btn-ghost text-xs p-2" title="Level up">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </NuxtLink>
            <button class="btn-danger text-xs p-2" title="Delete" @click="deleteCharacter(character.id, character.name)">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <footer class="mt-8 pb-4 text-center">
        <NuxtLink to="/about" class="text-xs text-slate-500 hover:text-slate-300 transition-colors">About Waystone</NuxtLink>
      </footer>
    </main>
  </div>
</template>
