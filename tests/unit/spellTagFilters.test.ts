import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import { spellMatchesChoice } from '~/services/spellcasting'
import { chooseSpellEvent } from '~/services/levelUpService'
import type { SpellDefinition } from '~/types/rulepack'
import type { ChooseSpellEvent } from '~/types/events'
import type { Character } from '~/types/character'
import spellFragment from '~/data/srd/spells.json'

// SRD spells only: the books that use these filters live under gitignored app/data/<abbrev>
// directories, and a tracked test that imports one fails CI on a fresh checkout.
const allSpells = RulepackSchema.parse(spellFragment).spells as SpellDefinition[]

/** Mirrors the picker's own loop in app/pages/characters/[id]/levelup.vue. */
function offered(event: ChooseSpellEvent, levelCap = 9): SpellDefinition[] {
  return allSpells.filter(s => spellMatchesChoice(s, event, { levelCap }))
}

function choice(overrides: Partial<ChooseSpellEvent>): ChooseSpellEvent {
  return { type: 'CHOOSE_SPELL', addTo: 'test', count: 1, cantrip: false, ...overrides }
}

const emptyCharacter = { chosenOptions: {} } as unknown as Character

describe('the SRD spell data carries the tags these filters read', () => {
  it('flags rituals and attack-roll spells', () => {
    expect(allSpells.filter(s => s.ritual).length).toBeGreaterThan(0)
    expect(allSpells.filter(s => s.attackRoll).length).toBeGreaterThan(0)
    expect(allSpells.filter(s => s.level === 0 && s.attackRoll).length).toBeGreaterThan(0)
  })
})

describe('CHOOSE_SPELL ritual filter', () => {
  it('offers only ritual spells from the named class list', () => {
    // Ritual Caster's shape: two 1st-level spells from one class list, ritual tag only.
    const event = choice({ count: 2, classes: ['wizard'], maxLevel: 1, ritual: true })
    const list = offered(event)

    expect(list.length).toBeGreaterThan(0)
    expect(list.every(s => s.ritual)).toBe(true)
    expect(list.every(s => s.classes.includes('wizard'))).toBe(true)
    expect(list.every(s => s.level === 1)).toBe(true)
    expect(list.map(s => s.id)).toContain('find-familiar')
    // The over-grant this filter exists to stop: a 1st-level wizard spell with no tag.
    expect(list.map(s => s.id)).not.toContain('magic-missile')
  })

  it('is a narrowing of the class list, not an alternative to it', () => {
    const unfiltered = offered(choice({ classes: ['wizard'], maxLevel: 1 }))
    const filtered = offered(choice({ classes: ['wizard'], maxLevel: 1, ritual: true }))

    expect(filtered.length).toBeLessThan(unfiltered.length)
    // Nothing outside the class list creeps in: a cleric ritual stays out of a wizard's.
    expect(filtered.some(s => !s.classes.includes('wizard'))).toBe(false)
    expect(offered(choice({ classes: ['cleric'], maxLevel: 1, ritual: true }))
      .map(s => s.id)).toContain('purify-food-and-drink')
  })
})

describe('CHOOSE_SPELL attack-roll filter', () => {
  it('offers only cantrips that require an attack roll', () => {
    // Spell Sniper's shape: one cantrip from one class list, attack roll only.
    const event = choice({ cantrip: true, classes: ['wizard'], attackRoll: true })
    const list = offered(event)

    expect(list.length).toBeGreaterThan(0)
    expect(list.every(s => s.attackRoll !== undefined)).toBe(true)
    expect(list.every(s => s.level === 0)).toBe(true)
    expect(list.map(s => s.id)).toEqual(
      expect.arrayContaining(['fire-bolt', 'ray-of-frost', 'shocking-grasp']),
    )
    // The over-grant this filter exists to stop: a cantrip that asks for no roll at all.
    expect(list.map(s => s.id)).not.toContain('mage-hand')
  })

  it('takes melee and ranged alike', () => {
    const list = offered(choice({ cantrip: true, attackRoll: true }))
    expect(list.some(s => s.attackRoll === 'melee')).toBe(true)
    expect(list.some(s => s.attackRoll === 'ranged')).toBe(true)
  })
})

describe('absent means unfiltered', () => {
  it('a choice carrying neither filter is unchanged', () => {
    const plain = choice({ classes: ['wizard'], maxLevel: 1 })
    const list = offered(plain)

    expect(list.every(s => s.classes.includes('wizard') && s.level === 1)).toBe(true)
    expect(list.map(s => s.id)).toContain('magic-missile')
    expect(list.map(s => s.id)).toContain('find-familiar')
    expect(list.some(s => !s.ritual)).toBe(true)

    const cantrips = offered(choice({ cantrip: true, classes: ['wizard'] }))
    expect(cantrips.map(s => s.id)).toContain('mage-hand')
    expect(cantrips.some(s => !s.attackRoll)).toBe(true)
  })
})

describe('the filters survive the trip from rulepack JSON to runtime event', () => {
  it('chooseSpellEvent carries ritual and attackRoll through', () => {
    const ritual = chooseSpellEvent(
      { type: 'CHOOSE_SPELL', addTo: 'feat', count: 2, classes: ['wizard'], maxLevel: 1, ritual: true },
      emptyCharacter,
    )
    expect(ritual?.ritual).toBe(true)

    const attack = chooseSpellEvent(
      { type: 'CHOOSE_SPELL', addTo: 'feat', count: 1, cantrip: true, classes: ['wizard'], attackRoll: true },
      emptyCharacter,
    )
    expect(attack?.attackRoll).toBe(true)

    const plain = chooseSpellEvent(
      { type: 'CHOOSE_SPELL', addTo: 'feat', count: 1, classes: ['wizard'] },
      emptyCharacter,
    )
    expect(plain?.ritual).toBeUndefined()
    expect(plain?.attackRoll).toBeUndefined()
  })

  it('the schema accepts both, and defaults neither', () => {
    const parsed = RulepackSchema.parse({
      id: 'test',
      name: 'Test',
      version: '1',
      feats: [{
        id: 'test.feat',
        name: 'Test Feat',
        description: '',
        levelUpEvents: [
          { type: 'CHOOSE_SPELL', addTo: 'test.feat', count: 2, ritual: true },
          { type: 'CHOOSE_SPELL', addTo: 'test.feat', count: 1, cantrip: true, attackRoll: true },
          { type: 'CHOOSE_SPELL', addTo: 'test.feat', count: 1 },
        ],
      }],
    })
    const events = parsed.feats[0]!.levelUpEvents!
    expect(events[0]).toMatchObject({ ritual: true })
    expect(events[1]).toMatchObject({ attackRoll: true })
    expect(events[2]).not.toHaveProperty('ritual')
    expect(events[2]).not.toHaveProperty('attackRoll')
  })
})
