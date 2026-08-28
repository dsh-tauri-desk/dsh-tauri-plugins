/**
 * store.ts — 归档页面的共享客户端状态与 RPC（/api/dsh-session/*）。
 *
 * store 保存「原始归档载荷」（archivedSessionIds + meta）与页面筛选状态；
 * 每个归档会话的业务字段（标题、更新时间、工作区组）由组件合并
 * ctx.sessions / ctx.workspaces 的运行时快照得到，这里不复制那份数据。
 */
import type { ArchivedListPayload, ArchiveGroup, ArchiveSort, ArchiveUiState } from './types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { useSyncExternalStore } from 'react'
import { SESSION_API_PREFIX } from './constants'

export type { ArchivedListPayload, ArchiveUiState } from './types'

/** 从 unknown 错误里取可展示文本。 */
function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SESSION_API_PREFIX}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  const body = await res.json().catch(() => ({} as { error?: string })) as T & { error?: string }
  if (!res.ok)
    throw new Error(body.error ?? `请求失败 (${res.status})`)
  return body as T
}

/** 查询归档会话列表。 */
export function fetchArchived(): Promise<ArchivedListPayload> {
  return request<ArchivedListPayload>('/archived')
}

/** 归档单个会话。 */
export function postArchive(sessionId: string, workspaceId?: string, beforeSessionId?: string): Promise<ArchivedListPayload> {
  return request<ArchivedListPayload>('/archive', {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...(workspaceId ? { workspaceId } : {}), ...(beforeSessionId ? { beforeSessionId } : {}) }),
  })
}

/** 取消归档（会话回到其工作区组保留的位置）。 */
export function postUnarchive(sessionId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/unarchive', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

/** 归档整个工作区组（一次写入多条记录）。 */
export function postArchiveWorkspace(workspaceId: string, sessionIds: string[]): Promise<ArchivedListPayload> {
  return request<ArchivedListPayload>('/archive-workspace', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, sessionIds }),
  })
}

/** 清空归档（全部会话回到其原组）。 */
export function postClear(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/clear', { method: 'POST', body: JSON.stringify({}) })
}

/** 全局唯一共享状态源（模块级单例）。 */
export const archiveStore = createSnapshotStore<ArchiveUiState>({
  archived: { archivedSessionIds: [], meta: {} },
  sort: 'updatedAt',
  group: 'group',
  query: '',
  workspaceId: 'all',
  loading: false,
  error: '',
})

/** 组件内订阅归档 UI 状态（uSES）。 */
export function useArchiveUi(): ArchiveUiState {
  return useSyncExternalStore(archiveStore.subscribe, archiveStore.getSnapshot)
}

export function setSort(sort: ArchiveSort): void {
  archiveStore.update((state) => {
    state.sort = sort
  })
}

export function setGroup(group: ArchiveGroup): void {
  archiveStore.update((state) => {
    state.group = group
  })
}

export function setQuery(query: string): void {
  archiveStore.update((state) => {
    state.query = query
  })
}

export function setWorkspaceFilter(workspaceId: string): void {
  archiveStore.update((state) => {
    state.workspaceId = workspaceId
  })
}

/** 拉取归档载荷并写入 store。 */
export async function refreshArchived(): Promise<void> {
  archiveStore.update((state) => {
    state.loading = true
    state.error = ''
  })
  try {
    const archived = await fetchArchived()
    archiveStore.update((state) => {
      state.archived = archived
      state.loading = false
    })
  }
  catch (error) {
    archiveStore.update((state) => {
      state.loading = false
      state.error = errMessage(error)
    })
  }
}

/** 归档一个会话并刷新。 */
export async function archiveSession(sessionId: string, workspaceId?: string, beforeSessionId?: string): Promise<void> {
  try {
    await postArchive(sessionId, workspaceId, beforeSessionId)
    await refreshArchived()
  }
  catch (error) {
    archiveStore.update((state) => {
      state.error = errMessage(error)
    })
  }
}

/** 归档整个工作区并刷新。 */
export async function archiveWorkspace(workspaceId: string, sessionIds: string[]): Promise<void> {
  try {
    await postArchiveWorkspace(workspaceId, sessionIds)
    await refreshArchived()
  }
  catch (error) {
    archiveStore.update((state) => {
      state.error = errMessage(error)
    })
  }
}

/** 取消归档并刷新。 */
export async function unarchiveSession(sessionId: string): Promise<void> {
  try {
    await postUnarchive(sessionId)
    await refreshArchived()
  }
  catch (error) {
    archiveStore.update((state) => {
      state.error = errMessage(error)
    })
  }
}

/** 清空归档并刷新。 */
export async function clearArchive(): Promise<void> {
  try {
    await postClear()
    await refreshArchived()
  }
  catch (error) {
    archiveStore.update((state) => {
      state.error = errMessage(error)
    })
  }
}
