import { describe, it, expect } from 'vitest'
import { evaluateAmount, halveExpression, isExpression } from '~/services/hpMath'

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
