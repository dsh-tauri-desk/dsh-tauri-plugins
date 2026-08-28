/** 插件显示名（诊断元数据，与 cordis.patch.yml 一致）。 */
export const TRUST_MODE_PLUGIN_NAME = 'dsh-tauri-trust-mode'

/** locale 命名空间（= 插件名）。 */
export const TRUST_MODE_LOCALE_NAMESPACE = TRUST_MODE_PLUGIN_NAME

/** 宿主侧 HTTP 路由前缀（客户端同源 fetch）。 */
export const TRUST_MODE_API_PREFIX = '/api/dsh-trust-mode'

/** 设置侧边栏分区槽（与 dsh-tauri-ui 的 SETTINGS_SECTION_SLOT 一致）。 */
export const SETTINGS_SECTION_SLOT = 'settings.section'

/** 本插件注册进 settings.section 的分区 id。 */
export const TRUST_MODE_SECTION_ID = TRUST_MODE_PLUGIN_NAME

/** 分区导航行排序（数字越小越靠上；50 落在常用项之后）。 */
export const TRUST_MODE_SECTION_ORDER = 50

/** 样式挂载 id（插件前缀，避免与其它插件冲突）。 */
export const STYLES_EFFECT = `${TRUST_MODE_PLUGIN_NAME}: styles`

/** css-render 样式 id（与 dsh-tauri-worktree 同款 @deepseek-ai/* 命名空间约定）。 */
export const TRUST_MODE_STYLE_ID = '@deepseek-ai/dsh-tauri-trust-mode/TrustMode.module.css'
