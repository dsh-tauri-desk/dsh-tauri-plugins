import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildRoutes, encodeSessionId, isWithinSessionsRoot, updateRegistryArchiveSet } from './index'

const allowConnection = { requestRejection: () => undefined }

describe('dsh-tauri-session route authentication', () => {
  it('rejects every route before archive or deletion logic', async () => {
    const requestRejection = vi.fn(() => 403 as const)
    const routes = buildRoutes({ connection: { requestRejection } }, 'unused')
    expect(routes).toHaveLength(7)
    for (const route of routes) {
      const writeHead = vi.fn()
      const end = vi.fn()
      await route.handler({ method: 'POST' }, { writeHead, end })
      expect(writeHead).toHaveBeenCalledWith(403)
      expect(end).toHaveBeenCalledWith('forbidden')
    }
    expect(requestRejection).toHaveBeenCalledTimes(routes.length)
  })
})

interface FakeRegistryState {
  initialized: boolean
  workspaceIds: string[]
  archivedSessionIds: string[]
}

interface FakeRegistry {
  enqueueOperation: (fn: () => Promise<void>) => Promise<void>
  requireState: () => FakeRegistryState
  setState: (state: FakeRegistryState) => Promise<void>
}

/** 构造一个可观测的伪宿主归档注册表。 */
function fakeRegistry(initial: FakeRegistryState): {
  ctx: { workspaceRegistry: FakeRegistry }
  state: FakeRegistryState
  setStateCalls: FakeRegistryState[]
} {
  const state: FakeRegistryState = { ...initial, workspaceIds: [...initial.workspaceIds], archivedSessionIds: [...initial.archivedSessionIds] }
  const setStateCalls: FakeRegistryState[] = []
  const registry: FakeRegistry = {
    enqueueOperation: async (fn) => {
      await fn()
    },
    requireState: () => state,
    setState: async (next) => {
      setStateCalls.push(next)
    },
  }
  return { ctx: { workspaceRegistry: registry }, state, setStateCalls }
}

/** 可发出 data/end 的最小 loopback 请求，供 routeHandler 读取 JSON body。 */
function fakeReq(body: unknown = {}): any {
  const listeners = new Map<string, Array<(...args: any[]) => void>>()
  const req: any = {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    on: (event: string, fn: (...args: any[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn])
      return req
    },
  }
  queueMicrotask(() => {
    for (const fn of listeners.get('data') ?? []) fn(Buffer.from(JSON.stringify(body)))
    for (const fn of listeners.get('end') ?? []) fn()
  })
  return req
}

/** 捕获 routeHandler 的状态码与 JSON 响应。 */
function fakeRes(): any {
  const res: any = {}
  res.writeHead = (code: number) => {
    res.code = code
  }
  res.end = (payload?: string) => {
    res.payload = payload
  }
  return res
}

describe('updateRegistryArchiveSet', () => {
  it('removes one id while preserving the rest of the registry state', async () => {
    const { ctx, state, setStateCalls } = fakeRegistry({
      initialized: true,
      workspaceIds: ['w1', 'w2'],
      archivedSessionIds: ['s1', 's2', 's3'],
    })
    await updateRegistryArchiveSet(ctx, ids => ids.filter(id => id !== 's2'))
    expect(setStateCalls).toHaveLength(1)
    expect(setStateCalls[0].archivedSessionIds).toEqual(['s1', 's3'])
    // 与归档无关的字段原样保留（setState 整体写回）。
    expect(setStateCalls[0].initialized).toBe(true)
    expect(setStateCalls[0].workspaceIds).toEqual(['w1', 'w2'])
    expect(state.archivedSessionIds).toEqual(['s1', 's2', 's3'])
  })

  it('does not write when the update leaves the set unchanged', async () => {
    const { ctx, setStateCalls } = fakeRegistry({
      initialized: true,
      workspaceIds: [],
      archivedSessionIds: ['s1', 's2'],
    })
    await updateRegistryArchiveSet(ctx, ids => ids.filter(id => id !== 'missing'))
    expect(setStateCalls).toHaveLength(0)
  })

  it('clears the whole set', async () => {
    const { ctx, setStateCalls } = fakeRegistry({
      initialized: true,
      workspaceIds: ['w1'],
      archivedSessionIds: ['s1', 's2'],
    })
    await updateRegistryArchiveSet(ctx, () => [])
    expect(setStateCalls).toHaveLength(1)
    expect(setStateCalls[0].archivedSessionIds).toEqual([])
  })

  it('rejects when the host registry does not expose the mutation surface', async () => {
    await expect(updateRegistryArchiveSet({ workspaceRegistry: {} }, ids => ids)).rejects.toThrow('workspaceRegistry')
  })
})

describe('isWithinSessionsRoot', () => {
  const root = resolve('dsh-home', 'sessions')

  it('accepts direct and nested session directories below the root', () => {
    expect(isWithinSessionsRoot(root, `${root}${sep}session-abc`)).toBe(true)
    expect(isWithinSessionsRoot(root, `${root}${sep}--group--${sep}session-abc`)).toBe(true)
  })

  it('rejects traversal and absolute escapes', () => {
    expect(isWithinSessionsRoot(root, `${root}${sep}..`)).toBe(false)
    expect(isWithinSessionsRoot(root, resolve('dsh-home'))).toBe(false)
    expect(isWithinSessionsRoot(root, resolve('..'))).toBe(false)
  })
})

describe('encodeSessionId', () => {
  it('escapes unsafe code units like the JSONL backend', () => {
    expect(encodeSessionId('..')).toBe('~002E~002E')
    expect(encodeSessionId('.')).toBe('~002E')
    expect(encodeSessionId('a/b')).toBe('a~002Fb')
    expect(encodeSessionId('plain-id')).toBe('plain-id')
  })
})

describe('session routes', () => {
  it.each([
    ['/api/dsh-session/delete', { sessionId: 's1' }],
    ['/api/dsh-session/delete-workspace', { sessionIds: ['s1'] }],
    ['/api/dsh-session/clear', {}],
  ])('%s fails closed without mutating host state or disk', async (path, body) => {
    const dshHome = mkdtempSync(join(tmpdir(), 'dsh-tauri-session-delete-gate-'))
    const sentinel = join(dshHome, 'sessions', 'group', 'session-s1', 'events.jsonl')
    mkdirSync(dirname(sentinel), { recursive: true })
    writeFileSync(sentinel, 'sentinel\n')

    const remove = vi.fn(() => true)
    const enqueueOperation = vi.fn(async () => {})
    const setState = vi.fn(async () => {})
    const update = vi.fn(async () => {})
    const info = vi.fn()
    const ctx = {
      connection: allowConnection,
      sessions: { get: () => ({ id: 's1' }), remove },
      workspaceRegistry: {
        archivedSessionIds: ['s1'],
        enqueueOperation,
        requireState: () => ({ archivedSessionIds: ['s1'] }),
        setState,
        requireTable: () => ({ entries: () => [['w1', { sessionIds: ['s1'] }]], update }),
      },
      logger: { info },
    }

    try {
      const route = buildRoutes(ctx, dshHome).find(candidate => candidate.path === path)!
      const res = fakeRes()
      await route.handler(fakeReq(body), res)

      expect(res.code).toBe(503)
      expect(JSON.parse(res.payload).error).toContain('永久删除已暂时禁用')
      expect(remove).not.toHaveBeenCalled()
      expect(enqueueOperation).not.toHaveBeenCalled()
      expect(setState).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(info).not.toHaveBeenCalled()
      expect(existsSync(sentinel)).toBe(true)
    }
    finally {
      rmSync(dshHome, { recursive: true, force: true })
    }
  })

  it('/delete returns 503 without waiting for a request body', async () => {
    const ctx = { connection: allowConnection, workspaceRegistry: {}, sessions: {} }
    const route = buildRoutes(ctx, '').find(candidate => candidate.path === '/api/dsh-session/delete')!
    const res = fakeRes()
    const req: any = {
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      on: vi.fn(() => req),
    }

    await route.handler(req, res)

    expect(res.code).toBe(503)
    expect(req.on).not.toHaveBeenCalled()
  })

  it('/archive remains available', async () => {
    const archivedSessionIds: string[] = []
    const archiveSession = vi.fn(async (sessionId: string) => {
      archivedSessionIds.push(sessionId)
    })
    const ctx = {
      connection: allowConnection,
      sessions: { get: (sessionId: string) => ({ id: sessionId, header: { cwd: 'C:/repo' } }) },
      workspaceRegistry: { archivedSessionIds, archiveSession },
    }
    const route = buildRoutes(ctx, '').find(candidate => candidate.path === '/api/dsh-session/archive')!
    const res = fakeRes()

    await route.handler(fakeReq({ sessionId: 's1' }), res)

    expect(res.code).toBe(200)
    expect(archiveSession).toHaveBeenCalledExactlyOnceWith('s1')
    expect(JSON.parse(res.payload).archivedSessionIds).toEqual(['s1'])
  })

  it('/unarchive remains available and only rewrites the archive set', async () => {
    const state = { initialized: true, workspaceIds: ['w1'], archivedSessionIds: ['s1', 's2'] }
    const setState = vi.fn(async () => {})
    const update = vi.fn(async () => {})
    const ctx = {
      connection: allowConnection,
      sessions: { get: () => undefined },
      workspaceRegistry: {
        archivedSessionIds: state.archivedSessionIds,
        enqueueOperation: async (operation: () => Promise<void>) => operation(),
        requireState: () => state,
        setState,
        requireTable: () => ({ entries: () => [], update }),
      },
    }
    const route = buildRoutes(ctx, '').find(candidate => candidate.path === '/api/dsh-session/unarchive')!
    const res = fakeRes()

    await route.handler(fakeReq({ sessionId: 's1' }), res)

    expect(res.code).toBe(200)
    expect(setState).toHaveBeenCalledExactlyOnceWith({ ...state, archivedSessionIds: ['s2'] })
    expect(update).not.toHaveBeenCalled()
  })
})
