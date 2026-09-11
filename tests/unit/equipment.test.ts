import { describe, it, expect } from 'vitest'
import {
  carriedWeight,
  carryingCapacity,
  cleanEquipmentName,
  coinWeight,
  entryWeight,
} from '~/services/equipment'
import { migrateCharacterShape } from '~/services/characterMigration'
import { validCharacter } from '../fixtures'
import type { Character, EquipmentEntry, Feature } from '~/types/character'

function withEquipment(equipment: EquipmentEntry[], extra: Partial<Character> = {}): Character {
  return { ...validCharacter, equipment, ...extra }
}

function feature(name: string, description: string): Feature {
  return { id: name, name, source: 'Test', description }
}

describe('an item name loses the source it was filed under', () => {
  it('drops the source and title-cases what is left', () => {
    expect(cleanEquipmentName('fine clothes|phb')).toBe('Fine Clothes')
  })

  it('prefers the display name a reference spells out', () => {
    expect(cleanEquipmentName('shortsword|phb|short sword')).toBe('Short Sword')
  })

  it('unwraps a tag that reached the data whole', () => {
    expect(cleanEquipmentName('{@item fine clothes|phb}')).toBe('Fine Clothes')
  })

  it('leaves the small words small', () => {
    expect(cleanEquipmentName('robe of the archmagi|dmg')).toBe('Robe of the Archmagi')
  })

  it('keeps a measurement as written', () => {
    expect(cleanEquipmentName('hempen rope (50 feet)|phb')).toBe('Hempen Rope (50 Feet)')
  })

  /** Without a pipe there is no source, so the name is the player's and stays theirs. */
  it('does not re-case something a player typed', () => {
    expect(cleanEquipmentName('Belt pouch containing 15 gp')).toBe('Belt pouch containing 15 gp')
    expect(cleanEquipmentName('  my lucky rock ')).toBe('my lucky rock')
  })
})

describe('a stored character is cleaned on the way out of the database', () => {
  it('rewrites a piped name', () => {
    const out = migrateCharacterShape({
      equipment: [{ id: 'a', name: 'fine clothes|phb', quantity: 1 }],
    }) as Character
    expect(out.equipment[0]!.name).toBe('Fine Clothes')
  })

  it('leaves an untouched name and the rest of the entry alone', () => {
    const out = migrateCharacterShape({
      equipment: [{ id: 'a', name: 'Bedroll', quantity: 2, weight: 7, notes: 'mine' }],
    }) as Character
    expect(out.equipment[0]).toEqual({ id: 'a', name: 'Bedroll', quantity: 2, weight: 7, notes: 'mine' })
  })

  it('survives a list that is not one', () => {
    const out = migrateCharacterShape({ equipment: 'nope' }) as { equipment: unknown }
    expect(out.equipment).toBe('nope')
  })
})

describe('weight is summed over whatever has been weighed', () => {
  it('multiplies an item weight by its quantity', () => {
    expect(entryWeight({ id: 'a', name: 'Javelin', quantity: 4, weight: 2 })).toBe(8)
  })

  it('contributes nothing when no weight was recorded', () => {
    expect(entryWeight({ id: 'a', name: 'Trinket', quantity: 3 })).toBe(0)
  })

  it('counts the unweighed entries rather than guessing at them', () => {
    const carried = carriedWeight(withEquipment([
      { id: 'a', name: 'Chain Mail', quantity: 1, weight: 55 },
      { id: 'b', name: 'Trinket', quantity: 1 },
      { id: 'c', name: 'Rations', quantity: 5, weight: 2 },
    ], { currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } }))
    expect(carried.gear).toBe(65)
    expect(carried.unweighed).toBe(1)
    expect(carried.total).toBe(65)
  })

  it('weighs the purse at fifty coins to the pound', () => {
    expect(coinWeight({ cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 })).toBe(2)
    expect(coinWeight({ cp: 25, sp: 25, ep: 0, gp: 0, pp: 0 })).toBe(1)
  })

  it('adds the coins to the total', () => {
    const carried = carriedWeight(withEquipment(
      [{ id: 'a', name: 'Bedroll', quantity: 1, weight: 7 }],
      { currency: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 } },
    ))
    expect(carried.coins).toBe(1)
    expect(carried.countsCoins).toBe(true)
    expect(carried.total).toBe(8)
  })
})

describe('a table that ignores coin weight can turn it off', () => {
  const purse = (countCoinWeight?: boolean) => carriedWeight(withEquipment(
    [{ id: 'a', name: 'Bedroll', quantity: 1, weight: 7 }],
    { currency: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 }, ...(countCoinWeight === undefined ? {} : { countCoinWeight }) },
  ))

  it('counts it by default, which is the rule as written', () => {
    expect(purse().countsCoins).toBe(true)
    expect(purse().total).toBe(8)
  })

  it('leaves it out of the total when it is off', () => {
    const carried = purse(false)
    expect(carried.countsCoins).toBe(false)
    expect(carried.total).toBe(7)
  })

  /** The sheet still prints what the purse weighs, so turning it back on is informed. */
  it('still reports what the coins weigh', () => {
    expect(purse(false).coins).toBe(1)
  })

  it('counts it again when it is switched back on', () => {
    expect(purse(true).total).toBe(8)
  })

  it('does not disturb the gear total either way', () => {
    expect(purse(false).gear).toBe(7)
    expect(purse(true).gear).toBe(7)
  })
})

describe('carrying capacity', () => {
  it('is Strength times fifteen', () => {
    // The fixture is a Strength 16 fighter.
    expect(carryingCapacity(validCharacter).capacity).toBe(240)
  })

  it('reads the override ability score rather than the rolled one', () => {
    const c = { ...validCharacter, abilityScoreOverrides: { str: 20 } }
    expect(carryingCapacity(c).capacity).toBe(300)
  })

  it('lets you push, drag or lift twice what you carry', () => {
    expect(carryingCapacity(validCharacter).pushDragLift).toBe(480)
  })

  it('doubles for a feature that counts you one size larger', () => {
    const c = withEquipment([], {
      features: [feature(
        'Powerful Build',
        'You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
      )],
    })
    const capacity = carryingCapacity(c)
    expect(capacity.capacity).toBe(480)
    expect(capacity.sources).toEqual(['Powerful Build'])
  })

  it('doubles for a feature that simply says it doubles', () => {
    const c = withEquipment([], {
      features: [feature(
        'Aspect of the Beast: Bear',
        'Your carrying capacity (including maximum load and maximum lift) is doubled, and you have advantage on Strength checks made to push, pull, lift, or break objects.',
      )],
    })
    expect(carryingCapacity(c).capacity).toBe(480)
  })

  /** Each says "doubled", and a goliath barbarian who took the bear totem has both. */
  it('stacks two of them', () => {
    const c = withEquipment([], {
      features: [
        feature('Powerful Build', 'You count as one size larger when determining your carrying capacity.'),
        feature('Aspect of the Beast', 'Your carrying capacity is doubled.'),
      ],
    })
    const capacity = carryingCapacity(c)
    expect(capacity.multiplier).toBe(4)
    expect(capacity.sources).toHaveLength(2)
  })

  it('ignores a feature that mentions capacity without widening it', () => {
    const c = withEquipment([], {
      features: [feature('Beast of Burden', 'Your mount has a carrying capacity of its own.')],
    })
    expect(carryingCapacity(c).multiplier).toBe(1)
  })

  it('ignores a feature that doubles something else', () => {
    const c = withEquipment([], {
      features: [feature('Extra Attack', 'You can attack twice whenever you take the Attack action.')],
    })
    expect(carryingCapacity(c).multiplier).toBe(1)
  })

  it('takes the player at their word over the features', () => {
    const c = withEquipment([], {
      carryingCapacityMultiplier: 1,
      features: [feature('Powerful Build', 'You count as one size larger for your carrying capacity.')],
    })
    const capacity = carryingCapacity(c)
    expect(capacity.capacity).toBe(240)
    expect(capacity.manual).toBe(true)
    expect(capacity.sources).toEqual([])
  })

  it('hands it back to the features when the override is cleared', () => {
    const c = withEquipment([], {
      carryingCapacityMultiplier: null,
      features: [feature('Powerful Build', 'You count as one size larger for your carrying capacity.')],
    })
    expect(carryingCapacity(c).manual).toBe(false)
    expect(carryingCapacity(c).capacity).toBe(480)
  })
})
