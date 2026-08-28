import type { ConversationPatchSpec } from './types'

/** 插件名（cordis 插件身份，与包名一致）。 */
export const TEMP_SESSION_PLUGIN_NAME = 'dsh-tauri-temp-session'

/** 本插件 HTTP 路由前缀（浏览器半区在其 client/constants.ts 中声明同值；跨 bundle 无共享来源）。 */
export const TEMP_SESSION_API_PREFIX = '/api/dsh-tauri-temp-session'

/** 系统提示 section 的排序（沿用独立版语义：位于通用会话提示之后、dsh-tauri-worktree(210) 之前）。 */
export const TEMP_SESSION_SECTION_ORDER = 109

/** 未归属会话的临时目录保留时长：7 天后被清理。 */
export const STALE_TEMP_MS = 7 * 24 * 60 * 60 * 1000

/** reserve 路由请求体上限（路由不依赖其内容，仅防御性读取）。 */
export const RESERVE_BODY_LIMIT = 64 * 1024

/** 内核补丁的首次修补备份后缀（保留原 bundle 以便手工恢复）。 */
export const PATCH_BACKUP_SUFFIX = `.${TEMP_SESSION_PLUGIN_NAME}.bak`

/** 本插件内核补丁标记（幂等判据，写入被修补的 bundle 内）。 */
export const CONVERSATION_PATCH_MARK = '/*** dsh-tauri-temp-session ***/'

/** 独立版 dsh-temp-session 的旧标记：命中视为已修补，避免对已迁移用户重复备份或误报漂移。 */
export const CONVERSATION_LEGACY_MARK = '/*** dsh-temp-session ***/'

/**
 * 内核客户端补丁规格：让"工作区就绪"的无工作区会话也保留 chipTitle（输入框可用）。
 * `from` 与上游 @deepseek-ai/dsh-client-ui-conversation 0.1.1-rc.x 的压缩源逐字对齐；
 * 上游升级改变实现时按 drifted 跳过并高调记录，随插件版本跟进。
 */
export const CONVERSATION_PATCH: ConversationPatchSpec = {
  package: '@deepseek-ai/dsh-client-ui-conversation',
  from: '(workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd))',
  to: `(${CONVERSATION_PATCH_MARK} cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd))`,
  mark: CONVERSATION_PATCH_MARK,
  legacyMark: CONVERSATION_LEGACY_MARK,
}

export const RESERVE_ROUTE_EFFECT = `${TEMP_SESSION_PLUGIN_NAME}: reserve route`

export const CLEANUP_EFFECT = `${TEMP_SESSION_PLUGIN_NAME}: bootstrap cleanup`
