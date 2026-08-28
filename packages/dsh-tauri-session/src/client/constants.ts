/** Shared protocol and UI constants for the dsh-tauri-session client plugin. */

export const SESSION_CLIENT_PLUGIN = 'dsh-tauri-session'
export const SESSION_CLIENT_NS = SESSION_CLIENT_PLUGIN
export const SESSION_API_PREFIX = '/api/dsh-session'
export const SESSION_REGISTRANT = SESSION_CLIENT_PLUGIN

export const SETTINGS_SECTION_SLOT = 'settings.section'
export const SESSION_SECTION_ID = 'dsh-tauri-session-archive'
export const SESSION_SECTION_ORDER = 220

export const SESSION_STYLE_ID = 'dsh-tauri-session-styles'

/** Effects / lifecycle ids (诊断元数据). */
export const SESSION_STYLES_EFFECT = `${SESSION_CLIENT_PLUGIN}: styles`
export const SESSION_ARCHIVE_PATCH_EFFECT = `${SESSION_CLIENT_PLUGIN}: workspace archive patch`
export const SESSION_ARCHIVE_SECTION_EFFECT = `${SESSION_CLIENT_PLUGIN}: archive section`

/** css-render class prefix (value 仅用于样式命名，不作为协议). */
export const SESSION_CLASSES = {
  page: 'dsh-tauri-session-page',
  header: 'dsh-tauri-session-header',
  title: 'dsh-tauri-session-title',
  deleteAll: 'dsh-tauri-session-delete-all',
  toolbar: 'dsh-tauri-session-toolbar',
  search: 'dsh-tauri-session-search',
  select: 'dsh-tauri-session-select',
  groups: 'dsh-tauri-session-groups',
  group: 'dsh-tauri-session-group',
  groupHeader: 'dsh-tauri-session-group-header',
  groupTitle: 'dsh-tauri-session-group-title',
  groupCount: 'dsh-tauri-session-group-count',
  list: 'dsh-tauri-session-list',
  row: 'dsh-tauri-session-row',
  rowTitle: 'dsh-tauri-session-row-title',
  rowMeta: 'dsh-tauri-session-row-meta',
  unarchive: 'dsh-tauri-session-unarchive',
  empty: 'dsh-tauri-session-empty',
  error: 'dsh-tauri-session-error',
} as const

/** Sync strings for matching the official workspace delete action (zh/en). */
export const DELETE_WORKSPACE_LABELS: readonly string[] = ['删除工作区', 'Delete workspace']
/** Replacement label. */
export const ARCHIVE_WORKSPACE_LABELS: readonly string[] = ['归档工作区', 'Archive workspace']

export const SIDEBAR_SELECTOR = '[data-slot="sidebar"]'
export const SESSION_ROW_ATTRIBUTE = 'data-dsh-tauri-session-id'
export const WORKSPACE_ACTION_ATTRIBUTE = 'data-dsh-tauri-session-archive-action'
