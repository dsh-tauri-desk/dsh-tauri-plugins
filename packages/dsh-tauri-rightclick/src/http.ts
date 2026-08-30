/** HTTP helpers: bounded JSON body reading, same-origin validation, JSON responses. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { JsonBody } from './types.js'
import { Buffer } from 'node:buffer'
import { MAX_BODY_BYTES } from './constants.js'

interface ConnectionGate {
  requestRejection: (request: IncomingMessage) => 401 | 403 | undefined
}

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>

/** Apply DSH's browser trust and authentication boundary before route logic. */
export function withConnectionAuth(connection: ConnectionGate | undefined, handler: RouteHandler): RouteHandler {
  if (typeof connection?.requestRejection !== 'function')
    throw new TypeError('dsh-tauri-rightclick requires the DSH connection authentication gate')
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

export type { RouteFunction, RouteResult } from './types.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

/**
 * 校验“同源 JSON POST”：content-type 必须是 JSON，且（当 origin 存在时）
 * origin 的 host 必须与请求 host 一致。桌面封装端同源请求会带 origin；
 * 无 origin 的 curl 等本地调用按无跨域处理。
 */
export function isSameOriginJsonRequest(req: IncomingMessage): { ok: true } | { ok: false, status: number, error: string } {
  const contentType = req.headers['content-type'] || ''
  if (!/^application\/json(?:\s*;|$)/i.test(contentType))
    return { ok: false, status: 415, error: 'unsupported-media-type' }
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin && host) {
    let sameOrigin = false
    try {
      sameOrigin = new URL(origin).host === host
    }
    catch {
      sameOrigin = false
    }
    if (!sameOrigin)
      return { ok: false, status: 403, error: 'cross-origin-request' }
  }
  return { ok: true }
}

/** 读取并解析 JSON 请求体，带字节上限（超限或解析失败时拒绝）。 */
export function readJsonBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<JsonBody> {
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
        req.destroy()
        reject(new Error('request body too large'))
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
          reject(new Error('request body must be a JSON object'))
        else
          resolve(parsed as JsonBody)
      }
      catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/** 写 JSON 响应。 */
export function respond(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    ...JSON_HEADERS,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}
