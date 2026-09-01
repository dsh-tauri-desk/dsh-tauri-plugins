import { TRUST_MODE_API_PREFIX } from './constants.js'

/** 信任模式状态。 */
export interface TrustModeStatus {
  enabled: boolean
}

/** 设置结果。 */
export interface TrustModeSetResult {
  ok: boolean
  enabled: boolean
}

/** 同源 JSON 请求封装。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TRUST_MODE_API_PREFIX}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`请求失败 (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

/** 读取信任模式当前状态。 */
export function fetchTrustModeStatus(): Promise<TrustModeStatus> {
  return request<TrustModeStatus>('/status')
}

/** 开启/关闭信任模式。 */
export function setTrustMode(enabled: boolean): Promise<TrustModeSetResult> {
  return request<TrustModeSetResult>('/set', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}
