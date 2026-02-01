import { describe, expect, it } from 'vitest'
import { capitalize, join } from '../src/index'

describe('utils', () => {
  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
    })
    it('returns empty for empty string', () => {
      expect(capitalize('')).toBe('')
    })
  })

  describe('join', () => {
    it('joins with default separator', () => {
      expect(join(['a', 'b', 'c'])).toBe('a b c')
    })
    it('joins with custom separator', () => {
      expect(join(['a', 'b'], '-')).toBe('a-b')
    })
    it('filters empty parts', () => {
      expect(join(['a', '', 'b'])).toBe('a b')
    })
  })
})
