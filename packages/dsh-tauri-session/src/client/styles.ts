/** Archive page styles generated as css-render nodes. */
import { CssRender } from 'css-render'
import { SESSION_CLASSES as K, SESSION_STYLE_ID } from './constants'

const cssr = CssRender()
const { c } = cssr

const archiveStyle = c([
  c(`.${K.page}`, {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '100%',
    color: 'var(--dsw-alias-label-primary)',
  }),
  c(`.${K.header}`, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  }),
  c(`.${K.title}`, {
    margin: 0,
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 600,
  }),
  c(`.${K.deleteAll}`, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxSizing: 'border-box',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '10px',
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
    color: 'var(--dsw-alias-danger-text, var(--dsw-alias-label-primary))',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: '20px',
  }, [
    c('&:hover', { background: 'var(--dsw-alias-interactive-bg-hover)' }),
  ]),
  c(`.${K.toolbar}`, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  }),
  c(`.${K.search}`, {
    flex: '1 1 220px',
    minWidth: 0,
    boxSizing: 'border-box',
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))',
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
    color: 'var(--dsw-alias-label-primary)',
    fontFamily: 'inherit',
    fontSize: '14px',
    outline: 'none',
  }),
  c(`.${K.select}`, {
    boxSizing: 'border-box',
    height: '36px',
    padding: '0 10px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))',
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
    color: 'var(--dsw-alias-label-primary)',
    fontFamily: 'inherit',
    fontSize: '14px',
    outline: 'none',
  }),
  c(`.${K.groups}`, {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  }),
  c(`.${K.group}`, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }),
  c(`.${K.groupHeader}`, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 2px',
  }),
  c(`.${K.groupTitle}`, {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 500,
    color: 'var(--dsw-alias-label-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  c(`.${K.groupCount}`, {
    fontSize: '13px',
    lineHeight: '20px',
    color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
  }),
  c(`.${K.list}`, {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.2))',
    borderRadius: '12px',
    overflow: 'hidden',
  }),
  c(`.${K.row}`, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    padding: '12px 16px',
    background: 'var(--dsw-alias-bg-base)',
    minHeight: '56px',
  }, [
    c('& + &', { borderTop: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.2))' }),
    c('&:hover', { background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.06))' }),
  ]),
  c(`.${K.rowTitle}`, {
    flex: '1 1 auto',
    minWidth: 0,
    fontSize: '14px',
    lineHeight: '22px',
    color: 'var(--dsw-alias-label-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  c(`.${K.rowMeta}`, {
    flex: 'none',
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
  }),
  c(`.${K.unarchive}`, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    flex: 'none',
    boxSizing: 'border-box',
    padding: '6px 12px',
    border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))',
    borderRadius: '10px',
    background: 'none',
    color: 'var(--dsw-alias-label-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: '20px',
  }, [
    c('&:hover', { background: 'var(--dsw-alias-interactive-bg-hover)' }),
  ]),
  c(`.${K.empty}`, {
    padding: '32px 0',
    textAlign: 'center',
    fontSize: '14px',
    lineHeight: '22px',
    color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
  }),
  c(`.${K.error}`, {
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
    color: 'var(--dsw-alias-danger-text, var(--dsw-alias-label-primary))',
    fontSize: '13px',
    lineHeight: '20px',
  }),
])

export function mountSessionStyles(): () => void {
  if (typeof document === 'undefined')
    return () => {}
  if (cssr.find(SESSION_STYLE_ID) !== null)
    return () => {}
  archiveStyle.mount({ id: SESSION_STYLE_ID, head: true })
  return () => archiveStyle.unmount({ id: SESSION_STYLE_ID })
}
