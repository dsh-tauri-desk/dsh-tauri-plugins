import type { SessionListSnapshot, WorktreeHydrationSessionsRuntime } from './types'
import { describe, expect, it, vi } from 'vitest'
import { openWorktreeSession } from './handoff'

function runtime(snapshot: SessionListSnapshot): WorktreeHydrationSessionsRuntime {
  return {
    binding: () => undefined,
    list: {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    },
    open: vi.fn((sessionId: string) => {
      snapshot.current = sessionId
    }),
    refresh: vi.fn(async () => {}),
  }
}

describe('openWorktreeSession', () => {
  it('refreshes until the inherited worktree session is listed before opening it', async () => {
    const snapshot: SessionListSnapshot = { ids: ['source'], current: 'source', phase: 'ready' }
    const sessions = runtime(snapshot)
    sessions.refresh = vi.fn(async () => {
      snapshot.ids.push('target')
    })

    await expect(openWorktreeSession(sessions, 'source', 'target', { maxAttempts: 2, retryDelayMs: 0 })).resolves.toBe(true)
    expect(sessions.refresh).toHaveBeenCalledOnce()
    expect(sessions.open).toHaveBeenCalledWith('target')
    expect(snapshot.current).toBe('target')
  })

  it('retries when an early open races session materialization', async () => {
    const snapshot: SessionListSnapshot = { ids: ['source', 'target'], current: 'source', phase: 'ready' }
    const sessions = runtime(snapshot)
    sessions.open = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error('scope is not ready')
      })
      .mockImplementationOnce(() => {
        snapshot.current = 'target'
      })

    await expect(openWorktreeSession(sessions, 'source', 'target', { maxAttempts: 2, retryDelayMs: 0 })).resolves.toBe(true)
    expect(sessions.open).toHaveBeenCalledTimes(2)
    expect(sessions.refresh).toHaveBeenCalledOnce()
  })

  it('stops before opening when hydration is disposed during refresh', async () => {
    const snapshot: SessionListSnapshot = { ids: ['source'], current: 'source', phase: 'ready' }
    const sessions = runtime(snapshot)
    let active = true
    sessions.refresh = vi.fn(async () => {
      snapshot.ids.push('target')
      active = false
    })

    await expect(openWorktreeSession(sessions, 'source', 'target', {
      isActive: () => active,
      maxAttempts: 2,
      retryDelayMs: 0,
    })).resolves.toBe(false)
    expect(sessions.open).not.toHaveBeenCalled()
  })

  it('does not override a user selection made while waiting', async () => {
    const snapshot: SessionListSnapshot = { ids: ['source'], current: 'source', phase: 'ready' }
    const sessions = runtime(snapshot)
    sessions.refresh = vi.fn(async () => {
      snapshot.current = 'other'
      snapshot.ids.push('other', 'target')
    })

    await expect(openWorktreeSession(sessions, 'source', 'target', { maxAttempts: 2, retryDelayMs: 0 })).resolves.toBe(false)
    expect(sessions.open).not.toHaveBeenCalled()
    expect(snapshot.current).toBe('other')
  })
})
