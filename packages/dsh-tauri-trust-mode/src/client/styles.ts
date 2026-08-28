/**
 * styles.ts — 信任模式分区样式（css-render 对象树，零内联样式、零 raw CSS）。
 *
 * 仅保留一个开关（switch）与分区排版所需的 CSS 变量与类。样式只在 apply() 的
 * effect 中挂载，disposer 只卸载本生命周期实际拥有的那份。
 */
import { CssRender } from 'css-render'
import { TRUST_MODE_STYLE_ID } from './constants.js'

const primary = 'var(--dsw-alias-label-primary)'
const secondary = 'var(--dsw-alias-label-secondary)'
const tertiary = 'var(--dsw-alias-label-tertiary)'
const border = 'var(--dsw-alias-border-l2)'
const business = 'var(--dsw-alias-state-business-primary)'
const layer1 = 'var(--dsw-alias-bg-layer-1)'

/** 挂载信任模式分区样式，返回 disposer。 */
export function mountTrustModeStyles(): () => void {
  if (typeof document === 'undefined')
    return () => {}
  const cssr = CssRender()
  if (cssr.find(TRUST_MODE_STYLE_ID) !== null)
    return () => {}
  const { c } = cssr
  const style = c([
    c('.dshtm-section', { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '760px', color: primary }),
    c('.dshtm-row', { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }),
    c('.dshtm-head', { display: 'flex', alignItems: 'center', gap: '10px' }),
    c('.dshtm-title', { margin: '0', fontSize: '15px', lineHeight: '22px', fontWeight: '600' }),
    c('.dshtm-spacer', { flex: '1', minWidth: '8px' }),
    c('.dshtm-switch', { position: 'relative', flex: 'none', width: '30px', height: '18px', border: '0', borderRadius: '999px', background: layer1, boxShadow: `inset 0 0 0 1px ${border}`, cursor: 'pointer' }),
    c('.dshtm-switch[aria-checked=\'true\']', { background: `color-mix(in srgb,${business} 55%,transparent)`, boxShadow: 'none' }),
    c('.dshtm-knob', { position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px', borderRadius: '50%', background: primary, transition: 'left .15s' }),
    c('.dshtm-switch[aria-checked=\'true\'] .dshtm-knob', { left: '14px', background: '#fff' }),
    c('.dshtm-switch:disabled', { opacity: '.6', cursor: 'default' }),
    c('.dshtm-desc', { margin: '0', fontSize: '13px', lineHeight: '20px', color: tertiary }),
    c('.dshtm-status', { fontSize: '12px', lineHeight: '18px', color: secondary }),
    c('.dshtm-error', { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-danger-primary, #e5484d)' }),
  ])
  style.mount({ id: TRUST_MODE_STYLE_ID, head: true })
  return () => style.unmount({ id: TRUST_MODE_STYLE_ID })
}
