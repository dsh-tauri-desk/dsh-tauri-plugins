import type { SessionsListSnapshot, SessionSummary, WorkspacesListSnapshot } from './types'
import { describe, expect, it } from 'vitest'
import { currentWorkspaceOf, findExistingTempBlank, isSubagentSummary } from './session'

function sessions(
  ids: string[],
  current: string | undefined,
  byId: Record<string, SessionSummary>,
): SessionsListSnapshot {
  return { ids, byId, current }
}

function workspaces(items: Array<{ id: string, sessionIds?: string[] }>): WorkspacesListSnapshot {
  return { items }
}

describe('currentWorkspaceOf', () => {
  it('returns the workspace that holds the current session', () => {
    const snapshot = workspaces([
      { id: 'ws-a', sessionIds: ['s1'] },
      { id: 'ws-b', sessionIds: ['s2', 's3'] },
    ])
    expect(currentWorkspaceOf(snapshot, 's2')?.id).toBe('ws-b')
  })

  it('returns undefined without a current session or a holding workspace', () => {
    const snapshot = workspaces([{ id: 'ws-a', sessionIds: ['s1'] }])
    expect(currentWorkspaceOf(snapshot, undefined)).toBeUndefined()
    expect(currentWorkspaceOf(snapshot, 's9')).toBeUndefined()
  })
})

describe('isSubagentSummary', () => {
  it('flags subagent origin or parented rows', () => {
    expect(isSubagentSummary({ id: 's', origin: 'subagent' })).toBe(true)
    expect(isSubagentSummary({ id: 's', parentId: 'p' })).toBe(true)
  })

  it('passes ordinary sessions through', () => {
    expect(isSubagentSummary({ id: 's' })).toBe(false)
    expect(isSubagentSummary(undefined)).toBe(false)
  })
})

describe('findExistingTempBlank', () => {
  it('reuses a blank workspace-free ordinary session', () => {
    const result = findExistingTempBlank(
      sessions(['s1'], undefined, { s1: { id: 's1', blank: true } }),
      workspaces([]),
    )
    expect(result).toBe('s1')
  })

  it('skips blank subagent sessions', () => {
    const result = findExistingTempBlank(
      sessions(['s1'], undefined, { s1: { id: 's1', blank: true, origin: 'subagent' } }),
      workspaces([]),
    )
    expect(result).toBeUndefined()
  })

  it('skips blank sessions that already sit in a workspace', () => {
    const result = findExistingTempBlank(
      sessions(['s1'], undefined, { s1: { id: 's1', blank: true } }),
      workspaces([{ id: 'ws-a', sessionIds: ['s1'] }]),
    )
    expect(result).toBeUndefined()
  })

  it('skips non-blank sessions', () => {
    const result = findExistingTempBlank(
      sessions(['s1'], undefined, { s1: { id: 's1', blank: false } }),
      workspaces([]),
    )
    expect(result).toBeUndefined()
  })
})
