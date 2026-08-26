import type { IncomingMessage, ServerResponse } from 'node:http'

export type JsonBody = Record<string, any>
export type RouteResult = [number, unknown]
export type RouteFunction = (body: JsonBody, req: IncomingMessage) => Promise<RouteResult>

function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket?.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function readJson(req: IncomingMessage, limit = 1024 * 1024): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Uint8Array | string) => {
      body += chunk
      if (body.length > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      }
      catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, code: number, payload: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export function routeHandler(fn: RouteFunction, { mutate = false }: { mutate?: boolean } = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }
    if (mutate && req.method === 'POST' && !isLoopback(req)) {
      sendJson(res, 403, { error: '变更操作仅限本机（127.0.0.1）调用' })
      return
    }
    try {
      const body = req.method === 'POST' ? await readJson(req) : {}
      const [code, payload] = await fn(body, req)
      sendJson(res, code, payload)
    }
    catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
