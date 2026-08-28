/**
 * dsh-tauri-temp-session 客户端插件体（browser half）：工作区可选 + 无工作区临时会话。
 *
 * 不注册任何 slot：Hero 的 WorkspaceChip 与侧边栏"新建会话"入口都是官方元素且无
 * 对应 slot 位，故沿用 dsh-tauri-worktree session.ts 的 DOM 补丁先例——只按
 * aria-label 等稳定属性匹配（绝不结构回退、不依赖生成的 class），全部状态落在
 * 稳定 data-* 属性上。
 *
 * 与 node half（src/index.ts）经 /api/dsh-tauri-temp-session/reserve 通信：客户端
 * 请求预留独立目录，再以 sessions.create({ sessionId, cwd }) 创建会话。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { LOCALE_EFFECT, RUNTIME_EFFECT, STYLES_EFFECT, TEMP_SESSION_PLUGIN_NAME } from './constants'
import { installTempSessionLocale } from './locale'
import { createTempSessionRuntime } from './session'
import { mountTempSessionStyles } from './styles'

/** 插件显示名（诊断元数据）。 */
export const name = TEMP_SESSION_PLUGIN_NAME

/** 需要的客户端服务：locale（双语）、sessions/workspaces（会话与工作区 stores）。 */
export const inject = ['locale', 'sessions', 'workspaces']

/**
 * 插件体：安装文案、样式与运行时（芯片对账 / 临时会话 / 新建入口包装 / 兜底补位）。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  const runtime = createTempSessionRuntime(ctx)
  ctx.effect(() => installTempSessionLocale(ctx, () => runtime.scheduleReconcile()), LOCALE_EFFECT)
  ctx.effect(() => mountTempSessionStyles(), STYLES_EFFECT)
  ctx.effect(() => runtime.install(), RUNTIME_EFFECT)
}
