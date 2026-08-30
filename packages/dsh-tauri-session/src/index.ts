/**
 * dsh-tauri-session 宿主侧（node half）：「已归档聊天」的管理接口。
 *
 * 归档语义（v2，与官方机制对齐）：
 *   官方工作区浏览器会话行菜单自带「归档」动作，写入宿主 WorkspaceRegistry 的
 *   归档集合（`archivedSessionIds`，持久化、隐藏于所有分组界面、不动工作区记账，
 *   取消归档自动恢复原组原位）。因此本插件不再维护自有的 `archive.json`，
 *   而是直接读写宿主归档集合：
 *     - `GET  /archived`        读宿主归档集合 + 会话头元数据；
 *     - `POST /archive`         归档单个会话（宿主 `archiveSession`）；
 *     - `POST /archive-workspace` 归档一组会话（插件 UI「归档工作区」）；
 *     - `POST /unarchive`       从宿主归档集合移除（宿主无公开 unarchive，
 *                               走注册表内部状态机，见 `updateRegistryArchiveSet`）；
 *     - `POST /delete`          兼容端点，永久删除禁用时返回 503；
 *     - `POST /delete-workspace` 兼容端点，永久删除禁用时返回 503；
 *     - `POST /clear`           兼容端点，永久删除禁用时返回 503。
 *   插件初始化时把旧版自持 `archive.json` 的记录一次性迁入宿主集合后删除旧文件。
 */

import type {
  ArchivedListPayload,
  ArchiveDocument,
  HostContext,
  PluginConfig,
  SessionLike,
} from './types.js'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { routeHandler, withConnectionAuth } from 'dsh-tauri'
import { SESSION_API_PREFIX, SESSION_ARCHIVE_FILE, SESSION_PLUGIN_NAME } from './constants.js'
import { loadArchive, saveArchive, sessionStateDir } from './storage.js'

/** 插件名（诊断元数据，与导出的 name 一致）。 */
export const name = SESSION_PLUGIN_NAME

/** 需要的宿主服务：webServer（HTTP 路由）、sessions（会话枚举/header）、workspaceRegistry（归档集合）。 */
export const inject = ['webServer', 'sessions', 'workspaceRegistry', 'connection']

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

/** 组装 GET /archived 的载荷：宿主归档集合 id + 每个会话的创建元数据（读 host session header）。 */
function buildArchivedPayload(ctx: HostContext): ArchivedListPayload {
  const registry = ctx.workspaceRegistry as { archivedSessionIds?: readonly string[] } | undefined
  const archivedSessionIds: string[] = []
  const meta: ArchivedListPayload['meta'] = {}
  for (const sessionId of registry?.archivedSessionIds ?? []) {
    const session = findSession(ctx, sessionId)
    if (!session)
      continue
    archivedSessionIds.push(sessionId)
    const cwd = sessionCwd(session)
    meta[sessionId] = {
      createdAt: session?.header?.createdAt,
      cwd,
      ...(session?.displayTitle ? { title: session.displayTitle } : session?.title ? { title: session.title } : {}),
    }
  }
  return { archivedSessionIds, meta }
}

/** 归档一个会话（宿主归档集合，幂等：已归档则无操作）。 */
async function archiveSession(ctx: HostContext, body: Record<string, unknown>): Promise<ArchivedListPayload> {
  const sessionId = String(body.sessionId ?? '')
  if (!sessionId)
    throw new Error('缺少 sessionId')
  await requireArchiveSession(ctx)(sessionId)
  return buildArchivedPayload(ctx)
}

/** 归档一组会话（「归档工作区」：一次调用归档该组全部会话）。 */
async function archiveWorkspace(ctx: HostContext, body: Record<string, unknown>): Promise<ArchivedListPayload> {
  const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds.map(String) : []
  if (sessionIds.length === 0)
    throw new Error('缺少 sessionIds')
  const archiveSession = requireArchiveSession(ctx)
  for (const sessionId of sessionIds)
    await archiveSession(sessionId)
  return buildArchivedPayload(ctx)
}

/**
 * 宿主归档集合的私有状态机面。宿主公开 API 只有 `archiveSession`（没有 unarchive），
 * 而取消归档是插件的核心功能，因此这里显式依赖注册表内部方法：
 * `enqueueOperation`（串行化读改写）、`requireState`（当前持久化状态）、
 * `setState`（写回并发布）。三者任一缺失（宿主升级改内部结构）即报错，绝不静默降级。
 */
interface RegistryArchiveSurface {
  enqueueOperation?: (fn: () => Promise<void>) => Promise<void>
  requireState?: () => { archivedSessionIds?: readonly string[] }
  requireTable?: () => {
    entries: () => Iterable<[string, { sessionIds?: readonly string[] }]>
    update: (id: string, update: (record: { sessionIds?: readonly string[] }) => { sessionIds: string[] }) => Promise<void>
  }
  setState?: (state: unknown) => Promise<void>
}

function registryArchiveSurface(ctx: HostContext): RegistryArchiveSurface {
  const registry = ctx.workspaceRegistry as unknown as RegistryArchiveSurface | undefined
  if (!registry || typeof registry.enqueueOperation !== 'function' || typeof registry.requireState !== 'function' || typeof registry.setState !== 'function')
    throw new Error('宿主 workspaceRegistry 未暴露归档集合的变更接口（宿主版本不兼容）')
  return registry
}

/** 归档所需方法缺失时报错，绝不静默跳过（否则迁移会误删旧记录）。 */
function requireArchiveSession(ctx: HostContext): (sessionId: string) => Promise<void> {
  const archiveSession = ctx.workspaceRegistry?.archiveSession
  if (typeof archiveSession !== 'function')
    throw new Error('宿主 workspaceRegistry 未提供 archiveSession（宿主版本不兼容）')
  return archiveSession.bind(ctx.workspaceRegistry) as (sessionId: string) => Promise<void>
}

/** 串行化地改写宿主归档集合（用于取消归档与旧数据修复）。 */
export async function updateRegistryArchiveSet(ctx: HostContext, update: (ids: string[]) => string[]): Promise<void> {
  const registry = registryArchiveSurface(ctx)
  await registry.enqueueOperation!(async () => {
    const state = registry.requireState!()
    const archived = [...(state.archivedSessionIds ?? [])]
    const next = update(archived)
    if (next.length === archived.length && next.every((id, index) => id === archived[index]))
      return
    await registry.setState!({ ...state, archivedSessionIds: next })
  })
}

/**
 * Restore the accounting slot when an older delete-all attempt removed it.
 * Normal archives already have the slot and this is a no-op; damaged historical
 * data is repaired from the session header cwd and the matching workspace path.
 */
async function restoreSessionWorkspaceAccounting(ctx: HostContext, sessionId: string): Promise<void> {
  const registry = registryArchiveSurface(ctx)
  const table = registry.requireTable?.()
  const session = findSession(ctx, sessionId)
  const cwd = sessionCwd(session)
  if (!table || !cwd || typeof ctx.workspaceRegistry?.list !== 'function')
    return
  const workspace = (ctx.workspaceRegistry.list() as Array<{ id: string, path?: string, sessionIds?: readonly string[] }>).find(item => item.path === cwd)
  if (!workspace || workspace.sessionIds?.includes(sessionId))
    return
  await table.update(workspace.id, current => ({ ...current, sessionIds: [...(current.sessionIds ?? []), sessionId] }))
}

/** 取消归档：移除归档标记，并修复历史数据缺失的工作区归属槽位。 */
async function unarchiveSession(ctx: HostContext, body: Record<string, unknown>): Promise<{ ok: true }> {
  const sessionId = String(body.sessionId ?? '')
  if (!sessionId)
    throw new Error('缺少 sessionId')
  const registry = registryArchiveSurface(ctx)
  await registry.enqueueOperation!(async () => {
    await restoreSessionWorkspaceAccounting(ctx, sessionId)
    const state = registry.requireState!()
    const archived = [...(state.archivedSessionIds ?? [])]
    const next = archived.filter(id => id !== sessionId)
    if (next.length !== archived.length)
      await registry.setState!({ ...state, archivedSessionIds: next })
  })
  return { ok: true as const }
}

/**
 * 一次性迁移旧版插件自持归档（`$DSH_HOME/dsh-tauri-session/archive.json`）到宿主
 * 归档集合。迁移成功的记录从旧文件中移除；仍失败的（如会话已不存在）保留在旧
 * 文件中，下次启动幂等重试 —— 绝不因单次失败丢弃用户数据。
 */
async function migrateLegacyArchive(ctx: HostContext, dshHome: string): Promise<void> {
  const legacy = loadArchive(dshHome)
  const sessionIds = Object.keys(legacy)
  if (sessionIds.length === 0)
    return
  let migrated = 0
  const failed: string[] = []
  let archiveSession: ((sessionId: string) => Promise<void>) | undefined
  try {
    archiveSession = requireArchiveSession(ctx)
  }
  catch {
    // 宿主不提供 archiveSession 时保留全部旧记录，下次启动重试，绝不误删。
    failed.push(...sessionIds)
  }
  if (archiveSession) {
    for (const sessionId of sessionIds) {
      try {
        await archiveSession(sessionId)
        migrated += 1
      }
      catch {
        failed.push(sessionId)
      }
    }
  }
  try {
    if (failed.length === 0) {
      rmSync(join(sessionStateDir(dshHome), SESSION_ARCHIVE_FILE), { force: true })
    }
    else {
      // 只保留未迁移成功的记录，避免下次启动重复迁移已成功的会话。
      const remaining: ArchiveDocument = {}
      for (const sessionId of failed)
        remaining[sessionId] = legacy[sessionId]
      saveArchive(remaining, dshHome)
    }
  }
  catch {
    // 旧文件整理失败不影响新机制（下次启动会再尝试迁移）。
  }
  ctx.logger?.info?.(`[${SESSION_PLUGIN_NAME}] migrated ${migrated}/${sessionIds.length} legacy archived session(s) into the host registry`)
}

const permanentDeletionUnavailable = routeHandler(
  async () => [503, {
    error: '当前 DSH 尚无可安全协调会话写入器的删除 API；永久删除已暂时禁用，请保留归档或取消归档。',
  }],
  { mutate: true, readBody: false },
)

/** 构建路由列表。 */
export function buildRoutes(ctx: HostContext, _dshHome: string): any[] {
  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/archived`,
      handler: routeHandler(async () => [200, buildArchivedPayload(ctx)]),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/archive`,
      handler: routeHandler(async body => [200, await archiveSession(ctx, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/archive-workspace`,
      handler: routeHandler(async body => [200, await archiveWorkspace(ctx, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/unarchive`,
      handler: routeHandler(async body => [200, await unarchiveSession(ctx, body)], { mutate: true }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/delete`,
      handler: permanentDeletionUnavailable,
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/delete-workspace`,
      handler: permanentDeletionUnavailable,
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/clear`,
      handler: permanentDeletionUnavailable,
    },
  ]
  return routes.map(route => ({
    ...route,
    handler: withConnectionAuth(ctx.connection, route.handler, 'dsh-tauri-session'),
  }))
}

/**
 * 插件体：迁移旧版归档 + 注册 HTTP 路由。
 * @param ctx - 宿主根上下文（注入 webServer/sessions/workspaceRegistry）。
 * @param config - 插件行配置（dshHome 等，仅用于旧版归档迁移路径）。
 */
export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  const cfg = config ?? {}
  const dshHome = resolveDshHome(cfg)

  // 旧版自持归档一次性迁入宿主集合（幂等：文件不存在或为空则直接跳过）。
  ctx.effect(() => {
    void migrateLegacyArchive(ctx, dshHome)
  }, `${SESSION_PLUGIN_NAME}: migrate legacy archive`)

  // HTTP 路由注册（归档/取消归档可用；永久删除兼容端点 fail closed）。
  ctx.effect(() => {
    const disposers = buildRoutes(ctx, dshHome).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers)
        dispose()
    }
  }, `${SESSION_PLUGIN_NAME}: routes`)
}
