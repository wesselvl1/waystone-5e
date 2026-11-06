import { describe, it, expect } from 'vitest'
import {
  adjustTrackedQuantity,
  isAmmunition,
  moveTrackedItem,
  trackItem,
  trackableItems,
  trackedItems,
  untrackItem,
} from '~/services/itemTracker'
import { CharacterSchema } from '~/schemas/characterSchema'
import { validCharacter } from '../fixtures'
import type { Character, EquipmentEntry } from '~/types/character'

function item(id: string, name: string, quantity = 1): EquipmentEntry {
  return { id, name, quantity }
}

function withEquipment(equipment: EquipmentEntry[], extra: Partial<Character> = {}): Character {
  return { ...validCharacter, equipment, ...extra }
}

const ids = (character: Character) => trackedItems(character).map(e => e.id)

describe('what counts as ammunition', () => {
  it.each(['Arrows', 'Bolts', 'Crossbow bolts', 'Sling bullets', 'Blowgun needles', 'Arrows +1', 'Arrow'])(
    'tracks %s on its own',
    name => expect(isAmmunition(name)).toBe(true),
  )

  it.each(['Quiver', 'Longbow', 'Crossbow, Light', 'Bolt of cloth', 'Healing potion', 'Needle and thread'])(
    'leaves %s alone',
    name => expect(isAmmunition(name)).toBe(false),
  )
})

describe('the tracked list', () => {
  it('picks up ammunition already in the inventory, so older characters get it too', () => {
    const c = withEquipment([item('a', 'Longbow'), item('b', 'Arrows', 20), item('c', 'Rope')])
    expect(ids(c)).toEqual(['b'])
  })

  it('lists hand-picked items in the stored order, ahead of ammunition nobody has placed', () => {
    const c = withEquipment(
      [item('a', 'Arrows', 20), item('b', 'Healing potion', 2), item('c', 'Javelin', 4)],
      { trackedItemIds: ['c', 'b'] },
    )
    expect(ids(c)).toEqual(['c', 'b', 'a'])
  })

  it('drops an id whose inventory line was deleted', () => {
    const c = withEquipment([item('a', 'Healing potion')], { trackedItemIds: ['gone', 'a'] })
    expect(ids(c)).toEqual(['a'])
  })

  it('leaves out ammunition the player took off the tracker', () => {
    const c = withEquipment([item('a', 'Arrows', 20)], { untrackedItemIds: ['a'] })
    expect(ids(c)).toEqual([])
  })

  it('follows the inventory line, not its name', () => {
    const c = withEquipment([item('a', 'Arrows +1 (renamed)', 5)], { trackedItemIds: ['a'] })
    expect(ids(c)).toEqual(['a'])
  })
})

describe('adding and removing', () => {
  it('adds an item to the bottom, fixing the order of what was already there', () => {
    const c = withEquipment([item('a', 'Arrows', 20), item('b', 'Healing potion')])
    const patch = trackItem(c, 'b')
    expect(patch.trackedItemIds).toEqual(['a', 'b'])
  })

  it('re-adding removed ammunition clears its removal', () => {
    const c = withEquipment([item('a', 'Arrows', 20)], { untrackedItemIds: ['a'] })
    const patch = trackItem(c, 'a')
    expect(patch.untrackedItemIds).toEqual([])
    expect(ids({ ...c, ...patch })).toEqual(['a'])
  })

  it('removing ammunition remembers the removal, and never touches the inventory', () => {
    const c = withEquipment([item('a', 'Arrows', 20)])
    const patch = untrackItem(c, 'a')
    expect(patch.untrackedItemIds).toEqual(['a'])
    expect(patch.equipment).toBeUndefined()
    expect(ids({ ...c, ...patch })).toEqual([])
  })

  it('removing a hand-picked item just drops it from the order', () => {
    const c = withEquipment([item('a', 'Healing potion')], { trackedItemIds: ['a'] })
    const patch = untrackItem(c, 'a')
    expect(patch.trackedItemIds).toEqual([])
    expect(patch.untrackedItemIds ?? []).toEqual([])
  })

  it('offers only the lines not yet tracked', () => {
    const c = withEquipment(
      [item('a', 'Arrows', 20), item('b', 'Healing potion'), item('c', 'Rope')],
      { trackedItemIds: ['b'] },
    )
    expect(trackableItems(c).map(e => e.id)).toEqual(['c'])
  })
})

describe('reordering', () => {
  it('moves a row and stores the whole order, ammunition included', () => {
    const c = withEquipment(
      [item('a', 'Arrows', 20), item('b', 'Healing potion'), item('c', 'Javelin', 4)],
      { trackedItemIds: ['b', 'c'] },
    )
    // shown as b, c, a — move a to the top
    const patch = moveTrackedItem(c, 2, 0)
    expect(patch.trackedItemIds).toEqual(['a', 'b', 'c'])
  })

  it('ignores a move outside the list', () => {
    const c = withEquipment([item('a', 'Arrows')])
    expect(moveTrackedItem(c, 0, 5).trackedItemIds).toEqual(['a'])
  })
})

describe('the count is the inventory quantity', () => {
  it('spends from the inventory line itself', () => {
    const c = withEquipment([item('a', 'Arrows', 20), item('b', 'Rope')])
    const patch = adjustTrackedQuantity(c, 'a', -1)
    expect(patch.equipment?.find(e => e.id === 'a')?.quantity).toBe(19)
    expect(patch.equipment?.find(e => e.id === 'b')).toEqual(item('b', 'Rope'))
  })

  it('stops at zero and keeps the line', () => {
    const c = withEquipment([item('a', 'Healing potion', 0)])
    const patch = adjustTrackedQuantity(c, 'a', -1)
    expect(patch.equipment).toEqual([item('a', 'Healing potion', 0)])
  })

  it('counts back up', () => {
    const c = withEquipment([item('a', 'Arrows', 0)])
    expect(adjustTrackedQuantity(c, 'a', 1).equipment?.[0]?.quantity).toBe(1)
  })
})

describe('the stored fields', () => {
  it('survive an import', () => {
    const parsed = CharacterSchema.parse({
      ...validCharacter,
      trackedItemIds: ['a'],
      untrackedItemIds: ['b'],
    })
    expect(parsed.trackedItemIds).toEqual(['a'])
    expect(parsed.untrackedItemIds).toEqual(['b'])
  })
})
