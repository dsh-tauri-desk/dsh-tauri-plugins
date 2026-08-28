/**
 * dsh-tauri-session 客户端插件体（browser half）：「已归档的聊天」设置分区 +
 * 工作区浏览器的「删除工作区 → 归档工作区」替换。
 *
 * 两块功能：
 *   - archive-page.tsx  注册进 settings.section（导航项「归档」，经官方设置侧边栏
 *     投影出导航行），渲染归档列表页（搜索 / 排序 / 分组 / 项目选择 / 取消归档）；
 *   - workspace-patch.ts  DOM 补丁：把官方工作区浏览器每组的「删除工作区」改写为
 *     「归档工作区」，点击改为归档该组全部会话；并把归档集合中的会话行隐藏出组。
 *
 * 与 node half（src/index.ts）经 /api/dsh-session/* 通信（archived/archive/
 * archive-workspace/unarchive/clear）。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ArchivePage } from './archive-page'
import {
  SESSION_ARCHIVE_PATCH_EFFECT,
  SESSION_ARCHIVE_SECTION_EFFECT,
  SESSION_REGISTRANT,
  SESSION_SECTION_ID,
  SESSION_SECTION_ORDER,
  SESSION_STYLES_EFFECT,
  SETTINGS_SECTION_SLOT,
} from './constants'
import { installLocale, text } from './locale'
import { mountSessionStyles } from './styles'
import { installWorkspaceArchivePatch } from './workspace-patch'

/** 插件显示名（诊断元数据）。 */
export const name = 'dsh-tauri-session'

/** 需要的客户端服务：slots / locale / sessions / workspaces。 */
export const inject = ['slots', 'locale', 'sessions', 'workspaces']

/**
 * 插件体：安装文案与样式，注册「归档」设置分区，并安装工作区浏览器补丁。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  installLocale(ctx)

  ctx.effect(() => mountSessionStyles(), SESSION_STYLES_EFFECT)

  // 1) 设置页「归档」分区（settings.section 单槽注册；导航行/内容由官方设置侧边栏投影）。
  // 'settings.section' 不在本插件类型图的 SlotMap 键（声明权在 ui-sidebar / ui-layout），
  // 此处对 options 显式 cast（先例：dsh-tauri-worktree 的 conversation.input.dock）。
  ctx.effect(
    () =>
      ctx.slots.register(
        {
          name: SETTINGS_SECTION_SLOT,
          id: SESSION_SECTION_ID,
          order: SESSION_SECTION_ORDER,
          registrant: SESSION_REGISTRANT,
          label: () => text('section'),
          inject: () => ({ sessionsRuntime: ctx.sessions, workspacesRuntime: ctx.workspaces }),
        } as never,
        ArchivePage,
      ),
    SESSION_ARCHIVE_SECTION_EFFECT,
  )

  // 2) 工作区浏览器补丁：替换「删除工作区」+ 隐藏归档会话行。
  ctx.effect(() => installWorkspaceArchivePatch(ctx.workspaces), SESSION_ARCHIVE_PATCH_EFFECT)
}
