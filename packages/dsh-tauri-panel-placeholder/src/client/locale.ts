import type { Context } from '@deepseek-ai/cordis'

/**
 * locale.ts — 样板插件的双语文案（placeholder NS）。
 * ctx.locale.register 类型来自 slots.d.ts 对 cordis Context 的增广。
 */
export const NS = 'placeholder'

/** 注册双语文案（分开注册：cordis locale 的 zh/en 分区；effect 内返回 dispose 组合）。 */
export function installPanelLocale(ctx: Context): void {
  ctx.effect(
    () => [
      ctx.locale.register(NS, 'zh', { 'panel.placeholder': '占位符' }),
      ctx.locale.register(NS, 'en', { 'panel.placeholder': 'Placeholder' }),
    ],
    'dsh-tauri-panel-placeholder: placeholder locale',
  )
}
