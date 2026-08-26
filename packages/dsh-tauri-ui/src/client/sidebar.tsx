import type { Context } from '@deepseek-ai/cordis'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'
import { SlotOutlet } from '@deepseek-ai/dsh-client-ui-renderer'
/**
 * sidebar.tsx — shell.overlay 里的设置侧边栏（id 'dsh-tauri-ui-settings'）。
 *
 * 布局即需求方 ASCII：整窗左侧停靠 —— 左栏（← 返回应用 / 🔍 搜索设置…
 * / 设置项导航，只过滤左栏列表）+ 右侧内容区。内容区渲染当前激活分区：
 *
 *   <SlotOutlet slotKey="settings.section" ownerProps={{ close }} opts={{ only: activeId }} />
 *
 * 与官方 SettingsPanel 的渲染调用逐参数一致（owner={close}，only=active）。
 * shell.overlay 是 list/root 且层本身 click-through，本条目 opt-in pointer
 * events。Esc 与“返回应用”都走 closeSettings()；打开时聚焦搜索框。
 *
 * 视觉对齐官方（用户反馈 m00308/m00310）：
 *   1. 左栏背景 = 官方 sidebar（.hHd-Xa_root）的 --dsw-specific-sidebar-fill；
 *   2. 内容区背景 = 主界面（.wSkVaW_root / .wSkVaW_scrollBody）的 --dsw-alias-bg-base；
 *   3. 左栏宽度可拖拽调整（镜像官方 DragHandle：pointer capture + rAF 节流），
 *      开通与官方一致的合约区间 clamp [264, 420]（官方默认 280、关闭即忘）；
 *      打开时按官方 sidebar 槽（[data-slot="sidebar"]）的实际渲染宽度做一次同步。
 *   4. 内容区宽度与主界面 hero 行一致：
 *      min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance)), 100%)
 *      （这些 --dsh-composer-* 变量定义域在官方 .wSkVaW_root 容器，overlay 在其外，
 *      由本组件在根节点自带相同定义），左右留空与主界面对齐。
 *   无“最小化/折叠 rail”模式：返回应用/Esc 即整体隐藏（与 codex 同思路）。
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from './icons'
import { settingsText, useSettingsLocale } from './locale'
import { useSettingsSectionRows } from './sections'
import {
  clampRailWidth,
  closeSettings,
  RAIL_WIDTH_DEFAULT,
  selectSection,
  setRailWidth,
  settingsStore,
  useSettingsUi,
} from './store'

/** GlobalStandardProps 的 useSessions 形状（本地镜像）。 */
type SelectorHook<T> = <S>(sel: (s: T) => S) => S

/** shell.overlay 条目无 owner props；标准钩子被本组件消费。 */
interface SettingsSidebarProps {
  useSessions: SelectorHook<SessionListState>
  useWorkspaces?: unknown
}

/**
 * 根节点：整窗停靠层。内容区背景 = 主界面 bg-base（item 2）；同时在此自带
 * 官方 .wSkVaW_root 定义域的 --dsh-composer-* 宽度变量（其外不继承）。
 */
const rootStyle: React.CSSProperties = {
  'position': 'fixed',
  'inset': 0,
  'zIndex': 1000,
  'display': 'flex',
  'background': 'var(--dsw-alias-bg-base)',
  'color': 'var(--dsw-alias-label-primary)',
  // 与主界面一致的宽度合约（官方值：chat-content-width 748px + 两侧 16px 留空）。
  '--dsh-chat-content-width': '748px',
  '--dsh-composer-card-max-width': 'calc(var(--dsh-chat-content-width) + 32px)',
  '--dsh-composer-side-clearance': '16px',
} as React.CSSProperties

/** 左栏：官方 sidebar（.hHd-Xa_root）配色与内边距（item 1）；宽度动态。 */
const railBaseStyle: React.CSSProperties = {
  flex: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '6px 12px',
  background: 'var(--dsw-specific-sidebar-fill)',
  borderRight: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.2))',
  overflow: 'hidden',
}

/** 拖拽手柄：8px 抓取条跨在左栏/内容区边界（镜像官方 DragHandle 交互）。 */
const handleStyle: React.CSSProperties = {
  flex: 'none',
  alignSelf: 'stretch',
  width: 8,
  marginLeft: -4,
  zIndex: 2,
  cursor: 'col-resize',
  touchAction: 'none',
  background: 'transparent',
  borderRadius: 4,
}

/** 内容区外层：占满剩余宽度、纵向滚动；背景继承根节点 bg-base。 */
const contentOuterStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '100%',
  boxSizing: 'border-box',
  overflowY: 'auto',
  display: 'flex',
}

/** 内容区内层：与主界面 hero 行同宽（item 4），左右留空对齐，居中。 */
const contentInnerStyle: React.CSSProperties = {
  width: 'min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance)), 100%)',
  margin: '0 auto',
  boxSizing: 'border-box',
  padding: '28px 36px',
}

const backButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  alignSelf: 'flex-start',
  padding: '6px 10px',
  border: 'none',
  background: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'inherit',
  width: '100%',
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--dsw-alias-label-primary)',
}

const searchStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  boxSizing: 'border-box',
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.25))',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const navItemStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  height: 40,
  padding: '9px 12px',
  border: 'none',
  background: 'none',
  borderRadius: 12,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 400,
  color: 'var(--dsw-alias-label-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const emptyStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
}

/**
 * 侧边栏组件：整窗 docked 左栏 + 右侧官方设置分区内容。
 * @param _props - 标准钩子（当前未消费 useSessions，保留以符合合成 props）。
 * @returns 侧边栏，或 null（未打开时 shell.overlay 条目不占位、不挡点击）。
 */
export function SettingsSidebar(_props: SettingsSidebarProps): ReactElement | null {
  const ui = useSettingsUi()
  const rows = useSettingsSectionRows()
  useSettingsLocale()
  const searchRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Esc 关闭（仅打开期间挂载监听，与官方 SettingsPanel 同生命周期）。
  useEffect(() => {
    if (!ui.open)
      return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape')
        closeSettings()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui.open])

  // 打开时聚焦搜索框；并按官方 sidebar 槽的实际渲染宽度同步左栏宽度（item 3）。
  useEffect(() => {
    if (!ui.open)
      return
    const el = document.querySelector('[data-slot="sidebar"]')
    const width = el?.getBoundingClientRect().width
    if (typeof width === 'number' && width >= 264)
      setRailWidth(clampRailWidth(width))
    searchRef.current?.focus()
  }, [ui.open])

  // 自定义主题可能把 --dsw-alias-bg-base 设定为半透明：设置页（整窗停靠层，
  // rootStyle 的背景取该变量）打开时会与会话区/侧栏（含右侧详情栏）重叠显形。
  // 打开时把下方各内容槽（sidebar / conversation / details）的宿主列（真实盒，
  // 即槽锚点 .parentElement）用 opacity:0 隐藏，关闭时复原。visibility 会因局部
  // 显式可见或 display:contents 中间节点在多级嵌套内容（如 workspace 的
  // sectionHeader）上被覆盖而不可靠；opacity:0 对整个子树按组生效，后代无法反制。
  // 设置页在兄弟槽 shell.overlay，不受影响。
  useEffect(() => {
    const targets: HTMLElement[] = []
    for (const slotKey of ['sidebar', 'conversation', 'details']) {
      const anchor = document.querySelector<HTMLElement>(`[data-slot="${slotKey}"]`)
      if (!anchor)
        continue
      targets.push(anchor.parentElement ?? anchor)
    }
    if (targets.length === 0)
      return
    // 记录打开前各宿主列已有的内联 opacity，关闭时按原值复原（而不是清空），
    // 避免覆盖其它插件/主题预设的内联 opacity。
    const previous = targets.map(el => el.style.opacity)
    if (ui.open) {
      for (const el of targets) el.style.opacity = '0'
    }
    return () => {
      targets.forEach((el, index) => {
        el.style.opacity = previous[index]
      })
    }
  }, [ui.open])

  if (!ui.open)
    return null

  const railWidth = ui.railWidth ?? RAIL_WIDTH_DEFAULT
  const query = ui.query.trim().toLowerCase()
  const visible = query
    ? rows.filter(
        row =>
          row.label.toLowerCase().includes(query) || row.id.toLowerCase().includes(query),
      )
    : rows
  const activeId = visible.some(row => row.id === ui.activeId)
    ? ui.activeId
    : visible[0]?.id

  return (
    <div style={rootStyle} data-slot-sidebar="dsh-tauri-ui">
      <div style={{ ...railBaseStyle, width: railWidth }}>
        <button
          type="button"
          style={backButtonStyle}
          onClick={() => closeSettings()}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'none'
          }}
        >
          <ArrowRight />
          {settingsText('back')}
        </button>
        <input
          ref={searchRef}
          style={searchStyle}
          value={ui.query}
          placeholder={settingsText('search')}
          aria-label={settingsText('search')}
          onChange={event =>
            settingsStore.update((state) => {
              state.query = event.target.value
            })}
        />
        <nav style={navStyle} aria-label={settingsText('settings')}>
          {visible.map(row => (
            <button
              key={row.id}
              type="button"
              style={{
                ...navItemStyle,
                ...(row.id === activeId
                  ? {
                      background: 'var(--dsw-specific-sidebar-nav-item-active)',
                      fontWeight: 500,
                    }
                  : {}),
              }}
              aria-current={row.id === activeId ? 'true' : undefined}
              onClick={() => selectSection(row.id)}
            >
              {row.label}
            </button>
          ))}
          {visible.length === 0 && <div style={emptyStyle}>{settingsText('noResults')}</div>}
        </nav>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={settingsText('settings')}
        style={{
          ...handleStyle,
          background: dragging ? 'var(--dsw-alias-border-l2)' : 'transparent',
        }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          const startX = event.clientX
          const startWidth = ui.railWidth ?? RAIL_WIDTH_DEFAULT
          setDragging(true)
          let raf = 0
          const onMove = (moveEvent: PointerEvent): void => {
            if (raf)
              cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
              setRailWidth(clampRailWidth(startWidth + (moveEvent.clientX - startX)))
            })
          }
          const onUp = (): void => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            setDragging(false)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }}
      />
      <div style={contentOuterStyle}>
        <div style={contentInnerStyle}>
          {activeId !== undefined && (
            <SlotOutlet
              slotKey="settings.section"
              ownerProps={{ close: () => closeSettings() }}
              opts={{ only: activeId }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 注册：shell.overlay（list）新增一个独立条目，渲染设置侧边栏。
 * @param ctx - 客户端根上下文。
 */
export function registerSettingsSidebar(ctx: Context): void {
  ctx.effect(
    () =>
      ctx.slots.register(
        { name: 'shell.overlay', id: 'dsh-tauri-ui-settings', registrant: 'dsh-tauri-ui' },
        SettingsSidebar,
      ),
    'dsh-tauri-ui: settings sidebar',
  )
}
