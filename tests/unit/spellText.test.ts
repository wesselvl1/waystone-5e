import { describe, it, expect } from 'vitest'
import {
  levelOrdinal,
  spellSubtitle,
  descriptionParagraphs,
  descriptionBlocks,
  splitLeadIn,
} from '~/utils/spellText'
import spellFragment from '~/data/srd/spells.json'
import { RulepackSchema } from '~/schemas/rulepackSchema'

const spells = RulepackSchema.parse(spellFragment).spells

describe('levelOrdinal', () => {
  it('names every spell level', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(levelOrdinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'])
  })

  it('falls back to the number for anything off the table', () => {
    expect(levelOrdinal(12)).toBe('12')
  })
})

describe('spellSubtitle', () => {
  it('reads a levelled spell the way the SRD prints it', () => {
    expect(spellSubtitle(3, 'evocation')).toBe('3rd-level evocation')
    expect(spellSubtitle(1, 'abjuration')).toBe('1st-level abjuration')
  })

  it('puts the school first for a cantrip, capitalised', () => {
    expect(spellSubtitle(0, 'conjuration')).toBe('Conjuration cantrip')
  })

  it('produces a sensible line for every spell in the SRD', () => {
    for (const spell of spells) {
      const subtitle = spellSubtitle(spell.level, spell.school)
      expect(subtitle, spell.id).toMatch(
        /^([1-9](st|nd|rd|th)-level [a-z]+|[A-Z][a-z]+ cantrip)$/)
    }
  })
})

describe('descriptionParagraphs', () => {
  it('splits on blank lines', () => {
    expect(descriptionParagraphs('one\n\ntwo\n\nthree')).toEqual(['one', 'two', 'three'])
  })

  it('tolerates whitespace-only separator lines and trailing newlines', () => {
    expect(descriptionParagraphs('one\n   \ntwo\n\n')).toEqual(['one', 'two'])
  })

  it('keeps a single-line break inside one paragraph', () => {
    // A lone newline is a wrap, not a paragraph boundary.
    expect(descriptionParagraphs('one\ntwo')).toEqual(['one\ntwo'])
  })

  it('returns nothing for an empty description', () => {
    expect(descriptionParagraphs('')).toEqual([])
    expect(descriptionParagraphs('\n\n')).toEqual([])
  })

  it('gives every SRD spell at least one paragraph', () => {
    for (const spell of spells) {
      expect(descriptionParagraphs(spell.description).length, spell.id)
        .toBeGreaterThan(0)
    }
  })
})

describe('splitLeadIn', () => {
  it('lifts the At Higher Levels heading off the sentence', () => {
    const { label, rest } = splitLeadIn(
      'At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6.')
    expect(label).toBe('At Higher Levels.')
    expect(rest).toMatch(/^When you cast this spell/)
  })

  it('leaves an ordinary paragraph whole', () => {
    const paragraph = 'A bright streak flashes from your pointing finger.'
    expect(splitLeadIn(paragraph)).toEqual({ label: '', rest: paragraph })
  })

  it('does not fire on a mention mid-paragraph', () => {
    const paragraph = 'The damage grows. At Higher Levels. is not a heading here.'
    expect(splitLeadIn(paragraph).label).toBe('')
  })

  it('finds the heading in the SRD text where the spell scales', () => {
    const fireball = spells.find(s => s.id === 'fireball')!
    const last = descriptionParagraphs(fireball.description).at(-1)!
    expect(splitLeadIn(last).label).toBe('At Higher Levels.')
  })

  it('never drops text — label plus rest reconstructs the paragraph', () => {
    for (const spell of spells) {
      for (const paragraph of descriptionParagraphs(spell.description)) {
        const { label, rest } = splitLeadIn(paragraph)
        expect(`${label}${label ? ' ' : ''}${rest}`, spell.id).toBe(paragraph)
      }
    }
  })
})

describe('descriptionBlocks', () => {
  const NL = String.fromCharCode(10)

  it('keeps a plain description as one text block', () => {
    expect(descriptionBlocks('Just prose.')).toEqual([{ kind: 'text', text: 'Just prose.' }])
  })

  it('turns a run of bullet lines into a list', () => {
    const text = ['Choose one:', '', '- First option.', '- Second option.'].join(NL)
    expect(descriptionBlocks(text)).toEqual([
      { kind: 'text', text: 'Choose one:' },
      { kind: 'list', items: ['First option.', 'Second option.'] },
    ])
  })

  it('splits a lead-in and its bullets inside one paragraph', () => {
    // The SRD writes these with single newlines, which collapse in HTML.
    const text = ['You create one effect:', '- One.', '- Two.'].join(NL)
    expect(descriptionBlocks(text)).toEqual([
      { kind: 'text', text: 'You create one effect:' },
      { kind: 'list', items: ['One.', 'Two.'] },
    ])
  })

  it('picks prose back up after a list', () => {
    const text = ['Lead:', '- One.', 'Trailing prose.'].join(NL)
    expect(descriptionBlocks(text)).toEqual([
      { kind: 'text', text: 'Lead:' },
      { kind: 'list', items: ['One.'] },
      { kind: 'text', text: 'Trailing prose.' },
    ])
  })

  it('joins wrapped prose lines into one block rather than one per line', () => {
    expect(descriptionBlocks(['A sentence', 'continues here.'].join(NL)))
      .toEqual([{ kind: 'text', text: 'A sentence continues here.' }])
  })

  it('accepts a bullet or an asterisk as the marker', () => {
    expect(descriptionBlocks(['• One.', '* Two.'].join(NL)))
      .toEqual([{ kind: 'list', items: ['One.', 'Two.'] }])
  })

  it('does not treat a dash inside a sentence as a bullet', () => {
    const text = 'The damage - fire - is halved.'
    expect(descriptionBlocks(text)).toEqual([{ kind: 'text', text }])
  })

  it('finds the list in thaumaturgy, where it was running into one line', () => {
    const thaumaturgy = spells.find(s => s.id === 'thaumaturgy')!
    const blocks = descriptionBlocks(thaumaturgy.description)
    const list = blocks.find(b => b.kind === 'list')
    expect(list).toBeDefined()
    if (list?.kind === 'list') {
      expect(list.items.length).toBeGreaterThan(2)
      for (const item of list.items) expect(item).not.toMatch(/^-/)
    }
  })

  it('gives every SRD spell at least one block and loses no bullet', () => {
    for (const spell of spells) {
      const blocks = descriptionBlocks(spell.description)
      expect(blocks.length, spell.id).toBeGreaterThan(0)
      const bulletLines = spell.description.split(NL)
        .filter(l => /^[-•*]\s+/.test(l.trim())).length
      const items = blocks.reduce(
        (n, b) => n + (b.kind === 'list' ? b.items.length : 0), 0)
      expect(items, spell.id).toBe(bulletLines)
    }
  })
})
