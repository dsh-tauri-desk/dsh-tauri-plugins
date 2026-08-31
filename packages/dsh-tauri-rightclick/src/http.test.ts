import { once } from 'node:events'
import { createServer, request as sendHttpRequest } from 'node:http'
import { isSameOriginJsonRequest, withConnectionAuth } from 'dsh-tauri'
import { afterEach, describe, expect, it, vi } from 'vitest'

const servers: ReturnType<typeof createServer>[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve) => {
    server.close(() => resolve())
  })))
})

function request(overrides: Record<string, unknown> = {}): any {
  return {
    headers: {},
    on: () => {},
    destroy: () => {},
    ...overrides,
  }
}

describe('isSameOriginJsonRequest', () => {
  it('accepts a JSON request with a matching origin', () => {
    const req = request({ headers: { 'content-type': 'application/json', 'origin': 'http://localhost:3085', 'host': 'localhost:3085' } })
    expect(isSameOriginJsonRequest(req)).toEqual({ ok: true })
  })

  it('accepts a JSON request with no origin (local curl)', () => {
    const req = request({ headers: { 'content-type': 'application/json; charset=utf-8' } })
    expect(isSameOriginJsonRequest(req)).toEqual({ ok: true })
  })

  it('rejects non-JSON content types', () => {
    const req = request({ headers: { 'content-type': 'text/plain' } })
    expect(isSameOriginJsonRequest(req)).toMatchObject({ ok: false, status: 415 })
  })

  it('rejects cross-origin requests', () => {
    const req = request({ headers: { 'content-type': 'application/json', 'origin': 'https://evil.example', 'host': 'localhost:3085' } })
    expect(isSameOriginJsonRequest(req)).toMatchObject({ ok: false, status: 403 })
  })
})

describe('withConnectionAuth', () => {
  it('rejects a real unauthenticated request before the route handler', async () => {
    const next = vi.fn()
    const server = createServer(withConnectionAuth({ requestRejection: () => 401 }, next))
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string')
      throw new Error('expected TCP listener')

    const response = await new Promise<{ status: number, body: string }>((resolve, reject) => {
      const outgoing = sendHttpRequest({
        host: '127.0.0.1',
        port: address.port,
        path: '/api/dsh-rightclick-menu/open-url',
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
      }, (incoming) => {
        incoming.setEncoding('utf8')
        let body = ''
        incoming.on('data', (chunk) => {
          body += chunk
        })
        incoming.on('end', () => {
          resolve({ status: incoming.statusCode ?? 0, body })
        })
      })
      outgoing.on('error', reject)
      outgoing.end('cross-origin-compatible body')
    })

    expect(response.status).toBe(401)
    expect(response.body).toBe('unauthorized')
    expect(next).not.toHaveBeenCalled()
  })

  it('preserves an authenticated request', async () => {
    const next = vi.fn()
    const handler = withConnectionAuth({ requestRejection: () => undefined }, next)
    const req = request()
    const res = {}
    await handler(req, res as never)
    expect(next).toHaveBeenCalledWith(req, res)
  })

  it.each([
    ['absent', undefined],
    ['missing its method', {}],
    ['using a non-function method', { requestRejection: null }],
  ])('returns 503 without invoking route logic when the gate is %s', async (_description, connection) => {
    const next = vi.fn()
    const handler = withConnectionAuth(connection as never, next, 'dsh-tauri-rightclick')
    const req = request()
    const res = {
      end: vi.fn(),
      writeHead: vi.fn(),
    }

    await handler(req, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(503, { 'content-type': 'application/json; charset=utf-8' })
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({
      error: 'dsh-tauri-rightclick requires the DSH connection authentication gate',
    }))
    expect(next).not.toHaveBeenCalled()
  })
})
