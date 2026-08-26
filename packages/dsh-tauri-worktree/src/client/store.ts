import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
/**
 * store.ts — dsh-tauri-worktree 的共享客户端状态（per-session 工作树状态 + RPC）。
 *
 * 桌面壳四个注册条目（select / surface / dialog / session）是同一
 * 插件的多个独立槽位，凭一个模块级 SnapshotStore 共享按会话缓存的工作树状态。
 * 任何条目把某会话的 state 写入 store，其余条目订阅渲染；所有后端调用集中在
 * 本文件的 worktreeApi 里（/api/dsh-worktree/*），与宿主侧的 HTTP 路由一一对应。
 */
import { useSyncExternalStore } from 'react'

const PREFERRED_MODE_KEY = 'dsh-tauri-worktree:preferred-mode'

/** 新会话沿用用户最近选择；存储不可用时保持官方默认「本地」。 */
export function preferredNewSessionMode(): 'local' | 'pending' {
  try {
    return localStorage.getItem(PREFERRED_MODE_KEY) === 'pending' ? 'pending' : 'local'
  }
  catch {
    return 'local'
  }
}

export function rememberNewSessionMode(mode: 'local' | 'pending'): void {
  try {
    localStorage.setItem(PREFERRED_MODE_KEY, mode)
  }
  catch {
    // 隐私模式或受限存储不影响会话功能。
  }
}

/** 从 unknown 错误里取可展示文本。 */
function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 工作树处理阶段（会话处理状态与日志展示的三阶段）。 */
export type WorktreePhase = 'idle' | 'creating' | 'created' | 'thinking' | 'error'

/** 某会话绑定的工作树状态。 */
export interface WorktreeSessionState {
  /** 模式：local（本地）| pending（下一条消息新建）| worktree（隔离工作树）。 */
  mode: 'local' | 'pending' | 'worktree'
  /** 会话工作目录是否位于 git 仓库内（非 git 目录强制 local 且隐藏模式选择器）。 */
  isGit: boolean
  /** 处理阶段（本地会话恒为 idle）。 */
  phase: WorktreePhase
  /** 阶段 1 的加载提示（正在准备工作区 → 正在检出文件），随创建推进。 */
  loadingLabel: string
  /** 阶段 2 的创建日志（点击查看）。 */
  log: string[]
  /** 工作树标识 [hash]/[dirname]（弹窗的「当前关联路径」）。 */
  worktreeKey: string
  /** 工作树绝对路径。 */
  worktreePath: string
  /** 项目（目标仓库）绝对路径。 */
  projectPath: string
  /** 创建工作树前所在的源会话（用于侧边栏归组与完成后返回）。 */
  sourceSessionId: string
  /** 检出弹窗分支名输入框当前值。 */
  branchName: string
  /** 检出弹窗是否打开。 */
  checkoutOpen: boolean
  /** 放弃弹窗是否打开。 */
  abandonOpen: boolean
  /** 最近一次 API 错误（展示用）。 */
  error: string
}

/** 无绑定会话的初始状态。 */
export function blankState(): WorktreeSessionState {
  return {
    mode: preferredNewSessionMode(),
    // 未知 git 状态时默认按 git 仓库处理（工作树插件的目标用户），待 status 返回后校准。
    isGit: true,
    phase: 'idle',
    loadingLabel: '',
    log: [],
    worktreeKey: '',
    worktreePath: '',
    projectPath: '',
    sourceSessionId: '',
    branchName: 'dsh/',
    checkoutOpen: false,
    abandonOpen: false,
    error: '',
  }
}

/** useSyncExternalStore 的空 snapshot 必须保持引用稳定，否则会触发无限重渲染。 */
const EMPTY_STATE = blankState()

/** 全局共享状态源（模块级单例；插件重载时随 bundle 重建，可接受）。 */
export interface WorktreeUiState {
  /** 按会话 id 缓存的工作树状态。 */
  bySession: Record<string, WorktreeSessionState>
}

export const worktreeStore = createSnapshotStore<WorktreeUiState>({
  bySession: {},
})

/** 取某会话的 state（无则回退空白态）。 */
export function selectSessionState(state: WorktreeUiState, sessionId: string | undefined): WorktreeSessionState {
  if (!sessionId)
    return EMPTY_STATE
  return state.bySession[sessionId] ?? EMPTY_STATE
}

/** 更新某会话的 state（merge 语义）。 */
export function patchSession(sessionId: string | undefined, patch: Partial<WorktreeSessionState>): void {
  if (!sessionId)
    return
  worktreeStore.update((state) => {
    const current = state.bySession[sessionId] ?? blankState()
    state.bySession[sessionId] = { ...current, ...patch }
  })
}

/** 组件内订阅某会话的工作树状态（uSES）。 */
export function useWorktreeSession(sessionId: string | undefined): WorktreeSessionState {
  return useSyncExternalStore(
    worktreeStore.subscribe,
    () => selectSessionState(worktreeStore.getSnapshot(), sessionId),
  )
}

// ---------------------------------------------------------------------------
// RPC（/api/dsh-worktree/*，同源 fetch）
// ---------------------------------------------------------------------------

const API_PREFIX = '/api/dsh-worktree'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`请求失败 (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

export interface WorktreeStatus {
  mode: 'local' | 'worktree'
  worktreeKey?: string
  worktreePath?: string
  projectPath?: string
  hash?: string
  dirname?: string
  sourceSessionId?: string
  log?: string[]
  /** 会话工作目录是否位于 git 仓库内（非 git 目录时客户端应强制本地并隐藏模式选择器）。 */
  isGit?: boolean
}

export interface WorktreeCreate {
  ok: boolean
  hash: string
  dirname: string
  worktreeKey: string
  worktreePath: string
  projectPath: string
  sourceSessionId: string
  log: string[]
  existed: boolean
}

/** 查询某会话的工作树状态（GET，sessionId 走查询串）。 */
export function fetchStatus(sessionId: string): Promise<WorktreeStatus> {
  return request<WorktreeStatus>(`/status?sessionId=${encodeURIComponent(sessionId)}`)
}

/** 为预分配的新会话创建工作树；项目路径从当前源会话解析。 */
export function createWorktree(sessionId: string, sourceSessionId = sessionId): Promise<WorktreeCreate> {
  return request<WorktreeCreate>('/create', {
    method: 'POST',
    body: JSON.stringify({ sessionId, sourceSessionId }),
  })
}

/** 将已创建的 worktree 会话正式归属到源项目 Workspace。 */
export function attachWorktreeSession(sessionId: string): Promise<{ ok: boolean, workspaceId: string }> {
  return request('/attach', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

/** 检出本地：把工作树改动带回本地分支，解除绑定，恢复本地会话。 */
export interface WorktreeCheckout {
  ok: boolean
  branch: string
  projectPath?: string
  /**
   * 检出后带回本地的新会话 id（继承工作树会话完整对话历史，cwd 指向本地项目）。
   * 缺失表示继承会话创建失败（宿主返回 warning）。
   */
  targetSessionId?: string
  warning?: string
}

export function checkoutWorktree(
  sessionId: string,
  worktreeHashDirname: string,
  branchName: string,
): Promise<WorktreeCheckout> {
  return request('/checkout', {
    method: 'POST',
    body: JSON.stringify({ sessionId, worktreeHashDirname, branchName }),
  })
}

/** 放弃更改：删除工作树并解除绑定，会话保留。 */
export function discardWorktree(
  sessionId: string,
  worktreeHashDirname: string,
): Promise<{ ok: boolean }> {
  return request('/discard', {
    method: 'POST',
    body: JSON.stringify({ sessionId, worktreeHashDirname }),
  })
}

/** 检出本地（弹窗确认后调用）。 */
export async function applyCheckout(
  sessionId: string,
  worktreeHashDirname: string,
  branchName: string,
): Promise<{ ok: boolean, error?: string, targetSessionId?: string }> {
  try {
    const result = await checkoutWorktree(sessionId, worktreeHashDirname, branchName)
    patchSession(sessionId, {
      mode: 'local',
      phase: 'idle',
      loadingLabel: '',
      log: [],
      worktreeKey: '',
      checkoutOpen: false,
      error: '',
    })
    return { ok: true, targetSessionId: result.targetSessionId }
  }
  catch (error) {
    patchSession(sessionId, { error: errMessage(error) })
    return { ok: false, error: errMessage(error) }
  }
}

/** 放弃更改（弹窗确认后调用）。 */
export async function applyDiscard(
  sessionId: string,
  worktreeHashDirname: string,
): Promise<{ ok: boolean, error?: string }> {
  try {
    await discardWorktree(sessionId, worktreeHashDirname)
    patchSession(sessionId, {
      mode: 'local',
      phase: 'idle',
      loadingLabel: '',
      log: [],
      worktreeKey: '',
      abandonOpen: false,
      error: '',
    })
    return { ok: true }
  }
  catch (error) {
    patchSession(sessionId, { error: errMessage(error) })
    return { ok: false, error: errMessage(error) }
  }
}
