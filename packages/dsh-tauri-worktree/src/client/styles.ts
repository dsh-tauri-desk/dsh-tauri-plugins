import { CssRender } from 'css-render'
import { WORKTREE_STYLE_ID, worktreeStyles } from './constants'

export { worktreeStyles } from './constants'

export function mountWorktreeStyles(): () => void {
  if (typeof document === 'undefined')
    return () => {}
  const cssr = CssRender()
  if (cssr.find(WORKTREE_STYLE_ID) !== null)
    return () => {}
  const { c } = cssr
  const s = worktreeStyles
  const style = c([
    c(`.${s.surface}`, { boxSizing: 'border-box', width: 'calc(100% - 2 * var(--dsh-composer-side-clearance) - 4 * var(--dsh-composer-dock-inset))', maxWidth: 'calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset))', margin: '0 auto', alignSelf: 'center' }),
    c(`.${s.surfaceBar}`, { boxSizing: 'border-box', width: '100%', position: 'relative', height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 5px 4px 12px', margin: '0 auto', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 12, background: 'var(--dsw-specific-tip)', color: 'var(--dsw-alias-label-primary)', pointerEvents: 'auto' }),
    c(`.${s.surfaceContent}`, { display: 'flex', alignItems: 'center', gap: 5 }),
    c(`.${s.surfaceLabel}`, { fontSize: 13, lineHeight: '20px', fontWeight: 500 }),
    c(`.${s.action}`, { height: 26, padding: '0 10px', border: 'none', borderRadius: 7, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))', whiteSpace: 'nowrap' }),
    c(`.${s.actionLog}`, { padding: 0, fontSize: 13, background: 'transparent', textDecoration: 'underline' }),
    c(`.${s.actionDanger}`, { color: 'var(--dsw-alias-danger-foreground, #c0392b)', background: 'transparent' }),
    c(`.${s.spacer}`, { flex: 1 }),
    c(`.${s.logs}`, { display: 'grid', gridTemplateRows: '0fr', opacity: 0, transition: 'grid-template-rows 180ms cubic-bezier(.16, 1, .3, 1), opacity 140ms ease' }),
    c(`.${s.logsOpen}`, { gridTemplateRows: '1fr', opacity: 1 }),
    c(`.${s.logsInner}`, { minHeight: 0, overflow: 'hidden' }),
    c(`.${s.logsPanel}`, { maxHeight: 180, overflowY: 'auto', padding: 10, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)', zIndex: 30 }),
    c(`.${s.logLine}`, { fontSize: 12, fontFamily: 'cursive', lineHeight: '16px' }),
    c(`.${s.modal}`, { position: 'absolute', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.4)' }),
    c(`.${s.card}`, { boxSizing: 'border-box', width: 'min(460px, calc(100vw - 48px))', padding: '20px 22px', borderRadius: 16, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 14 }),
    c(`.${s.title}`, { fontSize: 16, fontWeight: 600, lineHeight: '24px', margin: 0 }),
    c(`.${s.body}`, { fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))', margin: 0 }),
    c(`.${s.field}`, { display: 'flex', flexDirection: 'column', gap: 6 }),
    c(`.${s.fieldLabel}`, { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))' }),
    c(`.${s.inputWrap}`, { display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))', borderRadius: 10, overflow: 'hidden', background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.06))' }),
    c(`.${s.input}`, { flex: 1, minWidth: 0, height: 36, padding: '0 10px', border: 'none', background: 'none', color: 'var(--dsw-alias-label-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }),
    c(`.${s.pathRow}`, { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, lineHeight: '18px' }),
    c(`.${s.pathKey}`, { flex: 'none', color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))' }),
    c(`.${s.pathValue}`, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }),
    c(`.${s.error}`, { fontSize: 12, lineHeight: '18px', color: '#c0392b' }),
    c(`.${s.footer}`, { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }),
    c(`.${s.button}`, { boxSizing: 'border-box', height: 36, padding: '0 16px', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }),
    c(`.${s.buttonGhost}`, { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))' }),
    c(`.${s.buttonPrimary}`, { color: '#fff', background: 'var(--dsw-alias-bg-accent, #2f6feb)' }),
    c(`.${s.buttonDanger}`, { color: '#fff', background: '#c0392b' }),
    c(`.${s.buttonDisabled}`, { opacity: 0.5, cursor: 'not-allowed' }),
  ])
  style.mount({ id: WORKTREE_STYLE_ID, head: true })
  return () => style.unmount({ id: WORKTREE_STYLE_ID })
}
