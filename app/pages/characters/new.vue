<script setup lang="ts">
import { useCharactersStore } from '~/stores/characters'
import { useRulepacksStore } from '~/stores/rulepacks'
import type { Character, AbilityScores, SkillKey } from '~/types/character'

const router = useRouter()
const characterStore = useCharactersStore()
const rulepackStore = useRulepacksStore()

onMounted(() => rulepackStore.loadAll())

// ── Wizard state ──────────────────────────────────────────────────────────────
const step = ref(0)
const STEPS = ['Race', 'Class', 'Background', 'Ability Scores', 'Proficiencies', 'Equipment', 'Review']

const draft = reactive({
  name: '',
  raceId: '',
  subraceId: '',
  classId: '',
  backgroundId: '',
  alignment: '',
  abilityMethod: 'standard' as 'standard' | 'pointbuy' | 'manual',
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } as AbilityScores,
  skillChoices: [] as SkillKey[],
  startingGold: false,
})

// ── Standard array ────────────────────────────────────────────────────────────
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const ABILITY_KEYS: (keyof AbilityScores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

// ── Point buy ─────────────────────────────────────────────────────────────────
const PB_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const pointsSpent = computed(() =>
  ABILITY_KEYS.reduce((sum, k) => sum + (PB_COSTS[draft.abilities[k]] ?? 0), 0),
)
const pointsLeft = computed(() => 27 - pointsSpent.value)

// ── Lookups ───────────────────────────────────────────────────────────────────
const selectedRace = computed(() => rulepackStore.getRace(draft.raceId))
const selectedSubrace = computed(() => selectedRace.value?.subraces?.find(s => s.id === draft.subraceId))
const selectedClass = computed(() => rulepackStore.getClass(draft.classId))
const selectedBackground = computed(() => rulepackStore.getAllBackgrounds().find(b => b.id === draft.backgroundId))

// ── Effective abilities (base + race ASI + subrace ASI) ────────────────────────
const effectiveAbilities = computed<AbilityScores>(() => {
  const base = { ...draft.abilities }
  for (const [k, v] of Object.entries(selectedRace.value?.abilityScoreBonuses ?? {})) {
    const key = k as keyof AbilityScores
    base[key] = Math.min(20, base[key] + (v ?? 0))
  }
  for (const [k, v] of Object.entries(selectedSubrace.value?.abilityScoreBonuses ?? {})) {
    const key = k as keyof AbilityScores
    base[key] = Math.min(20, base[key] + (v ?? 0))
  }
  return base
})

// ── Skill choices ─────────────────────────────────────────────────────────────
const availableSkills = computed((): SkillKey[] => (selectedClass.value?.skillChoices.from ?? []) as SkillKey[])
const maxSkills = computed(() => selectedClass.value?.skillChoices.count ?? 0)

function toggleSkill(skill: SkillKey) {
  if (draft.skillChoices.includes(skill)) {
    draft.skillChoices = draft.skillChoices.filter(s => s !== skill)
  }
  else if (draft.skillChoices.length < maxSkills.value) {
    draft.skillChoices.push(skill)
  }
}

// Navigation
function canProceed() {
  if (step.value === 0) {
    if (!draft.raceId) return false
    // Require subrace selection if the chosen race has subraces
    if ((selectedRace.value?.subraces?.length ?? 0) > 0 && !draft.subraceId) return false
    return true
  }
  if (step.value === 1) return !!draft.classId
  if (step.value === 2) return !!draft.backgroundId
  return true
}

// ── Create character ──────────────────────────────────────────────────────────
async function createCharacter() {
  const cls = selectedClass.value
  const now = new Date().toISOString()
  const skillProfs = {} as Record<SkillKey, 0 | 1 | 2>
  for (const skill of draft.skillChoices) skillProfs[skill] = 1
  if (selectedBackground.value) {
    for (const skill of selectedBackground.value.skillProficiencies as SkillKey[]) {
      skillProfs[skill] = 1
    }
  }

  const character: Character = {
    id: crypto.randomUUID(),
    name: draft.name || 'Unnamed Adventurer',
    race: draft.raceId,
    subrace: draft.subraceId || undefined,
    background: draft.backgroundId,
    alignment: draft.alignment,
    classes: [{ classId: draft.classId, level: 1 }],
    experiencePoints: 0,
    inspiration: false,

    abilityScores: { ...draft.abilities },
    abilityScoreOverrides: {},

    hp: {
      max: Math.max(1, parseInt((cls?.hitDie ?? 'd8').replace('d', '')) + Math.floor((effectiveAbilities.value.con - 10) / 2)),
      current: Math.max(1, parseInt((cls?.hitDie ?? 'd8').replace('d', '')) + Math.floor((effectiveAbilities.value.con - 10) / 2)),
      temp: 0,
    },
    armorClass: null,
    speed: selectedRace.value?.speed ?? 30,
    initiative: null,
    hitDice: { total: 1, remaining: 1, die: cls?.hitDie ?? 'd8' },
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],

    savingThrowProficiencies: cls?.savingThrowProficiencies ?? [],
    skillProficiencies: skillProfs,
    otherProficiencies: [
      ...(cls?.armorProficiencies ?? []),
      ...(cls?.weaponProficiencies ?? []),
      ...(selectedRace.value?.languages ?? []),
    ],

    spellcastingAbility: cls?.spellcastingAbility,
    spellSlots: {} as Character['spellSlots'],
    spells: [],
    attacks: [],

    features: [
      ...(selectedRace.value?.traits.map(t => ({
        id: `race-${t.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: t.name,
        source: selectedRace.value?.name ?? 'Race',
        description: t.description,
      })) ?? []),
      ...(selectedSubrace.value?.traits.map(t => ({
        id: `subrace-${t.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: t.name,
        source: `${selectedRace.value?.name ?? 'Race'} (${selectedSubrace.value?.name})`,
        description: t.description,
      })) ?? []),
      ...(selectedBackground.value?.feature ? [{
        id: `bg-${selectedBackground.value.id}`,
        name: selectedBackground.value.feature.name,
        source: selectedBackground.value.name,
        description: selectedBackground.value.feature.description,
      }] : []),
    ],
    equipment: draft.startingGold ? [] : (selectedBackground.value?.equipment ?? []).map(item => {
      const match = item.match(/^(\d+)\s+(.+)$/)
      return {
        id: crypto.randomUUID(),
        name: match ? match[2] : item,
        quantity: match ? Number.parseInt(match[1]) : 1,
      }
    }),
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },

    notes: '',
    createdAt: now,
    updatedAt: now,
    rulepackIds: rulepackStore.rulepacks.map(r => r.id),
  }

  await characterStore.save(character)
  router.push(`/characters/${character.id}`)
}

function abilityMod(score: number) {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}
</script>

<template>
  <div class="min-h-screen pb-8">
    <!-- Top bar -->
    <header class="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <NuxtLink to="/" class="btn-ghost p-2">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <span class="flex-1 text-sm font-semibold text-white">New Character</span>
    </header>

    <!-- Progress bar -->
    <div class="flex h-1 bg-surface-800">
      <div
        class="h-full bg-primary-500 transition-all duration-300"
        :style="{ width: `${((step + 1) / STEPS.length) * 100}%` }"
      />
    </div>

    <div class="px-4 pt-4 space-y-4">
      <!-- Step label -->
      <div class="flex items-center justify-between">
        <p class="text-xs text-slate-500 uppercase tracking-widest">Step {{ step + 1 }} of {{ STEPS.length }}</p>
        <p class="text-sm font-semibold text-primary-300">{{ STEPS[step] }}</p>
      </div>

      <!-- ── Step 0: Race ── -->
      <template v-if="step === 0">
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="race in rulepackStore.getAllRaces()"
            :key="race.id"
            class="card text-left transition-colors hover:border-primary-500/50"
            :class="draft.raceId === race.id ? 'border-primary-500 bg-primary-900/20' : ''"
            @click="draft.raceId = race.id; draft.subraceId = ''"
          >
            <p class="font-semibold text-white text-sm">{{ race.name }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Speed {{ race.speed }}ft · {{ race.size }}</p>
            <div class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="[k, v] in Object.entries(race.abilityScoreBonuses)"
                :key="k"
                class="text-[10px] text-accent-400 bg-accent-400/10 rounded px-1.5 py-0.5"
              >
                +{{ v }} {{ k.toUpperCase() }}
              </span>
            </div>
          </button>
        </div>
        <div v-if="rulepackStore.getAllRaces().length === 0" class="text-slate-500 text-sm text-center py-8">
          No races available. <NuxtLink to="/rulepacks" class="text-primary-400 underline">Import a rulepack</NuxtLink> first.
        </div>

        <!-- Subrace picker -->
        <template v-if="selectedRace?.subraces?.length">
          <p class="section-header mt-2">Choose a {{ selectedRace.name }} subrace</p>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="sub in selectedRace.subraces"
              :key="sub.id"
              class="card text-left transition-colors hover:border-primary-500/50"
              :class="draft.subraceId === sub.id ? 'border-primary-500 bg-primary-900/20' : ''"
              @click="draft.subraceId = sub.id"
            >
              <p class="font-semibold text-white text-sm">{{ sub.name }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="[k, v] in Object.entries(sub.abilityScoreBonuses)"
                  :key="k"
                  class="text-[10px] text-accent-400 bg-accent-400/10 rounded px-1.5 py-0.5"
                >
                  +{{ v }} {{ k.toUpperCase() }}
                </span>
              </div>
            </button>
          </div>
        </template>

        <!-- Trait preview -->
        <div v-if="selectedRace" class="card space-y-2">
          <p class="section-header">Racial Traits</p>
          <div v-for="trait in selectedRace.traits" :key="trait.name" class="space-y-0.5">
            <p class="text-sm font-medium text-white">{{ trait.name }}</p>
            <p class="text-xs text-slate-400">{{ trait.description }}</p>
          </div>
          <template v-if="selectedSubrace">
            <p class="section-header mt-2">{{ selectedSubrace.name }} Traits</p>
            <div v-for="trait in selectedSubrace.traits" :key="trait.name" class="space-y-0.5">
              <p class="text-sm font-medium text-white">{{ trait.name }}</p>
              <p class="text-xs text-slate-400">{{ trait.description }}</p>
            </div>
          </template>
        </div>
      </template>

      <!-- ── Step 1: Class ── -->
      <template v-if="step === 1">
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="cls in rulepackStore.getAllClasses()"
            :key="cls.id"
            class="card text-left transition-colors hover:border-primary-500/50"
            :class="draft.classId === cls.id ? 'border-primary-500 bg-primary-900/20' : ''"
            @click="draft.classId = cls.id"
          >
            <p class="font-semibold text-white text-sm">{{ cls.name }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Hit Die {{ cls.hitDie }}</p>
            <p class="text-xs text-slate-500">{{ cls.primaryAbility.map(a => a.toUpperCase()).join('/') }}</p>
          </button>
        </div>
        <div v-if="selectedClass" class="card space-y-1">
          <p class="section-header">Level 1 Features</p>
          <p class="text-xs text-slate-400">
            {{ selectedClass.levels[0]?.features.join(', ') || 'None' }}
          </p>
          <p class="text-xs text-slate-500 mt-1">
            Saves: {{ selectedClass.savingThrowProficiencies.map(s => s.toUpperCase()).join(', ') }}
          </p>
        </div>
      </template>

      <!-- ── Step 2: Background ── -->
      <template v-if="step === 2">
        <div class="space-y-2">
          <button
            v-for="bg in rulepackStore.getAllBackgrounds()"
            :key="bg.id"
            class="card w-full text-left transition-colors hover:border-primary-500/50"
            :class="draft.backgroundId === bg.id ? 'border-primary-500 bg-primary-900/20' : ''"
            @click="draft.backgroundId = bg.id"
          >
            <p class="font-semibold text-white text-sm">{{ bg.name }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ bg.description }}</p>
            <p class="text-xs text-slate-500 mt-1">Skills: {{ bg.skillProficiencies.join(', ') }}</p>
          </button>
        </div>
        <div v-if="rulepackStore.getAllBackgrounds().length === 0" class="text-slate-500 text-sm text-center py-8">
          No backgrounds available. Import a rulepack first.
        </div>
      </template>

      <!-- ── Step 3: Ability Scores ── -->
      <template v-if="step === 3">
        <!-- Method selector -->
        <div class="flex gap-2">
          <button
            v-for="m in [['standard', 'Standard Array'], ['pointbuy', 'Point Buy'], ['manual', 'Manual']]"
            :key="m[0]"
            class="flex-1 btn text-xs py-1.5"
            :class="draft.abilityMethod === m[0] ? 'btn-primary' : 'btn-ghost'"
            @click="draft.abilityMethod = m[0] as typeof draft.abilityMethod"
          >
            {{ m[1] }}
          </button>
        </div>

        <p v-if="draft.abilityMethod === 'pointbuy'" class="text-sm text-slate-400">
          Points left: <span class="font-bold" :class="pointsLeft < 0 ? 'text-danger-400' : 'text-white'">{{ pointsLeft }}</span> / 27
        </p>

        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="key in ABILITY_KEYS"
            :key="key"
            class="stat-box"
          >
            <span class="stat-label">{{ key.toUpperCase() }}</span>

            <!-- Standard array: dropdown -->
            <select
              v-if="draft.abilityMethod === 'standard'"
              v-model.number="draft.abilities[key]"
              class="input text-center text-lg font-bold p-1 w-full"
            >
              <option v-for="v in STANDARD_ARRAY" :key="v" :value="v">{{ v }}</option>
            </select>

            <!-- Point buy: +/- buttons -->
            <template v-else-if="draft.abilityMethod === 'pointbuy'">
              <div class="flex items-center gap-1">
                <button
                  class="w-6 h-6 rounded bg-surface-700 text-slate-300 hover:bg-surface-600 text-xs"
                  @click="draft.abilities[key] = Math.max(8, draft.abilities[key] - 1)"
                >-</button>
                <span class="text-xl font-bold text-white w-8 text-center">{{ draft.abilities[key] }}</span>
                <button
                  class="w-6 h-6 rounded bg-surface-700 text-slate-300 hover:bg-surface-600 text-xs"
                  :disabled="draft.abilities[key] >= 15 || pointsLeft <= 0"
                  @click="draft.abilities[key] = Math.min(15, draft.abilities[key] + 1)"
                >+</button>
              </div>
            </template>

            <!-- Manual: plain input -->
            <input
              v-else
              v-model.number="draft.abilities[key]"
              type="number"
              min="1"
              max="30"
              class="input text-center text-lg font-bold p-1 w-full"
            />

            <span class="text-sm text-slate-400">{{ abilityMod(effectiveAbilities[key]) }}</span>
          </div>
        </div>

        <div v-if="Object.keys(selectedRace?.abilityScoreBonuses ?? {}).length > 0" class="card">
          <p class="text-xs text-slate-400">
            <span class="text-accent-400 font-medium">Racial bonuses applied:</span>
            {{ Object.entries(selectedRace!.abilityScoreBonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') }}
          </p>
        </div>
      </template>

      <!-- ── Step 4: Proficiencies ── -->
      <template v-if="step === 4">
        <div v-if="selectedClass">
          <p class="section-header">Choose {{ maxSkills }} Skills</p>
          <p class="text-xs text-slate-500 mb-3">{{ draft.skillChoices.length }}/{{ maxSkills }} selected</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="skill in availableSkills"
              :key="skill"
              class="card text-sm text-left transition-colors hover:border-primary-500/50 py-2"
              :class="draft.skillChoices.includes(skill)
                ? 'border-primary-500 bg-primary-900/20 text-white'
                : 'text-slate-400'"
              @click="toggleSkill(skill)"
            >
              {{ skill.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) }}
            </button>
          </div>
        </div>
        <div v-if="selectedBackground?.skillProficiencies.length" class="card">
          <p class="section-header">From Background ({{ selectedBackground.name }})</p>
          <p class="text-sm text-slate-400">{{ selectedBackground.skillProficiencies.join(', ') }}</p>
        </div>
      </template>

      <!-- ── Step 5: Starting Equipment ── -->
      <template v-if="step === 5">
        <div class="space-y-3">
          <div class="card">
            <p class="section-header">Starting Equipment</p>
            <p class="text-sm text-slate-400">Starting equipment packs will be added automatically from your class and background.</p>
            <div v-if="selectedBackground?.equipment.length" class="mt-2">
              <p class="text-xs text-slate-500 mb-1">Background equipment:</p>
              <ul class="text-sm text-slate-300 space-y-0.5 list-disc list-inside">
                <li v-for="item in selectedBackground.equipment" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
          <div class="card space-y-3">
            <div class="flex items-center gap-3">
              <input id="gold-toggle" v-model="draft.startingGold" type="checkbox" class="w-4 h-4 rounded accent-primary-500" />
              <label for="gold-toggle" class="text-sm text-slate-300">Start with gold instead</label>
            </div>
            <p class="text-xs text-slate-500">You can manually edit your equipment on the character sheet at any time.</p>
          </div>
        </div>
      </template>

      <!-- ── Step 6: Review ── -->
      <template v-if="step === 6">
        <div class="space-y-3">
          <div>
            <label class="label">Character Name</label>
            <input v-model="draft.name" class="input" placeholder="Enter a name…" />
          </div>
          <div>
            <label class="label">Alignment (optional)</label>
            <select v-model="draft.alignment" class="input">
              <option value="">—</option>
              <option v-for="a in ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>

          <div class="card space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-400">Race</span>
              <span class="text-white">{{ selectedRace?.name ?? '—' }}{{ selectedSubrace ? ` (${selectedSubrace.name})` : '' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Class</span>
              <span class="text-white">{{ selectedClass?.name ?? '—' }} 1</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Background</span>
              <span class="text-white capitalize">{{ selectedBackground?.name ?? '—' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">HP</span>
              <span class="text-white">{{ parseInt((selectedClass?.hitDie ?? 'd8').replace('d', '')) + Math.floor((effectiveAbilities.con - 10) / 2) }}</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div v-for="key in ABILITY_KEYS" :key="key" class="stat-box">
              <span class="stat-label">{{ key.toUpperCase() }}</span>
              <span class="text-xl font-bold text-white">{{ effectiveAbilities[key] }}</span>
              <span class="text-xs text-slate-400">{{ abilityMod(effectiveAbilities[key]) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Navigation -->
    <div class="fixed bottom-16 inset-x-0 px-4 flex gap-3 bg-surface-950/80 backdrop-blur py-3 border-t border-surface-700/60">
      <button v-if="step > 0" class="btn-ghost flex-1" @click="step--">Back</button>
      <button
        v-if="step < STEPS.length - 1"
        class="btn-primary flex-1"
        :disabled="!canProceed()"
        @click="step++"
      >
        Next
      </button>
      <button
        v-else
        class="btn-primary flex-1"
        @click="createCharacter"
      >
        Create Character
      </button>
    </div>
  </div>
</template>
