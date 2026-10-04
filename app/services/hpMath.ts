/**
 * The arithmetic the damage and heal boxes accept, so a resisted 37 is typed `37/2`
 * and a hit that is half resisted `8+7/2`, rather than worked out on paper first.
 *
 * `+ - * /` and parentheses, with the usual precedence. **Every division rounds
 * down**, at the point it happens, because that is how the rules halve damage: each
 * halved part is rounded down on its own, so `8+7/2` is 8 + 3 = 11, not 11.5 → 11
 * by luck. The total is rounded down as well, for a `37*0.5`.
 *
 * Deliberately not `eval` or `Function`: the box takes whatever a phone keyboard or a
 * paste puts in it, and a recursive-descent parser over five symbols is short.
 */

/** Symbols a phone keyboard or the operator row may produce, mapped to the plain ones. */
const SYMBOL_ALIASES: Record<string, string> = {
  '−': '-',
  '–': '-',
  '×': '*',
  'x': '*',
  'X': '*',
  '÷': '/',
  ',': '.',
}

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string }

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const raw = input[i]!
    const ch = SYMBOL_ALIASES[raw] ?? raw
    if (/\s/.test(ch)) { i++; continue }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i++
      continue
    }
    if (/[\d.]/.test(ch)) {
      let text = ''
      while (i < input.length) {
        const c = SYMBOL_ALIASES[input[i]!] ?? input[i]!
        if (!/[\d.]/.test(c)) break
        text += c
        i++
      }
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null
      tokens.push({ kind: 'num', value: Number(text) })
      continue
    }
    return null
  }
  return tokens
}

/**
 * The value of an amount expression, or `null` when it does not parse — empty, a
 * trailing operator while still typing, a division by zero. Never negative: a box
 * that subtracts hit points on "damage" must not quietly heal.
 */
export function evaluateAmount(input: string): number | null {
  const parsed = tokenize(input)
  if (!parsed || parsed.length === 0) return null
  const tokens: Token[] = parsed
  let pos = 0

  const peek = () => tokens[pos]
  const isOp = (value: string) => {
    const t = peek()
    return t?.kind === 'op' && t.value === value
  }

  function expression(): number | null {
    let left = term()
    while (left !== null && (isOp('+') || isOp('-'))) {
      const op = (tokens[pos++] as { value: string }).value
      const right = term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function term(): number | null {
    let left = factor()
    while (left !== null && (isOp('*') || isOp('/'))) {
      const op = (tokens[pos++] as { value: string }).value
      const right = factor()
      if (right === null) return null
      if (op === '*') left = left * right
      else if (right === 0) return null
      else left = Math.floor(left / right)
    }
    return left
  }

  function factor(): number | null {
    const t = peek()
    if (!t) return null
    if (t.kind === 'num') { pos++; return t.value }
    if (t.value === '-') { pos++; const v = factor(); return v === null ? null : -v }
    if (t.value === '+') { pos++; return factor() }
    if (t.value === '(') {
      pos++
      const v = expression()
      if (v === null || !isOp(')')) return null
      pos++
      return v
    }
    return null
  }

  const result = expression()
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) return null
  return Math.max(0, Math.floor(result))
}

/** Whether the box holds a sum rather than a bare number, i.e. whether "= n" is worth showing. */
export function isExpression(input: string): boolean {
  return /[+\-*/()−–×÷xX]/.test(input.trim().replace(/^\+/, ''))
}

/**
 * The ½ key: halve everything typed so far. A bare number becomes `37/2`; anything
 * longer is bracketed first, so `8+7` halves as a whole rather than only the 7.
 */
export function halveExpression(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}/2` : `(${trimmed})/2`
}

export interface HitPointPool { max: number; current: number; temp: number }

/**
 * Damage after it has gone through temporary hit points. The temporary pool absorbs
 * first and only what is left comes off `current` (SRD, "Temporary Hit Points"), so a
 * 12-point hit on 5 temp and 20 current leaves 0 and 13. `overflow` is the damage past
 * both, which is what a Wild Shape form carries over to the druid.
 */
export function applyDamage(hp: HitPointPool, amount: number): { current: number; temp: number; overflow: number } {
  const damage = Math.max(0, amount)
  const temp = Math.max(0, Number(hp.temp) || 0)
  const absorbed = Math.min(temp, damage)
  const rest = damage - absorbed
  return {
    current: Math.max(0, hp.current - rest),
    temp: temp - absorbed,
    overflow: Math.max(0, rest - hp.current),
  }
}

/** Healing restores `current` up to `max` and never touches temporary hit points. */
export function applyHealing(hp: HitPointPool, amount: number): { current: number; temp: number } {
  return {
    current: Math.min(hp.max, hp.current + Math.max(0, amount)),
    temp: Math.max(0, Number(hp.temp) || 0),
  }
}

/**
 * What an HP box commits. A cleared `type="number"` input hands `v-model` an empty
 * string, which was stored as-is — the sheet then held `temp: ""`, which no longer
 * matches the type and fails `CharacterSchema` on the next import. Anything that is not
 * a number falls back (to 0 for temp, the old value otherwise); the rest is a whole,
 * non-negative number.
 */
export function hpFieldValue(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number.NaN
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback
}
