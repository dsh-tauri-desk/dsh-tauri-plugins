import type { IncomingMessage } from 'node:http'

/** 宿主根上下文（cordis 注入 webServer 等服务）；本仓库统一以 any 表示。 */
export type HostContext = any

/** HTTP 路由处理函数的请求体（JSON 对象）。 */
export type JsonBody = Record<string, unknown>

/** 路由处理函数返回值 [HTTP 状态码, 响应体]。 */
export type RouteResult = [number, unknown]

/** 路由处理函数：接收请求体与请求对象，返回 [状态码, 响应体]。 */
export type RouteFunction = (body: JsonBody, req: IncomingMessage) => Promise<RouteResult>
