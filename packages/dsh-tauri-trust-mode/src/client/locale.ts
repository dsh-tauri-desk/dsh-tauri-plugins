/**
 * locale.ts — 本插件自有的界面文案（信任模式开关的标题、说明与状态）。
 *
 * 用 locale 服务的**非类型化**注册面（register(ns, locale, dict)）挂进 dsh 的 locale
 * 表：zh/en 双语齐全即满足运行时「bilingual balance」约束，无需增广 LocaleNamespaceMap。
 * 组件侧不引入框架 t 座，改用一个极薄的 uSES 桥：apply 时订阅 locale 变更推进 rev，
 * 组件订阅 rev 重渲染，文案按当前 active locale 从本地字典读取。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LocaleKey } from './types.js'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { useSyncExternalStore } from 'react'
import { TRUST_MODE_LOCALE_NAMESPACE as NS } from './constants.js'

export { TRUST_MODE_LOCALE_NAMESPACE as NS } from './constants.js'
export type { LocaleKey } from './types.js'

/** zh 字典（键集合的权威）。 */
const DICT_ZH = {
  trustMode: '信任模式',
  trustModeDesc: '关闭时，Agent 执行需要更高权限的命令会逐次弹出审批；开启后使用非受限沙箱且不再询问。该设置对之后新建的会话生效，既有会话不受影响。',
  trustModeOn: '已开启（对新建会话生效）',
  trustModeOff: '已关闭（逐次审批）',
  trustModeHint: '切换信任模式',
  saving: '保存中…',
  error: '操作失败',
} as const satisfies Record<LocaleKey, string>

/** en 字典，与 zh 键集完全一致（locale 运行时强制双语平衡）。 */
const DICT_EN: Record<LocaleKey, string> = {
  trustMode: 'Trust Mode',
  trustModeDesc: 'When off, the agent asks for approval on each privileged command. When on, it uses an unrestricted sandbox and stops asking. Applies to new sessions; existing sessions are unaffected.',
  trustModeOn: 'On (applies to new sessions)',
  trustModeOff: 'Off (asks each time)',
  trustModeHint: 'Toggle trust mode',
  saving: 'Saving…',
  error: 'Operation failed',
}

/** 活跃语言 id（模块级缓存，apply 时初始化并由订阅推进）。 */
let activeLocale = 'en'

/** locale 变更推进器：revision 前进 -> uSES 订阅方重渲染。 */
export const localeRev = createSnapshotStore({ rev: 0 })

/**
 * 在 apply 里安装：注册本插件的双语字典，并桥接 locale 变更到 rev。
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
