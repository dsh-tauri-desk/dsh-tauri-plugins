import { hello, two } from '@pkg-placeholder/core'
import { capitalize } from '@pkg-placeholder/utils'
import { describe, expect, it } from 'vitest'

describe('root-level', () => {
  it('can import and use core', () => {
    expect(hello).toBe('Hello world')
    expect(two).toBe(2)
  })

  it('can import and use utils', () => {
    expect(capitalize('hello')).toBe('Hello')
  })
})
