/**
 * archive-page.tsx — 设置页「归档」分区内容（已归档的聊天）。
 *
 * 布局（参照需求截图）：
 *   标题「已归档的聊天」 + 右上「全部删除」；
 *   工具条：搜索框 / 排序方式下拉 / 分组下拉 / 项目选择下拉；
 *   分组列表：每个工作区一组（无项目组统一命名「未分组」），组内聊天按排序方式排列，
 *   每行右侧「取消归档」。
 */
import type { ReactElement } from 'react'
import type { ArchiveGroup, ArchivePageProps, ArchiveRow, ArchiveSort, WorkspaceViewLike } from './types'
import { useEffect, useSyncExternalStore } from 'react'
import { groupArchive } from './archive-sort'
import { FolderIcon, RestoreIcon, TrashIcon } from './icons'
import { text, useLocale } from './locale'
import {
  clearArchive,
  refreshArchived,
  setGroup,
  setQuery,
  setSort,
  setWorkspaceFilter,
  unarchiveSession,
  useArchiveUi,
} from './store'

function workspaceTitleOf(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] ?? ''
}

/** 合并归档载荷与 session/workspace 运行时快照，生成带展示字段的归档行。 */
function buildRows(
  archivedSessionIds: string[],
  meta: Record<string, { createdAt?: number, cwd?: string }>,
  sessions: ReturnType<ArchivePageProps['sessionsRuntime']['list']['getSnapshot']>,
  workspaces: ReturnType<ArchivePageProps['workspacesRuntime']['list']['getSnapshot']>,
): ArchiveRow[] {
  const byPath = new Map<string, WorkspaceViewLike>()
  for (const ws of workspaces.items)
    byPath.set(ws.path, ws)

  const rows: ArchiveRow[] = []
  for (const sessionId of archivedSessionIds) {
    const summary = sessions.byId[sessionId]
    const entry = meta[sessionId]
    let workspace = workspaces.items.find(ws => ws.sessionIds.includes(sessionId))
    const cwd = summary?.cwd ?? entry?.cwd
    if (!workspace && cwd)
      workspace = byPath.get(cwd)
    rows.push({
      sessionId,
      title: summary?.displayTitle ?? summary?.title ?? summary?.id ?? sessionId,
      cwd,
      createdAt: entry?.createdAt,
      updatedAt: summary?.updatedAt,
      workspaceId: workspace?.workspaceId,
      workspaceTitle: workspace?.title ?? (workspace ? workspaceTitleOf(workspace.path) : undefined),
    })
  }
  return rows
}

/** 设置页「归档」分区。 */
export function ArchivePage(props: ArchivePageProps): ReactElement | null {
  const ui = useArchiveUi()
  useLocale()

  const sessions = useSyncExternalStore(props.sessionsRuntime.list.subscribe, props.sessionsRuntime.list.getSnapshot)
  const workspaces = useSyncExternalStore(props.workspacesRuntime.list.subscribe, props.workspacesRuntime.list.getSnapshot)

  // 进入归档分区时刷新一次归档载荷（后续随会话/工作区运行时变更重渲染）。
  useEffect(() => {
    void refreshArchived()
  }, [])

  const rows = buildRows(ui.archived.archivedSessionIds, ui.archived.meta, sessions, workspaces)

  const query = ui.query.trim().toLowerCase()
  const filtered = query
    ? rows.filter(row =>
        row.title.toLowerCase().includes(query)
        || (row.cwd ?? '').toLowerCase().includes(query)
        || (row.workspaceTitle ?? '').toLowerCase().includes(query))
    : rows

  const visible = ui.workspaceId === 'all'
    ? filtered
    : filtered.filter(row => row.workspaceId === ui.workspaceId)

  const groups = groupArchive(visible, ui.sort, ui.group, text('ungrouped'))

  // 项目下拉选项：所有项目 + 各工作区（按当前工作的归组标题去重）。
  const projectOptions = new Map<string, string>()
  for (const row of rows) {
    if (row.workspaceId)
      projectOptions.set(row.workspaceId, row.workspaceTitle ?? row.workspaceId)
  }

  return (
    <div className="dsh-tauri-session-page">
      <div className="dsh-tauri-session-header">
        <h1 className="dsh-tauri-session-title">{text('archiveTitle')}</h1>
        <button
          type="button"
          className="dsh-tauri-session-delete-all"
          onClick={() => clearArchive()}
        >
          <TrashIcon />
          {text('deleteAll')}
        </button>
      </div>

      <div className="dsh-tauri-session-toolbar">
        <input
          className="dsh-tauri-session-search"
          value={ui.query}
          placeholder={text('searchPlaceholder')}
          aria-label={text('searchPlaceholder')}
          onChange={event => setQuery(event.target.value)}
        />
        <select
          className="dsh-tauri-session-select"
          value={ui.sort}
          aria-label={text('sortLabel')}
          onChange={event => setSort(event.target.value as ArchiveSort)}
        >
          <option value="updatedAt">{text('sortUpdatedAt')}</option>
          <option value="createdAt">{text('sortCreatedAt')}</option>
          <option value="title">{text('sortTitle')}</option>
        </select>
        <select
          className="dsh-tauri-session-select"
          value={ui.group}
          aria-label={text('groupLabel')}
          onChange={event => setGroup(event.target.value as ArchiveGroup)}
        >
          <option value="group">{text('groupByGroup')}</option>
          <option value="project">{text('groupByProject')}</option>
        </select>
        <select
          className="dsh-tauri-session-select"
          value={ui.workspaceId}
          aria-label={text('allProjects')}
          onChange={event => setWorkspaceFilter(event.target.value)}
        >
          <option value="all">{text('allProjects')}</option>
          {[...projectOptions.entries()].map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
      </div>

      {ui.error && <div className="dsh-tauri-session-error">{ui.error}</div>}

      {!ui.loading && visible.length === 0 && (
        <div className="dsh-tauri-session-empty">{text('empty')}</div>
      )}

      <div className="dsh-tauri-session-groups">
        {groups.map(group => (
          <section key={group.id} className="dsh-tauri-session-group">
            <div className="dsh-tauri-session-group-header">
              <FolderIcon />
              <span className="dsh-tauri-session-group-title">{group.title || text('ungrouped')}</span>
              <span className="dsh-tauri-session-group-count">
                {group.rows.length}
                {' '}
                {text('chats')}
              </span>
            </div>
            <ul className="dsh-tauri-session-list">
              {group.rows.map(row => (
                <li key={row.sessionId} className="dsh-tauri-session-row">
                  <span className="dsh-tauri-session-row-title">{row.title}</span>
                  <span className="dsh-tauri-session-row-meta">{formatTime(row)}</span>
                  <button
                    type="button"
                    className="dsh-tauri-session-unarchive"
                    onClick={() => unarchiveSession(row.sessionId)}
                  >
                    <RestoreIcon />
                    {text('unarchive')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function formatTime(row: ArchiveRow): string {
  const value = row.updatedAt ?? row.createdAt
  if (!value)
    return ''
  const d = new Date(value)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
