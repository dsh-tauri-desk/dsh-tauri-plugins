import type { Context } from '@deepseek-ai/cordis'
import type { ReactElement } from 'react'
import type { WorkspaceSessionOrder } from './session'
/**
 * dialog.tsx — 检出本地 / 放弃更改 两个模态框（shell.overlay 条目）。
 *
 * 需求：
 *   - 检出本地：标题「将更改带回本地检出并继续」；分支名输入框预填 `dsh/`；
 *     显示「当前关联路径 [hash]/[dirname]」与「目标项目路径 [项目路径]」；
 *     按钮「确认检出并合并 / 取消」。
 *   - 放弃更改：标题「放弃工作树更改」；确认文本「确认放弃吗？这将删除当前会话及
 *     对应的临时工作树。」；按钮「确认放弃（危险）/ 取消」。
 *
 * 两个弹窗由 store 的 checkoutOpen / abandonOpen 驱动；均渲染为 shell.overlay
 * 下的居中模态（层本身 click-through，条目 opt-in pointer events）。
 */
import { useEffect } from 'react'
import { text, useLocale } from './locale'
import { resolveWorkspaceTopInsertion } from './session'
import { applyCheckout, applyDiscard, patchSession, useWorktreeSession } from './store'

interface WorkspacesRuntime {
  archiveSession: (sessionId: string) => Promise<void>
  list: { getSnapshot: () => { items: WorkspaceSessionOrder[] } }
  insertSessionBefore: (workspaceId: string, sessionId: string, beforeSessionId?: string) => Promise<unknown>
}

/** 本条目收到的合成 props 子集。 */
interface WorktreedialogProps {
  useSessions: <S>(sel: (state: DialogListState) => S) => S
  sessionsRuntime: {
    open: (sessionId: string) => void
    refresh: () => Promise<void>
    list: { getSnapshot: () => { current?: string, ids: string[] } }
  }
  workspacesRuntime: WorkspacesRuntime
}

/** 会话列表快照局部形状。 */
interface DialogListState {
  phase: string
  current?: string
  byId: Record<string, unknown>
}

const modalWrapStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1000,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(0,0,0,0.4)',
}

const cardStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 'min(460px, calc(100vw - 48px))',
  padding: '20px 22px',
  borderRadius: 16,
  background: 'var(--dsw-alias-bg-base)',
  color: 'var(--dsw-alias-label-primary)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  lineHeight: '24px',
  margin: 0,
}

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
  margin: 0,
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
}

const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.06))',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 36,
  padding: '0 10px',
  border: 'none',
  background: 'none',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
}

const pathRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 12,
  lineHeight: '18px',
}

const pathKeyStyle: React.CSSProperties = {
  flex: 'none',
  color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
}

const pathValStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'monospace',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 4,
}

const btnBase: React.CSSProperties = {
  boxSizing: 'border-box',
  height: 36,
  padding: '0 16px',
  border: 'none',
  borderRadius: 10,
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnGhost: React.CSSProperties = {
  ...btnBase,
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
}

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  color: '#fff',
  background: 'var(--dsw-alias-bg-accent, #2f6feb)',
}

const btnDanger: React.CSSProperties = {
  ...btnBase,
  color: '#fff',
  background: '#c0392b',
}

/**
 * 检出本地 / 放弃 弹窗组件（读 store 的 checkoutOpen / abandonOpen 决定渲染哪个）。
 * @param props - 复合槽位 props。
 * @param props.useSessions - 标准钩子：会话列表快照（取当前会话 id）。
 * @param props.workspacesRuntime - 宿主工作区运行时（归档会话）。
 * @param props.sessionsRuntime - 宿主会话运行时（打开继承会话）。
 * @returns 居中模态（无打开项时返回 null）。
 */
export function Worktreedialog({ useSessions, workspacesRuntime, sessionsRuntime }: WorktreedialogProps): ReactElement | null {
  useLocale()
  const sessionId = useSessions(state => state.current)
  const state = useWorktreeSession(sessionId)
  const checkout = state.checkoutOpen
  const abandon = state.abandonOpen
  const closeAll = (): void => patchSession(sessionId, { checkoutOpen: false, abandonOpen: false })

  // Hook 必须在所有 render 中保持相同顺序；仅打开弹窗时安装 Esc 监听。
  useEffect(() => {
    if (!sessionId || (!checkout && !abandon))
      return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape')
        closeAll()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sessionId, checkout, abandon])

  if (!sessionId || (!checkout && !abandon))
    return null

  return (
    <div style={modalWrapStyle} data-dsh-worktree-dialog="1" onClick={closeAll}>
      {checkout && (
        <CheckoutDialog
          sessionId={sessionId}
          worktreeKey={state.worktreeKey}
          projectPath={state.projectPath}
          branchName={state.branchName}
          error={state.error}
          workspacesRuntime={workspacesRuntime}
          sessionsRuntime={sessionsRuntime}
          onCancel={closeAll}
        />
      )}
      {abandon && (
        <AbandonDialog
          sessionId={sessionId}
          worktreeKey={state.worktreeKey}
          error={state.error}
          workspacesRuntime={workspacesRuntime}
          onCancel={closeAll}
        />
      )}
    </div>
  )
}

function CheckoutDialog(props: {
  sessionId: string
  worktreeKey: string
  projectPath: string
  branchName: string
  error: string
  workspacesRuntime: WorkspacesRuntime
  sessionsRuntime: {
    open: (sessionId: string) => void
    refresh: () => Promise<void>
    list: { getSnapshot: () => { current?: string, ids: string[] } }
  }
  onCancel: () => void
}): ReactElement {
  const { sessionId, worktreeKey, projectPath, workspacesRuntime, sessionsRuntime, onCancel } = props
  const branchName = props.branchName || 'dsh/'
  const disabled = branchName.trim() === '' || branchName.trim().endsWith('/')

  const updateBranch = (value: string): void => patchSession(sessionId, { branchName: value })
  const waitUntilListed = async (targetSessionId: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await sessionsRuntime.refresh()
        if (sessionsRuntime.list.getSnapshot().ids.includes(targetSessionId))
          return true
      }
      catch {}
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    return false
  }
  const openAndConfirm = async (targetSessionId: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        sessionsRuntime.open(targetSessionId)
        if (sessionsRuntime.list.getSnapshot().current === targetSessionId)
          return true
      }
      catch {
        await sessionsRuntime.refresh().catch(() => {})
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }
  const promoteToWorkspaceTop = async (targetSessionId: string): Promise<void> => {
    const insertion = resolveWorkspaceTopInsertion(
      workspacesRuntime.list.getSnapshot().items,
      projectPath,
      targetSessionId,
    )
    if (!insertion)
      return
    await workspacesRuntime.insertSessionBefore(
      insertion.workspaceId,
      targetSessionId,
      insertion.beforeSessionId,
    )
  }
  const checkout = async (): Promise<void> => {
    const result = await applyCheckout(sessionId, worktreeKey, branchName.trim())
    if (!result.ok)
      return
    if (!result.targetSessionId) {
      patchSession(sessionId, { checkoutOpen: false })
      return
    }
    const listed = await waitUntilListed(result.targetSessionId)
    if (!listed) {
      patchSession(sessionId, { error: `Local session ${result.targetSessionId} was created but did not appear in the session list.` })
      return
    }
    await promoteToWorkspaceTop(result.targetSessionId).catch(() => {})
    await workspacesRuntime.archiveSession(sessionId)
    const opened = await openAndConfirm(result.targetSessionId)
    if (!opened)
      patchSession(sessionId, { error: `Local session ${result.targetSessionId} could not be selected.` })
  }

  return (
    <div
      style={cardStyle}
      role="dialog"
      aria-modal="true"
      aria-label={text('checkoutTitle')}
      onClick={event => event.stopPropagation()}
    >
      <h2 style={titleStyle}>{text('checkoutTitle')}</h2>
      <div style={fieldStyle}>
        <label style={fieldLabelStyle} htmlFor="wt-checkout-branch">{text('checkoutBranchLabel')}</label>
        <div style={inputWrapStyle}>
          <input
            id="wt-checkout-branch"
            style={inputStyle}
            value={branchName}
            placeholder="dsh/feature-xyz"
            onChange={event => updateBranch(event.target.value)}
          />
        </div>
      </div>
      <div style={pathRowStyle}>
        <span style={pathKeyStyle}>{text('checkoutCurrentPath')}</span>
        <span style={pathValStyle}>{worktreeKey || '—'}</span>
      </div>
      <div style={pathRowStyle}>
        <span style={pathKeyStyle}>{text('checkoutTargetPath')}</span>
        <span style={pathValStyle}>{projectPath.replaceAll('\\', '/') || '—'}</span>
      </div>
      {props.error && <div style={{ fontSize: 12, lineHeight: '18px', color: '#c0392b' }}>{props.error}</div>}
      <div style={footerStyle}>
        <button type="button" style={btnGhost} onClick={onCancel}>{text('checkoutCancel')}</button>
        <button
          type="button"
          style={{ ...btnPrimary, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          disabled={disabled}
          onClick={() => void checkout()}
        >
          {text('checkoutConfirm')}
        </button>
      </div>
    </div>
  )
}

function AbandonDialog(props: {
  sessionId: string
  worktreeKey: string
  error: string
  workspacesRuntime: Pick<WorkspacesRuntime, 'archiveSession'>
  onCancel: () => void
}): ReactElement {
  const { sessionId, worktreeKey, workspacesRuntime, onCancel } = props
  const abandon = async (): Promise<void> => {
    const result = await applyDiscard(sessionId, worktreeKey)
    if (!result.ok)
      return
    // 不显式打开源会话：官方 archiveSession 投影会清空当前选择，回到
    // 「选择一个工作区开始」默认界面；显式 open 会触发工作区新建/复用 blank 会话。
    await workspacesRuntime.archiveSession(sessionId)
  }
  return (
    <div
      style={cardStyle}
      role="dialog"
      aria-modal="true"
      aria-label={text('abandonTitle')}
      onClick={event => event.stopPropagation()}
    >
      <h2 style={titleStyle}>{text('abandonTitle')}</h2>
      <p style={bodyStyle}>{text('abandonBody')}</p>
      {props.error && <div style={{ fontSize: 12, lineHeight: '18px', color: '#c0392b' }}>{props.error}</div>}
      <div style={footerStyle}>
        <button type="button" style={btnGhost} onClick={onCancel}>{text('abandonCancel')}</button>
        <button
          type="button"
          style={btnDanger}
          onClick={() => void abandon()}
        >
          {text('abandonConfirm')}
        </button>
      </div>
    </div>
  )
}

/**
 * 注册：shell.overlay（list）新增一个条目，渲染检出/放弃弹窗。
 * @param ctx - 客户端根上下文。
 */
export function registerdialog(ctx: Context): void {
  ctx.effect(
    () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'dsh-tauri-worktree-dialog',
          registrant: 'dsh-tauri-worktree',
          inject: () => ({
            workspacesRuntime: ctx.workspaces,
            sessionsRuntime: ctx.sessions,
          }),
        },
        Worktreedialog,
      ),
    'dsh-tauri-worktree: dialog',
  )
}
