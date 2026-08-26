import type { Context } from '@deepseek-ai/cordis'
import type { ReactElement } from 'react'
/**
 * surface.tsx — 聊天框正上方、仅会话内容区内的工作树状态条。
 */
import { useState } from 'react'
import { CircleTreeIcon } from './icons'
import { text, useLocale } from './locale'
import { patchSession, useWorktreeSession } from './store'

interface SurfaceBarProps {
  sessionId: string
}

const surfaceStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 'calc(100% - 2 * var(--dsh-composer-side-clearance) - 4 * var(--dsh-composer-dock-inset))',
  maxWidth: 'calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset))',
  margin: '0 auto',
  alignSelf: 'center',
}

const barStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  position: 'relative',
  height: 36,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '4px 5px 4px 12px',
  margin: '0 auto',
  border: '1px solid var(--dsw-alias-border-l1)',
  borderRadius: 12,
  background: 'var(--dsw-specific-tip)',
  color: 'var(--dsw-alias-label-primary)',
  pointerEvents: 'auto',
}

const actionStyle: React.CSSProperties = {
  height: 26,
  padding: '0 10px',
  border: 'none',
  borderRadius: 7,
  fontFamily: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
  whiteSpace: 'nowrap',
}

export function WorktreeSurface({ sessionId }: SurfaceBarProps): ReactElement | null {
  useLocale()
  const state = useWorktreeSession(sessionId)
  const [logOpen, setLogOpen] = useState(false)

  if (state.phase === 'idle' || state.mode === 'local')
    return null

  const creating = state.phase === 'creating'
  const failed = state.phase === 'error'
  const bound = state.mode === 'worktree'
  const label = creating
    ? state.loadingLabel || text('progressCreating')
    : failed
      ? `${text('progressError')}${state.error ? `: ${state.error}` : ''}`
      : text('surfaceWorktree')

  return (
    <div style={surfaceStyle}>
      <div style={barStyle} data-dsh-worktree-surface={sessionId}>
        <CircleTreeIcon size={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500 }}>
            {label}
            {creating && `...`}
          </span>
          {bound && state.log.length > 0 && (
            <button type="button" style={{ ...actionStyle, padding: 0, fontSize: 13, background: 'transparent', textDecoration: 'underline' }} onClick={() => setLogOpen(value => !value)}>
              {text('progressViewLogs')}
            </button>
          )}
        </div>
        <span style={{ flex: 1 }} />
        {bound && (
          <>
            <button type="button" style={actionStyle} onClick={() => patchSession(sessionId, { checkoutOpen: true })}>
              {text('surfaceCheckout')}
            </button>
            <button type="button" style={{ ...actionStyle, color: 'var(--dsw-alias-danger-foreground, #c0392b)', background: 'transparent' }} onClick={() => patchSession(sessionId, { abandonOpen: true })}>
              {text('surfaceAbandon')}
            </button>
          </>
        )}
      </div>
      <Logs log={state.log} open={logOpen} />
    </div>
  )
}

export function Logs({ log, open }: { log: string[], open: boolean }): ReactElement {
  return (
    <div
      aria-hidden={!open}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transition: 'grid-template-rows 180ms cubic-bezier(.16, 1, .3, 1), opacity 140ms ease',
      }}
    >
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: 180, overflowY: 'auto', padding: 10, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)', zIndex: 30 }}>
          {log.map((line, index) => <div key={`${index}:${line}`} style={{ fontSize: 12, fontFamily: 'cursive', lineHeight: '16px' }}>{line}</div>)}
        </div>
      </div>
    </div>
  )
}

/** input.dock 正位于 inputBar 上方，宽度天然受右侧会话内容区约束。 */
export function registerSurfaceBar(ctx: Context): void {
  ctx.slots.inject('conversation.input.dock' as never, () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'dsh-tauri-worktree-surface',
        order: -10,
        inject: (sessionId: string | undefined) => sessionId === undefined ? undefined : { sessionId },
      } as never,
      WorktreeSurface,
    ))
}
