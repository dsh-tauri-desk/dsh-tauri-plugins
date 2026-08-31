import type { ClientContext } from '../src/client/types'
import { describe, expect, it, vi } from 'vitest'
import { compat } from '../src/client/compat'

function context(services: Record<string, unknown>): ClientContext {
  return { ...services } as unknown as ClientContext
}

describe('compat', () => {
  it('preserves native sessions.provideInfo on Alpha-shaped desktop runtimes', () => {
    const inputActions = { setDraft: vi.fn() }
    const provideInfo = vi.fn(() => ({ props: { inputActions } }))
    const sessions = {
      list: { getSnapshot: () => ({}) },
      provideInfo,
    }
    const ctx = context({ sessions })

    const result = compat(ctx) as unknown as { sessions: { provideInfo: (id: string) => unknown } }
    expect(result.sessions.provideInfo('target')).toEqual({ props: { inputActions } })
    expect(provideInfo).toHaveBeenCalledWith('target')
  })
})
