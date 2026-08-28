import type { Context } from '@deepseek-ai/cordis'
/**
 * locale.ts — 本插件自有的界面文案（芯片可选文案 / × 的 title 与 aria）。
 *
 * 用 locale 服务的**非类型化**注册面（register(ns, locale, dict)）挂进 dsh 的
 * locale 表：zh/en 双语齐全即满足运行时"bilingual balance"约束。本插件无 React
 * 组件，故不用 uSES 桥——语言切换直接回调 onChange（由 runtime 侧把对账排进
 * 下一帧），模块级 activeLocale 缓存随之推进。
 */
import type { LocaleKey } from './types'
import { TEMP_SESSION_LOCALE_NAMESPACE as NS } from './constants'

/** zh 字典（键集合的权威）。 */
const DICT_ZH = {
  optional: '选择工作区（可选）',
  clearTitle: '取消工作区选择',
  clearAria: '取消工作区选择',
} as const satisfies Record<LocaleKey, string>

/** en 字典，与 zh 键集完全一致（locale 运行时强制双语平衡）。 */
const DICT_EN: Record<LocaleKey, string> = {
  optional: 'Choose workspace (optional)',
  clearTitle: 'Clear workspace selection',
  clearAria: 'Clear workspace selection',
}

/** 活跃语言 id（module 级缓存，apply 时初始化并由订阅推进）。 */
let activeLocale = 'en'

/**
 * 安装双语字典并桥接 locale 变更；返回完整 disposer（字典 + 订阅）。
 * @param ctx - 客户端根上下文（须已注入 locale 服务）。
 * @param onChange - 语言切换后由 runtime 触发一轮 DOM 对账。
 */
export function installTempSessionLocale(ctx: Context, onChange: () => void): () => void {
  activeLocale = ctx.locale.getLocale().active
  const disposeZh = ctx.locale.register(NS, 'zh', DICT_ZH)
  const disposeEn = ctx.locale.register(NS, 'en', DICT_EN)
  const unsubscribe = ctx.locale.subscribe(() => {
    activeLocale = ctx.locale.getLocale().active
    onChange()
  })
  return () => {
    disposeZh()
    disposeEn()
    unsubscribe()
  }
}

/** 按当前活跃语言取一条文案。 */
export function text(key: LocaleKey): string {
  return activeLocale === 'en' ? DICT_EN[key] : DICT_ZH[key]
}
