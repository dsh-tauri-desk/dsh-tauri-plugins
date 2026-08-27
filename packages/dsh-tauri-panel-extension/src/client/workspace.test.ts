import type { ExtensionRuntimeContext, SessionListSnapshot, WorkspaceListSnapshot } from './types'
import { describe, expect, it } from 'vitest'
import { chooseWorkspace } from './workspace'

function runtime(sessions: SessionListSnapshot, workspaces: WorkspaceListSnapshot): ExtensionRuntimeContext {
  return {
    sessions: {
      list: { getSnapshot: () => sessions },
      open: () => undefined,
    },
    workspaces: {
      list: { getSnapshot: () => workspaces },
      connectWorkspace: async workspaceId => workspaceId,
    },
  }
}

describe('chooseWorkspace', () => {
  it('prefers the workspace containing the current session', () => {
    const value = runtime(
      { ids: ['session-current'], current: 'session-current' },
      {
        recentWorkspaceId: 'workspace-recent',
        items: [
          { workspaceId: 'workspace-current', sessionIds: ['session-current'] },
          { workspaceId: 'workspace-recent', sessionIds: [] },
        ],
      },
    )
    expect(chooseWorkspace(value)).toBe('workspace-current')
  })

  it('falls back to the valid recent workspace and then the first item', () => {
    const recent = runtime(
      { ids: [] },
      { recentWorkspaceId: 'workspace-recent', items: [{ workspaceId: 'workspace-first' }, { workspaceId: 'workspace-recent' }] },
    )
    const first = runtime(
      { ids: [] },
      { recentWorkspaceId: 'workspace-missing', items: [{ workspaceId: 'workspace-first' }] },
    )
    expect(chooseWorkspace(recent)).toBe('workspace-recent')
    expect(chooseWorkspace(first)).toBe('workspace-first')
  })

  it('returns undefined when no workspace exists', () => {
    expect(chooseWorkspace(runtime({ ids: [] }, { items: [] }))).toBeUndefined()
  })
})
