<script setup lang="ts">
import type { Character, ProficiencyGroup } from '~/types/character'
import { useRulepacksStore } from '~/stores/rulepacks'
import {
  STANDARD_LANGUAGES,
  WEAPON_ARMOR_CATEGORIES,
  classifyProficiency,
  groupProficiencies,
  isProficiencyPlaceholder,
  proficiencyKey,
  proficiencyVocabulary,
} from '~/services/proficiencies'

const props = defineProps<{ character: Character }>()
const emit = defineEmits<{ update: [Partial<Character>] }>()

const rulepackStore = useRulepacksStore()

/**
 * What the loaded books call a weapon, a piece of armour and a language — the names a
 * guess is checked against, so a book's longsword-by-another-name is still a weapon.
 */
const vocabulary = computed(() => proficiencyVocabulary({
  weapons: rulepackStore.getAllWeapons().map(w => w.name),
  armor: rulepackStore.getAllArmor().map(a => a.name),
  languages: rulepackStore.getAllRaces().flatMap(r => r.languages ?? []),
}))

const sections = computed(() => groupProficiencies(
  props.character.otherProficiencies ?? [],
  props.character.proficiencyGroups,
  vocabulary.value,
))

const editing = ref(false)

/** An empty group is worth a heading only while there is an Add button under it. */
const visibleSections = computed(() =>
  editing.value ? sections.value : sections.value.filter(s => s.entries.length > 0))

const isEmpty = computed(() => (props.character.otherProficiencies ?? []).length === 0)

// ── Editing ───────────────────────────────────────────────────────────────────────────

const addingTo = ref<ProficiencyGroup | null>(null)
const draft = ref('')

/** What each section offers in its datalist; tools are whatever the table calls them. */
const suggestions = computed<Record<ProficiencyGroup, string[]>>(() => ({
  'weapons-armor': offer([
    ...WEAPON_ARMOR_CATEGORIES,
    ...rulepackStore.getAllWeapons().map(w => w.name),
    ...rulepackStore.getAllArmor().filter(a => a.category !== 'unarmored').map(a => a.name),
  ]),
  'languages': offer([
    ...STANDARD_LANGUAGES,
    ...rulepackStore.getAllRaces().flatMap(r => r.languages ?? []),
  ]).sort((a, b) => a.localeCompare(b)),
  'tools': [],
}))

/**
 * One entry per wording, dropping what the character already has and the prompts a race
 * prints among its languages — "1 extra language of your choice" is the thing being
 * answered here, not an answer to offer.
 */
function offer(names: string[]): string[] {
  const held = new Set((props.character.otherProficiencies ?? []).map(proficiencyKey))
  const byKey = new Map<string, string>()
  for (const name of names) {
    const key = proficiencyKey(name)
    if (!key || held.has(key) || byKey.has(key) || isProficiencyPlaceholder(name)) continue
    byKey.set(key, name)
  }
  return [...byKey.values()]
}

function startEditing() {
  editing.value = true
}

function stopEditing() {
  editing.value = false
  addingTo.value = null
  draft.value = ''
}

/**
 * A plain ref would collect an array here, the input being inside the `v-for` over the
 * sections; only one is ever mounted, so the function form keeps it a single element.
 */
const addInput = ref<HTMLInputElement | null>(null)
function setAddInput(el: unknown) {
  addInput.value = (el as HTMLInputElement | null) ?? null
}

async function startAdd(group: ProficiencyGroup) {
  addingTo.value = group
  draft.value = ''
  await nextTick()
  addInput.value?.focus()
}

/**
 * Add an entry to the section it was typed into.
 *
 * A group is only stored where the wording would have filed it elsewhere — a homebrew
 * language nothing has heard of, a tool named after a weapon. Everything the guess gets
 * right stays derived, so a later book teaching the sheet that word changes nothing.
 */
function addProficiency(group: ProficiencyGroup) {
  const name = draft.value.trim()
  draft.value = ''
  addingTo.value = null
  if (!name) return

  const list = props.character.otherProficiencies ?? []
  if (list.some(p => proficiencyKey(p) === proficiencyKey(name))) return

  const patch: Partial<Character> = { otherProficiencies: [...list, name] }
  if (classifyProficiency(name, vocabulary.value) !== group) {
    patch.proficiencyGroups = {
      ...(props.character.proficiencyGroups ?? {}),
      [proficiencyKey(name)]: group,
    }
  }
  emit('update', patch)
}

function removeProficiency(name: string) {
  const groups = { ...(props.character.proficiencyGroups ?? {}) }
  delete groups[proficiencyKey(name)]
  emit('update', {
    otherProficiencies: (props.character.otherProficiencies ?? []).filter(p => p !== name),
    proficiencyGroups: Object.keys(groups).length > 0 ? groups : undefined,
  })
}

/** The section an entry would move to, since tapping it walks round the three. */
function nextSection(from: ProficiencyGroup) {
  const index = sections.value.findIndex(s => s.key === from)
  return sections.value[(index + 1) % sections.value.length]!
}

/** Tapping an entry while editing walks it round the three sections. */
function moveProficiency(name: string, from: ProficiencyGroup) {
  const next = nextSection(from).key
  const groups = { ...(props.character.proficiencyGroups ?? {}) }
  if (classifyProficiency(name, vocabulary.value) === next) delete groups[proficiencyKey(name)]
  else groups[proficiencyKey(name)] = next
  emit('update', {
    proficiencyGroups: Object.keys(groups).length > 0 ? groups : undefined,
  })
}
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between mb-2">
      <p class="section-header mb-0">Proficiencies &amp; Languages</p>
      <button class="btn-ghost text-xs py-1 px-2" @click="editing ? stopEditing() : startEditing()">
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </div>

    <p v-if="isEmpty && !editing" class="text-sm text-slate-500">
      No proficiencies recorded.
    </p>

    <div class="space-y-3">
      <div v-for="section in visibleSections" :key="section.key">
        <p class="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">{{ section.label }}</p>

        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="entry in section.entries"
            :key="entry.name"
            class="inline-flex items-center gap-1 text-xs rounded-full border pl-2.5"
            :class="[
              entry.placeholder
                ? 'border-dashed border-surface-600 text-slate-500 italic'
                : 'border-surface-600 bg-surface-700 text-slate-200',
              editing ? 'pr-1 py-0.5' : 'pr-2.5 py-1',
            ]"
          >
            <button
              v-if="editing"
              class="py-0.5"
              :title="`Move to ${nextSection(section.key).label}`"
              @click="moveProficiency(entry.name, section.key)"
            >
              {{ entry.label }}
            </button>
            <template v-else>{{ entry.label }}</template>

            <button
              v-if="editing"
              class="w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-danger-400"
              :aria-label="`Remove ${entry.label}`"
              @click="removeProficiency(entry.name)"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>

          <button
            v-if="editing && addingTo !== section.key"
            class="text-xs rounded-full border border-dashed border-surface-600 px-2.5 py-1 text-slate-400 hover:text-white hover:border-slate-500"
            @click="startAdd(section.key)"
          >
            + Add
          </button>
        </div>

        <div v-if="editing && addingTo === section.key" class="flex gap-2 mt-2">
          <input
            :ref="setAddInput"
            v-model="draft"
            class="input flex-1"
            :list="`proficiency-options-${section.key}`"
            :placeholder="section.label"
            @keydown.enter="addProficiency(section.key)"
            @keydown.esc="addingTo = null"
          />
          <datalist :id="`proficiency-options-${section.key}`">
            <option v-for="name in suggestions[section.key]" :key="name" :value="name" />
          </datalist>
          <button class="btn-primary text-xs px-3" @click="addProficiency(section.key)">Add</button>
        </div>
      </div>
    </div>

    <p v-if="editing" class="text-[11px] text-slate-500 mt-3">
      Tap a proficiency to move it to the next group.
    </p>
  </div>
</template>
