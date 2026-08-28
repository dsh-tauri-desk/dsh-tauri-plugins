import { describe, expect, it } from 'vitest'
import { safeWebUrl } from './opener'

describe('safeWebUrl', () => {
  it('accepts http/https URLs', () => {
    expect(safeWebUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1')
    expect(safeWebUrl('http://example.com')).toBe('http://example.com/')
  })

  it('rejects non-web protocols', () => {
    expect(safeWebUrl('file:///C:/Windows/win.ini')).toBeNull()
    expect(safeWebUrl('javascript:alert(1)')).toBeNull()
    expect(safeWebUrl('ftp://example.com')).toBeNull()
    expect(safeWebUrl('data:text/plain,hi')).toBeNull()
  })

  it('rejects non-strings and malformed values', () => {
    expect(safeWebUrl(123)).toBeNull()
    expect(safeWebUrl(null)).toBeNull()
    expect(safeWebUrl('not a url')).toBeNull()
  })
})
