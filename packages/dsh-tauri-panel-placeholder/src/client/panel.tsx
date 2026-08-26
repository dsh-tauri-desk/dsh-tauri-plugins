import type { Context } from '@deepseek-ai/cordis'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { Content } from './content'
import { IconPlaceholder } from './icons'
import { NS } from './locale'

/**
 * panel.tsx — 面板区（sidebar.panel.action 槽）样板条目：
 * 「定时任务」。按 dsh-tauri-panel 面板协议接入（见 ../dsh-tauri-panel/PROTOCOL.md）：
 * 条目用宿主导出的 <ActionItem> 组装（样式/折叠/active 态宿主承担），点击调
 * 宿主导出的 renderPanelContent 切换会话区替换——本插件零机制代码。
 */

/** panel.protocol 宿主服务（经 ctx.reflect.get 取用；完整类型见 dsh-tauri-panel/PROTOCOL.md）。 */
interface PanelProtocol {
  /** 面板区条目组件：id/icon/onClick/children 由子插件填，其余宿主处理。 */
  ActionItem: (props: { id: string, icon?: ReactElement, onClick?: () => void, children?: ReactNode }) => ReactElement
  /** 切换会话区替换：未替换则打开 render，已替换则关闭恢复官方会话界面。 */
  renderPanelContent: (spec: { id: string, render: ComponentType<{ t?: (key: string) => string }>, locale?: string }) => void
}

/** sidebar.panel.action 条目合成 props 子集（inject 提供 protocol）。 */
interface PlaceholderPanelProps {
  /** 本条目 locale 翻译函数（placeholder NS）。 */
  t: (key: string) => string
  /** 宿主面板协议服务（inject：ctx.reflect.get('panel.protocol')）。 */
  protocol: PanelProtocol
}

function PlaceholderPanel(props: PlaceholderPanelProps): ReactElement {
  const { t, protocol: { ActionItem, renderPanelContent } } = props

  function onClick(): void {
    renderPanelContent({ id: 'placeholder', render: Content, locale: NS })
  }

  return (
    <ActionItem id="placeholder" icon={<IconPlaceholder />}onClick={onClick}>
      {t('panel.placeholder')}
    </ActionItem>
  )
}

/** 注册面板区样板条目（等 sidebar.panel.action 声明出现——即 dsh-tauri-panel 生效后）。 */
export function installPanel(ctx: Context): void {
  ctx.slots.inject('sidebar.panel.action' as never, () => {
    // 宿主协议服务经反射注册（dsh-tauri-panel apply 先于本条目声明执行）；
    // 缺失时降级：不注册条目（旧核心/宿主未装）。
    const protocol = ctx.reflect.get('panel.protocol') as PanelProtocol | undefined
    if (!protocol) {
      console.warn('[dsh-tauri-panel-placeholder] panel.protocol host service unavailable — panel item disabled.')
      // 类型要求返回 SlotInjectionEffect：空 disposer 表示不注册任何条目。
      return () => {}
    }
    return ctx.slots.register(
      {
        name: 'sidebar.panel.action',
        id: 'dsh-tauri-panel-placeholder',
        order: 10,
        priority: 0,
        locale: NS,
        inject: () => ({ protocol }),
      } as never,
      PlaceholderPanel,
    )
  })
}
