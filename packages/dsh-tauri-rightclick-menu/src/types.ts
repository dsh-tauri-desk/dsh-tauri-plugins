/** Host-half shared types for dsh-tauri-rightclick-menu. */

/** 宿主上下文（沿用工作区先例：插件按需解构具体服务）。 */
export type HostContext = any

/** 路由处理器收到的 JSON 请求体。 */
export type JsonBody = Record<string, unknown>

export type RouteResult = [number, unknown]
export type RouteFunction = (body: JsonBody, req: import('node:http').IncomingMessage) => Promise<RouteResult>

/** 会话持久化条目（sessionPersistence.list() 返回）。 */
export interface SessionHeaderLike {
  id: string
  origin?: string
}

/** 会话磁盘位置（sessionPersistence.locate() 返回）。 */
export interface SessionLocationLike {
  kind?: string
  path?: string
}

/** 永久删除会话的成功载荷。 */
export interface DeleteSessionResult {
  ok: true
  removed: true
  /** 删除前是否已脱离 live session（运行中的会话被停止并脱离）。 */
  detached: boolean
  /** 非致命的清理告警（投影/过渡/工作区记账失败时收集）。 */
  warnings: string[]
}

/** 每个 host route 的注册描述（传给 ctx.webServer.register）。 */
export interface HostRoute {
  kind: 'exact'
  path: string
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>
}
