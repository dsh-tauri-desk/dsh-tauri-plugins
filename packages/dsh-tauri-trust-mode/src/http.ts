import type { IncomingMessage, ServerResponse } from 'node:http'
import type { JsonBody, RouteFunction } from './types.js'
import { Buffer } from 'node:buffer'

export type { RouteFunction, RouteResult } from './types.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const MAX_BODY_BYTES = 1024 * 1024

function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket?.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

class HttpError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message)
  }
}

function readJson(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    let exceeded = false
    req.on('data', (chunk: Uint8Array | string) => {
      if (exceeded)
        return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.byteLength
      if (bytes > limit) {
        exceeded = true
        reject(new HttpError('请求体过大', 413))
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      if (exceeded)
        return
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new HttpError('请求体必须是 JSON 对象', 400)
        resolve(parsed as JsonBody)
      }
      catch (error) {
        reject(error instanceof HttpError ? error : new HttpError('请求体不是有效的 JSON', 400))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, code: number, payload: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(code, { ...JSON_HEADERS, ...headers })
  res.end(code === 204 ? undefined : JSON.stringify(payload))
}

// 包装路由处理函数：限定 GET/POST、校验来源、统一 JSON 响应。
// fn 收到处理函数（GET 时无 body，POST 时收到解析后的 JSON 对象）；mutate=true 表示变更操作（仅限本机 127.0.0.1，使用 POST）。
export function routeHandler(
  fn: RouteFunction,
  { mutate = false }: { mutate?: boolean } = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const allowedMethod = mutate ? 'POST' : 'GET'
  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {}, { allow: `${allowedMethod}, OPTIONS` })
      return
    }
    if (req.method !== allowedMethod) {
      sendJson(res, 405, { error: `仅支持 ${allowedMethod} 请求` }, { allow: `${allowedMethod}, OPTIONS` })
      return
    }
    if (mutate && !isLoopback(req)) {
      sendJson(res, 403, { error: '变更操作仅限本机（127.0.0.1）调用' })
      return
    }
    try {
      const [code, payload] = await fn(mutate ? await readJson(req) : {}, req)
      sendJson(res, code, payload)
    }
    catch (error) {
      const code = error instanceof HttpError ? error.statusCode : 500
      sendJson(res, code, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
