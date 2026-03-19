import { useRulepacksStore } from '~/stores/rulepacks'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { RulepackFragment } from '~/schemas/rulepackSchema'
import srdRacesData from '~/data/srd/races.json'
import srdSubracesData from '~/data/srd/subraces.json'
import srdSubclassesData from '~/data/srd/subclasses.json'
import srdClasses from '~/data/srd/classes.json'
import srdBackgrounds from '~/data/srd/backgrounds.json'
import srdFeats from '~/data/srd/feats.json'
import srdSpells from '~/data/srd/spells.json'

/** Additional fragment files to merge into the SRD rulepack, in load order. */
const SRD_FRAGMENTS = [srdRacesData, srdSubracesData, srdSubclassesData, srdClasses, srdBackgrounds, srdFeats, srdSpells]

export default defineNuxtPlugin(async () => {
  const rulepackStore = useRulepacksStore()

  // Ensure Dexie data is loaded before checking
  await rulepackStore.loadAll()

  // All fragments share the same id/version — use races.json to drive the version check
  const existing = rulepackStore.getById(srdRacesData.id)

  // Re-seed if the bundled version is newer than what's stored
  if (existing?.version === srdRacesData.version) return

  // Merge all fragment files in order (first fragment creates the rulepack, rest merge in)
  for (const fragmentData of SRD_FRAGMENTS) {
    const fragResult = RulepackSchema.safeParse(fragmentData)
    if (!fragResult.success) {
      console.error('[Waystone] Failed to validate SRD fragment:', fragResult.error.issues)
      continue
    }
    await rulepackStore.add(fragResult.data as RulepackFragment)
  }

  console.info('[Waystone] SRD 5.1 rulepack loaded.')
})
