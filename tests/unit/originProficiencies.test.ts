import { describe, it, expect } from 'vitest'
import { originProficienciesAtFirstLevel } from '~/services/levelUpService'
import type { Background, Race, Subrace } from '~/types/rulepack'
import races from '~/data/srd/races.json'
import subraces from '~/data/srd/subraces.json'

const dwarf = (races.races as unknown as Race[]).find(r => r.id === 'dwarf')!
const hillDwarf = (subraces.subraces as unknown as Subrace[]).find(s => s.id === 'hill-dwarf')!

const race = {
  id: 'test-race',
  name: 'Test Race',
  levelUpEvents: [
    { level: 1, trait: 'Old Training', levelUpEvents: [{ type: 'GAIN_PROFICIENCY', proficiency: 'whip' }] },
    { level: 1, levelUpEvents: [
      { type: 'GAIN_PROFICIENCY', proficiency: 'light' },
      { type: 'GAIN_PROFICIENCY', proficiency: 'net', whenOption: { choiceId: 'c', optionId: 'o' } },
    ] },
    { level: 3, levelUpEvents: [{ type: 'GAIN_PROFICIENCY', proficiency: 'medium' }] },
  ],
} as unknown as Race

describe('originProficienciesAtFirstLevel', () => {
  it('includes the SRD hill dwarf\'s Dwarven Combat Training', () => {
    const profs = originProficienciesAtFirstLevel(dwarf, hillDwarf, undefined)
    expect(profs).toContain('warhammer')
    expect(profs).toContain('battleaxe')
  })

  it('leaves out the grant of a trait the subrace replaces', () => {
    const subrace = { id: 's', name: 'S', replacesRaceTraits: ['Old Training'] } as unknown as Subrace
    expect(originProficienciesAtFirstLevel(race, subrace, undefined)).not.toContain('whip')
    expect(originProficienciesAtFirstLevel(race, undefined, undefined)).toContain('whip')
  })

  it('leaves out a whenOption grant and a later level', () => {
    const profs = originProficienciesAtFirstLevel(race, undefined, undefined)
    expect(profs).toContain('light')
    expect(profs).not.toContain('net')
    expect(profs).not.toContain('medium')
  })

  it('reads the subrace and the background as well', () => {
    const subrace = { id: 's', name: 'S', levelUpEvents: [
      { level: 1, levelUpEvents: [{ type: 'GAIN_PROFICIENCY', proficiency: 'longsword' }] },
    ] } as unknown as Subrace
    const background = { id: 'b', name: 'B', levelUpEvents: [
      { level: 1, levelUpEvents: [{ type: 'GAIN_PROFICIENCY', proficiency: 'shields' }] },
    ] } as unknown as Background
    expect(originProficienciesAtFirstLevel(undefined, subrace, background)).toEqual(['longsword', 'shields'])
  })
})
