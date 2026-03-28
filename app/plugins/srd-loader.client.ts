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
const SRD_FRAGMENTS = [srdRacesData, srdSubracesData, srdClasses, srdSubclassesData, srdBackgrounds, srdFeats, srdSpells]

/**
 * Increment this when bundled SRD data changes in a way that requires re-seeding,
 * without changing the official SRD version number.
 */
const SRD_SEED_REVISION = 2
const SEED_REVISION_KEY = `waystone-srd-seed-revision-${srdRacesData.id}`

export default defineNuxtPlugin(async () => {
  const rulepackStore = useRulepacksStore()

  // Ensure Dexie data is loaded before checking
  await rulepackStore.loadAll()

  // All fragments share the same id/version — use races.json to drive the version check
  const existing = rulepackStore.getById(srdRacesData.id)

  const storedRevision = Number(localStorage.getItem(SEED_REVISION_KEY) ?? 0)
  // Re-seed if the bundled version is newer or the internal seed revision has changed
  if (existing?.version === srdRacesData.version && storedRevision >= SRD_SEED_REVISION) return

  // Merge all fragment files in order (first fragment creates the rulepack, rest merge in)
  for (const fragmentData of SRD_FRAGMENTS) {
    const fragResult = RulepackSchema.safeParse(fragmentData)
    if (!fragResult.success) {
      console.error('[Waystone] Failed to validate SRD fragment:', fragResult.error.issues)
      continue
    }
    await rulepackStore.add(fragResult.data)
  }

  localStorage.setItem(SEED_REVISION_KEY, String(SRD_SEED_REVISION))
  console.info('[Waystone] SRD 5.1 rulepack loaded.')
})
