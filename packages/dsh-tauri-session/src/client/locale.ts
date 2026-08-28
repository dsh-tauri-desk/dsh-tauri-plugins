/**
 * locale.ts — 本插件自有文案（归档设置页 / 归档工作区按钮）。
 * 走 locale 服务的非类型化注册面（register(ns, locale, dict)），zh/en 双语齐备。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LocaleKey } from './types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { useSyncExternalStore } from 'react'
import { SESSION_CLIENT_NS as NS } from './constants'

export { SESSION_CLIENT_NS as NS } from './constants'

/** zh 字典（键集合的权威）。 */
const DICT_ZH = {
  section: '归档',
  archiveTitle: '已归档的聊天',
  deleteAll: '全部删除',
  searchPlaceholder: '搜索已归档的聊天',
  sortLabel: '排序方式',
  sortUpdatedAt: '更新时间',
  sortCreatedAt: '创建时间',
  sortTitle: '按字母排序',
  groupLabel: '分组',
  groupByGroup: '按组排序',
  groupByProject: '按子项目排序',
  allProjects: '所有项目',
  ungrouped: '未分组',
  unarchive: '取消归档',
  empty: '没有已归档的聊天',
  noResults: '没有匹配的聊天',
  loadFailed: '加载失败',
  chats: '个聊天',
  archiveWorkspace: '归档工作区',
} as const satisfies Record<LocaleKey, string>

/** en 字典，与 zh 键集完全一致（locale 运行时强制双语平衡）。 */
const DICT_EN: Record<LocaleKey, string> = {
  section: 'Archive',
  archiveTitle: 'Archived chats',
  deleteAll: 'Delete all',
  searchPlaceholder: 'Search archived chats',
  sortLabel: 'Sort by',
  sortUpdatedAt: 'Updated time',
  sortCreatedAt: 'Created time',
  sortTitle: 'Alphabetical',
  groupLabel: 'Group',
  groupByGroup: 'By group',
  groupByProject: 'By project',
  allProjects: 'All projects',
  ungrouped: 'Ungrouped',
  unarchive: 'Unarchive',
  empty: 'No archived chats',
  noResults: 'No matching chats',
  loadFailed: 'Failed to load',
  chats: 'chats',
  archiveWorkspace: 'Archive workspace',
}

/** 活跃语言 id（module 级缓存，apply 时初始化并由订阅推进）。 */
let activeLocale = 'en'

/** locale 变更推进器：revision 前进 -> uSES 订阅方重渲染。 */
export const localeRev = createSnapshotStore({ rev: 0 })

/**
 * 在 apply 里安装：注册双语字典，并桥接 locale 变更到 rev。
 * @param ctx - 客户端根上下文（须已注入 locale 服务）。
 */
export function installLocale(ctx: Context): void {
  activeLocale = ctx.locale.getLocale().active
  ctx.locale.register(NS, 'zh', DICT_ZH)
  ctx.locale.register(NS, 'en', DICT_EN)
  ctx.locale.subscribe(() => {
    activeLocale = ctx.locale.getLocale().active
    localeRev.update((state) => {
      state.rev += 1
    })
  })
}

/** 按当前活跃语言取一条文案。 */
export function text(key: LocaleKey): string {
  return activeLocale === 'en' ? DICT_EN[key] : DICT_ZH[key]
}

/** 组件内订阅 locale 变更（revision 前进即重渲染）。 */
export function useLocale(): void {
  useSyncExternalStore(localeRev.subscribe, () => localeRev.getSnapshot().rev)
}
