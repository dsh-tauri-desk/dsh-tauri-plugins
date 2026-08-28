/**
 * dsh-tauri-session 宿主侧（node half）：插件自有的「已归档聊天」存档与管理。
 *
 * 职责（参照 dsh-tauri-worktree 的 host/client 架构）：
 *   1. 维护插件自有的归档集合（`~/.dsh/dsh-tauri-session/archive.json`），
 *      不触碰宿主 WorkspaceRegistry 的 archiveSession（宿主没有 unarchive，
 *      无法把会话移出归档集）；
 *   2. 暴露 /api/dsh-session/* 给客户端（list / archive / unarchive /
 *      archive-workspace / prune）；
 *   3. 插件初始化时自动清理僵尸归档（归档会话的工作目录已不存在）。
 *
 * 归档语义：归档只记录 sessionId 及它在归档时所属的工作区组与位置锚点，
 * 从不修改宿主工作区的 sessionIds 记账 —— 因此「取消归档」删掉记录后，
 * 会话会在原来的工作区组里、位于保留的位置自动恢复显示。
 */

import type {
  ArchivedListPayload,
  ArchiveDocument,
  ArchivedSessionRecord,
  HostContext,
  PluginConfig,
  SessionLike,
} from './types.js'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SESSION_API_PREFIX, SESSION_PLUGIN_NAME } from './constants.js'
import { routeHandler } from './http.js'
import { loadArchive, saveArchive } from './storage.js'

/** 插件名（诊断元数据，与导出的 name 一致）。 */
export const name = SESSION_PLUGIN_NAME

/** 需要的宿主服务：webServer（HTTP 路由）、sessions（会话枚举/header）、workspaceRegistry（工作区归属）。 */
export const inject = ['webServer', 'sessions', 'workspaceRegistry']

/** API 路由前缀（客户端同源 fetch）。 */
export const API_PREFIX = SESSION_API_PREFIX

function resolveDshHome(config: PluginConfig): string {
  return typeof config.dshHome === 'string' && config.dshHome ? config.dshHome : process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** 查找会话对象（host ctx.sessions）。 */
function findSession(ctx: HostContext, sessionId: string): SessionLike | undefined {
  if (!sessionId)
    return undefined
  return (ctx.sessions?.get?.(sessionId) as SessionLike | undefined)
    ?? (ctx.sessions?.list?.() as SessionLike[] | undefined)?.find((session: SessionLike) => session.id === sessionId)
}

/** 会话工作目录（header.cwd）。 */
function sessionCwd(session: SessionLike | undefined): string | undefined {
  const cwd = session?.header?.cwd
  return typeof cwd === 'string' && cwd ? cwd : undefined
}

/** 解析会话所属工作区 id（按 cwd 解析；解析失败返回 undefined）。 */
async function resolveWorkspaceId(ctx: HostContext, sessionId: string): Promise<string | undefined> {
  const session = findSession(ctx, sessionId)
  const cwd = sessionCwd(session)
  if (!cwd)
    return undefined
  try {
    const workspace = await ctx.workspaceRegistry?.resolveByPath?.(cwd)
    return workspace?.id as string | undefined
  }
  catch {
    return undefined
  }
}

/** 按归档时间升序排列的已归档会话 id（稳定的参考顺序，客户端自行分组/排序）。 */
function orderedArchiveIds(archive: ArchiveDocument): string[] {
  return Object.values(archive)
    .sort((a, b) => a.archivedAt - b.archivedAt)
    .map(record => record.sessionId)
}

/** 组装 GET /archived 的载荷：归档 id + 每个会话的创建元数据（读 host session header）。 */
function buildArchivedPayload(ctx: HostContext, archive: ArchiveDocument): ArchivedListPayload {
  const archivedSessionIds = orderedArchiveIds(archive)
  const meta: ArchivedListPayload['meta'] = {}
  for (const sessionId of archivedSessionIds) {
    const session = findSession(ctx, sessionId)
    const cwd = sessionCwd(session)
    meta[sessionId] = {
      createdAt: session?.header?.createdAt,
      cwd,
    }
  }
  return { archivedSessionIds, meta }
}

/** 归档一个会话（幂等：已归档则仅刷新位置信息）。 */
async function archiveSession(ctx: HostContext, dshHome: string, body: Record<string, unknown>): Promise<ArchivedListPayload> {
  const sessionId = String(body.sessionId ?? '')
  if (!sessionId)
    throw new Error('缺少 sessionId')
  const archive = loadArchive(dshHome)
  const workspaceId = typeof body.workspaceId === 'string' && body.workspaceId
    ? body.workspaceId
    : await resolveWorkspaceId(ctx, sessionId)
  const existing = archive[sessionId]
  const beforeSessionId = typeof body.beforeSessionId === 'string' && body.beforeSessionId
    ? body.beforeSessionId
    : existing?.beforeSessionId
  const record: ArchivedSessionRecord = {
    sessionId,
    archivedAt: existing?.archivedAt ?? Date.now(),
    ...(workspaceId ? { workspaceId } : {}),
    ...(beforeSessionId ? { beforeSessionId } : {}),
  }
  archive[sessionId] = record
  saveArchive(archive, dshHome)
  return buildArchivedPayload(ctx, archive)
}

/** 取消归档（删除记录；会话在其工作区组保留的位置自动恢复）。 */
function unarchiveSession(dshHome: string, body: Record<string, unknown>): { ok: true } {
  const sessionId = String(body.sessionId ?? '')
  if (!sessionId)
    throw new Error('缺少 sessionId')
  const archive = loadArchive(dshHome)
  delete archive[sessionId]
  saveArchive(archive, dshHome)
  return { ok: true as const }
}

/** 归档整个工作区组：为该组的每个会话写入记录（含位置锚点）。 */
async function archiveWorkspace(ctx: HostContext, dshHome: string, body: Record<string, unknown>): Promise<ArchivedListPayload> {
  const workspaceId = String(body.workspaceId ?? '')
  const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds.map(String) : []
  if (!workspaceId)
    throw new Error('缺少 workspaceId')
  const archive = loadArchive(dshHome)
  // beforeSessionId = 该子会话在组内顺序中的上一个会话（insert-before 语义锚点）。
  sessionIds.forEach((sessionId, index) => {
    const beforeSessionId = sessionIds[index + 1]
    archive[sessionId] = {
      sessionId,
      workspaceId,
      ...(beforeSessionId ? { beforeSessionId } : {}),
      archivedAt: archive[sessionId]?.archivedAt ?? Date.now(),
    }
  })
  saveArchive(archive, dshHome)
  return buildArchivedPayload(ctx, archive)
}

/** 删除全部归档记录（清空归档，全部会话回到其原组）。 */
function clearArchive(dshHome: string): { ok: true } {
  saveArchive({}, dshHome)
  return { ok: true as const }
}

/**
 * 清理僵尸归档：归档会话的工作目录（header.cwd）已不存在时，该会话成为
 * 「会话存在但目录已不存在」的僵尸 —— 从插件归档集合中剔除其记录。
 * @returns 被清除的会话 id。
 */
function pruneZombieArchives(ctx: HostContext, dshHome: string): string[] {
  const archive = loadArchive(dshHome)
  const removed: string[] = []
  for (const sessionId of Object.keys(archive)) {
    const session = findSession(ctx, sessionId)
    const cwd = sessionCwd(session)
    // 只有确实能确定目录已不存在时才清理；未知状态（会话无 cwd 或查不到）
    // 保守保留，避免误删仍在持久化中的会话。
    if (cwd && !existsSync(cwd)) {
      delete archive[sessionId]
      removed.push(sessionId)
    }
  }
  if (removed.length > 0)
    saveArchive(archive, dshHome)
  return removed
}

/** 构建路由列表。 */
export function buildRoutes(ctx: HostContext, config: PluginConfig): any[] {
  const dshHome = resolveDshHome(config)

  return [
    {
      kind: 'exact',
      path: `${API_PREFIX}/archived`,
      handler: routeHandler(async () => [200, buildArchivedPayload(ctx, loadArchive(dshHome))]),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/archive`,
      handler: routeHandler(async body => [200, await archiveSession(ctx, dshHome, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/archive-workspace`,
      handler: routeHandler(async body => [200, await archiveWorkspace(ctx, dshHome, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/unarchive`,
      handler: routeHandler(async body => [200, unarchiveSession(dshHome, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/clear`,
      handler: routeHandler(async () => [200, clearArchive(dshHome)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/prune`,
      handler: routeHandler(async () => [200, { removed: pruneZombieArchives(ctx, dshHome) }], { mutate: true }),
    },
  ]
}

/**
 * 插件体：注册 HTTP 路由，并在初始化时清理僵尸归档。
 * @param ctx - 宿主根上下文（注入 webServer/sessions/workspaceRegistry）。
 * @param config - 插件行配置（dshHome 等）。
 */
export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  const cfg = config ?? {}
  const dshHome = resolveDshHome(cfg)

  // 初始化时自动清理僵尸会话（归档记录对应的工作目录已不存在）。
  ctx.effect(() => {
    const removed = pruneZombieArchives(ctx, dshHome)
    if (removed.length > 0)
      ctx.logger?.info?.(`[${SESSION_PLUGIN_NAME}] pruned ${removed.length} zombie archived session(s)`)
  }, `${SESSION_PLUGIN_NAME}: prune zombie archives`)

  // HTTP 路由注册（客户端经此调用 list/archive/unarchive/...）。
  ctx.effect(() => {
    const disposers = buildRoutes(ctx, cfg).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers)
        dispose()
    }
  }, `${SESSION_PLUGIN_NAME}: routes`)
}
