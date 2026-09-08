<script setup lang="ts">
import type { Character, ActiveCreatureForm } from '~/types/character'
import type { CreatureDefinition, CreatureFilter, CreatureType } from '~/types/rulepack'
import { useRulepacksStore } from '~/stores/rulepacks'
import { abilityMod } from '~/composables/useCharacterStats'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rulepackStore = useRulepacksStore()

const limits = computed(() => props.character.wildShape?.limits)
const active = computed(() => props.character.wildShape?.active)

/**
 * Widen the character's stored limits back into a CreatureFilter. `types` is stored as
 * string[] on the character to keep character.ts free of rulepack imports, so the cast
 * happens here — the values themselves come from CreatureTypeSchema.
 */
const filter = computed<CreatureFilter | null>(() => {
  const l = limits.value
  if (!l) return null
  return {
    types: (l.types as CreatureType[] | undefined) ?? ['beast'],
    maxCR: l.maxCR,
    allowSwim: l.allowSwim,
    allowFly: l.allowFly,
  }
})

const eligible = computed<CreatureDefinition[]>(() =>
  filter.value ? rulepackStore.getCreaturesMatching(filter.value) : [],
)

// ── Autocomplete ──────────────────────────────────────────────────────────────

const query = ref('')
const open = ref(false)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q === '' ? eligible.value : eligible.value.filter(c => c.name.toLowerCase().includes(q))
})

/** SRD prints low CR as fractions, so 0.125 has to read as 1/8 rather than 0.125. */
function formatCR(cr: number): string {
  if (cr === 0) return '0'
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

/** Matches grouped into CR bands, ascending, empty bands omitted. */
const groupedMatches = computed(() => {
  const groups = new Map<number, CreatureDefinition[]>()
  for (const c of matches.value) {
    if (!groups.has(c.challengeRating)) groups.set(c.challengeRating, [])
    groups.get(c.challengeRating)!.push(c)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cr, list]) => ({
      cr,
      label: `CR ${formatCR(cr)}`,
      creatures: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }))
})

function speedSummary(c: CreatureDefinition): string {
  return Object.entries(c.speeds)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`))
    .join(', ')
}

// ── Transform / revert ────────────────────────────────────────────────────────

function assume(c: CreatureDefinition) {
  const form: ActiveCreatureForm = {
    creatureId: c.id,
    name: c.name,
    hp: { max: c.hitPoints, current: c.hitPoints },
  }
  query.value = ''
  open.value = false
  emit('update', {
    wildShape: { ...props.character.wildShape!, active: form },
  })
}

function revert() {
  const { active: _dropped, ...rest } = props.character.wildShape!
  emit('update', { wildShape: { ...rest } })
}

function adjustFormHp(delta: number) {
  const a = active.value
  if (!a) return
  const current = Math.max(0, Math.min(a.hp.max, a.hp.current + delta))
  emit('update', {
    wildShape: { ...props.character.wildShape!, active: { ...a, hp: { ...a.hp, current } } },
  })
}

/** The statblock behind the active form, if the pack providing it is still loaded. */
const activeStatblock = computed<CreatureDefinition | undefined>(() =>
  active.value ? rulepackStore.getCreature(active.value.creatureId) : undefined,
)

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}
</script>

<template>
  <div v-if="limits" class="card space-y-3">
    <div class="flex items-baseline justify-between gap-2">
      <p class="section-header mb-0">Wild Shape</p>
      <p class="text-xs text-slate-500">
        up to CR {{ formatCR(limits.maxCR) }}
        <span v-if="!limits.allowSwim"> · no swim</span>
        <span v-if="!limits.allowFly"> · no fly</span>
      </p>
    </div>

    <!-- Transformed: form hit points plus the statblock, read-only -->
    <template v-if="active">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <p class="stat-label">Current Form</p>
          <p class="text-sm font-semibold text-white truncate">{{ active.name }}</p>
        </div>
        <button
          class="px-2.5 py-1 rounded text-xs bg-surface-700 border border-surface-600 text-slate-300 hover:bg-surface-600"
          @click="revert"
        >
          Revert
        </button>
      </div>

      <div>
        <p class="stat-label">Form HP</p>
        <div class="flex items-center gap-2 mt-1">
          <button
            class="w-7 h-7 rounded bg-surface-700 border border-surface-600 text-slate-300 text-sm"
            :disabled="active.hp.current === 0"
            @click="adjustFormHp(-1)"
          >
            −
          </button>
          <span class="text-sm font-semibold tabular-nums" :class="active.hp.current === 0 ? 'text-danger-400' : 'text-white'">
            {{ active.hp.current }} / {{ active.hp.max }}
          </span>
          <button
            class="w-7 h-7 rounded bg-surface-700 border border-surface-600 text-slate-300 text-sm"
            :disabled="active.hp.current >= active.hp.max"
            @click="adjustFormHp(1)"
          >
            +
          </button>
        </div>
        <p v-if="active.hp.current === 0" class="text-xs text-danger-400 mt-1">
          At 0 form hit points you revert and any excess damage carries over to your own hit points.
        </p>
      </div>

      <div v-if="activeStatblock" class="pt-2 border-t border-surface-700 space-y-2">
        <div class="flex gap-4 flex-wrap text-xs">
          <span class="text-slate-400">AC <span class="text-white font-semibold">{{ activeStatblock.armorClass }}</span></span>
          <span class="text-slate-400">Speed <span class="text-white font-semibold">{{ speedSummary(activeStatblock) }}</span></span>
          <span class="text-slate-400">
            {{ activeStatblock.size }} {{ activeStatblock.type }}
          </span>
        </div>

        <div class="grid grid-cols-6 gap-1 text-center">
          <div v-for="key in ABILITY_ORDER" :key="key" class="rounded bg-surface-800 py-1">
            <p class="text-[10px] uppercase text-slate-500">{{ key }}</p>
            <p class="text-xs font-semibold text-white">
              {{ activeStatblock.abilityScores[key] }}
              <span class="text-slate-500">{{ signed(abilityMod(activeStatblock.abilityScores[key])) }}</span>
            </p>
          </div>
        </div>

        <div v-if="activeStatblock.traits?.length" class="space-y-1">
          <p v-for="t in activeStatblock.traits" :key="t.name" class="text-xs text-slate-400">
            <span class="text-slate-200 font-semibold">{{ t.name }}.</span> {{ t.description }}
          </p>
        </div>

        <div v-if="activeStatblock.actions?.length" class="space-y-1">
          <p class="stat-label">Actions</p>
          <p v-for="a in activeStatblock.actions" :key="a.name" class="text-xs text-slate-400">
            <span class="text-slate-200 font-semibold">{{ a.name }}.</span>
            <span v-if="a.attackBonus !== undefined" class="text-accent-400"> {{ signed(a.attackBonus) }} to hit</span>
            <span v-if="a.damage" class="text-slate-300"> · {{ a.damage }} {{ a.damageType }}</span>
          </p>
        </div>
      </div>

      <p v-else class="text-xs text-slate-500">
        Statblock for “{{ active.name }}” is not in any loaded rulepack, so only the tracked hit points are shown.
      </p>
    </template>

    <!-- Not transformed: pick a form -->
    <template v-else>
      <div class="relative">
        <input
          v-model="query"
          type="text"
          placeholder="Search a beast to become…"
          class="input w-full"
          @focus="open = true"
        >
        <button
          v-if="query"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs"
          @click="query = ''"
        >
          clear
        </button>
      </div>

      <div v-if="open" class="max-h-72 overflow-y-auto space-y-2">
        <p v-if="groupedMatches.length === 0" class="text-xs text-slate-500 py-2 text-center">
          <template v-if="eligible.length === 0">
            No creature statblocks are loaded. Import a rulepack that provides them.
          </template>
          <template v-else>
            Nothing matches “{{ query }}”
          </template>
        </p>

        <div v-for="group in groupedMatches" :key="group.cr">
          <p class="text-[10px] uppercase tracking-wide text-slate-500 sticky top-0 bg-surface-900 py-1">
            {{ group.label }}
            <span class="text-slate-600">({{ group.creatures.length }})</span>
          </p>
          <button
            v-for="c in group.creatures"
            :key="c.id"
            class="w-full text-left px-2 py-1.5 rounded hover:bg-surface-700 flex items-baseline gap-2"
            @click="assume(c)"
          >
            <span class="text-sm text-white flex-1 truncate">{{ c.name }}</span>
            <span class="text-[10px] text-slate-500 flex-shrink-0">
              {{ c.hitPoints }} hp · AC {{ c.armorClass }} · {{ speedSummary(c) }}
            </span>
          </button>
        </div>
      </div>

      <button
        v-if="!open"
        class="text-xs text-primary-400"
        @click="open = true"
      >
        Browse {{ eligible.length }} available forms
      </button>
    </template>
  </div>
</template>
