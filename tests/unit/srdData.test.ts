import { describe, it, expect } from 'vitest'
import { RulepackSchema } from '~/schemas/rulepackSchema'

import spells from '~/data/srd/spells.json'
import classes from '~/data/srd/classes.json'
import backgrounds from '~/data/srd/backgrounds.json'
import races from '~/data/srd/races.json'
import feats from '~/data/srd/feats.json'
import subclasses from '~/data/srd/subclasses.json'
import subraces from '~/data/srd/subraces.json'

const srdFiles = [
  { name: 'spells.json', data: spells },
  { name: 'classes.json', data: classes },
  { name: 'backgrounds.json', data: backgrounds },
  { name: 'races.json', data: races },
  { name: 'feats.json', data: feats },
  { name: 'subclasses.json', data: subclasses },
  { name: 'subraces.json', data: subraces },
]

describe('SRD data files', () => {
  for (const { name, data } of srdFiles) {
    it(`${name} is valid against RulepackSchema`, () => {
      const result = RulepackSchema.safeParse(data)
      if (!result.success) {
        // Surface the first validation error for easy debugging
        const issue = result.error.issues[0]
        throw new Error(`${name}: ${issue.path.join('.')} — ${issue.message}`)
      }
      expect(result.success).toBe(true)
    })
  }
})
