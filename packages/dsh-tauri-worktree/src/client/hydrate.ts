/**
 * hydrate.ts — 从 Host ledger 恢复所有已知会话的工作树状态。
 *
 * Mode selector 只在 hero composer 出现，不能承担全局状态恢复；侧边栏图标、归组、
 * 状态条和弹窗均依赖本 observer 在普通历史会话打开前完成 hydration。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionListSnapshot, WorkspaceListSnapshot } from './types'
import { attachWorktreeSession, discardWorktree, fetchStatus, patchSession, selectSessionState, worktreeStore } from './store'

export function installWorktreeHydration(ctx: ClientContext): () => void {
  // HARDCODE: SessionRuntime.binding() is an internal DSH 0.1.1-rc.2 API.
  // The public session-list source does not emit every tool-event mutation, so
  // live checkout/discard reconciliation subscribes to the bound Session source.
  const sessionsRuntime = ctx.sessions as unknown as {
    binding: (sessionId: string) => { session?: { subscribe?: (listener: () => void) => () => void } } | undefined
  }
  const seen = new Set<string>()
  const switching = new Set<string>()
  const cleanedArchives = new Set<string>()
  const inFlight = new Set<string>()
  const queued = new Set<string>()
  let disposed = false

  const reconcileSession = (sessionId: string, force = false): void => {
    if (inFlight.has(sessionId)) {
      if (force)
        queued.add(sessionId)
      return
    }
    const previous = selectSessionState(worktreeStore.getSnapshot(), sessionId)
    // 普通 hydration 每个会话只做一次；已绑定会话则在其事件流变化时强制复核，
    // 以便 Agent 调用 checkout_worktree / discard_worktree 后无刷新切回本地状态。
    if (!force && seen.has(sessionId))
      return
    seen.add(sessionId)
    inFlight.add(sessionId)
    void fetchStatus(sessionId)
      .then((status) => {
        if (disposed)
          return
        if (status.mode === 'worktree') {
          patchSession(sessionId, {
            mode: 'worktree',
            phase: 'created',
            isGit: status.isGit !== false,
            worktreeKey: status.worktreeKey ?? '',
            worktreePath: status.worktreePath ?? '',
            projectPath: status.projectPath ?? '',
            sourceSessionId: status.sourceSessionId ?? '',
            log: status.log ?? [],
          })
          // 自愈旧 ledger 会话：Desktop workspace 补丁允许显式归属到源 Workspace。
          if (status.sourceSessionId)
            void attachWorktreeSession(sessionId).catch(() => {})
          // create_worktree 工具在 Host 先发布继承上下文的新根会话；它进入列表后，
          // 客户端把当前源会话视觉交接到该工作树会话（不启动额外模型 turn）。
          const currentId = (ctx.sessions.list.getSnapshot() as SessionListSnapshot).current
          if (status.sourceSessionId && currentId === status.sourceSessionId && !switching.has(sessionId)) {
            switching.add(sessionId)
            ctx.sessions.open(sessionId as never)
          }
          return
        }
        const isGit = status.isGit !== false
        // 非 git 目录：永远只能是本地模式，且隐藏工作树模式选择器（select 据此渲染）。
        if (!isGit) {
          patchSession(sessionId, {
            mode: 'local',
            phase: 'idle',
            isGit: false,
            loadingLabel: '',
            log: [],
            worktreeKey: '',
            worktreePath: '',
            projectPath: status.projectPath ?? previous.projectPath,
            sourceSessionId: '',
            checkoutOpen: false,
            abandonOpen: false,
            error: '',
          })
          return
        }
        if (previous.mode === 'worktree') {
          patchSession(sessionId, {
            mode: 'local',
            phase: 'idle',
            isGit: true,
            loadingLabel: '',
            log: [],
            worktreeKey: '',
            worktreePath: '',
            projectPath: status.projectPath ?? previous.projectPath,
            sourceSessionId: '',
            checkoutOpen: false,
            abandonOpen: false,
            error: '',
          })
        }
        else {
          patchSession(sessionId, { isGit: true })
        }
      })
      .catch(() => {
        // 状态接口失败不应影响普通会话；后续 list 重新出现时允许重试。
        seen.delete(sessionId)
      })
      .finally(() => {
        inFlight.delete(sessionId)
        if (queued.delete(sessionId) && !disposed)
          reconcileSession(sessionId, true)
      })
  }

  const hydrate = (): void => {
    const snapshot = ctx.sessions.list.getSnapshot() as SessionListSnapshot
    for (const sessionId of snapshot.ids) reconcileSession(sessionId)
  }

  // 原生侧栏「归档」只隐藏会话。若该会话绑定工作树，归档集合变化后补做
  // worktree/owned branch/ledger 清理；会话日志仍由 DSH 归档持久化保留。
  const cleanupArchivedWorktrees = (): void => {
    const snapshot = ctx.workspaces.list.getSnapshot() as WorkspaceListSnapshot
    for (const sessionId of snapshot.archivedSessionIds) {
      if (cleanedArchives.has(sessionId))
        continue
      cleanedArchives.add(sessionId)
      void fetchStatus(sessionId)
        .then((status) => {
          if (disposed || status.mode !== 'worktree')
            return
          return discardWorktree(sessionId, status.worktreeKey ?? '')
        })
        .catch(() => {
          // 网络/Host 暂不可用时允许下次快照重试。
          cleanedArchives.delete(sessionId)
        })
    }
  }

  const sessionSubscriptions = new Map<string, () => void>()
  const bindSessionEvents = (): void => {
    const snapshot = ctx.sessions.list.getSnapshot() as SessionListSnapshot
    for (const sessionId of snapshot.ids) {
      if (sessionSubscriptions.has(sessionId))
        continue
      const session = sessionsRuntime.binding(sessionId)?.session
      if (!session?.subscribe)
        continue
      sessionSubscriptions.set(sessionId, session.subscribe(() => {
        const state = selectSessionState(worktreeStore.getSnapshot(), sessionId)
        if (state.mode === 'worktree')
          reconcileSession(sessionId, true)
      }))
    }
  }
  const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
    hydrate()
    bindSessionEvents()
  })
  const unsubscribeWorkspaces = ctx.workspaces.list.subscribe(cleanupArchivedWorktrees)
  hydrate()
  bindSessionEvents()
  cleanupArchivedWorktrees()
  return () => {
    disposed = true
    unsubscribeSessions()
    unsubscribeWorkspaces()
    for (const unsubscribe of sessionSubscriptions.values()) unsubscribe()
  }
}
