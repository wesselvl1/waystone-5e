import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { SpellDefinition } from '~/types/rulepack'
import type { ChooseSpellEvent } from '~/types/events'
import druidFragment from '~/data/srd/druid.json'
import spellFragment from '~/data/srd/spells.json'

const druid = RulepackSchema.parse(druidFragment).classes.find(c => c.id === 'druid')!
const allSpells = RulepackSchema.parse(spellFragment).spells as SpellDefinition[]

/**
 * Mirrors availableSpells in app/pages/characters/[id]/levelup.vue. Note the fall-through:
 * with neither fromList, classes nor schools set, every spell in every pack is offered.
 * That is why a CHOOSE_SPELL event must never lose its restriction on the way to the UI.
 */
function availableSpells(event: ChooseSpellEvent, known: string[] = []): SpellDefinition[] {
  const existing = new Set(known)
  return allSpells.filter((s) => {
    if (existing.has(s.id)) return false
    if (event.cantrip !== (s.level === 0)) return false
    if (event.fromList?.length) return event.fromList.includes(s.id)
    if (event.classes?.length) return s.classes.some(c => event.classes!.includes(c))
    if (event.schools?.length) return event.schools.includes(s.school)
    return true
  })
}

/**
 * Mirrors confirmSubclass's injection of subclass-level choice events. Before the fix this
 * dropped classes and schools, so the level at which a subclass was chosen offered spells
 * from every list. Druid level 2 is the first SRD case to hit it: the subclass is chosen at
 * 2 and Circle of the Land's Bonus Cantrip is granted at the same level.
 */
function injectSubclassSpellEvents(subclassId: string, level: number): ChooseSpellEvent[] {
  const sub = (druid.subclasses ?? []).find(s => s.id === subclassId)!
  const lvl = sub.levels.find(l => l.level === level)
  const out: ChooseSpellEvent[] = []
  for (const def of lvl?.levelUpEvents ?? []) {
    if (def.type !== 'CHOOSE_SPELL') continue
    out.push({
      type: 'CHOOSE_SPELL',
      addTo: def.addTo,
      count: def.count,
      cantrip: def.cantrip ?? false,
      fromList: def.fromList,
      classes: def.classes,
      schools: def.schools,
    })
  }
  return out
}

describe('subclass spell events injected at the level the subclass is chosen', () => {
  it('the druid data itself restricts the level-2 bonus cantrip to the druid list', () => {
    const sub = (druid.subclasses ?? []).find(s => s.id === 'circle-of-the-land')!
    const lvl2 = sub.levels.find(l => l.level === 2)!
    const choice = lvl2.levelUpEvents!.find(e => e.type === 'CHOOSE_SPELL')!
    expect(choice.type).toBe('CHOOSE_SPELL')
    if (choice.type === 'CHOOSE_SPELL') {
      expect(choice.cantrip).toBe(true)
      expect(choice.classes).toEqual(['druid'])
    }
  })

  it('offers only druid cantrips for the Circle of the Land bonus cantrip', () => {
    const [event] = injectSubclassSpellEvents('circle-of-the-land', 2)
    expect(event).toBeDefined()

    const offered = availableSpells(event!)
    expect(offered.length).toBeGreaterThan(0)
    expect(offered.every(s => s.level === 0)).toBe(true)

    const nonDruid = offered.filter(s => !s.classes.includes('druid'))
    expect(nonDruid.map(s => s.name), 'non-druid cantrips offered').toEqual([])

    // Spot-check cantrips that belong to other lists only
    for (const id of ['eldritch-blast', 'fire-bolt', 'vicious-mockery', 'sacred-flame']) {
      const spell = allSpells.find(s => s.id === id)
      if (spell && !spell.classes.includes('druid')) {
        expect(offered.some(s => s.id === id), `${id} should not be offered`).toBe(false)
      }
    }
  })

  it('offers every druid cantrip the character does not already know', () => {
    const [event] = injectSubclassSpellEvents('circle-of-the-land', 2)
    const druidCantrips = allSpells.filter(s => s.level === 0 && s.classes.includes('druid'))
    expect(availableSpells(event!)).toHaveLength(druidCantrips.length)

    const known = [druidCantrips[0]!.id]
    expect(availableSpells(event!, known)).toHaveLength(druidCantrips.length - 1)
  })

  it('regression: dropping classes offers the whole spell list', () => {
    // This is what the bug looked like. Kept as a guard so the fall-through in
    // availableSpells is never mistaken for a safe default.
    const [event] = injectSubclassSpellEvents('circle-of-the-land', 2)
    const { classes: _dropped, ...withoutClasses } = event!
    const unrestricted = availableSpells(withoutClasses as ChooseSpellEvent)
    const restricted = availableSpells(event!)

    expect(unrestricted.length).toBeGreaterThan(restricted.length)
    expect(unrestricted.some(s => !s.classes.includes('druid'))).toBe(true)
  })
})
