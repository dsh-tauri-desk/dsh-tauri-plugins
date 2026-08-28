/**
 * dsh-tauri-rightclick-menu 宿主侧（node half）：永久删除会话 + 系统浏览器开链。
 *
 * 客户端（src/client/）负责右键菜单的 DOM 交互；本 half 只提供两个宿主能力：
 *   - POST /api/dsh-rightclick-menu/delete   永久删除会话（含 Agent 停止、目录
 *     路径安全校验、投影/工作区记账清理与官方归档过渡，见 session-delete.ts）；
 *   - POST /api/dsh-rightclick-menu/open-url 用系统默认浏览器打开 http/https 外链
 *     （Harness 的 host.openPath 只接受文件系统路径，URL 必须走这里）。
 *
 * 两个路由都只接受同源 JSON POST（isSameOriginJsonRequest 校验），并串行化
 * 变更操作（mutation lock），避免并发删除同一会话造成目录/账本竞争。
 */

import type { HostContext, HostRoute } from './types.js'
import {
  DELETE_SESSION_ROUTE,
  OPEN_URL_ROUTE,
  RIGHTCLICK_API_PREFIX,
  RIGHTCLICK_PLUGIN_NAME,
  SESSION_ID_RE,
} from './constants.js'
import { isSameOriginJsonRequest, readJsonBody, respond } from './http.js'
import { openUrl, safeWebUrl } from './opener.js'
import { deleteSession } from './session-delete.js'

/** 插件名（诊断元数据，与导出的 name 一致）。 */
export const name = RIGHTCLICK_PLUGIN_NAME

/**
 * 需要的宿主服务：webServer（HTTP 路由）、sessionPersistence（定位会话文件）、
 *  workspaceRegistry（归档过渡/记账）、agents（停止运行中会话）、
 *  sessions（live session 脱离）、storageDomain（投影/工作区账本）。
 */
export const inject = ['webServer', 'sessionPersistence', 'workspaceRegistry', 'agents', 'sessions', 'storageDomain']

/** API 路由前缀（客户端同源 fetch）。 */
export const API_PREFIX = RIGHTCLICK_API_PREFIX

/** 构建路由列表。 */
export function buildRoutes(ctx: HostContext): HostRoute[] {
  // 串行化变更操作：每个 delete/open-url 依次排队执行，保证同一会话不会并发删除。
  let mutationTail: Promise<unknown> = Promise.resolve()
  const withMutationLock = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationTail.then(operation, operation)
    mutationTail = result.then(() => undefined, () => undefined)
    return result
  }

  return [
    {
      kind: 'exact',
      path: DELETE_SESSION_ROUTE,
      handler: async (request, response) => {
        if (request.method !== 'POST')
          return respond(response, 405, { ok: false, error: 'method-not-allowed' })
        const validation = isSameOriginJsonRequest(request)
        if (!validation.ok)
          return respond(response, validation.status, { ok: false, error: validation.error })
        let body
        try {
          body = await readJsonBody(request)
        }
        catch {
          return respond(response, 400, { ok: false, error: 'bad-request' })
        }
        const sessionId = body?.sessionId
        if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId))
          return respond(response, 400, { ok: false, error: 'invalid-session-id' })
        return withMutationLock(async () => {
          try {
            respond(response, 200, await deleteSession(ctx, sessionId))
          }
          catch (error) {
            ctx.logger?.warn?.(`[${RIGHTCLICK_PLUGIN_NAME}] failed to delete session ${sessionId}:`, error)
            respond(response, 500, { ok: false, error: 'delete-failed' })
          }
        })
      },
    },
    {
      kind: 'exact',
      path: OPEN_URL_ROUTE,
      handler: async (request, response) => {
        if (request.method !== 'POST')
          return respond(response, 405, { ok: false, error: 'method-not-allowed' })
        const validation = isSameOriginJsonRequest(request)
        if (!validation.ok)
          return respond(response, validation.status, { ok: false, error: validation.error })
        let body
        try {
          body = await readJsonBody(request)
        }
        catch {
          return respond(response, 400, { ok: false, error: 'bad-request' })
        }
        const url = safeWebUrl(body?.url)
        if (!url)
          return respond(response, 400, { ok: false, error: 'invalid-url' })
        return withMutationLock(async () => {
          try {
            await openUrl(url)
            respond(response, 200, { ok: true })
          }
          catch (error) {
            ctx.logger?.warn?.(`[${RIGHTCLICK_PLUGIN_NAME}] failed to open URL ${url}:`, error)
            respond(response, 500, { ok: false, error: 'open-url-failed' })
          }
        })
      },
    },
  ]
}

/**
 * 插件体：注册 HTTP 路由。
 * @param ctx - 宿主根上下文（注入 webServer/sessionPersistence/workspaceRegistry/
 *   agents/sessions/storageDomain）。
 */
export function apply(ctx: HostContext): void {
  ctx.effect(() => {
    const disposers = buildRoutes(ctx).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers)
        dispose()
    }
  }, `${RIGHTCLICK_PLUGIN_NAME}: routes`)
}
