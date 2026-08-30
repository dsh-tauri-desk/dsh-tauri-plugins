/** HTTP helpers: JSON body reading, same-origin check, JSON responses. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ConnectionGate } from './types.ts'
import { Buffer } from 'node:buffer'

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>

/** Apply DSH's browser trust and authentication boundary before route logic. */
export function withConnectionAuth(connection: ConnectionGate | undefined, handler: RouteHandler): RouteHandler {
  if (typeof connection?.requestRejection !== 'function')
    throw new TypeError('dsh-tauri-panel-extension requires the DSH connection authentication gate')
  return async (request, response) => {
    const rejection = connection.requestRejection(request)
    if (rejection !== undefined) {
      response.writeHead(rejection)
      response.end(rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    await handler(request, response)
  }
}

/** Read and JSON-parse a request body, bounded to 1 MiB (skill bodies live here). */
export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    received += buffer.length
    if (received > 1024 * 1024)
      throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * True when the request is a same-origin POST a browser page could have made.
 * CSRF fence (the loopback server already trusts its local peer for reads).
 */
export function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined)
    return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  }
  catch {
    return false
  }
}

/** Write a JSON response. */
export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(payload)
}
