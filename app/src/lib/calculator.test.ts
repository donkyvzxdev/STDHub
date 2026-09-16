import { describe, expect, it } from 'vitest'
import {
  CalcError,
  evaluate,
  formatResult,
  tokenize,
} from './calculator'

describe('T12 calculator engine', () => {
  it('does basic arithmetic with precedence', () => {
    expect(evaluate('2+3*4')).toBe(14)
    expect(evaluate('(2+3)*4')).toBe(20)
    expect(evaluate('10-4/2')).toBe(8)
    expect(evaluate('2^3^2')).toBe(512)
    expect(evaluate('10%3')).toBe(1)
  })

  it('handles unary minus and nested parens', () => {
    expect(evaluate('-5+2')).toBe(-3)
    expect(evaluate('-(2+3)')).toBe(-5)
    expect(evaluate('--5')).toBe(5)
    expect(evaluate('((1+2)*(3+4))')).toBe(21)
  })

  it('supports implicit multiplication and constants', () => {
    expect(evaluate('2pi', 'rad')).toBeCloseTo(2 * Math.PI, 10)
    expect(evaluate('2(3+4)')).toBe(14)
    expect(evaluate('(2+1)(3+1)')).toBe(12)
    expect(evaluate('e', 'rad')).toBeCloseTo(Math.E, 10)
  })

  it('does trig in degrees by default', () => {
    expect(evaluate('sin(30)')).toBeCloseTo(0.5, 10)
    expect(evaluate('cos(60)')).toBeCloseTo(0.5, 10)
    expect(evaluate('tan(45)')).toBeCloseTo(1, 10)
    expect(evaluate('asin(1)')).toBeCloseTo(90, 10)
  })

  it('does trig in radians when asked', () => {
    expect(evaluate('sin(pi/2)', 'rad')).toBeCloseTo(1, 10)
    expect(evaluate('cos(pi)', 'rad')).toBeCloseTo(-1, 10)
  })

  it('does logs, roots, factorial and friends', () => {
    expect(evaluate('log(100)')).toBe(2)
    expect(evaluate('ln(e)', 'rad')).toBeCloseTo(1, 10)
    expect(evaluate('sqrt(16)')).toBe(4)
    expect(evaluate('cbrt(27)')).toBe(3)
    expect(evaluate('5!')).toBe(120)
    expect(evaluate('3!+4')).toBe(10)
    expect(evaluate('abs(-7)')).toBe(7)
  })

  it('rejects invalid input with CalcError', () => {
    for (const bad of [
      '',
      '   ',
      '2+',
      '(2+3',
      '2..5',
      'foo(2)',
      '1/0',
      'sqrt(-1)',
      'log(0)',
      '(-5)!',
      'tan(90)',
      '2^^2',
    ]) {
      expect(() => evaluate(bad), bad).toThrow(CalcError)
    }
  })

  it('allows unary plus', () => {
    expect(evaluate('2++2')).toBe(4)
    expect(evaluate('+5')).toBe(5)
  })

  it('tokenizes unary vs binary minus', () => {
    expect(tokenize('2*-3')).toHaveLength(4)
    expect(evaluate('2*-3')).toBe(-6)
  })

  it('formats results cleanly', () => {
    expect(formatResult(2)).toBe('2')
    expect(formatResult(0.1 + 0.2)).toBe('0.3')
    expect(formatResult(-0)).toBe('0')
    expect(formatResult(1 / 3)).toBe('0.3333333333')
  })
})
