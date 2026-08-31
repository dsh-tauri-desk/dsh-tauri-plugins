/**
 * panel.tsx — 设置页「归档」分区内容（已归档的聊天）。
 *
 * 布局（参照需求截图）：
 *   标题「已归档的聊天」；
 *   工具条：搜索框 / 排序方式下拉（官方 primitives Input + Menu 组件）；
 *   分组列表：每行左侧竖排「标题 + 时间」（标题加粗），右侧「取消归档」按钮。
 *
 * 数据源：宿主归档集合。列表 id 取「GET /archived 载荷 ∪ 客户端 workspace 快照的
 * archivedSessionIds」——后者随宿主帧实时镜像官方「归档」动作，保证用户刚用官方
 * 菜单归档的会话立刻出现在本页。
 *
 * 变更期间（unarchive）页面进入 pending：动作按钮禁用并弹 loading
 * toast；取消归档成功后弹「对话已取消归档 [查看]」，查看可跳转到恢复的会话。
 */
import type { ReactElement } from 'react'
import type { ArchivePanelProps, ArchiveRow, ArchiveSort, WorkspaceViewLike } from './types'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { SESSION_CLASSES as K } from './constants'
import { IconFolderOpen, IconMagnifier } from './icons'
import { isEnglishLocale, text, useLocale } from './locale'
import { MenuSelect } from './select'
import { groupArchive } from './sort'
import {
  archiveStore,
  refreshArchived,
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

/** 按出现顺序合并多个 id 列表（去重；GET 载荷优先，快照补漏）。 */
function unionIds(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id))
        continue
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/** 合并归档载荷与 session/workspace 运行时快照，生成带展示字段的归档行。 */
function buildRows(
  archivedSessionIds: string[],
  meta: Record<string, { createdAt?: number, cwd?: string, title?: string }>,
  sessions: ReturnType<ArchivePanelProps['sessionsRuntime']['list']['getSnapshot']>,
  workspaces: ReturnType<ArchivePanelProps['workspacesRuntime']['list']['getSnapshot']>,
  titleById: Record<string, string>,
): ArchiveRow[] {
  const byPath = new Map<string, WorkspaceViewLike>()
  for (const ws of workspaces.items) {
    byPath.set(ws.path, ws)
  }

  const rows: ArchiveRow[] = []
  for (const sessionId of archivedSessionIds) {
    const summary = sessions.byId[sessionId]
    const entry = meta[sessionId]
    // The host archive set can briefly contain stale ids after a refresh; do not
    // render those ghosts, and never expose temporary blank sessions as archives.
    if (!summary && !entry)
      continue
    if (summary?.blank === true)
      continue
    let workspace = workspaces.items.find(ws => ws.sessionIds.includes(sessionId))
    const cwd = summary?.cwd ?? entry?.cwd
    if (!workspace && cwd)
      workspace = byPath.get(cwd)
    rows.push({
      sessionId,
      title: summary?.displayTitle ?? summary?.title ?? entry?.title ?? titleById[sessionId] ?? (cwd ? workspaceTitleOf(cwd) : undefined) ?? text('untitled'),
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
export function ArchivePanel(props: ArchivePanelProps): ReactElement | null {
  const ui = useArchiveUi()
  useLocale()

  const sessions = useSyncExternalStore(props.sessionsRuntime.list.subscribe, props.sessionsRuntime.list.getSnapshot)
  const workspaces = useSyncExternalStore(props.workspacesRuntime.list.subscribe, props.workspacesRuntime.list.getSnapshot)

  // 变更走宿主注册表内部状态机，不产生官方 changed frame；成功后手动重拉镜像。
  const resyncWorkspaces = useCallback(() => {
    return props.workspacesRuntime.manager?.refresh?.() ?? Promise.resolve()
  }, [props.workspacesRuntime])
  // 进入分区或宿主归档集合规模变化时刷新归档载荷（meta：createdAt/cwd）。
  const archivedCount = (workspaces.archivedSessionIds ?? []).length
  useEffect(() => {
    void refreshArchived()
  }, [archivedCount])

  const archivedIds = unionIds(ui.archived.archivedSessionIds, workspaces.archivedSessionIds ?? [])
    .filter(id => !ui.suppressedSessionIds.includes(id))
  const rows = buildRows(archivedIds, ui.archived.meta, sessions, workspaces, ui.titleById)
  useEffect(() => {
    const titles: Record<string, string> = {}
    for (const row of rows)
      titles[row.sessionId] = row.title
    const current = archiveStore.getSnapshot().titleById
    if (Object.entries(titles).some(([id, title]) => current[id] !== title)) {
      archiveStore.set(state => ({
        ...state,
        titleById: { ...state.titleById, ...titles },
      }))
    }
  }, [rows])

  const query = ui.query.trim().toLowerCase()
  const filtered = query
    ? rows.filter(row =>
        row.title.toLowerCase().includes(query)
        || (row.cwd ?? '').toLowerCase().includes(query)
        || (row.workspaceTitle ?? '').toLowerCase().includes(query))
    : rows

  const visible = ui.workspaceId === 'all'
    ? filtered
    : filtered.filter(row => ui.workspaceId === 'ungrouped' ? !row.workspaceId : row.workspaceId === ui.workspaceId)

  const groups = groupArchive(visible, ui.sort, text('ungrouped'))

  const busy = ui.pending || ui.loading

  /** 取消归档：成功后弹「对话已取消归档 [查看]」。 */
  function handleUnarchive(sessionId: string): void {
    void unarchiveSession(sessionId, resyncWorkspaces)
  }

  return (
    <div className={K.page}>
      <div className={K.header}>
        <h1 className={K.title}>{text('archiveTitle')}</h1>
      </div>

      <div className={K.toolbar}>
        <Input
          className={K.search}
          value={ui.query}
          placeholder={text('searchPlaceholder')}
          aria-label={text('searchPlaceholder')}
          icon={<IconMagnifier />}
          onChange={event => setQuery(event.target.value)}
        />
        <MenuSelect
          label={text('sortLabel')}
          value={ui.sort}
          onSelect={id => setSort(id as ArchiveSort)}
          options={[
            { id: 'updatedAt', label: text('sortUpdatedAt') },
            { id: 'createdAt', label: text('sortCreatedAt') },
            { id: 'title', label: text('sortTitle') },
          ]}
        />
        <MenuSelect
          label={text('allProjects')}
          value={ui.workspaceId}
          onSelect={setWorkspaceFilter}
          options={[
            { id: 'all', label: text('allProjects') },
            ...[...projectOptions(rows).entries()].map(([id, title]) => ({ id, label: title })),
            ...(rows.some(row => !row.workspaceId) ? [{ id: 'ungrouped', label: text('ungrouped') }] : []),
          ]}
        />
      </div>

      {ui.error && <div className={K.error}>{ui.error}</div>}

      {!ui.loading && visible.length === 0 && (
        <div className={K.empty}>{query ? text('noResults') : text('empty')}</div>
      )}

      <div className={K.groups}>
        {groups.map(group => (
          <section key={group.id} className={K.group}>
            <div className={K.groupHeader}>
              <IconFolderOpen />
              <span className={K.groupTitle}>{group.title || text('ungrouped')}</span>
              <span className={K.groupCount}>
                {group.rows.length}
                {' '}
                {text('chats')}
              </span>
            </div>
            <ul className={K.list}>
              {group.rows.map(row => (
                <li key={row.sessionId} className={K.row}>
                  <div className={K.rowMain}>
                    <span className={K.rowTitle}>{row.title}</span>
                    <span className={K.rowTime}>{formatTime(row)}</span>
                  </div>
                  <div className={K.rowActions}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={K.unarchive}
                      disabled={busy}
                      onClick={() => handleUnarchive(row.sessionId)}
                    >
                      {text('unarchive')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

    </div>
  )
}

/** 项目下拉选项：从归档行收集「工作区 id → 标题」映射（保持出现顺序）。 */
function projectOptions(rows: ArchiveRow[]): Map<string, string> {
  const options = new Map<string, string>()
  for (const row of rows) {
    if (row.workspaceId)
      options.set(row.workspaceId, row.workspaceTitle ?? row.workspaceId)
  }
  return options
}

function formatTime(row: ArchiveRow): string {
  const value = row.updatedAt ?? row.createdAt
  if (!value)
    return ''
  const d = new Date(value)
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (isEnglishLocale()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
