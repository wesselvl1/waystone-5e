/**
 * Turning a SpellDefinition's stored text into the shape a spell block reads in.
 *
 * Kept out of the component so it is testable under the `node` vitest environment, which
 * cannot mount anything relying on Nuxt auto-imports.
 */

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** "1st", "2nd", … for a spell or slot level; the level itself for anything unexpected. */
export function levelOrdinal(level: number): string {
  return ORDINALS[level] ?? String(level)
}

/**
 * The line under a spell's name: "3rd-level evocation", or "Evocation cantrip" for a
 * cantrip, matching how the SRD prints it.
 */
export function spellSubtitle(level: number, school: string): string {
  if (level === 0) return `${school.charAt(0).toUpperCase()}${school.slice(1)} cantrip`
  return `${levelOrdinal(level)}-level ${school}`
}

/** Blank lines separate paragraphs in the stored description. */
export function descriptionParagraphs(description: string): string[] {
  return description
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
}

/**
 * The heading a paragraph names itself with, split off so it can be emphasised instead of
 * running into the sentence after it. `label` is empty when the paragraph has none.
 */
export function splitLeadIn(paragraph: string): { label: string, rest: string } {
  const match = paragraph.match(/^(At Higher Levels\.|Ritual\.|Cantrip Upgrade\.)\s*/)
  if (!match) return { label: '', rest: paragraph }
  return { label: match[1]!, rest: paragraph.slice(match[0].length) }
}

/** One rendered chunk of a description: running text, or a bulleted list. */
export type DescriptionBlock =
  | { kind: 'text', text: string }
  | { kind: 'list', items: string[] }

/**
 * A description split into blocks ready to render.
 *
 * Thirteen SRD spells list their options as `- ` lines inside a paragraph — thaumaturgy
 * and prestidigitation among them. Those single newlines collapse in HTML, running every
 * option into one sentence, so a run of bullet lines becomes its own list block.
 */
export function descriptionBlocks(description: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = []

  for (const paragraph of descriptionParagraphs(description)) {
    let items: string[] = []
    let text: string[] = []

    const flushList = () => {
      if (items.length > 0) blocks.push({ kind: 'list', items })
      items = []
    }
    const flushText = () => {
      if (text.length > 0) blocks.push({ kind: 'text', text: text.join(' ') })
      text = []
    }

    for (const line of paragraph.split('\n')) {
      const bullet = line.match(/^[-•*]\s+(.*)$/)
      if (bullet) {
        flushText()
        items.push(bullet[1]!.trim())
      }
      else {
        flushList()
        if (line.trim()) text.push(line.trim())
      }
    }

    flushText()
    flushList()
  }

  return blocks
}
