import type { Context } from '@deepseek-ai/cordis'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { useSyncExternalStore } from 'react'
import { NS } from './locale'

/**
 * service.tsx — 面板协议宿主服务（协议能力，见 PROTOCOL.md）。
 *
 * 宿主对外只暴露两个构件，子插件无需处理任何状态/机制：
 *   - `<ActionItem>`：面板区条目组件（样式、折叠态、active 态全由宿主承担）；
 *   - `renderPanelContent(spec)`：切换会话区替换（conversation 槽条件 shadow），
 *     子插件在 ActionItem 的 onClick 里调用。
 *
 * 机制（全部在宿主，单一权威）：
 *   - 服务经 ctx.reflect.provide('panel.protocol', api) 暴露（cordis
 *     ReflectService，官方 runtime 同款用法 ctx.reflect.provide("sessions", this)）；
 *   - renderPanelContent：conversation 槽（single/session-maybe，layout 声明、
 *     官方 ui-conversation priority 0 是唯一注册者）以 priority -1 **动态注册**
 *     → 整个右侧会话区被替换（CenterColumn 内、零定位层）；官方条目被
 *     shadow 但仍 live（children/locale 有效）。再调（同 id）→ dispose 句柄
 *     → 官方恢复（toggle 语义）。
 *   - 替换状态存共享 snapshot store：ActionItem 经 useSyncExternalStore
 *     感知「当前替换 id === 自己 id」→ 保持 active（hover）样式。
 *   - 退出时机：无关闭按钮——document capture 层监听 pointerdown，但**只
 *     响应侧栏内点击**（[data-dshp-panel-sidebar] 根容器）：点侧栏任意处
 *     （会话/搜索/筛选/新会话/折叠/设置等）即恢复官方会话界面，目标操作
 *     继续正常执行；右侧区域（第三方悬浮按钮等）不影响替换，避免误关。
 *     替换视图内部与面板条目自身不触发（后者留给条目 onClick）。
 *
 * 不能常驻注册 + SlotOutlet 透传：SlotOutlet 对 single 槽只渲染 live 条目，
 * 自己 live 后渲染官方条目 = 自递归（无公开 API 渲染被 shadow 条目）。
 */

/** 面板协议服务名（第三方经 ctx.reflect.get 取用）。 */
export const PANEL_PROTOCOL_SERVICE = 'panel.protocol'

/** 内容区替换规格（renderPanelContent 入参）。 */
export interface PanelContentSpec {
  /** 视图唯一标识（同一时刻只存在一个替换；active 态以它匹配 ActionItem）。 */
  id: string
  /** 视图组件：宿主渲染时按标准 kit 传入 t（可选，自包含组件可忽略）。 */
  render: ComponentType<{ t?: (key: string) => string }>
  /** 视图文案命名空间（可选，默认宿主 'panel'；视图可声明自己的 NS）。 */
  locale?: string
}

/** ActionItem 合成 props：id + 图标 + 点击行为 + 文字（子插件只填这些）。 */
export interface PanelActionItemProps {
  /** 条目唯一标识（active 态：当前内容区替换 id 与之相等则保持选中样式）。 */
  id: string
  /** 条目图标（16px 语义，自绘 SVG 组件实例）。 */
  icon?: ReactElement
  /** 点击行为：自定义动作；打开内容区替换典型写法是调 renderPanelContent。 */
  onClick?: () => void
  /** 条目文字（wide 态显示；折叠态宿主 CSS 自动隐藏，只留图标钮）。 */
  children?: ReactNode
}

/** 当前 conversation 替换的 inject 句柄（undefined = 官方会话区 live）。 */
let conversationSeat: (() => void) | undefined
/** 当前替换视图规格。 */
let currentSpec: PanelContentSpec | undefined
/** 替换状态（ActionItem active 样式订阅源）。 */
const panelViewStore = createSnapshotStore<{ id: string } | null>(null)
/** 根上下文（renderPanelContent 内部注册用）。 */
let rootCtx: Context | undefined

/** 渲染 conversation 槽条目：包标记容器 + 宿主内容列（宽度约束由宿主决定，见 styles.ts）。 */
function ConversationSeat({ t }: { t: (key: string) => string }): ReactElement | null {
  const spec = currentSpec
  if (!spec)
    return null
  const View = spec.render
  return (
    <div data-dshp-panel-view="" className="dshp-panelView">
      {/* 内容列：对齐官方内容列宽度（max-width var(--dsh-chat-content-width, 748px)），
          子插件零宽度关注，只负责内容自身布局（垂直方向自定）。 */}
      <div className="dshp-panelViewColumn">
        <View t={t} />
      </div>
    </div>
  )
}

/**
 * capture 层 pointerdown：替换激活时，只响应**侧栏内**（[data-dshp-panel-sidebar]）
 * 的点击——右侧区域（第三方悬浮按钮等）不影响替换，避免误关。侧栏内点击
 * 替换视图/面板条目不处理（条目留给 onClick），其余关闭替换——官方会话区
 * 恢复，目标操作继续正常执行。
 */
function onPointerDownCapture(event: PointerEvent): void {
  if (!conversationSeat)
    return
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-dshp-panel-sidebar]') === null)
    return
  if (target?.closest('[data-dshp-panel-view]') !== null || target?.closest('[data-dshp-panel-action]') !== null)
    return
  closeConversation()
}

/** 打开会话区替换：动态注册 priority -1 的 conversation 条目。 */
function openConversation(ctx: Context, spec: PanelContentSpec): void {
  if (currentSpec && currentSpec.id === spec.id)
    return
  if (conversationSeat)
    closeConversation()
  currentSpec = spec
  panelViewStore.set({ id: spec.id })
  conversationSeat = ctx.slots.inject('conversation' as never, () =>
    ctx.slots.register(
      {
        name: 'conversation',
        id: 'dsh-tauri-panel-conversation-seat',
        priority: -1,
        locale: spec.locale ?? NS,
      } as never,
      ConversationSeat,
    ))
  document.addEventListener('pointerdown', onPointerDownCapture, true)
}

/** 关闭会话区替换：dispose inject 句柄 → 注销条目 → 官方 ui-conversation 恢复。 */
function closeConversation(): void {
  conversationSeat?.()
  conversationSeat = undefined
  currentSpec = undefined
  panelViewStore.set(null)
  document.removeEventListener('pointerdown', onPointerDownCapture, true)
}

/** 订阅当前替换 id（null = 官方会话区）。 */
function usePanelViewId(): { id: string } | null {
  return useSyncExternalStore(
    fn => panelViewStore.subscribe(fn),
    () => panelViewStore.getSnapshot(),
  )
}

/** ActionItem：面板区条目（样式/折叠/active 态全宿主，子插件只填内容与行为）。 */
export function PanelActionItem({ id, icon, onClick, children }: PanelActionItemProps): ReactElement {
  const active = usePanelViewId()?.id === id
  return (
    <button
      type="button"
      className={active ? 'dshp-menuItem dshp-menuItemSelected' : 'dshp-menuItem'}
      data-dshp-panel-action=""
      onClick={onClick}
    >
      {icon !== undefined && <span className="dshp-menuItemIcon">{icon}</span>}
      <span className="dshp-menuItemLabel">{children}</span>
    </button>
  )
}

/**
 * 切换会话区替换：未替换则打开（conversation 槽动态注册 spec.render），
 * 已替换则关闭恢复官方会话界面。子插件在 ActionItem 的 onClick 里调用。
 * @param spec - 内容区规格。
 */
export function renderPanelContent(spec: PanelContentSpec): void {
  if (!rootCtx)
    return
  if (conversationSeat)
    closeConversation()
  else
    openConversation(rootCtx, spec)
}

/**
 * 安装宿主服务：经 ctx.reflect.provide 暴露 panel.protocol（effect 生命周期，
 * 插件卸载即注销）。不依赖 renderer 补丁（conversation 注册只走 slots
 * runtime）——旧核心下内容区替换仍可用（仅面板区条目需 renderer）。
 * @param ctx - 客户端根上下文。
 */
export function installPanelService(ctx: Context): void {
  rootCtx = ctx
  const api = {
    ActionItem: PanelActionItem,
    renderPanelContent,
  }
  ctx.effect(
    () => ctx.reflect.provide(PANEL_PROTOCOL_SERVICE, api),
    'dsh-tauri-panel: panel.protocol host service',
  )
}
