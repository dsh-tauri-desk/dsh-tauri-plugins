/** 插件名（诊断元数据，与 cordis.patch.yml 的 id/name 一致）。 */
export const TRUST_MODE_PLUGIN_NAME = 'dsh-tauri-trust-mode'

/** 宿主侧 HTTP 路由前缀（客户端同源 fetch）。 */
export const TRUST_MODE_API_PREFIX = '/api/dsh-trust-mode'

/** settings.yaml 中承载权限预设的分节名。 */
export const PERMISSION_PRESETS_SECTION = 'permissionPresets'

/** 分节内表示「未来会话使用的预设」的键。 */
export const DEFAULT_PRESET_KEY = 'defaultPreset'

/** 信任模式取值：非受限沙箱 + 不再询问。 */
export const TRUST_PRESET = 'danger-full-access'

/** 默认取值：工作区可写沙箱 + 逐次询问。 */
export const ASK_PRESET = 'workspace-write'
