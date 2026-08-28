import type { SessionsRuntimeLike, SessionSummaryLike, WorkspacesRuntimeLike } from './types'
import { describe, expect, it } from 'vitest'
import {
  externalUrl,
  isAction,
  resolveSession,
  rowFrom,
  selectedUrl,
  titleFrom,
  workspaceForSession,
  workspaceFrom,
} from './locate'

function sessionRow(title: string, opts: { selected?: boolean, actionLabel?: string } = {}): Element {
  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  if (opts.selected)
    row.setAttribute('aria-selected', 'true')
  const label = document.createElement('span')
  label.textContent = title
  row.appendChild(label)
  if (opts.actionLabel) {
    const button = document.createElement('button')
    button.setAttribute('aria-label', opts.actionLabel)
    row.appendChild(button)
  }
  return row
}

function sessionsRuntime(byId: Record<string, SessionSummaryLike>, current?: string): SessionsRuntimeLike {
  return {
    list: {
      getSnapshot: () => ({ ids: Object.keys(byId), byId, current }),
    },
    binding: () => undefined,
    fork: async () => 'child',
    open: () => {},
  }
}

describe('isAction', () => {
  it('matches zh/en session action labels', () => {
    const zh = document.createElement('button')
    zh.setAttribute('aria-label', '会话“测试”的操作')
    const en = document.createElement('button')
    en.setAttribute('aria-label', 'Session actions for Test')
    expect(isAction(zh)).toBe(true)
    expect(isAction(en)).toBe(true)
  })

  it('rejects unrelated labels', () => {
    const button = document.createElement('button')
    button.setAttribute('aria-label', '新建会话')
    expect(isAction(button)).toBe(false)
  })
})

describe('rowFrom', () => {
  it('finds the treeitem row from a descendant target', () => {
    const row = sessionRow('Alpha', { actionLabel: '会话“Alpha”的操作' })
    const inner = document.createElement('span')
    inner.textContent = 'x'
    row.querySelector('button')!.appendChild(inner)
    document.body.appendChild(row)
    expect(rowFrom(inner)).toBe(row)
    row.remove()
  })

  it('returns null for non-row targets', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(rowFrom(div)).toBeNull()
    div.remove()
  })
})

describe('titleFrom', () => {
  it('extracts the quoted title from the action label', () => {
    const row = sessionRow('Anything', { actionLabel: '会话“我的会话”的操作' })
    expect(titleFrom(row)).toBe('我的会话')
  })

  it('falls back to the first text child', () => {
    const row = sessionRow('Plain title')
    expect(titleFrom(row)).toBe('Plain title')
  })
})

describe('resolveSession', () => {
  it('resolves the current session for the selected row', () => {
    const sessions = sessionsRuntime({
      a: { id: 'a', title: 'A' },
      b: { id: 'b', title: 'B' },
    }, 'b')
    const row = sessionRow('B', { selected: true })
    expect(resolveSession(sessions, row, null)?.id).toBe('b')
  })

  it('resolves by unique title match only', () => {
    const sessions = sessionsRuntime({ a: { id: 'a', title: 'Unique' } })
    const row = sessionRow('Unique')
    expect(resolveSession(sessions, row, null)?.id).toBe('a')
  })

  it('returns null on ambiguous titles', () => {
    const sessions = sessionsRuntime({
      a: { id: 'a', title: 'Same' },
      b: { id: 'b', title: 'Same' },
    })
    const row = sessionRow('Same')
    expect(resolveSession(sessions, row, null)).toBeNull()
  })
})

describe('externalUrl', () => {
  it('accepts http/https only', () => {
    expect(externalUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(externalUrl('http://example.com')).toBe('http://example.com/')
    expect(externalUrl('file:///etc/passwd')).toBeNull()
    expect(externalUrl('javascript:alert(1)')).toBeNull()
    expect(externalUrl('not a url')).toBeNull()
  })
})

describe('selectedUrl', () => {
  it('matches a bare http(s) URL in selected text', () => {
    expect(selectedUrl('https://example.com/x')).toBe('https://example.com/x')
    expect(selectedUrl('foo https://example.com')).toBeNull()
  })
})

describe('workspaceFrom', () => {
  function workspaceRow(title: string): Element {
    const row = document.createElement('div')
    row.setAttribute('role', 'treeitem')
    row.setAttribute('aria-label', title)
    return row
  }

  it('finds the workspace by aria-label', () => {
    const workspaces = {
      list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: 'Minecraft', path: 'C:/minecraft', sessionIds: [] }], archivedSessionIds: [] }) },
      archiveSession: async () => {},
      startSession: () => {},
      delete: async () => {},
    } as unknown as WorkspacesRuntimeLike
    const row = workspaceRow('Minecraft')
    const target = document.createElement('span')
    row.appendChild(target)
    document.body.appendChild(row)
    const found = workspaceFrom(target, workspaces)
    expect(found?.workspace.workspaceId).toBe('w1')
    row.remove()
  })

  it('returns null when no workspace matches', () => {
    const workspaces = {
      list: { getSnapshot: () => ({ items: [], archivedSessionIds: [] }) },
      archiveSession: async () => {},
      startSession: () => {},
      delete: async () => {},
    } as unknown as WorkspacesRuntimeLike
    const row = workspaceRow('Unknown')
    document.body.appendChild(row)
    expect(workspaceFrom(row, workspaces)).toBeNull()
    row.remove()
  })
})

describe('workspaceForSession', () => {
  it('finds the workspace owning a session id', () => {
    const workspaces = {
      list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', title: 'Minecraft', path: 'C:/minecraft', sessionIds: ['s1', 's2'] }], archivedSessionIds: [] }) },
      archiveSession: async () => {},
      startSession: () => {},
      delete: async () => {},
    } as unknown as WorkspacesRuntimeLike
    expect(workspaceForSession(workspaces, { id: 's2' })?.workspaceId).toBe('w1')
    expect(workspaceForSession(workspaces, { id: 'nope' })).toBeNull()
    expect(workspaceForSession(workspaces, null)).toBeNull()
  })
})
