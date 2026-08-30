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

/** 构造一个工作区项目行（role=treeitem + 标题 span，可带 aria-label/title）。 */
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

/** 构造最小 workspaces 运行时（固定 items + 空归档集合）。 */
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

  it('never matches a workspace with a blank or missing title', () => {
    const blank = { workspaceId: 'w0', title: '   ', path: 'C:/blank', sessionIds: [] }
    const untitled = { workspaceId: 'w9', path: 'C:/untitled', sessionIds: [] }
    const row = workspaceRow('')
    document.body.appendChild(row)
    // 空文本行不得与空白/缺失标题的工作区误命中（空字符串 === 空字符串）。
    expect(workspaceFromRow(row, workspacesRuntime([blank]))).toBeNull()
    expect(workspaceFromRow(row, workspacesRuntime([untitled]))).toBeNull()
    row.remove()
  })

  it('ignores other plugins menu buttons (no official itemWrap structure)', async () => {
    // 模拟 rightclick 插件的右键菜单：自绘按钮，无官方 primitives 的 itemWrap 包裹。
    // scan 误 patch 会把克隆项插进别人的菜单，且文案替换失败时造成文本粘连（#235）。
    const ctxMenu = document.createElement('div')
    ctxMenu.setAttribute('role', 'menu')
    ctxMenu.className = 'dsh-tauri-rightclick'
    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.setAttribute('role', 'menuitem')
    deleteBtn.className = 'dsh-tauri-rightclick-item'
    const span = document.createElement('span')
    span.textContent = '删除工作区'
    deleteBtn.appendChild(span)
    ctxMenu.appendChild(deleteBtn)
    document.body.appendChild(ctxMenu)

    const { installWorkspaceArchivePatch } = await import('./workspace-patch')
    const dispose = installWorkspaceArchivePatch(
      workspacesRuntime([{ workspaceId: 'w1', title: 'Minecraft', path: 'C:/minecraft', sessionIds: ['session-1'] }]),
      { list: { subscribe: () => () => {}, getSnapshot: () => ({ ids: [], byId: {} }) } } as never,
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    // 右键菜单按钮保持原样：不插入克隆、不粘连。
    expect(deleteBtn.textContent?.trim()).toBe('删除工作区')
    expect(ctxMenu.querySelectorAll('button').length).toBe(1)
    dispose()
    document.body.innerHTML = ''
  })
})
