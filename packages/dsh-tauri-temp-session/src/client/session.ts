/**
 * session.ts — 浏览器半区运行时：临时会话创建、Hero 芯片对账、"新建会话"入口
 * 包装与兜底补位。
 *
 * createTempSessionRuntime 只构建闭包，不触碰 DOM 与 stores；install() 由
 * ctx.effect 挂载，返回完整 disposer（观测器、订阅、挂起 RAF 与 startSession
 * 恢复），过期事件在 dispose 后一律忽略。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SessionsListSnapshot,
  SessionsRuntime,
  SessionSummary,
  WorkspacesListSnapshot,
  WorkspacesRuntime,
} from './types'
import { findChip, reconcileChip, removeClearButton } from './chip'
import { AUTO_ENSURE_INTERVAL_MS, TEMP_SESSION_API_PREFIX, TEMP_SESSION_PLUGIN_NAME } from './constants'

/** 当前会话挂接的工作区视图（无则 undefined）。 */
export function currentWorkspaceOf(
  snapshot: WorkspacesListSnapshot,
  currentId: string | null | undefined,
): WorkspacesListSnapshot['items'][number] | undefined {
  if (currentId === undefined || currentId === null)
    return undefined
  for (const workspace of snapshot.items ?? []) {
    if ((workspace.sessionIds ?? []).includes(currentId))
      return workspace
  }
  return undefined
}

/**
 * subagent 子会话的判定：列表摘要带 origin === "subagent" 或 parentId。
 * 子代理的空白会话同样是"空白 + 无工作区"，若不排除会被误当作临时会话复用并
 * 打开——进而表现为"临时会话以 subagent 形式运行"，且模型选择报
 * agent-busy（owned by subagent routing）。
 */
export function isSubagentSummary(summary: SessionSummary | undefined): boolean {
  return summary !== undefined && (summary.origin === 'subagent' || summary.parentId !== undefined)
}

/**
 * 找一个现成的"空白 + 无工作区 + 非 subagent"会话（即本插件创建的临时空白会话）。
 * 只有本插件会创建无工作区会话，因此该判定是安全的；不存在则 undefined。
 */
export function findExistingTempBlank(
  sessions: SessionsListSnapshot,
  workspaces: WorkspacesListSnapshot,
): string | undefined {
  for (const id of sessions.ids ?? []) {
    const summary = sessions.byId[id]
    if (summary === undefined || summary.blank !== true)
      continue
    if (isSubagentSummary(summary))
      continue
    if (currentWorkspaceOf(workspaces, summary.id) === undefined)
      return summary.id
  }
  return undefined
}

export interface TempSessionRuntime {
  /** 把一轮 DOM 对账排进下一帧（合帧；dispose 后为 no-op）。 */
  scheduleReconcile: () => void
  /** 挂载观测器、订阅与入口包装；返回完整 disposer。 */
  install: () => () => void
}

/** 组装运行时闭包；ctx.sessions / ctx.workspaces 经 cast 到达写面（见 client/types.ts）。 */
export function createTempSessionRuntime(ctx: ClientContext): TempSessionRuntime {
  const sessions = ctx.sessions as unknown as SessionsRuntime
  const workspaces = ctx.workspaces as unknown as WorkspacesRuntime
  const sessionsList = sessions.list
  const workspacesList = workspaces.list

  let creating = false
  let lastAuto = 0
  let pendingRaf = 0
  let disposed = false
  /** 本轮应用是否出现过"当前会话"：区分启动期与运行期（见 autoEnsure）。 */
  let everHadCurrent = false

  /** 预留并创建一次临时会话；复用现成的空白临时会话时直接返回其 id。 */
  async function ensureTempSession(): Promise<string> {
    const existing = findExistingTempBlank(sessionsList.getSnapshot(), workspacesList.getSnapshot())
    if (existing !== undefined)
      return existing
    const response = await fetch(`${TEMP_SESSION_API_PREFIX}/reserve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`reserve failed (${response.status}): ${detail}`)
    }
    const data = await response.json() as { ok?: boolean, sessionId?: string, cwd?: string, error?: string }
    if (data.ok !== true || data.sessionId === undefined || data.cwd === undefined)
      throw new Error(data.error ?? 'reserve failed')
    return await sessions.create({ sessionId: data.sessionId, cwd: data.cwd })
  }

  /** 点击 ×：把当前空白会话从工作区切回"未选定"（临时会话）。 */
  async function clearWorkspace(): Promise<void> {
    if (creating)
      return
    const currentId = sessionsList.getSnapshot().current
    if (currentId === undefined)
      return
    const workspace = currentWorkspaceOf(workspacesList.getSnapshot(), currentId)
    if (workspace === undefined)
      return
    creating = true
    try {
      const nextId = await ensureTempSession()
      if (sessionsList.getSnapshot().current !== nextId)
        sessions.open(nextId)
    }
    catch (error) {
      console.warn(`${TEMP_SESSION_PLUGIN_NAME}: clear workspace failed:`, error)
    }
    finally {
      creating = false
    }
  }

  /** DOM 对账：更新芯片文案与 × 展示。 */
  function reconcile(): void {
    try {
      const chip = findChip()
      if (chip === null) {
        removeClearButton()
        return
      }
      const snapshot = sessionsList.getSnapshot()
      const workspaceSelected = currentWorkspaceOf(workspacesList.getSnapshot(), snapshot.current) !== undefined
      reconcileChip(chip, workspaceSelected, clearWorkspace)
    }
    catch {
      // 任何 DOM/状态异常都不应打断应用；下一轮对账重试。
    }
  }

  function scheduleReconcile(): void {
    if (disposed || pendingRaf !== 0)
      return
    pendingRaf = window.requestAnimationFrame(() => {
      pendingRaf = 0
      reconcile()
    })
  }

  /**
   * 兜底：当前无会话时预建一个临时空白会话。
   * 启动期（尚未出现过当前会话）有最近工作区时让位给上游初始选择逻辑
   * （startInitialSelection 是一次性策略，只在该窗口内自动连接）；
   * 运行期（删除/归档当前会话后 current 归零）上游不再行动，由这里补位，
   * 否则 hero 输入框因 sessionId === void 0 被内核判为 inert（必须选工作区）。
   */
  function autoEnsure(): void {
    if (creating || disposed)
      return
    let snapshot: SessionsListSnapshot
    try {
      snapshot = sessionsList.getSnapshot()
    }
    catch {
      return
    }
    const wsSnapshot = workspacesList.getSnapshot()
    if (wsSnapshot.baselinesReady !== true)
      return
    if (snapshot.current !== undefined) {
      everHadCurrent = true
      return
    }
    if (!everHadCurrent && wsSnapshot.recentWorkspaceId !== undefined)
      return
    const now = Date.now()
    if (now - lastAuto < AUTO_ENSURE_INTERVAL_MS)
      return
    lastAuto = now
    creating = true
    ensureTempSession()
      .then((id) => {
        if (sessionsList.getSnapshot().current === undefined)
          sessions.open(id)
      })
      .catch((error) => {
        console.warn(`${TEMP_SESSION_PLUGIN_NAME}: auto temp session failed:`, error)
      })
      .finally(() => {
        creating = false
      })
  }

  function install(): () => void {
    // 1) "新建会话"入口：无显式工作区 → 临时会话（跳过上游"连接最近工作区"逻辑）。
    const originalStartSession = workspaces.startSession
    let patched: WorkspacesRuntime['startSession'] | undefined
    if (typeof originalStartSession === 'function') {
      const startSessionPatch: WorkspacesRuntime['startSession'] = (workspaceId) => {
        if (workspaceId === undefined) {
          // 已处于"空白临时会话"的 hero 时，无需再建一个会话。
          const snapshot = sessionsList.getSnapshot()
          const currentId = snapshot.current
          if (currentId !== undefined) {
            const current = snapshot.byId[currentId]
            const workspace = currentWorkspaceOf(workspacesList.getSnapshot(), currentId)
            if (current !== undefined && current.blank === true && workspace === undefined && !isSubagentSummary(current))
              return
          }
          if (creating || disposed)
            return
          creating = true
          ensureTempSession()
            .then(id => sessions.open(id))
            .catch((error) => {
              console.warn(`${TEMP_SESSION_PLUGIN_NAME}: new session failed:`, error)
            })
            .finally(() => {
              creating = false
            })
          return
        }
        return originalStartSession.call(workspaces, workspaceId)
      }
      patched = startSessionPatch
      workspaces.startSession = startSessionPatch
    }

    // 2) 状态订阅：芯片对账 + 兜底补位。
    const unsubscribes = [
      sessionsList.subscribe(scheduleReconcile),
      workspacesList.subscribe(scheduleReconcile),
      sessionsList.subscribe(autoEnsure),
      workspacesList.subscribe(autoEnsure),
    ]

    // 3) DOM 观测：React 更新芯片后立即重新对账。
    const observer = new MutationObserver(scheduleReconcile)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    // 4) 首轮对账 + 首轮兜底（快照可能已就绪且无当前会话——此时无订阅事件可依）。
    scheduleReconcile()
    autoEnsure()

    return () => {
      disposed = true
      if (pendingRaf !== 0) {
        window.cancelAnimationFrame(pendingRaf)
        pendingRaf = 0
      }
      observer.disconnect()
      for (const unsubscribe of unsubscribes)
        unsubscribe()
      if (patched !== undefined && workspaces.startSession === patched)
        workspaces.startSession = originalStartSession
    }
  }

  return { scheduleReconcile, install }
}
