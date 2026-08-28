/**
 * dsh-tauri-trust-mode 客户端插件体（browser half）：设置侧边栏的信任模式开关。
 *
 * 与宿主侧（src/index.ts）经 /api/dsh-trust-mode/* 通信；本 half 只负责在
 * settings.section 槽注册一个分区项（含开关 UI），并在 apply 时挂载样式、安装文案。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  TRUST_MODE_LOCALE_NAMESPACE as NS,
  SETTINGS_SECTION_SLOT,
  STYLES_EFFECT,
  TRUST_MODE_PLUGIN_NAME,
  TRUST_MODE_SECTION_ID,
  TRUST_MODE_SECTION_ORDER,
} from './constants.js'
import { installLocale, text } from './locale.js'
import { mountTrustModeStyles } from './styles.js'
import { TrustModeSection } from './trust-mode-section.js'

/** 插件显示名（诊断元数据，与 cordis.patch.yml 一致）。 */
export const name = TRUST_MODE_PLUGIN_NAME

/** 需要的客户端服务：slots（注册分区项）、locale（双语）。 */
export const inject = ['slots', 'locale']

/**
 * 插件体：安装文案、挂载样式、注册设置分区项。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  installLocale(ctx)
  ctx.effect(
    () => mountTrustModeStyles(),
    STYLES_EFFECT,
  )
  // 延后到 settings.section 槽声明后再注册，避免「槽未声明」竞态。
  ctx.slots.inject(SETTINGS_SECTION_SLOT as never, () =>
    ctx.slots.register(
      {
        name: SETTINGS_SECTION_SLOT,
        id: TRUST_MODE_SECTION_ID,
        registrant: TRUST_MODE_PLUGIN_NAME,
        order: TRUST_MODE_SECTION_ORDER,
        locale: NS,
        label: () => text('trustMode'),
      } as never,
      TrustModeSection,
    ))
}
