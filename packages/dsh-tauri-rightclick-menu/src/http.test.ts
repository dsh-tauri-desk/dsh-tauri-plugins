import { describe, expect, it } from 'vitest'
import { isSameOriginJsonRequest } from './http'

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
