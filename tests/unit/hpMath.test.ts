import { describe, it, expect } from 'vitest'
import { applyDamage, applyHealing, evaluateAmount, halveExpression, hpFieldValue, isExpression } from '~/services/hpMath'

describe('evaluateAmount', () => {
  it('reads a bare number', () => {
    expect(evaluateAmount('22')).toBe(22)
    expect(evaluateAmount(' 22 ')).toBe(22)
  })

  it('halves damage rounding down', () => {
    expect(evaluateAmount('37/2')).toBe(18)
  })

  it('rounds each halved part down on its own', () => {
    // 8 + floor(7/2), the way a half-resisted hit is worked out at the table.
    expect(evaluateAmount('8+7/2')).toBe(11)
    expect(evaluateAmount('7/2+7/2')).toBe(6)
  })

  it('follows precedence and brackets', () => {
    expect(evaluateAmount('2+3*4')).toBe(14)
    expect(evaluateAmount('(8+7)/2')).toBe(7)
    expect(evaluateAmount('10-3-2')).toBe(5)
  })

  it('accepts the symbols a keyboard or the operator row produces', () => {
    expect(evaluateAmount('9×2')).toBe(18)
    expect(evaluateAmount('9x2')).toBe(18)
    expect(evaluateAmount('9÷2')).toBe(4)
    expect(evaluateAmount('9−2')).toBe(7)
  })

  it('rounds a fractional total down', () => {
    expect(evaluateAmount('37*0.5')).toBe(18)
    expect(evaluateAmount('37*0,5')).toBe(18)
  })

  it('never goes negative', () => {
    expect(evaluateAmount('3-10')).toBe(0)
    expect(evaluateAmount('-5')).toBe(0)
  })

  it('is null for anything that is not a finished sum', () => {
    expect(evaluateAmount('')).toBeNull()
    expect(evaluateAmount('8+')).toBeNull()
    expect(evaluateAmount('(8+7')).toBeNull()
    expect(evaluateAmount('8)')).toBeNull()
    expect(evaluateAmount('8/0')).toBeNull()
    expect(evaluateAmount('1.2.3')).toBeNull()
    expect(evaluateAmount('alert(1)')).toBeNull()
  })
})

describe('isExpression', () => {
  it('is false for a bare number', () => {
    expect(isExpression('22')).toBe(false)
    expect(isExpression('')).toBe(false)
  })

  it('is true once an operator is typed', () => {
    expect(isExpression('8+7/2')).toBe(true)
    expect(isExpression('9×2')).toBe(true)
  })
})

describe('halveExpression', () => {
  it('halves a bare number without brackets', () => {
    expect(halveExpression('37')).toBe('37/2')
  })

  it('brackets a sum so the whole of it is halved', () => {
    expect(halveExpression('8+7')).toBe('(8+7)/2')
    expect(evaluateAmount(halveExpression('8+7'))).toBe(7)
  })

  it('leaves an empty box empty', () => {
    expect(halveExpression('  ')).toBe('')
  })
})

describe('applyDamage', () => {
  it('takes damage out of temporary hit points first', () => {
    expect(applyDamage({ max: 30, current: 20, temp: 5 }, 3)).toEqual({ current: 20, temp: 2, overflow: 0 })
  })

  it('carries what the temporary pool cannot absorb over to current', () => {
    expect(applyDamage({ max: 30, current: 20, temp: 5 }, 12)).toEqual({ current: 13, temp: 0, overflow: 0 })
  })

  it('works without temporary hit points', () => {
    expect(applyDamage({ max: 30, current: 20, temp: 0 }, 7)).toEqual({ current: 13, temp: 0, overflow: 0 })
  })

  it('stops at 0 and reports the damage past both pools', () => {
    expect(applyDamage({ max: 30, current: 4, temp: 3 }, 10)).toEqual({ current: 0, temp: 0, overflow: 3 })
  })

  it('treats a cleared temp box as no temporary hit points', () => {
    expect(applyDamage({ max: 30, current: 20, temp: '' as unknown as number }, 5)).toEqual({ current: 15, temp: 0, overflow: 0 })
  })
})

describe('applyHealing', () => {
  it('heals current up to max and leaves temporary hit points alone', () => {
    expect(applyHealing({ max: 30, current: 25, temp: 4 }, 10)).toEqual({ current: 30, temp: 4 })
  })
})

describe('hpFieldValue', () => {
  it('falls back when the box was cleared', () => {
    expect(hpFieldValue('', 0)).toBe(0)
    expect(hpFieldValue('', 12)).toBe(12)
  })

  it('keeps a whole, non-negative number', () => {
    expect(hpFieldValue(7, 0)).toBe(7)
    expect(hpFieldValue(-3, 0)).toBe(0)
    expect(hpFieldValue(2.6, 0)).toBe(3)
  })
})
