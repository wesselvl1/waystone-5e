<script setup lang="ts">
import { useRulepacksStore } from '~/stores/rulepacks'
import type { SpellDefinition } from '~/types/rulepack'

const route = useRoute()
const router = useRouter()
const rulepackStore = useRulepacksStore()

onMounted(async () => {
  await rulepackStore.loadAll()
  if (!pack.value) router.replace('/rulepacks')
})

const pack = computed(() => rulepackStore.getById(route.params.id as string))

const TABS = [
  { key: 'races', label: 'Races' },
  { key: 'classes', label: 'Classes' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'feats', label: 'Feats' },
  { key: 'spells', label: 'Spells' },
] as const

type TabKey = 'races' | 'classes' | 'backgrounds' | 'feats' | 'spells'

const activeTab = ref<TabKey>('races')
const expanded = ref<string | null>(null)

function setTab(key: TabKey) {
  activeTab.value = key
  expanded.value = null
  spellSearch.value = ''
  spellLevelFilter.value = null
}

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
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
        <!-- ========== RACES ========== -->
        <template v-if="activeTab === 'races'">
          <p v-if="pack.races.length === 0" class="text-slate-500 text-sm text-center py-8">No races in this pack.</p>
          <div v-for="race in pack.races" :key="race.id" class="card">
            <button class="w-full flex items-start justify-between gap-3 text-left" @click="toggle(race.id)">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-white">{{ race.name }}</span>
                  <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-700 text-slate-400">{{ race.size }}</span>
                </div>
                <p class="text-xs text-slate-400 mt-1">
                  {{ formatASI(race.abilityScoreBonuses) || 'No ASI' }} · {{ race.speed }}ft · {{ race.languages.join(', ') }}
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
            <button class="w-full flex items-start justify-between gap-3 text-left" @click="toggle(cls.id)">
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
                        <td class="py-1 pr-3 text-slate-500 align-top">+{{ lvl.proficiencyBonus }}</td>
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
            <button class="w-full flex items-start justify-between gap-3 text-left" @click="toggle(bg.id)">
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
            <button class="w-full flex items-start justify-between gap-3 text-left" @click="toggle(feat.id)">
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
              <button class="w-full flex items-start justify-between gap-3 text-left" @click="toggle(spell.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-medium text-white">{{ spell.name }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-400 capitalize">{{ spell.school }}</span>
                    <span v-if="spell.ritual" class="text-[10px] px-1.5 py-0.5 rounded bg-accent-900/40 text-accent-400">Ritual</span>
                    <span v-if="spell.concentration" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-slate-500">Conc.</span>
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
              <div v-if="expanded === spell.id" class="mt-3 pt-3 border-t border-surface-700/50 space-y-2">
                <p class="text-xs text-slate-400"><span class="text-slate-300">Components: </span>{{ spell.components }}</p>
                <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{{ spell.description }}</p>
                <p v-if="spell.classes.length" class="text-xs text-slate-500">Classes: {{ spell.classes.join(', ') }}</p>
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
  </div>
</template>
