import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  createSnapshotStore: () => ({
    getSnapshot: () => null,
    set: () => undefined,
    subscribe: () => () => undefined,
  }),
}))

describe('panel protocol', () => {
  it('closes safely when no panel content is active', async () => {
    const { closePanelContent } = await import('../src/client/service')
    expect(() => closePanelContent()).not.toThrow()
  })
})
