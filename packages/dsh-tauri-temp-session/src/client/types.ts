/**
 * 浏览器半区消费的窄服务类型（cast 边界之后的契约）。
 *
 * `ctx.sessions` 的类型化外向面（ISessions）刻意不含 `create`（写面留在具体
 * SessionRuntime 上），因此经由一次显式 cast 使用；以下字段对齐
 * dsh-client-runtime 0.1.1-rc.2 真实形状的所需子集。
 */

/** 会话列表摘要（本插件消费的子集）。 */
export interface SessionSummary {
  id: string
  /** 空日志位：从未发送过消息的会话。 */
  blank?: boolean
  /** 粗粒度来源标记；子代理行带 'subagent'。 */
  origin?: string
  parentId?: string
}

export interface SessionsListSnapshot {
  ids: readonly string[]
  byId: Readonly<Record<string, SessionSummary | undefined>>
  current: string | undefined
}

export interface WorkspaceItem {
  id: string
  path?: string
  /** 挂接到该工作区的会话 id。 */
  sessionIds?: readonly string[]
}

export interface WorkspacesListSnapshot {
  items: readonly WorkspaceItem[]
  /** workspace.list 与 session.list 两个 baseline 都成功后才为 true。 */
  baselinesReady?: boolean
  recentWorkspaceId?: string | undefined
}

/** dsh-client-runtime 的 uSES 列表 store 子集。 */
export interface ListStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
}

/**
 * sessions 服务的使用面：类型化 ISessions 之外的 `create`（按预留 cwd 建临时
 * 会话，服务端 ensureSession 会递归建目录并写入 header.cwd）经 cast 到达。
 */
export interface SessionsRuntime {
  list: ListStore<SessionsListSnapshot>
  create: (input: { sessionId: string, cwd: string }) => Promise<string>
  open: (sessionId: string) => void
}

/** workspaces 服务的使用面；startSession 会被本插件包装（disposer 恢复）。 */
export interface WorkspacesRuntime {
  list: ListStore<WorkspacesListSnapshot>
  startSession: (workspaceId?: string) => void
}

export type LocaleKey = 'optional' | 'clearTitle' | 'clearAria'
