import type { WorkspacesRuntimeLike, WorkspaceViewLike } from './types'
import { describe, expect, it, vi } from 'vitest'

import { workspaceFromRow } from './workspace-patch'

// workspace-patch 顶层依赖宿主模块（dsh-tauri/client 为 ModuleLoader 包裹产物、
// primitives 引用 CSS module），单测只关心 workspaceFromRow 的纯匹配逻辑，mock 掉。
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
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: () => null,
  Modal: () => null,
}))

function workspaceRow(title: string, opts: { ariaLabel?: string, titleAttr?: string } = {}): Element {
  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  row.setAttribute('aria-expanded', 'false')
  if (opts.ariaLabel)
    row.setAttribute('aria-label', opts.ariaLabel)
  if (opts.titleAttr)
    row.setAttribute('title', opts.titleAttr)
  const wrapper = document.createElement('span')
  const inner = document.createElement('span')
  inner.textContent = title
  wrapper.appendChild(inner)
  row.appendChild(wrapper)
  return row
}

function workspacesRuntime(items: WorkspaceViewLike[]): WorkspacesRuntimeLike {
  return {
    list: {
      subscribe: () => () => {},
      getSnapshot: () => ({ items, archivedSessionIds: [] }),
    },
  } as unknown as WorkspacesRuntimeLike
}

describe('workspaceFromRow', () => {
  const minecraft = { workspaceId: 'w1', title: 'Minecraft', path: 'C:/minecraft', sessionIds: ['session-1'] }

  it('matches the unique workspace by the row title span', () => {
    const row = workspaceRow('Minecraft')
    document.body.appendChild(row)
    expect(workspaceFromRow(row, workspacesRuntime([minecraft]))?.workspaceId).toBe('w1')
    row.remove()
  })

  it('matches by aria-label when present', () => {
    const row = workspaceRow('Anything', { ariaLabel: 'Minecraft' })
    document.body.appendChild(row)
    expect(workspaceFromRow(row, workspacesRuntime([minecraft]))?.workspaceId).toBe('w1')
    row.remove()
  })

  it('matches by title attribute when present', () => {
    const row = workspaceRow('Anything', { titleAttr: 'Minecraft' })
    document.body.appendChild(row)
    expect(workspaceFromRow(row, workspacesRuntime([minecraft]))?.workspaceId).toBe('w1')
    row.remove()
  })

  it('returns null when the row matches no workspace', () => {
    const row = workspaceRow('Unknown')
    document.body.appendChild(row)
    expect(workspaceFromRow(row, workspacesRuntime([minecraft]))).toBeNull()
    row.remove()
  })

  it('returns null on ambiguous titles (collapsed workspaces never render session rows)', () => {
    const duplicate = { workspaceId: 'w2', title: 'Minecraft', path: 'D:/minecraft', sessionIds: ['session-9'] }
    const row = workspaceRow('Minecraft')
    document.body.appendChild(row)
    // 重名工作区无法唯一命中 → 返回 null（调用方退回 DOM 兜底，绝不归档到猜测的工作区）。
    expect(workspaceFromRow(row, workspacesRuntime([minecraft, duplicate]))).toBeNull()
    row.remove()
  })
})
