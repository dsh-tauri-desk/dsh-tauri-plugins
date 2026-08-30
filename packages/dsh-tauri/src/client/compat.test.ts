import type { ClientContext } from './types'
import { describe, expect, it, vi } from 'vitest'
import { compat } from './compat'

interface CompatFace {
  sessions?: {
    list?: { getSnapshot?: () => unknown, subscribe?: (listener: () => void) => unknown }
  }
  workspaces?: {
    list?: { getSnapshot?: () => unknown }
    startSession?: (workspaceId?: string) => unknown
    connectWorkspace?: (workspaceId: string) => Promise<unknown>
  }
}

/** Build a plain service bag cast to the cordis-shaped client context. */
function context(services: Record<string, unknown>): ClientContext {
  return { ...services } as unknown as ClientContext
}

describe('compat', () => {
  it('passes the rc.2 context through untouched when sessions expose getSnapshot', () => {
    const ctx = context({
      sessions: {
        list: { getSnapshot: () => ({}) },
        getSnapshot: () => ({}),
      },
    })
    expect(compat(ctx)).toBe(ctx)
  })

  it('delegates startSession to the alpha workspaces service itself when uiWorkspace is absent', () => {
    const startSession = vi.fn()
    const connectWorkspace = vi.fn(async (id: string) => id)
    const workspaces = {
      list: { getSnapshot: () => ({ items: [] }) },
      startSession,
      connectWorkspace,
    }
    const ctx = context({
      sessions: { list: { getSnapshot: () => ({}) } },
      workspaces,
    })

    const result = compat(ctx) as unknown as CompatFace
    expect(result.workspaces?.startSession).toBeTypeOf('function')
    result.workspaces?.startSession?.('workspace-a')
    expect(startSession).toHaveBeenCalledWith('workspace-a')
    expect(startSession.mock.instances[0]).toBe(workspaces)

    void result.workspaces?.connectWorkspace?.('workspace-b')
    expect(connectWorkspace).toHaveBeenCalledWith('workspace-b')
    expect(connectWorkspace.mock.instances[0]).toBe(workspaces)
  })

  it('keeps preferring uiWorkspace.startSession on the legacy alpha shape', () => {
    const uiStartSession = vi.fn()
    const workspaceStartSession = vi.fn()
    const ctx = context({
      sessions: { list: { getSnapshot: () => ({}) } },
      workspaces: { list: { getSnapshot: () => ({}) }, startSession: workspaceStartSession },
      uiWorkspace: { startSession: uiStartSession },
    })

    const result = compat(ctx) as unknown as CompatFace
    result.workspaces?.startSession?.('workspace-a')
    expect(uiStartSession).toHaveBeenCalledWith('workspace-a')
    expect(workspaceStartSession).not.toHaveBeenCalled()
  })

  it('returns undefined startSession when neither surface provides it', () => {
    const ctx = context({
      sessions: { list: { getSnapshot: () => ({}) } },
      workspaces: { list: { getSnapshot: () => ({}) } },
    })

    const result = compat(ctx) as unknown as CompatFace
    expect(result.workspaces?.startSession).toBeUndefined()
  })
})
