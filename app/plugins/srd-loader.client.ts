import { useRulepacksStore } from '~/stores/rulepacks'
import { RulepackSchema } from '~/schemas/rulepackSchema'
import type { Rulepack } from '~/types/rulepack'
import srdData from '~/data/srd-5.1.json'

export default defineNuxtPlugin(async () => {
  const rulepackStore = useRulepacksStore()

  // Ensure Dexie data is loaded before checking
  await rulepackStore.loadAll()

  const existing = rulepackStore.getById('srd-5.1')

  // Re-seed if the bundled version is newer than what's stored
  if (existing?.version === (srdData as { version: string }).version) return

  const result = RulepackSchema.safeParse(srdData)
  if (!result.success) {
    console.error('[Waystone] Failed to validate bundled SRD rulepack:', result.error.issues)
    return
  }

  await rulepackStore.add(result.data as unknown as Rulepack)
  console.info('[Waystone] SRD 5.1 rulepack loaded.')
})
