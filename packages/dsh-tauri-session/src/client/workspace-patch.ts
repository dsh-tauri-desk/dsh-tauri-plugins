/**
 * workspace-patch.ts — 把官方工作区浏览器里的「删除工作区」替换为「归档工作区」，
 * 并把已归档会话行隐藏出工作区组（本项目自持有归档集合，官方浏览器并不知道它）。
 *
 * 与 dsh-tauri-worktree 的 session.ts 同法（零结构补丁）：官方的 WorkspaceBrowser
 * 是 `sidebar.workspaces` 单槽、**没有** per-workspace / per-row 的注入槽，只能按
 * 语义结构（[role=treeitem]）+ React Fiber key 定位。本文件做三件事：
 *   1. 定位「删除工作区」按钮 → 改文案为「归档工作区」，capture 阶段拦截点击，
 *      改为「归档该工作区全部会话」；
 *   2. 订阅归档 store，把归档集合中的会话行隐藏（display:none），取消归档则恢复；
 *   3. 用 MutationObserver 在官方重渲染后重扫，保证替换不被刷掉。
 */
import type { WorkspacesRuntimeLike } from './types'
import {
  DELETE_WORKSPACE_LABELS,
  SIDEBAR_SELECTOR,
  WORKSPACE_ACTION_ATTRIBUTE,
} from './constants'
import { text } from './locale'
import { archiveSession, archiveStore, archiveWorkspace } from './store'

/**
 * 从 React Fiber key 里读 session id（只读，不移动 React 管理的节点）。
 * 参照 dsh-tauri-worktree/src/client/session.ts 的 HARDCODE 技法。
 */
function reactKey(element: Element, prefix: 'session-' | ''): string | undefined {
  const fiberName = Object.keys(element).find(key => key.startsWith('__reactFiber$'))
  let fiber = fiberName ? (element as unknown as Record<string, any>)[fiberName] : undefined
  for (let depth = 0; fiber && depth < 10; depth++, fiber = fiber.return) {
    if (typeof fiber.key === 'string' && fiber.key.startsWith(prefix))
      return fiber.key
  }
}

/** 收集一个工作区组容器里的全部会话 id。 */
function collectSessionIds(group: Element): string[] {
  const ids = new Set<string>()
  for (const row of group.querySelectorAll<Element>('[role="treeitem"][aria-selected]')) {
    const id = reactKey(row, 'session-')
    if (id)
      ids.add(id)
  }
  return [...ids]
}

/** 解析按钮所隶属的工作区组容器（从按钮向上找最近的、同时装得下会话行的祖先）。 */
function workspaceGroupOf(button: Element): Element | undefined {
  let node = button.parentElement
  for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
    if (node.querySelector('[role="treeitem"][aria-selected]'))
      return node
  }
  return undefined
}

/** 找到匹配的「删除工作区」按钮集合（按文案匹配，双语）。 */
function deleteButtons(root: ParentNode): Element[] {
  const buttons: Element[] = []
  for (const button of root.querySelectorAll<Element>('button')) {
    const label = button.textContent?.trim() ?? ''
    if (!label)
      continue
    if (DELETE_WORKSPACE_LABELS.includes(label) || DELETE_WORKSPACE_LABELS.some(needle => label.includes(needle)))
      buttons.push(button)
  }
  return buttons
}

/**
 * 安装工作区浏览器补丁。返回卸载函数。
 * @param workspacesRuntime - 客户端 ctx.workspaces（用于按会话反面定位工作区）。
 */
export function installWorkspaceArchivePatch(workspacesRuntime: WorkspacesRuntimeLike): () => void {
  if (typeof document === 'undefined')
    return () => {}

  const archivedSet = (): Set<string> => new Set(archiveStore.getSnapshot().archived.archivedSessionIds)

  /** 按会话 id 解析工作区；解析不到返回 undefined（客户端退化为逐会话归档，由宿主按 cwd 归组）。 */
  function resolveWorkspaceId(sessionIds: string[]): string | undefined {
    const items = workspacesRuntime.list.getSnapshot().items
    // 优先「该组会话恰好全属于某工作区」的精确匹配。
    const exact = items.find(ws => sessionIds.length > 0 && sessionIds.every(id => ws.sessionIds.includes(id)))
    if (exact)
      return exact.workspaceId
    const single = items.find(ws => sessionIds.some(id => ws.sessionIds.includes(id)))
    return single?.workspaceId
  }

  /** 归档一个工作区组（点击「归档工作区」后触发）。 */
  async function archiveGroup(group: Element): Promise<void> {
    const sessionIds = collectSessionIds(group)
    if (sessionIds.length === 0)
      return
    const workspaceId = resolveWorkspaceId(sessionIds)
    if (workspaceId)
      await archiveWorkspace(workspaceId, sessionIds)
    else
      await Promise.all(sessionIds.map(id => archiveSession(id)))
  }

  /** 为按钮改写文案并拦截点击（capture 阶段抢先，阻止官方删除逻辑）。 */
  function patchButton(button: Element): void {
    if (button.hasAttribute(WORKSPACE_ACTION_ATTRIBUTE))
      return
    button.setAttribute(WORKSPACE_ACTION_ATTRIBUTE, '1')
    button.textContent = text('archiveWorkspace')
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      const group = workspaceGroupOf(button)
      if (group)
        void archiveGroup(group)
    }, { capture: true })
  }

  /** 隐藏/恢复归档会话行。 */
  function applyRowVisibility(): void {
    const archived = archivedSet()
    for (const row of document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-selected]')) {
      const id = reactKey(row, 'session-')
      if (!id)
        continue
      const hidden = archived.has(id)
      const currentHidden = row.style.display === 'none'
      if (hidden !== currentHidden)
        row.style.display = hidden ? 'none' : ''
    }
  }

  /** 全量扫描：改写按钮 + 应用行可见性。 */
  function scan(): void {
    const sidebar = document.querySelector<HTMLElement>(SIDEBAR_SELECTOR)
    if (!sidebar)
      return
    for (const button of deleteButtons(sidebar))
      patchButton(button)
    applyRowVisibility()
  }

  const ro = new MutationObserver(scan)
  let timer: ReturnType<typeof setInterval> | undefined
  let tries = 0
  function attach(): boolean {
    const sidebar = document.querySelector<HTMLElement>(SIDEBAR_SELECTOR)
    if (!sidebar)
      return false
    ro.observe(sidebar, { childList: true, subtree: true })
    scan()
    return true
  }

  if (!attach()) {
    timer = setInterval(() => {
      if (attach() || ++tries > 30)
        clearInterval(timer)
    }, 500)
  }

  // 归档集合变化时重扫（取消归档后行恢复显示）。
  const unsubscribeStore = archiveStore.subscribe(scan)

  return () => {
    ro.disconnect()
    unsubscribeStore()
    if (timer !== undefined)
      clearInterval(timer)
  }
}
