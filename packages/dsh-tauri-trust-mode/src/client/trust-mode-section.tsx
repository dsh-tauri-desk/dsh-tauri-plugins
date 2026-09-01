import type { ReactElement } from 'react'
import type { TrustModeSectionProps } from './types.js'
import { useEffect, useState } from 'react'
import { text, useLocale } from './locale.js'
import { fetchTrustModeStatus, setTrustMode } from './store.js'

/**
 * 设置分区内容：信任模式开关。
 *
 * 组件由 dsh-tauri-ui 的 settings.section 槽渲染，仅接收 ownerProps.close；
 * 状态经 /api/dsh-trust-mode/status 拉取、经 /set 切换，与宿主侧 settings.yaml 同步。
 * @param _props - 标准钩子（close 由槽宿主注入，本组件未直接消费）。
 * @returns 分区内容。
 */
export function TrustModeSection(_props: TrustModeSectionProps): ReactElement {
  useLocale()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchTrustModeStatus()
      .then((status) => {
        if (!cancelled)
          setEnabled(status.enabled)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(): Promise<void> {
    if (enabled === null || busy)
      return
    setBusy(true)
    setError('')
    try {
      const next = !enabled
      const result = await setTrustMode(next)
      setEnabled(result.enabled)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <div className="dshtm-section">
      <div className="dshtm-row">
        <div className="dshtm-head">
          <h3 className="dshtm-title">{text('trustMode')}</h3>
        </div>
        <span className="dshtm-spacer" />
        <button
          type="button"
          className="dshtm-switch"
          role="switch"
          aria-checked={enabled === true}
          aria-label={text('trustModeHint')}
          title={text('trustModeHint')}
          disabled={enabled === null || busy}
          onClick={() => void toggle()}
        >
          <span className="dshtm-knob" />
        </button>
      </div>
      <p className="dshtm-desc">{text('trustModeDesc')}</p>
      {enabled !== null && !error && (
        <p className="dshtm-status">{enabled ? text('trustModeOn') : text('trustModeOff')}</p>
      )}
      {busy && <p className="dshtm-status">{text('saving')}</p>}
      {error && <p className="dshtm-error">{`${text('error')}: ${error}`}</p>}
    </div>
  )
}
