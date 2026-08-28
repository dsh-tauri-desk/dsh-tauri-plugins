/** Context menu / toast / confirm dialog styles generated as css-render nodes. */
import { CssRender } from 'css-render'
import { RIGHTCLICK_CLASSES as K, RIGHTCLICK_STYLE_ID } from './constants'

const cssr = CssRender()
const { c } = cssr

const rightClickStyle = c([
  c(`.${K.menu}`, {
    position: 'fixed',
    zIndex: 2147483647,
    width: 'max-content',
    minWidth: '148px',
    maxWidth: '260px',
    padding: '4px',
    background: 'var(--dsw-alias-bg-layer-2, #fff)',
    color: 'var(--dsw-alias-label-primary, #161616)',
    border: '1px solid var(--dsw-alias-border-l2, #ddd)',
    borderRadius: '7px',
    boxShadow: '0 5px 16px #00000029',
    font: '13px/18px system-ui, sans-serif',
  }),
  c(`.${K.item}`, {
    boxSizing: 'border-box',
    width: '100%',
    height: '30px',
    padding: '0 8px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    color: 'inherit',
    background: 'transparent',
    border: '0',
    borderRadius: '5px',
    cursor: 'pointer',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    justifyContent: 'space-between',
  }, [
    c('&:hover, &:focus-visible', {
      background: 'var(--dsw-alias-interactive-bg-hover, #0000000f)',
      outline: 'none',
    }),
  ]),
  c(`.${K.itemDanger}`, {
    color: 'var(--dsw-alias-state-error-primary, #d93025)',
  }),
  c(`.${K.shortcut}`, {
    color: 'var(--dsw-alias-label-tertiary, #777)',
    fontSize: '11px',
  }),
  c(`.${K.separator}`, {
    height: '1px',
    margin: '4px -4px',
    background: 'var(--dsw-alias-border-l2, #ddd)',
  }),
  c(`.${K.toast}`, {
    position: 'fixed',
    zIndex: 2147483647,
    left: '50%',
    bottom: '28px',
    transform: 'translateX(-50%)',
    padding: '7px 12px',
    borderRadius: '7px',
    background: '#222',
    color: '#fff',
    font: '13px/18px system-ui, sans-serif',
    boxShadow: '0 6px 20px #0003',
  }),
  c(`.${K.dialogBackdrop}`, {
    position: 'fixed',
    zIndex: 2147483647,
    inset: '0',
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: '#0006',
  }),
  c(`.${K.dialog}`, {
    boxSizing: 'border-box',
    width: 'min(420px, 100%)',
    padding: '20px',
    background: 'var(--dsw-alias-bg-layer-2, #fff)',
    color: 'var(--dsw-alias-label-primary, #161616)',
    border: '1px solid var(--dsw-alias-border-l2, #ddd)',
    borderRadius: '12px',
    boxShadow: '0 18px 50px #0005',
    font: '14px/21px system-ui, sans-serif',
  }),
  c(`.${K.dialogTitle}`, {
    margin: '0 0 10px',
    fontSize: '17px',
    lineHeight: '24px',
    fontWeight: 650,
  }),
  c(`.${K.dialogMessage}`, {
    margin: '0',
    whiteSpace: 'pre-line',
    color: 'var(--dsw-alias-label-secondary, #555)',
  }),
  c(`.${K.dialogActions}`, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '22px',
  }),
  c(`.${K.dialogButton}`, {
    minWidth: '72px',
    height: '34px',
    padding: '0 14px',
    border: '1px solid var(--dsw-alias-border-l2, #ccc)',
    borderRadius: '7px',
    background: 'var(--dsw-alias-bg-layer-1, #fff)',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
  }, [
    c('&:hover, &:focus-visible', {
      background: 'var(--dsw-alias-interactive-bg-hover, #0000000f)',
      outline: '2px solid var(--dsw-alias-state-focus, #6b9eff)',
      outlineOffset: '1px',
    }),
  ]),
  c(`.${K.dialogConfirm}`, {
    borderColor: 'transparent',
    background: 'var(--dsw-alias-state-error-primary, #d93025)',
    color: '#fff',
  }, [
    c('&:hover, &:focus-visible', {
      background: 'var(--dsw-alias-state-error-primary, #c5221f)',
    }),
  ]),
])

/** 挂载右键菜单样式；若已由其他生命周期挂载则不取得所有权。 */
export function mountRightClickStyles(): () => void {
  if (typeof document === 'undefined')
    return () => {}
  if (cssr.find(RIGHTCLICK_STYLE_ID) !== null)
    return () => {}
  rightClickStyle.mount({ id: RIGHTCLICK_STYLE_ID, head: true })
  return () => rightClickStyle.unmount({ id: RIGHTCLICK_STYLE_ID })
}
