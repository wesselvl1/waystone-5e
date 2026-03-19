<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import { importFromFile, importFromUrl } from '~/services/rulepackImport'

const rulepackStore = useRulepacksStore()

onMounted(() => rulepackStore.loadAll())

const fileInput = ref<HTMLInputElement | null>(null)
const urlInput = ref('')
const showUrlModal = ref(false)
const confirmedUrl = ref('')
const importing = ref(false)
const error = ref('')

async function handleFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importing.value = true
  error.value = ''
  try {
    const pack = await importFromFile(file)
    await rulepackStore.add(pack)
  }
  catch (err: unknown) {
    error.value = (err as Error).message
  }
  finally {
    importing.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function openUrlModal() {
  urlInput.value = ''
  error.value = ''
  showUrlModal.value = true
}

async function confirmUrlImport() {
  confirmedUrl.value = urlInput.value.trim()
  showUrlModal.value = false
  if (!confirmedUrl.value) return
  importing.value = true
  error.value = ''
  try {
    const pack = await importFromUrl(confirmedUrl.value)
    await rulepackStore.add(pack)
  }
  catch (err: unknown) {
    error.value = (err as Error).message
  }
  finally {
    importing.value = false
  }
}

async function removePack(id: string, name: string) {
  if (!confirm(`Remove "${name}"? Characters using it won't be affected but lookups will break.`)) return
  await rulepackStore.remove(id)
}
</script>

<template>
  <div class="min-h-screen pb-4">
    <header class="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <h1 class="font-display text-lg font-semibold text-primary-400 tracking-wide">Rulepacks</h1>
      <div class="flex gap-2">
        <button class="btn-ghost text-xs" @click="fileInput?.click()">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          File
        </button>
        <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFile" />
        <button class="btn-ghost text-xs" @click="openUrlModal">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
          </svg>
          URL
        </button>
      </div>
    </header>

    <main class="px-4 pt-4 space-y-3">
      <p v-if="importing" class="text-slate-400 text-sm text-center py-4 animate-pulse">Importing…</p>
      <p v-if="error" class="text-danger-400 text-sm bg-danger-500/10 rounded-lg px-3 py-2 whitespace-pre-wrap">{{ error }}</p>

      <div v-if="rulepackStore.rulepacks.length === 0 && !importing" class="flex flex-col items-center justify-center pt-24 gap-4 text-center">
        <div class="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center">
          <svg class="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <p class="text-slate-300 font-medium">No rulepacks loaded</p>
          <p class="text-slate-500 text-sm mt-1">Import a JSON rulepack file or paste a URL.</p>
        </div>
      </div>

      <div v-for="pack in rulepackStore.rulepacks" :key="pack.id" class="card">
        <div class="flex items-start justify-between gap-3">
          <NuxtLink :to="`/rulepacks/${pack.id}`" class="flex-1 min-w-0">
            <p class="font-semibold text-white">{{ pack.name }}</p>
            <p class="text-xs text-slate-500 mt-0.5">v{{ pack.version }}<span v-if="pack.author"> · {{ pack.author }}</span></p>
            <p v-if="pack.description" class="text-xs text-slate-400 mt-1">{{ pack.description }}</p>
            <div class="flex gap-3 mt-2 text-[11px] text-slate-500">
              <span>{{ pack.races.length }} races</span>
              <span>{{ pack.classes.length }} classes</span>
              <span>{{ pack.spells.length }} spells</span>
              <span>{{ pack.feats.length }} feats</span>
            </div>
          </NuxtLink>
          <button class="btn-danger flex-shrink-0 p-2" @click="removePack(pack.id, pack.name)">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </main>

    <!-- URL confirmation modal -->
    <Teleport to="body">
      <div v-if="showUrlModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-md card space-y-4" @click.stop>
          <h2 class="font-semibold text-white">Import from URL</h2>
          <p class="text-sm text-slate-400">The app will fetch the rulepack from this URL. Only import rulepacks from sources you trust.</p>
          <div>
            <label class="label">URL</label>
            <input v-model="urlInput" type="url" class="input" placeholder="https://example.com/my-rulepack.json" @keydown.enter="confirmUrlImport" />
          </div>
          <div class="flex gap-2 justify-end">
            <button class="btn-ghost" @click="showUrlModal = false">Cancel</button>
            <button class="btn-primary" :disabled="!urlInput.trim()" @click="confirmUrlImport">Fetch & Import</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
