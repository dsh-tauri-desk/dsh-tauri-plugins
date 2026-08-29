// @vitest-environment happy-dom
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionListSnapshot, WorktreeHydrationSessionsRuntime } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HANDOFF_WINDOW_MS } from './constants'
import { openWorktreeSession } from './handoff'
import { installWorktreeHydration } from './hydrate'
import { worktreeStore } from './store'

// dsh-client-runtime 的 ./client 入口是 window.__ModuleLoader__ 引导脚本，无法在
// vitest 中直接加载；这里用最小 SnapshotStore 实现替换 createSnapshotStore。
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  return {
    createSnapshotStore: (init: unknown) => {
      let state = clone(init)
      const listeners = new Set<() => void>()
      return {
        getSnapshot: () => state,
        subscribe: (fn: () => void) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        update: (mutator: (draft: any) => void) => {
          const draft = clone(state)
          mutator(draft)
          state = draft
          for (const fn of listeners)
            fn()
        },
        set: (next: unknown) => {
          state = clone(next)
          for (const fn of listeners)
            fn()
        },
      }
    },
  }
})

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

/** 最小 ClientContext：只提供 installWorktreeHydration 用到的 sessions/workspaces 面。 */
function hydrationCtx(snapshot: SessionListSnapshot): ClientContext {
  const sessionsListeners = new Set<() => void>()
  return {
    sessions: {
      list: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
          sessionsListeners.add(listener)
          return () => sessionsListeners.delete(listener)
        },
      },
      binding: () => undefined,
      open: () => {},
      refresh: async () => {},
    },
    workspaces: {
      list: {
        getSnapshot: () => ({ archivedSessionIds: [] }),
        subscribe: () => () => {},
      },
    },
  } as unknown as ClientContext
}

/** 按 sessionId 返回 /status 响应的 fetch 桩；非 /status 请求（如 /attach）不计数。 */
function stubStatusFetch(statuses: (sessionId: string, calls: number) => unknown): ReturnType<typeof vi.fn> {
  let calls = 0
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input), 'http://localhost')
    if (!url.pathname.endsWith('/status'))
      return { ok: false, status: 404, text: async () => 'not found' }
    calls++
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const status = statuses(sessionId, calls)
    if (!status)
      return { ok: false, status: 404, text: async () => 'not found' }
    return { ok: true, status: 200, json: async () => status }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** 可驱动列表事件与会话事件流的 hydration 上下文（供自动交接门控测试）。 */
function liveHydrationCtx(snapshot: SessionListSnapshot): ClientContext & {
  emit: () => void
  fireEvent: (sessionId: string) => void
  openMock: ReturnType<typeof vi.fn>
} {
  const sessionsListeners = new Set<() => void>()
  const eventListeners = new Map<string, Set<() => void>>()
  const openMock = vi.fn((sessionId: string) => {
    snapshot.current = sessionId
  })
  return {
    emit() {
      for (const listener of [...sessionsListeners])
        listener()
    },
    fireEvent(sessionId: string) {
      for (const listener of [...(eventListeners.get(sessionId) ?? [])])
        listener()
    },
    openMock,
    sessions: {
      list: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
          sessionsListeners.add(listener)
          return () => sessionsListeners.delete(listener)
        },
      },
      binding: (sessionId: string) => {
        const listeners = new Set<() => void>()
        eventListeners.set(sessionId, listeners)
        return { session: { subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        } } }
      },
      open: openMock,
      refresh: async () => {},
    },
    workspaces: {
      list: {
        getSnapshot: () => ({ archivedSessionIds: [] }),
        subscribe: () => () => {},
      },
    },
  } as unknown as ClientContext & {
    emit: () => void
    fireEvent: (sessionId: string) => void
    openMock: ReturnType<typeof vi.fn>
  }
}

/** 工作树会话的 /status 响应（s0 是源会话、本地模式；wt1 绑定工作树）。 */
function handoffStatuses(sessionId: string): unknown {
  return sessionId === 'wt1'
    ? {
        mode: 'worktree',
        worktreeKey: 'abc123/repo',
        worktreePath: '/wt/abc123/repo',
        projectPath: '/repo',
        sourceSessionId: 's0',
        log: [],
        isGit: true,
      }
    : { mode: 'local', projectPath: '/repo', isGit: true }
}

describe('installWorktreeHydration', () => {
  beforeEach(() => {
    worktreeStore.set({ bySession: {} })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('retries a transient /status failure until it succeeds, then stops', async () => {
    vi.useFakeTimers()
    const fetchMock = stubStatusFetch((sessionId, calls) => calls === 1
      ? undefined // 首次请求失败（宿主尚未就绪）
      : { mode: 'local', projectPath: `/repo/${sessionId}`, isGit: true })
    const dispose = installWorktreeHydration(hydrationCtx({ ids: ['s1'], current: 's1', phase: 'ready' }))
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(worktreeStore.getSnapshot().bySession.s1).toBeUndefined()
      await vi.advanceTimersByTimeAsync(1500)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(worktreeStore.getSnapshot().bySession.s1?.isGit).toBe(true)
      // 成功后不再重试
      await vi.advanceTimersByTimeAsync(10_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
    finally {
      dispose()
    }
  })

  it('keeps the default git assumption and retries when the host reports an unresolved session', async () => {
    vi.useFakeTimers()
    const fetchMock = stubStatusFetch((_sessionId, calls) => calls === 1
      ? { mode: 'local', projectPath: '', isGit: null } // 会话尚未就绪：未知
      : { mode: 'local', projectPath: '/repo', isGit: true })
    const dispose = installWorktreeHydration(hydrationCtx({ ids: ['s1'], current: 's1', phase: 'ready' }))
    try {
      // 未知状态不落库：保持 blankState 默认 isGit: true（模式选择器可见）
      expect(worktreeStore.getSnapshot().bySession.s1).toBeUndefined()
      await vi.advanceTimersByTimeAsync(1500)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(worktreeStore.getSnapshot().bySession.s1?.isGit).toBe(true)
    }
    finally {
      dispose()
    }
  })

  it('hides the worktree mode only for a definitively non-git session', async () => {
    const fetchMock = stubStatusFetch(() => ({ mode: 'local', projectPath: '/plain', isGit: false }))
    const dispose = installWorktreeHydration(hydrationCtx({ ids: ['s1'], current: 's1', phase: 'ready' }))
    try {
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(worktreeStore.getSnapshot().bySession.s1?.isGit).toBe(false)
      })
    }
    finally {
      dispose()
    }
  })

  it('restores a ledger-bound worktree session', async () => {
    stubStatusFetch(() => ({
      mode: 'worktree',
      worktreeKey: 'abc123/repo',
      worktreePath: '/wt/abc123/repo',
      projectPath: '/repo',
      sourceSessionId: 's0',
      log: ['Worktree created at /wt/abc123/repo'],
      isGit: true,
    }))
    const dispose = installWorktreeHydration(hydrationCtx({ ids: ['s1'], current: 's1', phase: 'ready' }))
    try {
      await vi.waitFor(() => {
        expect(worktreeStore.getSnapshot().bySession.s1?.mode).toBe('worktree')
        expect(worktreeStore.getSnapshot().bySession.s1?.worktreeKey).toBe('abc123/repo')
        expect(worktreeStore.getSnapshot().bySession.s1?.sourceSessionId).toBe('s0')
      })
    }
    finally {
      dispose()
    }
  })

  it('auto-switches to a worktree session created during this app run (create_worktree handoff)', async () => {
    const snapshot: SessionListSnapshot = { ids: ['s0'], current: 's0', phase: 'ready' }
    const ctx = liveHydrationCtx(snapshot)
    stubStatusFetch(handoffStatuses)
    const dispose = installWorktreeHydration(ctx)
    try {
      // 基线已捕获（s0）；create_worktree 发布的新工作树会话随后进入列表
      snapshot.ids.push('wt1')
      ctx.emit()
      await vi.waitFor(() => expect(ctx.openMock).toHaveBeenCalledWith('wt1'))
      expect(snapshot.current).toBe('wt1')
    }
    finally {
      dispose()
    }
  })

  it('does not auto-switch to a pre-existing worktree session (startup baseline)', async () => {
    const snapshot: SessionListSnapshot = { ids: ['s0', 'wt1'], current: 's0', phase: 'ready' }
    const ctx = liveHydrationCtx(snapshot)
    stubStatusFetch(handoffStatuses)
    const dispose = installWorktreeHydration(ctx)
    try {
      await vi.waitFor(() => expect(worktreeStore.getSnapshot().bySession.wt1?.mode).toBe('worktree'))
      expect(ctx.openMock).not.toHaveBeenCalled()
    }
    finally {
      dispose()
    }
  })

  it('does not auto-switch once the handoff window has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const snapshot: SessionListSnapshot = { ids: ['s0'], current: 's0', phase: 'ready' }
    const ctx = liveHydrationCtx(snapshot)
    stubStatusFetch(handoffStatuses)
    const dispose = installWorktreeHydration(ctx)
    try {
      snapshot.ids.push('wt1')
      ctx.emit() // appearedAt[wt1] = 1_000_000；/status 请求已发出
      vi.setSystemTime(1_000_000 + HANDOFF_WINDOW_MS + 1000)
      await vi.advanceTimersByTimeAsync(1) // 让 /status 的微任务完成
      // 状态仍正常恢复，但已过时效窗口，不再自动交接
      expect(worktreeStore.getSnapshot().bySession.wt1?.mode).toBe('worktree')
      expect(ctx.openMock).not.toHaveBeenCalled()
    }
    finally {
      dispose()
    }
  })

  it('does not re-steal focus on later reconciles after the handoff', async () => {
    const snapshot: SessionListSnapshot = { ids: ['s0'], current: 's0', phase: 'ready' }
    const ctx = liveHydrationCtx(snapshot)
    stubStatusFetch(handoffStatuses)
    const dispose = installWorktreeHydration(ctx)
    try {
      snapshot.ids.push('wt1')
      ctx.emit()
      await vi.waitFor(() => expect(ctx.openMock).toHaveBeenCalledWith('wt1'))
      // 用户回到源会话后，工作树会话事件流触发复核（对应 checkout/discard 状态对齐）
      snapshot.current = 's0'
      ctx.fireEvent('wt1')
      await vi.waitFor(() => expect(worktreeStore.getSnapshot().bySession.wt1?.mode).toBe('worktree'))
      expect(ctx.openMock).toHaveBeenCalledTimes(1)
      expect(snapshot.current).toBe('s0')
    }
    finally {
      dispose()
    }
  })

  it('does not bounce back to the worktree session when clicking another session in the group', async () => {
    const snapshot: SessionListSnapshot = { ids: ['s0', 'x1'], current: 's0', phase: 'ready' }
    const ctx = liveHydrationCtx(snapshot)
    stubStatusFetch(handoffStatuses)
    const dispose = installWorktreeHydration(ctx)
    try {
      snapshot.ids.push('wt1')
      ctx.emit()
      await vi.waitFor(() => expect(ctx.openMock).toHaveBeenCalledWith('wt1'))
      // 用户点击组内另一个（运行中的）会话 x1
      ctx.openMock.mockClear()
      snapshot.current = 'x1'
      // 运行中的工作树会话事件流持续触发复核：不得弹回工作树会话
      ctx.fireEvent('wt1')
      ctx.fireEvent('wt1')
      await vi.waitFor(() => expect(worktreeStore.getSnapshot().bySession.wt1?.mode).toBe('worktree'))
      expect(ctx.openMock).not.toHaveBeenCalled()
      expect(snapshot.current).toBe('x1')
    }
    finally {
      dispose()
    }
  })
})
