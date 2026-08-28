/** Client-side shared types for dsh-tauri-session. */

/** Raw archive listing from the host (`GET /api/dsh-session/archived`). */
export interface ArchivedListPayload {
  archivedSessionIds: string[]
  /** Per archived session, creation metadata read from the host session header. */
  meta: Record<string, { createdAt?: number, cwd?: string }>
}

/** One archived session row after merging host metadata + session/workspace runtime facts. */
export interface ArchiveRow {
  sessionId: string
  title: string
  cwd?: string
  createdAt?: number
  updatedAt?: number
  archivedAt?: number
  /** Workspace group this session is displayed under; undefined means the 未分组 bucket. */
  workspaceId?: string
  workspaceTitle?: string
}

/** Sort method for the archive page filter. */
export type ArchiveSort = 'updatedAt' | 'createdAt' | 'title'
/** Grouping/orientation for ordering the group headers. */
export type ArchiveGroup = 'group' | 'project'

/** Persistent archive-page UI state (shared via a module SnapshotStore). */
export interface ArchiveUiState {
  archived: ArchivedListPayload
  sort: ArchiveSort
  /** 'group' | 'project' — how group headers are ordered. */
  group: ArchiveGroup
  query: string
  /** Selected project/workspace filter; 'all' shows every group. */
  workspaceId: string
  loading: boolean
  error: string
}

/** Props injected into the settings.section slot component. */
export interface ArchivePageProps {
  close?: () => void
  sessionsRuntime: SessionsRuntimeLike
  workspacesRuntime: WorkspacesRuntimeLike
}

/** Minimal `ctx.sessions` face the archive page subscribes to. */
export interface SessionsRuntimeLike {
  list: {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => SessionListSnapshot
  }
}

export interface SessionSummaryLike {
  id: string
  title?: string
  displayTitle?: string
  cwd?: string
  updatedAt?: number
  blank?: boolean
}

export interface SessionListSnapshot {
  ids: string[]
  byId: Record<string, SessionSummaryLike>
  current?: string
  phase?: 'pending' | 'ready'
}

/** Minimal `ctx.workspaces` face the archive page subscribes to. */
export interface WorkspacesRuntimeLike {
  list: {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => WorkspaceListSnapshot
  }
}

export interface WorkspaceViewLike {
  workspaceId: string
  path: string
  title?: string
  sessionIds: string[]
}

export interface WorkspaceListSnapshot {
  items: readonly WorkspaceViewLike[]
  archivedSessionIds?: readonly string[]
}

export type LocaleKey
  = | 'section'
    | 'archiveTitle'
    | 'deleteAll'
    | 'searchPlaceholder'
    | 'sortLabel'
    | 'sortUpdatedAt'
    | 'sortCreatedAt'
    | 'sortTitle'
    | 'groupLabel'
    | 'groupByGroup'
    | 'groupByProject'
    | 'allProjects'
    | 'ungrouped'
    | 'unarchive'
    | 'empty'
    | 'noResults'
    | 'loadFailed'
    | 'chats'
    | 'archiveWorkspace'
