import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { archiveStore, postArchive, refreshArchived } from './store'

// dsh-tauri/client 的产物是 ModuleLoader 包裹的浏览器脚本（依赖 window.__ModuleLoader__），
// 单测环境没有该全局；这里以最小语义 mock createExternalStore（不可变 set + uSES 接口）。
vi.mock('dsh-tauri/client', () => ({
  createExternalStore: <T>(initial: T) => {
    let state = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      set: (next: T | ((current: T) => T)) => {
        state = typeof next === 'function' ? (next as (current: T) => T)(state) : next
        for (const listener of listeners)
          listener()
      },
    }
  },
}))

/** 归档载荷最小形状（与 /api/dsh-session/archived 响应一致）。 */
function archivedPayload(ids: string[]): unknown {
  return { archivedSessionIds: ids, meta: {} }
}

describe('archiveStore suppressed session ids', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    archiveStore.set(state => ({ ...state, suppressedSessionIds: [], archived: { archivedSessionIds: [], meta: {} } }))
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(archivedPayload([])), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('clears suppression after a successful refresh (re-archived sessions stay visible)', async () => {
    // 取消归档会把会话 id 加进抑制列表（runMutation 的刷新窗口保护）。
    archiveStore.set(state => ({ ...state, suppressedSessionIds: ['session-1'] }))
    // 二次归档后，归档载荷里重新包含该 id —— 刷新成功后抑制必须被清掉，
    // 否则会话从侧边栏消失的同时也不会出现在归档页（#235）。
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(archivedPayload(['session-1'])), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    await refreshArchived()
    expect(archiveStore.getSnapshot().suppressedSessionIds).toEqual([])
    expect(archiveStore.getSnapshot().archived.archivedSessionIds).toEqual(['session-1'])
  })

  it('keeps suppression while a refresh fails (ghost rows stay hidden)', async () => {
    archiveStore.set(state => ({ ...state, suppressedSessionIds: ['session-1'] }))
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    })
    await refreshArchived()
    expect(archiveStore.getSnapshot().suppressedSessionIds).toEqual(['session-1'])
    expect(archiveStore.getSnapshot().error).not.toBe('')
  })

  it('archive API is a POST to /api/dsh-session/archive', async () => {
    await postArchive('session-1', 'w1')
    const call = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(call[0]).toBe('/api/dsh-session/archive')
    expect(call[1]?.method).toBe('POST')
    expect(JSON.parse(String(call[1]?.body))).toEqual({ sessionId: 'session-1', workspaceId: 'w1' })
  })
})
