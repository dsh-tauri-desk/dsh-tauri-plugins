import type { Context } from '@deepseek-ai/cordis'
import type { ReactElement } from 'react'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
/**
 * select.tsx — 「标准模式」右侧的会话工作模式选择器。
 *
 * 选择「新建工作树」只为下一条消息设为待创建；提交时先创建 worktree 和绑定该 cwd
 * 的新会话，再迁移草稿并调用官方 inputActions.submit()。
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleTreeIcon } from './icons'
import { NS, text, useLocale } from './locale'
import {
  attachWorktreeSession,
  createWorktree,
  patchSession,
  rememberNewSessionMode,
  useWorktreeSession,
} from './store'

interface InputState {
  draft: string
  imageIds: string[]
}

interface InputActions {
  setDraft: (text: string) => void
  addImages: (ids: string[]) => boolean
  removeImage: (id: string) => void
  submit: () => void
}

interface SessionsRuntime {
  create: (opts: { cwd: string, sessionId: string }) => Promise<string>
  open: (sessionId: string) => void
  provideInfo: (sessionId: string) => { props?: { inputActions?: InputActions } } | undefined
}

interface ModeSelectProps {
  sessionId: string
  useInput: <S>(selector: (state: InputState) => S) => S
  inputActions: InputActions
  sessionsRuntime: SessionsRuntime
}

const CHEVRON_CLASS = 'dsh-tauri-worktree-mode-chevron'

function ensureModeSelectStyles(): void {
  if (document.querySelector('style[data-plugin-css="@deepseek-ai/dsh-tauri-worktree/ModeSelect.module.css"]'))
    return
  const style = document.createElement('style')
  style.dataset.plugin = '@deepseek-ai/dsh-tauri-worktree'
  style.dataset.pluginCss = '@deepseek-ai/dsh-tauri-worktree/ModeSelect.module.css'
  style.textContent = `.${CHEVRON_CLASS} { color: var(--dsw-alias-label-caption); flex: none; }`
  document.head.appendChild(style)
}

const triggerStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  maxWidth: 240,
  minHeight: 28,
  padding: '0 8px',
  border: 'none',
  borderRadius: 16,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'var(--dsw-font-family, inherit)',
  fontSize: 13,
  fontWeight: 500,
  lineHeight: '20px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
}

export function WorktreeModeSelect(props: ModeSelectProps): ReactElement {
  const { sessionId } = props
  ensureModeSelectStyles()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [portalHost, setPortalHost] = useState<HTMLSpanElement | null>(null)

  useEffect(() => {
    const anchor = anchorRef.current
    // HARDCODE: DSH 0.1.1-rc.2 has no slot beside AgentPresetSeat, so this relies
    // on the shell's private composer marker and hero preset slot DOM placement.
    const composerSeat = anchor?.closest<HTMLElement>('[data-composer-seat]')
    if (!composerSeat)
      return

    let host: HTMLSpanElement | null = null
    const place = (): void => {
      const presetSlot = composerSeat.querySelector<HTMLElement>('[data-slot="conversation.hero.agentPreset"]')
      if (!presetSlot) {
        setPortalHost(null)
        host?.remove()
        host = null
        return
      }
      if (!host) {
        host = document.createElement('span')
        host.dataset.dshTauriWorktreeMode = sessionId
        host.style.display = 'inline-flex'
        host.style.alignItems = 'center'
      }
      if (presetSlot.nextElementSibling !== host)
        presetSlot.after(host)
      setPortalHost(host)
    }

    place()
    const observer = new MutationObserver(place)
    observer.observe(composerSeat, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      host?.remove()
    }
  }, [sessionId])

  return (
    <>
      <span ref={anchorRef} data-dsh-tauri-worktree-mode-anchor={sessionId} style={{ display: 'none' }} />
      {portalHost && createPortal(<WorktreeModeControl {...props} />, portalHost)}
    </>
  )
}

function WorktreeModeControl({ sessionId, useInput, inputActions, sessionsRuntime }: ModeSelectProps): ReactElement | null {
  const state = useWorktreeSession(sessionId)
  const draft = useInput(input => input.draft)
  const imageIds = useInput(input => input.imageIds)
  useLocale()
  const [open, setOpen] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (state.mode !== 'pending')
      return
    // HARDCODE: capture submission from the private composer DOM because the
    // current client API exposes inputActions.submit(), but no pre-submit hook.
    const root = document.querySelector<HTMLElement>(`[data-dsh-tauri-worktree-mode-anchor="${CSS.escape(sessionId)}"]`)
    const composerSeat = root?.closest<HTMLElement>('[data-composer-seat]')
    if (!composerSeat)
      return

    const start = async (): Promise<void> => {
      if (submittingRef.current || draft.trim() === '')
        return
      submittingRef.current = true
      const targetSessionId = `session-${crypto.randomUUID()}`
      patchSession(sessionId, { mode: 'pending', phase: 'creating', loadingLabel: text('progressCreating'), error: '' })
      try {
        const created = await createWorktree(targetSessionId, sessionId)
        patchSession(targetSessionId, {
          mode: 'worktree',
          phase: 'created',
          loadingLabel: text('progressCreated'),
          log: created.log,
          worktreeKey: created.worktreeKey,
          worktreePath: created.worktreePath,
          projectPath: created.projectPath,
          sourceSessionId: created.sourceSessionId,
        })
        await sessionsRuntime.create({ cwd: created.worktreePath, sessionId: targetSessionId })
        await attachWorktreeSession(targetSessionId)
        const nextActions = sessionsRuntime.provideInfo(targetSessionId)?.props?.inputActions
        if (!nextActions)
          throw new Error('新工作树会话的输入服务尚未就绪')
        nextActions.setDraft(draft)
        if (imageIds.length > 0 && !nextActions.addImages(imageIds))
          throw new Error('无法迁移消息附件到工作树会话')
        inputActions.setDraft('')
        for (const imageId of imageIds) inputActions.removeImage(imageId)
        patchSession(sessionId, { mode: 'local', phase: 'idle', loadingLabel: '' })
        sessionsRuntime.open(targetSessionId)
        // 迁移草稿后提交到新工作树会话；submit() 会在进入时同步捕获草稿/附件快照再发送。
        // 无论提交结果如何，创建了工作树就必须清空输入框内容（含附件），避免内容仍残留进后续新会话。
        queueMicrotask(() => {
          try {
            nextActions.submit()
          }
          finally {
            nextActions.setDraft('')
            for (const imageId of imageIds) nextActions.removeImage(imageId)
          }
        })
      }
      catch (error) {
        patchSession(sessionId, {
          mode: 'pending',
          phase: 'error',
          loadingLabel: '',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      finally {
        submittingRef.current = false
      }
    }

    const intercept = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Node) || !composerSeat.contains(target))
        return
      if (event instanceof MouseEvent) {
        const button = target instanceof Element ? target.closest('button[aria-label]') : null
        if (button?.getAttribute('aria-label')?.includes('发送') !== true && button?.getAttribute('aria-label')?.toLowerCase().includes('send') !== true)
          return
      }
      if (event instanceof KeyboardEvent && (event.key !== 'Enter' || event.shiftKey || event.isComposing))
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      void start()
    }

    composerSeat.addEventListener('click', intercept, true)
    composerSeat.addEventListener('keydown', intercept, true)
    return () => {
      composerSeat.removeEventListener('click', intercept, true)
      composerSeat.removeEventListener('keydown', intercept, true)
    }
  }, [draft, imageIds, inputActions, sessionId, sessionsRuntime, state.mode])

  // 非 git 目录不提供工作树：隐藏整个模式选择器，会话永远只能停留在本地模式。
  if (state.isGit === false)
    return null

  const pending = state.mode === 'pending'
  const bound = state.mode === 'worktree'
  const activeLabel = bound ? text('modeWorktree') : pending ? text('modeNewWorktree') : text('modeLocal')
  const trigger = (
    <button
      type="button"
      aria-label={text('modeLabel')}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(value => !value)}
      style={{
        ...triggerStyle,
        background: open ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = open ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent'
      }}
    >
      <span style={{ color: 'var(--dsw-alias-label-primary)', display: 'inline-flex', flex: 'none' }}>
        <CircleTreeIcon size={13} />
      </span>
      <span>{activeLabel}</span>
      <IconChevronDownOutline14 className={CHEVRON_CLASS} />
    </button>
  )

  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      items={bound
        ? [{ id: 'worktree', label: text('modeWorktree') }]
        : [
            { id: 'local', label: text('modeLocal') },
            { id: 'pending', label: text('modeWorktree') },
          ]}
      selectedId={bound ? 'worktree' : pending ? 'pending' : 'local'}
      onSelect={(id) => {
        setOpen(false)
        if (bound)
          return
        const mode = id === 'pending' ? 'pending' : 'local'
        rememberNewSessionMode(mode)
        patchSession(sessionId, {
          mode,
          phase: 'idle',
          loadingLabel: '',
          error: '',
        })
      }}
      side="bottom"
      align="start"
      portal
      anchor={trigger}
    />
  )
}

/** 使用 input.dock 的 session 生命周期，并把控件 portal 到标准模式右侧。 */
export function registerModeSelect(ctx: Context): void {
  ctx.slots.inject('conversation.input.dock' as never, () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'dsh-tauri-worktree-mode',
        order: -20,
        locale: NS,
        inject: (sessionId: string | undefined) => sessionId === undefined
          ? undefined
          : { sessionId, sessionsRuntime: ctx.sessions as unknown as SessionsRuntime },
      } as never,
      WorktreeModeSelect,
    ))
}
