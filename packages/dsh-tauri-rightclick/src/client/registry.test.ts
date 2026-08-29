import { beforeEach, describe, expect, it } from 'vitest'
import { holdRegistryLease, registry } from './registry'

const KEY = Symbol.for('dsh.rightclick-menu.extensions')

describe('registry', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[KEY]
  })

  it('registers extensions ordered by order', () => {
    const api = registry()
    api.register({ id: 'b', order: 10, run: () => {} })
    api.register({ id: 'a', order: 5, run: () => {} })
    expect(api.list().map(entry => entry.id)).toEqual(['a', 'b'])
  })

  it('rejects duplicate ids', () => {
    const api = registry()
    api.register({ id: 'dup', run: () => {} })
    expect(() => api.register({ id: 'dup', run: () => {} })).toThrow()
  })

  it('disposer removes the entry', () => {
    const api = registry()
    const dispose = api.register({ id: 'x', run: () => {} })
    expect(api.list()).toHaveLength(1)
    dispose()
    expect(api.list()).toHaveLength(0)
  })

  it('is a global singleton across calls', () => {
    expect(registry()).toBe(registry())
  })
})

describe('holdRegistryLease', () => {
  it('keeps the global registry alive while leased', () => {
    const release = holdRegistryLease()
    expect((globalThis as Record<symbol, unknown>)[KEY]).toBeDefined()
    release()
  })

  it('removes the global registry when released with no entries', () => {
    const release = holdRegistryLease()
    release()
    // 无条目且无租约时回收全局键。
    expect((globalThis as Record<symbol, unknown>)[KEY]).toBeUndefined()
  })

  it('keeps the global registry while entries remain', () => {
    const api = registry()
    api.register({ id: 'persistent', run: () => {} })
    const release = holdRegistryLease()
    release()
    expect((globalThis as Record<symbol, unknown>)[KEY]).toBeDefined()
  })
})
