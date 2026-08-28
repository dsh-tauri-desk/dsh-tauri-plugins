import { describe, expect, it } from 'vitest'
import { isUnderRoot, prunableSessionIds } from './cleanup'

describe('isUnderRoot', () => {
  it('accepts the root itself', () => {
    expect(isUnderRoot('/a/tmp-sessions', '/a/tmp-sessions')).toBe(true)
  })

  it('accepts nested paths on both separator styles', () => {
    expect(isUnderRoot('C:\\Users\\me\\.dsh\\tmp-sessions', 'C:\\Users\\me\\.dsh\\tmp-sessions\\session-1')).toBe(true)
    expect(isUnderRoot('C:\\Users\\me\\.dsh\\tmp-sessions', 'C:\\Users\\me\\.dsh\\tmp-sessions/session-1')).toBe(true)
    expect(isUnderRoot('/home/me/.dsh/tmp-sessions', '/home/me/.dsh/tmp-sessions/session-1')).toBe(true)
  })

  it('rejects sibling prefixes that merely share a character run', () => {
    expect(isUnderRoot('/a/tmp-sessions', '/a/tmp-sessions-backup/x')).toBe(false)
  })

  it('normalizes trailing separators on either side', () => {
    expect(isUnderRoot('/a/root/', '/a/root/x')).toBe(true)
    expect(isUnderRoot('/a/root\\', '/a/root/x')).toBe(true)
  })

  it('rejects non-string and empty paths', () => {
    expect(isUnderRoot('/a', undefined)).toBe(false)
    expect(isUnderRoot('/a', null)).toBe(false)
    expect(isUnderRoot('/a', '')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isUnderRoot('/A/root', '/a/root/x')).toBe(false)
  })
})

describe('prunableSessionIds', () => {
  it('keeps only dirs that are neither live nor persisted', () => {
    expect(prunableSessionIds(['a', 'b', 'c', 'd'], new Set(['a']), new Set(['b']))).toEqual(['c', 'd'])
  })

  it('returns everything when nothing is owned', () => {
    expect(prunableSessionIds(['x'], new Set(), new Set())).toEqual(['x'])
  })
})
