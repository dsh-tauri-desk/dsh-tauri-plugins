export const WORKTREE_PLUGIN_NAME = 'dsh-tauri-worktree'
export const WORKTREE_LOCALE_NAMESPACE = WORKTREE_PLUGIN_NAME
export const WORKTREE_API_PREFIX = '/api/dsh-worktree'
export const PREFERRED_MODE_STORAGE_KEY = `${WORKTREE_PLUGIN_NAME}:preferred-mode`

export const INPUT_DOCK_SLOT = 'conversation.input.dock'
export const SHELL_OVERLAY_SLOT = 'shell.overlay'
export const MODE_SELECT_ID = `${WORKTREE_PLUGIN_NAME}-mode`
export const MODE_SELECT_ORDER = -20
export const SURFACE_ID = `${WORKTREE_PLUGIN_NAME}-surface`
export const SURFACE_ORDER = -10
export const DIALOG_ID = `${WORKTREE_PLUGIN_NAME}-dialog`

export const STYLES_EFFECT = `${WORKTREE_PLUGIN_NAME}: styles`
export const DIALOG_EFFECT = `${WORKTREE_PLUGIN_NAME}: dialog`
export const HYDRATION_EFFECT = `${WORKTREE_PLUGIN_NAME}: hydrate session bindings`
export const SESSION_ICONS_EFFECT = `${WORKTREE_PLUGIN_NAME}: session branch icons`

export const MODE_SELECT_STYLE_ID = '@deepseek-ai/dsh-tauri-worktree/ModeSelect.module.css'
export const WORKTREE_STYLE_ID = '@deepseek-ai/dsh-tauri-worktree/SurfaceDialog.module.css'
export const SESSION_ICON_STYLE_ID = '@deepseek-ai/dsh-tauri-worktree/SessionBranchIcon.module.css'

export const MODE_SELECT_CLASSES = {
  anchor: 'dsh-tauri-worktree-mode-anchor',
  chevron: 'dsh-tauri-worktree-mode-chevron',
  host: 'dsh-tauri-worktree-mode-host',
  icon: 'dsh-tauri-worktree-mode-icon',
  trigger: 'dsh-tauri-worktree-mode-trigger',
  triggerOpen: 'dsh-tauri-worktree-mode-trigger-open',
} as const

export const worktreeStyles = {
  surface: 'dsh-tauri-worktree-surface',
  surfaceBar: 'dsh-tauri-worktree-surface-bar',
  surfaceContent: 'dsh-tauri-worktree-surface-content',
  surfaceLabel: 'dsh-tauri-worktree-surface-label',
  action: 'dsh-tauri-worktree-action',
  actionLog: 'dsh-tauri-worktree-action-log',
  actionDanger: 'dsh-tauri-worktree-action-danger',
  spacer: 'dsh-tauri-worktree-spacer',
  logs: 'dsh-tauri-worktree-logs',
  logsOpen: 'dsh-tauri-worktree-logs-open',
  logsInner: 'dsh-tauri-worktree-logs-inner',
  logsPanel: 'dsh-tauri-worktree-logs-panel',
  logLine: 'dsh-tauri-worktree-log-line',
  modal: 'dsh-tauri-worktree-modal',
  card: 'dsh-tauri-worktree-dialog-card',
  title: 'dsh-tauri-worktree-dialog-title',
  body: 'dsh-tauri-worktree-dialog-body',
  field: 'dsh-tauri-worktree-dialog-field',
  fieldLabel: 'dsh-tauri-worktree-dialog-field-label',
  inputWrap: 'dsh-tauri-worktree-dialog-input-wrap',
  input: 'dsh-tauri-worktree-dialog-input',
  pathRow: 'dsh-tauri-worktree-dialog-path-row',
  pathKey: 'dsh-tauri-worktree-dialog-path-key',
  pathValue: 'dsh-tauri-worktree-dialog-path-value',
  error: 'dsh-tauri-worktree-dialog-error',
  footer: 'dsh-tauri-worktree-dialog-footer',
  button: 'dsh-tauri-worktree-dialog-button',
  buttonGhost: 'dsh-tauri-worktree-dialog-button-ghost',
  buttonPrimary: 'dsh-tauri-worktree-dialog-button-primary',
  buttonDanger: 'dsh-tauri-worktree-dialog-button-danger',
  buttonDisabled: 'dsh-tauri-worktree-dialog-button-disabled',
} as const

export const SESSION_ICON_ATTRIBUTE = 'data-dsh-worktree-icon'
export const SIDEBAR_SELECTOR = '[data-slot="sidebar"]'
export const COMPOSER_SEAT_SELECTOR = '[data-composer-seat]'
export const HERO_PRESET_SLOT_SELECTOR = '[data-slot="conversation.hero.agentPreset"]'
export const MODE_ANCHOR_ATTRIBUTE = 'data-dsh-tauri-worktree-mode-anchor'
