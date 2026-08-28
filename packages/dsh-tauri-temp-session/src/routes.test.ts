import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ExactRoute } from './types'
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVE_BODY_LIMIT } from './constants'
import { createReserveRoute } from './routes'

class FakeRequest {
  method: string | undefined
  socket: { remoteAddress: string }
  private body: string
  private dataHandlers: Array<(chunk: string) => void> = []
  private endHandlers: Array<() => void> = []

  constructor(method = 'POST', remoteAddress = '127.0.0.1', body = '{}') {
    this.method = method
    this.socket = { remoteAddress }
    this.body = body
  }

  on(event: string, handler: (arg?: unknown) => void): void {
    if (event === 'data')
      this.dataHandlers.push(handler as (chunk: string) => void)
    if (event === 'end')
      this.endHandlers.push(handler as () => void)
  }

  emitBody(): void {
    for (const handler of this.dataHandlers)
      handler(this.body)
    for (const handler of this.endHandlers)
      handler()
  }

  destroy(): void {}
}

class FakeResponse {
  statusCode = 0
  body: string | undefined

  writeHead(code: number, _headers: Record<string, string>): void {
    this.statusCode = code
  }

  end(payload?: string): void {
    this.body = payload
  }
}

function dispatch(route: ExactRoute, req: FakeRequest): Promise<FakeResponse> {
  const res = new FakeResponse()
  const done = route.handler(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  req.emitBody()
  return done.then(() => res)
}

describe('createReserveRoute', () => {
  it('answers OPTIONS with 204', async () => {
    const route = createReserveRoute('/tmp/unused')
    const res = await dispatch(route, new FakeRequest('OPTIONS'))
    expect(res.statusCode).toBe(204)
  })

  it('rejects non-POST methods with 405', async () => {
    const route = createReserveRoute('/tmp/unused')
    const res = await dispatch(route, new FakeRequest('GET'))
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body!)).toMatchObject({ ok: false })
  })

  it('rejects non-loopback callers with 403', async () => {
    const route = createReserveRoute('/tmp/unused')
    const res = await dispatch(route, new FakeRequest('POST', '10.1.2.3'))
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body!)).toMatchObject({ ok: false })
  })

  it('reserves a fresh session directory on POST', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-tauri-temp-session-test-'))
    const route = createReserveRoute(tempRoot)
    const res = await dispatch(route, new FakeRequest())
    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(res.body!) as { ok: boolean, sessionId: string, cwd: string }
    expect(payload.ok).toBe(true)
    expect(payload.sessionId.startsWith('session-')).toBe(true)
    expect(payload.cwd.startsWith(tempRoot)).toBe(true)
    expect(existsSync(payload.cwd)).toBe(true)
  })

  it('rejects oversized bodies with 413', async () => {
    const route = createReserveRoute('/tmp/unused')
    const oversized = 'x'.repeat(RESERVE_BODY_LIMIT + 1)
    const res = await dispatch(route, new FakeRequest('POST', '127.0.0.1', oversized))
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body!)).toMatchObject({ ok: false })
  })

  it('exposes the exact reserve path under the plugin prefix', () => {
    const route = createReserveRoute('/tmp/unused')
    expect(route.kind).toBe('exact')
    expect(route.path).toBe('/api/dsh-tauri-temp-session/reserve')
  })

  it('creates the temp root recursively when missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'dsh-tauri-temp-session-test-'))
    const tempRoot = join(base, 'nested', 'tmp-sessions')
    const route = createReserveRoute(tempRoot)
    const res = await dispatch(route, new FakeRequest())
    expect(res.statusCode).toBe(200)
    expect(existsSync(tempRoot)).toBe(true)
  })
})
