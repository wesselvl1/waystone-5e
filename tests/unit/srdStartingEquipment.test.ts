import { describe, it, expect } from 'vitest'
import type { ClassDefinition, StartingWealth, StartingItem } from '~/types/rulepack'

// Glob-driven, like srdData.test.ts.
const fragments = import.meta.glob<{ default: any }>('~/data/srd/*.json', { eager: true })
const file = (name: string) => fragments[`/app/data/srd/${name}.json`]?.default ?? Object.entries(fragments).find(([p]) => p.endsWith(`/${name}.json`))?.[1].default

const WEALTH: Record<string, StartingWealth> = {
  barbarian: { dice: '2d4', multiplier: 10 },
  bard: { dice: '5d4', multiplier: 10 },
  cleric: { dice: '5d4', multiplier: 10 },
  druid: { dice: '2d4', multiplier: 10 },
  fighter: { dice: '5d4', multiplier: 10 },
  monk: { dice: '5d4', multiplier: 1 },
  paladin: { dice: '5d4', multiplier: 10 },
  ranger: { dice: '5d4', multiplier: 10 },
  rogue: { dice: '4d4', multiplier: 10 },
  sorcerer: { dice: '3d4', multiplier: 10 },
  warlock: { dice: '4d4', multiplier: 10 },
  wizard: { dice: '4d4', multiplier: 10 },
}

const classOf = (id: string): ClassDefinition => file(id).classes.find((c: ClassDefinition) => c.id === id)

describe('SRD starting equipment', () => {
  for (const [id, wealth] of Object.entries(WEALTH)) {
    it(`${id} declares starting equipment and wealth`, () => {
      const c = classOf(id)
      expect(c.startingEquipment!.length).toBeGreaterThan(0)
      expect(c.startingWealth).toEqual(wealth)
    })
  }

  it('every referenced weapon, armour and pack id resolves', () => {
    const weapons = new Set(file('weapons').weapons.map((w: any) => w.id))
    const armor = new Set(file('armor').armor.map((a: any) => a.id))
    const packs = new Set(file('equipment-packs').equipmentPacks.map((p: any) => p.id))
    for (const id of Object.keys(WEALTH)) {
      for (const bullet of classOf(id).startingEquipment!) {
        for (const option of bullet.options) {
          for (const item of option.items as StartingItem[]) {
            if (item.kind === 'weapon') expect(weapons.has(item.id), `${id}: weapon ${item.id}`).toBe(true)
            if (item.kind === 'armor') expect(armor.has(item.id), `${id}: armor ${item.id}`).toBe(true)
            if (item.kind === 'pack') expect(packs.has(item.id), `${id}: pack ${item.id}`).toBe(true)
          }
        }
      }
    }
  })

  it('draconic resilience belongs to the draconic bloodline', () => {
    const dr = file('armor').armor.find((a: any) => a.id === 'draconic-resilience')
    expect(dr.subclassId).toBe('draconic-bloodline')
    const sorcerer = classOf('sorcerer')
    expect(sorcerer.subclasses.some(s => s.id === 'draconic-bloodline')).toBe(true)
  })

  it('the fighter offers chain mail or leather, longbow and 20 arrows', () => {
    const first = classOf('fighter').startingEquipment![0]!
    expect(first.options.map(o => o.label)).toEqual(['chain mail', 'leather armor, a longbow, and 20 arrows'])
  })
})
