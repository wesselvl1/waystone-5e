<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import type { SpellDefinition } from '~/types/rulepack'
import type { EntryKind, ProseBlock } from '~/services/homebrew'
import {
  ENTRY_KINDS,
  HOMEBREW_PACK_ID,
  blankHomebrewPack,
  entryId,
  entryKindMeta,
  entryName,
  fieldValue,
  forkKey,
  listEntries,
  mintEntryId,
  proseBlocks,
} from '~/services/homebrew'

const route = useRoute()
const router = useRouter()
const rulepackStore = useRulepacksStore()

onMounted(async () => {
  await rulepackStore.loadAll()
  if (!pack.value) router.replace('/rulepacks')
})

const packId = computed(() => route.params.id as string)
const pack = computed(() => rulepackStore.getById(packId.value))
const isHomebrew = computed(() => packId.value === HOMEBREW_PACK_ID)

/**
 * The kinds this pack gets a tab for: whatever it holds, plus — in the player's own pack
 * — every kind there is, since an empty tab is where a new entry is created.
 */
const TABS = computed(() =>
  ENTRY_KINDS.filter(meta =>
    isHomebrew.value || (pack.value ? listEntries(pack.value, meta.key).length > 0 : false)))

/** The five kinds this page renders in full; the rest share one card. */
const BESPOKE = new Set<EntryKind>(['races', 'classes', 'backgrounds', 'feats', 'spells'])

const activeTab = ref<EntryKind>('races')
const expanded = ref<string | null>(null)

// A pack with no races opens on whatever it does have.
watch(TABS, (tabs) => {
  if (tabs.length && !tabs.some(tab => tab.key === activeTab.value)) activeTab.value = tabs[0]!.key
}, { immediate: true })

function setTab(key: EntryKind) {
  activeTab.value = key
  expanded.value = null
  spellSearch.value = ''
  spellLevelFilter.value = null
}

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function entriesOf(kind: EntryKind): Record<string, unknown>[] {
  return pack.value ? listEntries(pack.value, kind) : []
}

// Spell filters
const spellSearch = ref('')
const spellLevelFilter = ref<number | null>(null)

const filteredSpells = computed((): SpellDefinition[] => {
  if (!pack.value) return []
  let spells = pack.value.spells
  if (spellLevelFilter.value !== null) {
    const lvl = spellLevelFilter.value
    spells = spells.filter(s => s.level === lvl)
  }
  const q = spellSearch.value.trim().toLowerCase()
  if (q) spells = spells.filter(s => s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q))
  return [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
})

const spellsByLevel = computed(() => {
  const map = new Map<number, SpellDefinition[]>()
  for (const spell of filteredSpells.value) {
    if (!map.has(spell.level)) map.set(spell.level, [])
    map.get(spell.level)!.push(spell)
  }
  return [...map.entries()].sort(([a], [b]) => a - b)
})

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

function formatASI(bonuses: Partial<Record<string, number>>): string {
  return Object.entries(bonuses)
    .filter(([, v]) => v !== undefined && v !== 0)
    .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${ABILITY_LABELS[k] ?? k.toUpperCase()}`)
    .join(', ')
}

function levelLabel(l: number): string {
  return l === 0 ? 'Cantrips' : `Level ${l} Spells`
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

interface EditorState {
  kind: EntryKind
  entry: Record<string, unknown>
  mode: 'edit' | 'duplicate' | 'new'
  sourcePackName?: string
  copiesOnSave: boolean
}

const editing = ref<EditorState | null>(null)
/** Shown after a book's entry has been copied, so the edit is not silently elsewhere. */
const savedNotice = ref('')

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function openEdit(kind: EntryKind, entry: Record<string, unknown>) {
  savedNotice.value = ''
  editing.value = {
    kind,
    entry: clone(entry),
    mode: 'edit',
    sourcePackName: pack.value?.name,
    // A book is never written to: editing one of its entries copies it out.
    copiesOnSave: !isHomebrew.value,
  }
}

function openDuplicate(kind: EntryKind, entry: Record<string, unknown>) {
  savedNotice.value = ''
  editing.value = {
    kind,
    // Blank id and a marked name: this stands beside the original rather than replacing
    // it, so it must not inherit the id the original is looked up by.
    entry: { ...clone(entry), id: '', name: `${entryName(kind, entry)} (copy)` },
    mode: 'duplicate',
    sourcePackName: pack.value?.name,
    copiesOnSave: false,
  }
}

function openNew(kind: EntryKind) {
  savedNotice.value = ''
  editing.value = { kind, entry: entryKindMeta(kind).blank(), mode: 'new', copiesOnSave: false }
}

async function onSave(saved: Record<string, unknown>) {
  const state = editing.value
  if (!state) return

  let entry = saved
  if (state.mode !== 'edit' && state.kind !== 'optionPools' && !entry.id) {
    const target = rulepackStore.homebrewPack() ?? blankHomebrewPack()
    entry = { ...entry, id: mintEntryId(target, state.kind, String(entry.name ?? '')) }
  }

  const origin = state.copiesOnSave
    ? rulepackStore.forkOriginFor(packId.value, state.kind, entryId(state.kind, entry))
    : undefined

  await rulepackStore.saveHomebrewEntry(state.kind, entry, origin)

  savedNotice.value = isHomebrew.value
    ? ''
    : `Saved “${entryName(state.kind, entry)}” to your Homebrew pack. It is what the app uses now.`
  editing.value = null
}

// ---------------------------------------------------------------------------
// Deleting, and copies whose book has moved on
// ---------------------------------------------------------------------------

const pendingDelete = ref<{ kind: EntryKind; id: string; name: string } | null>(null)

const deletePrompt = computed(() => {
  const pending = pendingDelete.value
  if (!pending) return null
  const status = forkStatusFor(pending.kind, pending.id)
  return {
    title: `Delete “${pending.name}”?`,
    message: status
      ? `This is your copy of an entry from ${status.origin.packName}. Deleting it brings that `
        + 'version back.'
      : 'Characters already using it keep the name on the sheet, but lookups will break.',
  }
})

async function confirmDelete() {
  const pending = pendingDelete.value
  pendingDelete.value = null
  if (!pending) return
  await rulepackStore.removeHomebrewEntry(pending.kind, pending.id)
}

const forkStatuses = computed(() => rulepackStore.homebrewForkStatuses())

function forkStatusFor(kind: EntryKind, id: string) {
  return forkStatuses.value.find(status => status.kind === kind && status.id === id)
}

/** Copies the book has moved on underneath — the notice the homebrew pack leads with. */
const staleForks = computed(() => forkStatuses.value.filter(status => status.state !== 'current'))

/**
 * Keep this copy as it is, and stop saying the book has changed.
 *
 * Re-saving with a fresh origin re-snapshots the source hash, so the notice returns only
 * the next time the book itself moves — which is the honest behaviour: the reader has
 * seen this change and decided.
 */
async function keepCopy(kind: EntryKind, id: string) {
  const homebrew = rulepackStore.homebrewPack()
  const entry = homebrew && listEntries(homebrew, kind).find(candidate => entryId(kind, candidate) === id)
  if (!entry) return
  const status = forkStatusFor(kind, id)
  const origin = status ? rulepackStore.forkOriginFor(status.origin.packId, kind, id) : undefined
  await rulepackStore.saveHomebrewEntry(kind, clone(entry), origin)
}

/**
 * Which of this book's entries the player has already copied and edited.
 *
 * Shown as a chip on the book's own page: the entry on screen is not the one the app is
 * using, and nothing else would say so.
 */
const homebrewClaims = computed(() => {
  const claims = new Set<string>()
  const homebrew = rulepackStore.homebrewPack()
  if (!homebrew || isHomebrew.value) return claims
  for (const meta of ENTRY_KINDS) {
    for (const entry of listEntries(homebrew, meta.key)) {
      claims.add(forkKey(meta.key, entryId(meta.key, entry)))
    }
  }
  return claims
})

function isEdited(kind: EntryKind, entry: unknown): boolean {
  return homebrewClaims.value.has(forkKey(kind, entryId(kind, entry)))
}

// ---------------------------------------------------------------------------
// The shared card, for the kinds this page does not render in full
// ---------------------------------------------------------------------------

/** A one-line "simple · melee · 1d8 · slashing", built from the kind's own field list. */
function summaryOf(kind: EntryKind, entry: Record<string, unknown>): string {
  return entryKindMeta(kind).fields
    .filter(field => field.key !== 'name' && field.kind !== 'multiline')
    .map(field => String(fieldValue(entry, field)))
    .filter(Boolean)
    .join(' · ')
}

function proseOf(entry: Record<string, unknown>): ProseBlock[] {
  return proseBlocks(entry)
}

function descriptionOf(entry: Record<string, unknown>): string {
  return typeof entry.description === 'string' ? entry.description : ''
}

// ---------------------------------------------------------------------------
// Name and description — the parts of a book that are the player's to change
// ---------------------------------------------------------------------------

const editingDetails = ref(false)
const nameDraft = ref('')
const descriptionDraft = ref('')

function openDetails() {
  if (!pack.value) return
  nameDraft.value = pack.value.name
  descriptionDraft.value = pack.value.description ?? ''
  editingDetails.value = true
}

async function saveDetails() {
  if (!nameDraft.value.trim()) return
  editingDetails.value = false
  await rulepackStore.updatePackDetails(packId.value, {
    name: nameDraft.value,
    description: descriptionDraft.value,
  })
}

// ---------------------------------------------------------------------------
// Export — the only way a pack written here leaves this browser
// ---------------------------------------------------------------------------

function exportPack() {
  if (!pack.value) return
  const blob = new Blob([JSON.stringify(pack.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${pack.value.id}.json`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="min-h-screen pb-8">
    <!-- Header -->
    <header class="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <NuxtLink to="/rulepacks" class="btn-ghost p-2 -ml-2 flex-shrink-0">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <div class="flex-1 min-w-0">
        <h1 class="font-display text-lg font-semibold text-primary-400 tracking-wide truncate">{{ pack?.name }}</h1>
        <p v-if="pack" class="text-xs text-slate-500 truncate">
          v{{ pack.version }}<span v-if="pack.author"> · {{ pack.author }}</span>
        </p>
      </div>
      <button v-if="pack" class="btn-ghost p-2 flex-shrink-0" aria-label="Edit name and description" title="Edit name and description" @click="openDetails">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button v-if="pack" class="btn-ghost text-xs flex-shrink-0" @click="exportPack">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>
    </header>

    <template v-if="pack">
      <!-- Pack meta -->
      <div class="px-4 pt-3 space-y-1">
        <p v-if="pack.description" class="text-sm text-slate-400">{{ pack.description }}</p>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{{ pack.races.length }} races</span>
          <span>{{ pack.classes.length }} classes</span>
          <span>{{ pack.backgrounds.length }} backgrounds</span>
          <span>{{ pack.feats.length }} feats</span>
          <span>{{ pack.spells.length }} spells</span>
        </div>
      </div>

      <!-- What a copy costs: it stops receiving the book's own corrections -->
      <div v-if="isHomebrew" class="px-4 pt-3">
        <p class="text-xs text-slate-400 bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2">
          Entries here replace the book's version wherever the app looks one up, and they do
          <em>not</em> update with it. The app's rules data is still being corrected, so a copy taken
          today can be missing a fix made tomorrow — you will be told below when the book one of
          these came from has changed.
        </p>
      </div>

      <!-- Copies whose source has moved on -->
      <div v-if="isHomebrew && staleForks.length" class="px-4 pt-3 space-y-2">
        <div
          v-for="status in staleForks"
          :key="`${status.kind}:${status.id}`"
          class="rounded-lg bg-accent-900/20 border border-accent-700/40 px-3 py-2.5 space-y-2"
        >
          <p class="text-xs text-accent-200">
            <span class="font-semibold">{{ status.name }}</span>
            <template v-if="status.state === 'changed'">
              — {{ status.origin.packName }} has changed this since you copied it (v{{ status.origin.packVersion }}).
              Your copy is what the app uses.
            </template>
            <template v-else>
              — {{ status.origin.packName }} no longer has this entry, so your copy is the only
              version left.
            </template>
          </p>
          <div v-if="status.state === 'changed'" class="flex gap-2">
            <button
              class="btn-ghost text-xs py-1"
              @click="pendingDelete = { kind: status.kind, id: status.id, name: status.name }"
            >Take the book's version</button>
            <button class="btn-ghost text-xs py-1" @click="keepCopy(status.kind, status.id)">Keep mine</button>
          </div>
        </div>
      </div>

      <p
        v-if="savedNotice"
        class="mx-4 mt-3 text-xs text-slate-300 bg-primary-900/30 border border-primary-700/40 rounded-lg px-3 py-2"
      >
        {{ savedNotice }}
        <NuxtLink :to="`/rulepacks/${HOMEBREW_PACK_ID}`" class="text-primary-400 underline">Open Homebrew</NuxtLink>
      </p>

      <!-- Tabs -->
      <div class="sticky top-[53px] z-30 flex gap-1 px-4 py-2 mt-2 bg-surface-900/95 backdrop-blur border-b border-surface-700/40 overflow-x-auto" style="scrollbar-width: none;">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
          :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-surface-700 hover:text-white'"
          @click="setTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <main class="px-4 pt-4 space-y-2">
        <!-- New, in the player's own pack -->
        <div v-if="isHomebrew" class="flex justify-end">
          <button class="btn-primary text-xs" @click="openNew(activeTab)">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New {{ entryKindMeta(activeTab).singular }}
          </button>
        </div>

        <!-- ========== RACES ========== -->
        <template v-if="activeTab === 'races'">
          <p v-if="pack.races.length === 0" class="text-slate-500 text-sm text-center py-8">No races in this pack.</p>
          <div v-for="race in pack.races" :key="race.id" class="card">
            <div class="flex items-start justify-between gap-3">
              <button class="flex-1 min-w-0 flex items-start gap-3 text-left" @click="toggle(race.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-white">{{ race.name }}</span>
                    <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-700 text-slate-400">{{ race.size }}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">
                    {{ formatASI(race.abilityScoreBonuses) || 'No ASI' }} · Walk {{ race.speeds.walk }}ft<template v-if="race.speeds.fly">, Fly {{ race.speeds.fly }}ft</template><template v-if="race.speeds.swim">, Swim {{ race.speeds.swim }}ft</template><template v-if="race.speeds.climb">, Climb {{ race.speeds.climb }}ft</template> · {{ race.languages.join(', ') }}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                  :class="expanded === race.id ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <RulepackEntryActions
                :can-delete="isHomebrew"
                :edited="isEdited('races', race)"
                @edit="openEdit('races', race as unknown as Record<string, unknown>)"
                @duplicate="openDuplicate('races', race as unknown as Record<string, unknown>)"
                @delete="pendingDelete = { kind: 'races', id: race.id, name: race.name }"
              />
            </div>

            <div v-if="expanded === race.id" class="mt-3 pt-3 border-t border-surface-700/50 space-y-4">
              <!-- Traits -->
              <div v-if="race.traits.length">
                <p class="section-header">Racial Traits</p>
                <div class="space-y-2.5">
                  <div v-for="trait in race.traits" :key="trait.name">
                    <p class="text-sm font-medium text-slate-200">{{ trait.name }}</p>
                    <p class="text-xs text-slate-400 mt-0.5 whitespace-pre-wrap leading-relaxed">{{ trait.description }}</p>
                  </div>
                </div>
              </div>
              <!-- Subraces -->
              <div v-if="race.subraces?.length">
                <p class="section-header">Subraces</p>
                <div class="space-y-2">
                  <div v-for="sub in race.subraces" :key="sub.id" class="rounded-lg bg-surface-900/60 border border-surface-700/40 p-3">
                    <p class="text-sm font-semibold text-white">{{ sub.name }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">{{ formatASI(sub.abilityScoreBonuses) || 'No ASI' }}</p>
                    <div v-if="sub.traits.length" class="mt-2 space-y-2">
                      <div v-for="t in sub.traits" :key="t.name">
                        <p class="text-xs font-medium text-slate-300">{{ t.name }}</p>
                        <p class="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed mt-0.5">{{ t.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ========== CLASSES ========== -->
        <template v-if="activeTab === 'classes'">
          <p v-if="pack.classes.length === 0" class="text-slate-500 text-sm text-center py-8">No classes in this pack.</p>
          <div v-for="cls in pack.classes" :key="cls.id" class="card">
            <div class="flex items-start justify-between gap-3">
              <button class="flex-1 min-w-0 flex items-start gap-3 text-left" @click="toggle(cls.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-white">{{ cls.name }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-400">{{ cls.hitDie }}</span>
                    <span v-if="cls.spellcastingAbility" class="text-[10px] px-1.5 py-0.5 rounded bg-primary-900/50 text-primary-400">
                      {{ ABILITY_LABELS[cls.spellcastingAbility] ?? cls.spellcastingAbility }} caster
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">
                    Saves: {{ cls.savingThrowProficiencies.map(a => ABILITY_LABELS[a] ?? a).join(', ') }}
                    <span v-if="cls.primaryAbility.length"> · Primary: {{ cls.primaryAbility.map(a => ABILITY_LABELS[a] ?? a).join('/') }}</span>
                  </p>
                </div>
                <svg
                  class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                  :class="expanded === cls.id ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <RulepackEntryActions
                :can-delete="isHomebrew"
                :edited="isEdited('classes', cls)"
                @edit="openEdit('classes', cls as unknown as Record<string, unknown>)"
                @duplicate="openDuplicate('classes', cls as unknown as Record<string, unknown>)"
                @delete="pendingDelete = { kind: 'classes', id: cls.id, name: cls.name }"
              />
            </div>

            <div v-if="expanded === cls.id" class="mt-3 pt-3 border-t border-surface-700/50 space-y-4">
              <!-- Proficiencies -->
              <div>
                <p class="section-header">Proficiencies</p>
                <div class="space-y-1 text-xs text-slate-400">
                  <p v-if="cls.armorProficiencies.length">
                    <span class="text-slate-300">Armor: </span>{{ cls.armorProficiencies.join(', ') }}
                  </p>
                  <p v-if="cls.weaponProficiencies.length">
                    <span class="text-slate-300">Weapons: </span>{{ cls.weaponProficiencies.join(', ') }}
                  </p>
                  <p v-if="cls.toolProficiencies.length">
                    <span class="text-slate-300">Tools: </span>{{ cls.toolProficiencies.join(', ') }}
                  </p>
                  <p v-if="cls.skillChoices.from.length">
                    <span class="text-slate-300">Skills: </span>Choose {{ cls.skillChoices.count }} from {{ cls.skillChoices.from.join(', ') }}
                  </p>
                </div>
              </div>

              <!-- Level table -->
              <div>
                <p class="section-header">Class Progression</p>
                <div class="overflow-x-auto -mx-1 px-1">
                  <table class="w-full text-xs min-w-[280px]">
                    <thead>
                      <tr class="text-slate-500 border-b border-surface-700/50">
                        <th class="text-left pb-1.5 pr-3 font-medium w-8">Lvl</th>
                        <th class="text-left pb-1.5 pr-3 font-medium w-10">Prof</th>
                        <th class="text-left pb-1.5 font-medium">Features</th>
                        <template v-if="cls.spellcastingAbility">
                          <th class="text-right pb-1.5 pl-2 font-medium w-8">Cntr</th>
                          <th class="text-right pb-1.5 pl-2 font-medium whitespace-nowrap">1–9</th>
                        </template>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-700/20">
                      <tr v-for="lvl in cls.levels" :key="lvl.level" class="text-slate-300">
                        <td class="py-1 pr-3 text-slate-500 align-top">{{ lvl.level }}</td>
                        <td class="py-1 pr-3 text-slate-500 align-top">+{{ Math.floor((lvl.level - 1) / 4) + 2 }}</td>
                        <td class="py-1 text-slate-300 align-top leading-relaxed">{{ lvl.features.join(', ') || '—' }}</td>
                        <template v-if="cls.spellcastingAbility">
                          <td class="py-1 pl-2 text-right text-slate-500 align-top">{{ lvl.cantripsKnown ?? '—' }}</td>
                          <td class="py-1 pl-2 text-right text-slate-500 align-top whitespace-nowrap">
                            <template v-if="lvl.spellSlots && Object.keys(lvl.spellSlots).length">
                              {{ Object.entries(lvl.spellSlots).map(([, v]) => v).join('/') }}
                            </template>
                            <template v-else>—</template>
                          </td>
                        </template>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ========== BACKGROUNDS ========== -->
        <template v-if="activeTab === 'backgrounds'">
          <p v-if="pack.backgrounds.length === 0" class="text-slate-500 text-sm text-center py-8">No backgrounds in this pack.</p>
          <div v-for="bg in pack.backgrounds" :key="bg.id" class="card">
            <div class="flex items-start justify-between gap-3">
              <button class="flex-1 min-w-0 flex items-start gap-3 text-left" @click="toggle(bg.id)">
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-white">{{ bg.name }}</p>
                  <p class="text-xs text-slate-400 mt-1">
                    Skills: {{ bg.skillProficiencies.join(', ') || 'None' }}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                  :class="expanded === bg.id ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <RulepackEntryActions
                :can-delete="isHomebrew"
                :edited="isEdited('backgrounds', bg)"
                @edit="openEdit('backgrounds', bg as unknown as Record<string, unknown>)"
                @duplicate="openDuplicate('backgrounds', bg as unknown as Record<string, unknown>)"
                @delete="pendingDelete = { kind: 'backgrounds', id: bg.id, name: bg.name }"
              />
            </div>

            <div v-if="expanded === bg.id" class="mt-3 pt-3 border-t border-surface-700/50 space-y-3">
              <p v-if="bg.description" class="text-sm text-slate-400 leading-relaxed">{{ bg.description }}</p>
              <div class="space-y-1 text-xs text-slate-400">
                <p v-if="bg.toolProficiencies.length">
                  <span class="text-slate-300">Tools: </span>{{ bg.toolProficiencies.join(', ') }}
                </p>
                <p v-if="bg.languages">
                  <span class="text-slate-300">Languages: </span>{{ bg.languages }} of your choice
                </p>
                <p v-if="bg.equipment.length">
                  <span class="text-slate-300">Equipment: </span>{{ bg.equipment.join(', ') }}
                </p>
              </div>
              <div class="rounded-lg bg-surface-900/60 border border-surface-700/40 p-3">
                <p class="text-sm font-semibold text-primary-400">{{ bg.feature.name }}</p>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">{{ bg.feature.description }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ========== FEATS ========== -->
        <template v-if="activeTab === 'feats'">
          <p v-if="pack.feats.length === 0" class="text-slate-500 text-sm text-center py-8">No feats in this pack.</p>
          <div v-for="feat in pack.feats" :key="feat.id" class="card">
            <div class="flex items-start justify-between gap-3">
              <button class="flex-1 min-w-0 flex items-start gap-3 text-left" @click="toggle(feat.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-white">{{ feat.name }}</span>
                    <span v-if="feat.prerequisite" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-500">
                      Req: {{ feat.prerequisite }}
                    </span>
                  </div>
                  <p v-if="feat.abilityScoreBonus && Object.keys(feat.abilityScoreBonus).length" class="text-xs text-slate-400 mt-1">
                    ASI: {{ formatASI(feat.abilityScoreBonus) }}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                  :class="expanded === feat.id ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <RulepackEntryActions
                :can-delete="isHomebrew"
                :edited="isEdited('feats', feat)"
                @edit="openEdit('feats', feat as unknown as Record<string, unknown>)"
                @duplicate="openDuplicate('feats', feat as unknown as Record<string, unknown>)"
                @delete="pendingDelete = { kind: 'feats', id: feat.id, name: feat.name }"
              />
            </div>
            <div v-if="expanded === feat.id" class="mt-3 pt-3 border-t border-surface-700/50">
              <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{{ feat.description }}</p>
            </div>
          </div>
        </template>

        <!-- ========== SPELLS ========== -->
        <template v-if="activeTab === 'spells'">
          <!-- Filters -->
          <div class="space-y-2 pb-1">
            <input v-model="spellSearch" type="search" class="input" placeholder="Search spells…" />
            <div class="flex gap-1.5 overflow-x-auto pb-1" style="scrollbar-width: none;">
              <button
                class="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors"
                :class="spellLevelFilter === null ? 'bg-primary-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'"
                @click="spellLevelFilter = null"
              >All</button>
              <button
                v-for="l in [0,1,2,3,4,5,6,7,8,9]"
                :key="l"
                class="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors"
                :class="spellLevelFilter === l ? 'bg-primary-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'"
                @click="spellLevelFilter = spellLevelFilter === l ? null : l"
              >{{ l === 0 ? 'Cantrip' : `L${l}` }}</button>
            </div>
          </div>

          <p v-if="filteredSpells.length === 0" class="text-slate-500 text-sm text-center py-8">No spells match your filters.</p>

          <div v-for="[level, spells] in spellsByLevel" :key="level" class="space-y-2">
            <p class="section-header pt-2">{{ levelLabel(level) }}</p>
            <div v-for="spell in spells" :key="spell.id" class="card">
              <div class="flex items-start justify-between gap-3">
                <button class="flex-1 min-w-0 flex items-start gap-3 text-left" @click="toggle(spell.id)">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-medium text-white">{{ spell.name }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-400 capitalize">{{ spell.school }}</span>
                      <span v-if="spell.ritual" class="text-[10px] px-1.5 py-0.5 rounded bg-accent-900/40 text-accent-400">Ritual</span>
                      <span v-if="spell.concentration" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-500">Conc.</span>
                      <SpellRollBadge :spell-id="spell.id" />
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">{{ spell.castingTime }} · {{ spell.range }} · {{ spell.duration }}</p>
                  </div>
                  <svg
                    class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                    :class="expanded === spell.id ? 'rotate-180' : ''"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <RulepackEntryActions
                  :can-delete="isHomebrew"
                  :edited="isEdited('spells', spell)"
                  @edit="openEdit('spells', spell as unknown as Record<string, unknown>)"
                  @duplicate="openDuplicate('spells', spell as unknown as Record<string, unknown>)"
                  @delete="pendingDelete = { kind: 'spells', id: spell.id, name: spell.name }"
                />
              </div>
              <div v-if="expanded === spell.id" class="mt-3 pt-3 border-t border-surface-700/50 space-y-2">
                <p class="text-xs text-slate-400"><span class="text-slate-300">Components: </span>{{ spell.components }}</p>
                <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{{ spell.description }}</p>
                <p v-if="spell.classes.length" class="text-xs text-slate-500">Classes: {{ spell.classes.join(', ') }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ========== EVERYTHING ELSE ========== -->
        <template v-if="!BESPOKE.has(activeTab)">
          <p v-if="entriesOf(activeTab).length === 0" class="text-slate-500 text-sm text-center py-8">
            No {{ entryKindMeta(activeTab).label.toLowerCase() }} in this pack.
          </p>
          <div
            v-for="entry in entriesOf(activeTab)"
            :key="`${activeTab}:${entryId(activeTab, entry)}`"
            class="card"
          >
            <div class="flex items-start justify-between gap-3">
              <button
                class="flex-1 min-w-0 flex items-start gap-3 text-left"
                @click="toggle(`${activeTab}:${entryId(activeTab, entry)}`)"
              >
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-white">{{ entryName(activeTab, entry) }}</p>
                  <p v-if="summaryOf(activeTab, entry)" class="text-xs text-slate-400 mt-1">
                    {{ summaryOf(activeTab, entry) }}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 flex-shrink-0 text-slate-500 transition-transform mt-0.5"
                  :class="expanded === `${activeTab}:${entryId(activeTab, entry)}` ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <RulepackEntryActions
                :can-delete="isHomebrew"
                :can-duplicate="activeTab !== 'optionPools'"
                :edited="isEdited(activeTab, entry)"
                @edit="openEdit(activeTab, entry)"
                @duplicate="openDuplicate(activeTab, entry)"
                @delete="pendingDelete = { kind: activeTab, id: entryId(activeTab, entry), name: entryName(activeTab, entry) }"
              />
            </div>

            <div
              v-if="expanded === `${activeTab}:${entryId(activeTab, entry)}`"
              class="mt-3 pt-3 border-t border-surface-700/50 space-y-3"
            >
              <p v-if="descriptionOf(entry)" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {{ descriptionOf(entry) }}
              </p>
              <div v-for="block in proseOf(entry)" :key="block.path.join('.')">
                <p class="text-sm font-medium text-slate-200">
                  {{ block.name }}
                  <span v-if="block.context" class="text-[11px] text-slate-500 font-normal">· {{ block.context }}</span>
                </p>
                <p class="text-xs text-slate-400 mt-0.5 whitespace-pre-wrap leading-relaxed">{{ block.value }}</p>
              </div>
            </div>
          </div>
        </template>
      </main>
    </template>

    <!-- Loading / not found -->
    <div v-if="!pack && rulepackStore.loading" class="flex justify-center pt-24">
      <p class="text-slate-500 text-sm animate-pulse">Loading…</p>
    </div>

    <RulepackEntryEditor
      v-if="editing"
      :open="!!editing"
      :kind="editing.kind"
      :entry="editing.entry"
      :mode="editing.mode"
      :source-pack-name="editing.sourcePackName"
      :copies-on-save="editing.copiesOnSave"
      @save="onSave"
      @close="editing = null"
    />

    <Teleport to="body">
      <div v-if="editingDetails" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="editingDetails = false">
        <div class="w-full max-w-md card space-y-4">
          <h2 class="font-semibold text-white">Edit pack</h2>
          <p v-if="!isHomebrew" class="text-sm text-slate-400">
            Nothing in the book changes, only how it is labelled; the name also shows beside its
            entries in every picker. Re-importing the pack keeps what you write here, and removing
            it and importing it afresh brings back the book's own.
          </p>
          <div>
            <label class="label" for="pack-name">Name</label>
            <input id="pack-name" v-model="nameDraft" type="text" class="input" @keydown.enter="saveDetails" @keydown.esc="editingDetails = false" />
          </div>
          <div>
            <label class="label" for="pack-description">Description</label>
            <textarea id="pack-description" v-model="descriptionDraft" rows="4" class="input" @keydown.esc="editingDetails = false" />
          </div>
          <div class="flex gap-2 justify-end">
            <button class="btn-ghost" @click="editingDetails = false">Cancel</button>
            <button class="btn-primary" :disabled="!nameDraft.trim()" @click="saveDetails">Save</button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="!!deletePrompt"
      :title="deletePrompt?.title ?? ''"
      :message="deletePrompt?.message"
      confirm-label="Delete"
      danger
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
