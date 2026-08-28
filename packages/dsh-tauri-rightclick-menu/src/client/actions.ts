/**
 * actions.ts — 菜单项对应的业务动作：官方操作转交官方组件；插件自有能力
 * （永久删除、资源管理器打开目录、默认浏览器打开外链、剪贴板）走宿主能力。
 */
import type {
  SessionsRuntimeLike,
  SessionSummaryLike,
  WorkspacesRuntimeLike,
  WorkspaceViewLike,
} from './types'
import { DELETE_SESSION_ROUTE, HOST_OPEN_PATH_ENDPOINT, OPEN_URL_ROUTE } from './constants'
import { confirmDialog, toast } from './dialog'
import { text } from './locale'
import { externalUrl, officialAction } from './locate'

/**
 * 资源管理器打开目录：直接调用宿主 RPC host.openPath（HTTP 端点
 *  /api/host.openPath），绕过 better-sidebar 对 workspaces.openPath 的包装——
 *  否则目录会被侧边栏编辑器当文件打开（`xxx is a directory`）。
 */
export async function openInExplorer(path: string): Promise<void> {
  const response = await fetch(HOST_OPEN_PATH_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: crypto.randomUUID(),
      method: 'host.openPath',
      payload: { path },
    }),
  })
  if (!response.ok)
    throw new Error(text('openFailed', { reason: `HTTP ${response.status}` }))
  const full = await response.json()
  if (!full.result?.ok)
    throw new Error(text('openFailed', { reason: full.result?.error?.message || text('unknownError') }))
}

/** 用系统默认浏览器打开外链（插件宿主路由，只收 http/https）。 */
export async function openExternalUrl(value: string): Promise<void> {
  const url = externalUrl(value)
  if (!url)
    throw new Error(text('openFailed', { reason: text('invalidLink') }))
  const response = await fetch(OPEN_URL_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  let result: { ok?: boolean, error?: string } | null = null
  try {
    result = await response.json()
  }
  catch {}
  if (!response.ok || !result?.ok)
    throw new Error(text('openFailed', { reason: result?.error || `HTTP ${response.status}` }))
}

/** 官方菜单项选择：点击行内操作按钮后在 [role=menuitem] 中按文案点目标项。 */
async function officialSelect(row: Element, labels: RegExp[], failureMessage: string): Promise<void> {
  let action = officialAction(row)
  if (!action) {
    row.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      clientX: row.getBoundingClientRect().left + 8,
      clientY: row.getBoundingClientRect().top + 8,
    }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    action = officialAction(row)
  }
  if (!action)
    throw new Error(text('officialSessionActionUnavailable'))
  action.click()
  setTimeout(() => {
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node =>
      labels.some(label => label.test(node.textContent?.trim() || '')))
    if (!item) {
      toast(failureMessage)
      return
    }
    item.click()
  }, 0)
}

/** 重命名会话：行内有官方操作按钮时走官方重命名，否则回退插件 prompt + rename RPC。 */
export async function renameSession(
  sessions: SessionsRuntimeLike,
  row: Element,
  session: SessionSummaryLike | null,
): Promise<void> {
  if (officialAction(row)) {
    await officialSelect(row, [/^重命名$/, /^rename$/i], text('officialRenameUnavailable'))
    return
  }
  if (!session)
    throw new Error(text('sessionUnknown'))
  // 官方重命名不可用时回退原生 prompt（插件不引入额外弹窗组件）。
  // eslint-disable-next-line no-alert
  const title = globalThis.prompt(text('renameSession'), session.displayTitle || session.title || '')
  if (title === null || title.trim() === (session.title || session.displayTitle))
    return
  if (!title.trim())
    throw new Error(text('sessionNameEmpty'))
  const binding = sessions.binding(session.id)
  if (!binding)
    throw new Error(text('sessionServiceUnavailable'))
  const result = await binding.session.rename(title.trim())
  if (!result.ok)
    throw new Error(result.error?.message || text('renameFailed'))
  toast(text('sessionRenamed'))
}

/** 归档会话：优先官方归档菜单，回退 workspaces.archiveSession。 */
export async function archiveSession(
  workspaces: WorkspacesRuntimeLike,
  row: Element,
  session: SessionSummaryLike | null,
): Promise<void> {
  if (officialAction(row)) {
    await officialSelect(row, [/^归档会话$/, /^archive( session)?$/i], text('officialArchiveUnavailable'))
    return
  }
  if (!session)
    throw new Error(text('sessionUnknown'))
  await workspaces.archiveSession(session.id)
  toast(text('sessionArchived'))
}

/** 分叉会话：优先官方分叉菜单，回退 sessions.fork + open。 */
export async function forkSession(
  sessions: SessionsRuntimeLike,
  row: Element,
  session: SessionSummaryLike | null,
): Promise<void> {
  if (officialAction(row)) {
    await officialSelect(row, [/^分叉会话$/, /^fork( session)?$/i], text('officialForkUnavailable'))
    return
  }
  if (!session)
    throw new Error(text('sessionUnknown'))
  const childId = await sessions.fork({ sessionId: session.id, increaseTitle: true })
  sessions.open(childId)
}

/** 永久删除会话：插件确认框（非官方确认），确认后走宿主删除路由。 */
export async function deleteSession(session: SessionSummaryLike | null): Promise<void> {
  if (!session)
    throw new Error(text('sessionUnknown'))
  const title = session.displayTitle || session.title || session.id
  const confirmed = await confirmDialog({
    title: text('deleteSessionDialogTitle'),
    message: text('deleteSessionConfirm', { title }),
    confirmLabel: text('confirmDelete'),
    cancelLabel: text('cancel'),
  })
  if (!confirmed)
    return
  try {
    await fetch(DELETE_SESSION_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    })
  }
  catch {}
}

/** 归档整个工作区（跳过已归档的会话，确认后逐个归档）。 */
export async function archiveWorkspaceSessions(workspaces: WorkspacesRuntimeLike, workspace: WorkspaceViewLike): Promise<void> {
  const archived = new Set(workspaces.list.getSnapshot().archivedSessionIds)
  const sessionIds = workspace.sessionIds.filter(id => !archived.has(id))
  if (!sessionIds.length) {
    toast(text('noWorkspaceSessions'))
    return
  }
  // 原生 confirm：工作区批量归档确认（与源插件行为一致，不引入额外弹窗组件）。
  // eslint-disable-next-line no-alert
  if (!globalThis.confirm(text('archiveWorkspaceConfirm', { title: workspace.title, count: sessionIds.length })))
    return
  for (const id of sessionIds)
    await workspaces.archiveSession(id)
  toast(text('workspaceSessionsArchived', { count: sessionIds.length }))
}

/** 移除工作区（仅移除注册，不动目录/文件/会话日志）。 */
export async function removeWorkspace(workspaces: WorkspacesRuntimeLike, workspace: WorkspaceViewLike): Promise<void> {
  // eslint-disable-next-line no-alert
  if (!globalThis.confirm(text('removeWorkspaceConfirm', { title: workspace.title })))
    return
  await workspaces.delete(workspace.workspaceId)
  toast(text('workspaceRemoved'))
}
