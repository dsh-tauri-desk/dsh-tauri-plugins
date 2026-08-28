import { describe, expect, it } from 'vitest'
import { updateRegistryArchiveSet } from './index'

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
