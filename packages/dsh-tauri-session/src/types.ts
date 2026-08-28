export type HostContext = any

export type JsonBody = Record<string, unknown>

export type RouteResult = [number, unknown]
export type RouteFunction = (body: JsonBody, req: import('node:http').IncomingMessage) => Promise<RouteResult>

export interface PluginConfig {
  /** Root directory holding the plugin archive (defaults to `~/.dsh`). */
  dshHome?: string
}

/**
 * One plugin-owned archived session record. The workspace accounting is never
 * touched by archiving: the session keeps its `sessionIds` slot in the host
 * workspaces, so un-archiving removes the record and the session reappears in
 * its original workspace group at its retained position. `workspaceId` /
 * `beforeSessionId` are stored so the client can group and reorder precisely.
 */
export interface ArchivedSessionRecord {
  sessionId: string
  /** The workspace group the session belonged to when archived (for grouping). */
  workspaceId?: string
  /** The session that preceded it in the workspace order at archive time. */
  beforeSessionId?: string
  /** Epoch ms when it was archived. */
  archivedAt: number
}

/** Whole archive document keyed by session id. */
export type ArchiveDocument = Record<string, ArchivedSessionRecord>

/** Minimal host session header surface (createdAt/cwd live on the host Session.header). */
export interface SessionHeaderLike {
  createdAt?: number
  cwd?: string
}

/** Minimal host session surface used by this plugin. */
export interface SessionLike {
  id: string
  header?: SessionHeaderLike
}

/** Wire payload for `GET /api/dsh-session/archived`. */
export interface ArchivedListPayload {
  archivedSessionIds: string[]
  /** Per archived session, creation metadata read from the host session header. */
  meta: Record<string, { createdAt?: number, cwd?: string }>
}
