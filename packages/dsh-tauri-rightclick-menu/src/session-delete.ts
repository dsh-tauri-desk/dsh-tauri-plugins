/**
 * session-delete.ts — 宿主侧“永久删除会话”流程。
 *
 * Harness 当前只公开归档（archive）而没有删除会话 RPC，因此删除必须由插件
 * 宿主直接操作磁盘与运行时账本。流程顺序（每步失败都保留可恢复状态）：
 *   1. 校验会话为可删除的 JSONL 持久化（拒绝 subagent 与其它持久化形态）；
 *   2. 停止运行中的 Agent 并等待其 idle，避免日志被后台重新写回；
 *   3. 脱离 live session，删磁盘目录（带重试与存在性校验）；
 *   4. 清理投影缓存与工作区记账，最后走官方 archive 过渡 UI。
 */

import type { DeleteSessionResult, HostContext, SessionHeaderLike, SessionLocationLike } from './types.js'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { RIGHTCLICK_PLUGIN_NAME } from './constants.js'

/** 删除目录的移除重试次数。 */
const REMOVE_ATTEMPTS = 3
/** 等待 Agent idle 的超时（毫秒）。 */
const AGENT_IDLE_TIMEOUT_MS = 15_000

/**
 * 会话目录的安全校验：只允许 `DSH_HOME/sessions/<sessionId>` 且目录名与会话 id
 * 完全一致，拒绝路径穿越、软链指向等一切越界目录。
 * @returns 校验通过后的绝对会话目录。
 */
export function safeSessionDirectory(location: SessionLocationLike, sessionId: string): string {
  const dshHome = process.env.DSH_HOME
  if (!dshHome)
    throw new Error('DSH_HOME is unavailable')
  const sessionsRoot = resolve(dshHome, 'sessions')
  const sessionDir = resolve(dirname(location.path ?? ''))
  const fromRoot = relative(sessionsRoot, sessionDir)
  const outsideRoot = !fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
  if (outsideRoot || basename(sessionDir) !== sessionId)
    throw new Error(`refusing unsafe session directory: ${sessionDir}`)
  return sessionDir
}

/** 停止运行中的 Agent：先 cancel（保留 inbox），再等待 idle。 */
async function stopAgent(agent: any): Promise<void> {
  if (!agent)
    return
  if (typeof agent.cancel === 'function') {
    try {
      await agent.cancel({ kind: 'user' }, { keepInbox: true })
    }
    catch {}
  }
  if (typeof agent.whenIdle === 'function') {
    await new Promise<void>((resolvePromise) => {
      const timer = setTimeout(resolvePromise, AGENT_IDLE_TIMEOUT_MS)
      Promise.resolve(agent.whenIdle()).then(
        () => {
          clearTimeout(timer)
          resolvePromise()
        },
        () => {
          clearTimeout(timer)
          resolvePromise()
        },
      )
    })
  }
}

/** 脱离 live session（先 flush 再 detach；无 detach 入口时退化为 store.delete）。 */
async function detachLiveSession(ctx: HostContext, sessionId: string): Promise<boolean> {
  const sessions = ctx.get('sessions')
  const session = sessions?.get?.(sessionId)
  if (!session)
    return false
  if (typeof sessions.flush === 'function') {
    try {
      await sessions.flush(session)
    }
    catch {}
  }
  const entry = sessions.store?.get?.(sessionId)
  if (!entry)
    return false
  if (typeof sessions.detachEntered === 'function')
    sessions.detachEntered(entry)
  else
    sessions.store.delete(sessionId)
  return true
}

/** 清理 session_projcache 域的投影条目。 */
async function removeProjection(ctx: HostContext, sessionId: string): Promise<void> {
  const domain = ctx.storageDomain.get('session_projcache')
  const sessions = domain?.table?.('sessions')
  if (sessions?.get(sessionId) !== undefined)
    await sessions.delete(sessionId)
}

/** 清理工作区记账：从工作区 sessionIds 摘除 + 移出归档集合。 */
async function removeWorkspaceAccounting(ctx: HostContext, sessionId: string): Promise<void> {
  const domain = ctx.storageDomain.get('workspace')
  if (!domain)
    return
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (workspace.sessionIds.includes(sessionId))
      await workspace.detachSession(sessionId)
  }
  const state = domain.global?.get?.()
  if (state?.archivedSessionIds?.includes(sessionId)) {
    const next = {
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter((id: string) => id !== sessionId),
    }
    if (typeof ctx.workspaceRegistry.setState === 'function') {
      await ctx.workspaceRegistry.setState(next)
    }
    else {
      await domain.global.set(next)
      if ('state' in ctx.workspaceRegistry)
        ctx.workspaceRegistry.state = next
    }
  }
}

/** 走官方归档过渡：优先 workspaceRegistry.archiveSession，失败时手动记账。 */
async function archiveForTransition(ctx: HostContext, sessionId: string): Promise<void> {
  try {
    await ctx.workspaceRegistry.archiveSession(sessionId)
  }
  catch (error) {
    const state = ctx.storageDomain.get('workspace')?.global?.get?.()
    if (!state || state.archivedSessionIds.includes(sessionId))
      throw error
    const next = { ...state, archivedSessionIds: [...state.archivedSessionIds, sessionId] }
    if (typeof ctx.workspaceRegistry.setState === 'function') {
      await ctx.workspaceRegistry.setState(next)
    }
    else {
      await ctx.storageDomain.get('workspace').global.set(next)
      if ('state' in ctx.workspaceRegistry)
        ctx.workspaceRegistry.state = next
    }
  }
}

/** 递归删除目录并验证：重试后仍存在则报错，绝不静默跳过。 */
async function removeAndVerify(sessionDir: string): Promise<void> {
  for (let attempt = 0; attempt < REMOVE_ATTEMPTS; attempt += 1) {
    await rm(sessionDir, { recursive: true, force: true })
    await new Promise(resolve => setImmediate(resolve))
  }
  if (existsSync(sessionDir))
    throw new Error(`session directory still exists: ${sessionDir}`)
}

/**
 * 永久删除一个会话（完整流程见文件头注释）。
 * @returns 成功载荷；失败时抛错（错误文案面向客户端 toast）。
 */
export async function deleteSession(ctx: HostContext, sessionId: string): Promise<DeleteSessionResult> {
  const header = (await ctx.sessionPersistence.list()).find((item: SessionHeaderLike) => item.id === sessionId)
  if (!header)
    throw new Error('session not found')
  if (header.origin === 'subagent')
    throw new Error('subagent session cannot be deleted directly')
  const location = ctx.sessionPersistence.locate(header)
  if (location?.kind !== 'jsonl' || typeof location.path !== 'string')
    throw new Error('session does not use deletable JSONL persistence')
  const sessionDir = safeSessionDirectory(location, sessionId)

  await stopAgent(ctx.agents.get(sessionId))
  const detached = await detachLiveSession(ctx, sessionId)

  await removeAndVerify(sessionDir)
  const warnings: string[] = []
  try {
    await removeProjection(ctx, sessionId)
  }
  catch (error) {
    warnings.push('projection-cleanup-failed')
    ctx.logger?.warn?.(`[${RIGHTCLICK_PLUGIN_NAME}] failed to clean projection ${sessionId}:`, error)
  }
  await removeAndVerify(sessionDir)

  // 官方 UI 过渡只在持久化删除成功后执行：删除非当前会话时保留当前内容区，
  // 删除当前会话时内容区进入默认 New Session 视图。
  try {
    await archiveForTransition(ctx, sessionId)
  }
  catch (error) {
    warnings.push('archive-transition-failed')
    ctx.logger?.warn?.(`[${RIGHTCLICK_PLUGIN_NAME}] failed to transition deleted session ${sessionId}:`, error)
  }
  try {
    await removeWorkspaceAccounting(ctx, sessionId)
  }
  catch (error) {
    warnings.push('workspace-cleanup-failed')
    ctx.logger?.warn?.(`[${RIGHTCLICK_PLUGIN_NAME}] failed to clean workspace accounting ${sessionId}:`, error)
  }

  return { ok: true, removed: true, detached, warnings }
}
