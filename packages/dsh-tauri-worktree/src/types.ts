export type HostContext = any

export type JsonBody = Record<string, unknown>

export interface PluginConfig {
  worktreesRoot?: string
}

export interface Binding {
  sessionId: string
  sourceSessionId: string
  hash: string
  dirname: string
  worktreePath: string
  projectPath: string
  branchName: string
  ownsBranch: boolean
  createdAt: string
  log: string[]
}

export type Ledger = Record<string, Binding>

export interface CheckoutContext {
  projectPath: string
  branch?: string
  worktreePath?: string
  checkedOutAt: string
}

export type CheckoutContexts = Record<string, CheckoutContext>

export interface GitOptions {
  timeout?: number
  signal?: AbortSignal
}

export interface EnsureOptions extends GitOptions {
  sourceSessionId?: string
  branchName?: string
}

export interface CheckoutOptions extends GitOptions {
  beforeRemove?: (checkout: { branch: string, projectPath: string, worktreePath: string }) => Promise<OperationResult<any>>
}

export interface CheckoutInfo {
  branch?: string
  worktreePath?: string
}

export interface PendingHandoff {
  sourceAgent: any
  targetSessionId: string
  binding: Binding
}

export type OperationResult<T extends object = Record<string, never>>
  = | ({ ok: true } & T)
    | { ok: false, error: string }

export interface WorktreeParams {
  worktree_hash_dirname?: string
  worktreeHashDirname?: string
  sessionId?: string
  branch_name?: string
}

export type RouteResult = [number, unknown]
export type RouteFunction = (body: JsonBody, req: import('node:http').IncomingMessage) => Promise<RouteResult>
