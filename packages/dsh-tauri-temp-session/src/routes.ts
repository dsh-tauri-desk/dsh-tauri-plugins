import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ExactRoute, JsonBody, RouteFunction, RouteHandler } from './types'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { RESERVE_BODY_LIMIT, TEMP_SESSION_API_PREFIX } from './constants'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

export class HttpError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message)
  }
}

/** 仅本机回环地址允许调用（与 dsh-tauri-worktree 相同的安全口径）。 */
function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket?.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function readJson(req: IncomingMessage, limit = RESERVE_BODY_LIMIT): Promise<JsonBody> {
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
        reject(new HttpError('request body too large', 413))
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
          throw new HttpError('request body must be a JSON object', 400)
        resolve(parsed as JsonBody)
      }
      catch (error) {
        reject(error instanceof HttpError ? error : new HttpError('request body is not valid JSON', 400))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, code: number, payload: unknown): void {
  res.writeHead(code, JSON_HEADERS)
  res.end(code === 204 ? undefined : JSON.stringify(payload))
}

/** 统一的路由包装：严格方法、变更限回环、JSON 体上限（口径与 dsh-tauri-worktree 对齐）。 */
export function routeHandler(fn: RouteFunction, { mutate = false }: { mutate?: boolean } = {}): RouteHandler {
  const allowedMethod = mutate ? 'POST' : 'GET'
  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }
    if (req.method !== allowedMethod) {
      sendJson(res, 405, { ok: false, error: 'POST required' })
      return
    }
    if (mutate && !isLoopback(req)) {
      sendJson(res, 403, { ok: false, error: 'loopback only' })
      return
    }
    try {
      const [code, payload] = await fn(mutate ? await readJson(req) : {}, req)
      sendJson(res, code, payload)
    }
    catch (error) {
      const code = error instanceof HttpError ? error.statusCode : 500
      sendJson(res, code, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * reserve 路由：为一次新的临时会话预留独立目录 <tempRoot>/session-<uuid> 并原样
 * 返回；客户端随后以 sessions.create({ sessionId, cwd }) 创建会话。
 */
export function createReserveRoute(tempRoot: string): ExactRoute {
  return {
    kind: 'exact',
    path: `${TEMP_SESSION_API_PREFIX}/reserve`,
    handler: routeHandler(async () => {
      const sessionId = `session-${randomUUID()}`
      const cwd = join(tempRoot, sessionId)
      await mkdir(cwd, { recursive: true })
      return [200, { ok: true, sessionId, cwd }]
    }, { mutate: true }),
  }
}
