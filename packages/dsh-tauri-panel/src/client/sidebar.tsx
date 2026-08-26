import type { Context } from '@deepseek-ai/cordis'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'
import { SlotOutlet } from '@deepseek-ai/dsh-client-ui-renderer'
import { useEffect, useRef, useState } from 'react'
import { ChatOutline, FishMark } from './icons'
import { NS } from './locale'

/**
 * sidebar.tsx — sidebar 槽的整槽替换（priority -1 shadow 官方 ui-sidebar）。
 *
 * 结构为官方 SidebarRoot（dsh-client-ui-sidebar 0.1.1-rc.2）的克隆，改动点：
 *   - logoRow 高度 60px → 32px、底部间距 8px → 4px（需求①②）；
 *   - 「新会话」按钮从 logoRow 下方移入**面板区**（需求③），样式改为
 *     workspace 菜单项行样式（需求④，镜像官方 Rows.module.css .sessionRow）；
 *   - 面板区 = 新会话菜单项 + 第三方功能项（槽 `sidebar.panel.action`，
 *     list/root，本条目 children 声明，协议⑤，见 PROTOCOL.md）。
 *
 * 渲染官方子槽（brand.mark/brand.name/workspaces/footer.action/settings）一律
 * 走 <SlotOutlet>（无 children 所有权检查）：官方条目仍 live（被 shadow），
 * 其 children 声明与 locale 注册继续生效；本条目**只**声明新增槽
 * sidebar.panel.action（子槽 key 全局唯一，绝不重声明官方子槽）。
 *
 * 交互行为镜像官方：折叠 settled（COLLAPSE_SETTLE_MS=150）→ wide 判定、
 * rail-in/fading 动画类、滚动条 linger（quietBars）。
 */

/** COLLAPSE_SETTLE_MS — 折叠动画 settle 延迟（镜像官方）。 */
const COLLAPSE_SETTLE_MS = 150
/** SCROLLBAR_LINGER_MS — 指针离开后滚动条淡出延迟（镜像官方）。 */
const SCROLLBAR_LINGER_MS = 2000

/** 简易 classnames 拼接。 */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** sidebar 槽 owner 传入的合成 props 子集。 */
interface SidebarRootProps {
  /** 侧栏折叠态（layout 的 sidebarCol 状态）。 */
  collapsed: boolean
  /** 侧栏宽度（wide 态生效）。 */
  width: number
  /** 开始新会话（inject：ctx.workspaces.startSession）。 */
  startSession: (workspaceId?: string) => void
  /** 折叠/展开切换（inject：ctx.layout.toggleSidebar）。 */
  toggleSidebar: () => void
  /** 本条目 locale 翻译函数（panel NS）。 */
  t: (key: string) => string
}

/** 克隆的 SidebarRoot：紧凑 logoRow + 面板区 + 官方子槽透传。 */
function SidebarRootClone({ collapsed, width, startSession, toggleSidebar, t }: SidebarRootProps): ReactElement {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    const timer = window.setTimeout(() => {
      setSettled(true)
    }, COLLAPSE_SETTLE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [collapsed])

  const wide = !collapsed || !settled
  const lastWideWidth = useRef(width)
  if (!collapsed)
    lastWideWidth.current = width
  const everWide = useRef(!collapsed)
  if (!collapsed)
    everWide.current = true

  // 滚动条 linger：指针进入取消计时，离开后 2s 把滚动条 thumb 变透明。
  const [pointerInside, setPointerInside] = useState(false)
  const lingerTimer = useRef<number | undefined>(undefined)
  const armLinger = (): void => {
    if (lingerTimer.current !== undefined)
      return
    lingerTimer.current = window.setTimeout(() => {
      lingerTimer.current = undefined
      setPointerInside(false)
    }, SCROLLBAR_LINGER_MS)
  }
  const cancelLinger = (): void => {
    window.clearTimeout(lingerTimer.current)
    lingerTimer.current = undefined
  }

  return (
    <div
      className={cx(
        'dshp-root',
        !wide && 'dshp-collapsed',
        !wide && everWide.current && 'dshp-railIn',
        collapsed && wide && 'dshp-fading',
        !pointerInside && 'dshp-quietBars',
      )}
      data-dshp-panel-sidebar=""
      style={wide ? { width: collapsed ? lastWideWidth.current : width } : undefined}
      onPointerEnter={() => {
        cancelLinger()
        setPointerInside(true)
      }}
      onPointerLeave={() => {
        armLinger()
      }}
    >
      <div className="dshp-logoRow">
        {wide && (
          <button
            type="button"
            className="dshp-brand"
            aria-label={t('session.new.label')}
            onClick={() => startSession()}
          >
            <span className="dshp-brandIdentity" aria-hidden="true">
              <span className="dshp-brandMark">
                <SlotOutlet
                  slotKey="sidebar.brand.mark"
                  ownerProps={{ size: 24 }}
                  opts={{ fallback: <FishMark size={24} /> }}
                />
              </span>
              <span className="dshp-brandName">
                <SlotOutlet
                  slotKey="sidebar.brand.name"
                  ownerProps={{}}
                  opts={{ fallback: <span className="dshp-fallbackBrandName">DSH Local Build</span> }}
                />
              </span>
            </span>
          </button>
        )}
        <button
          type="button"
          className="dshp-iconButton dshp-toggle"
          aria-label={collapsed ? t('toggle.open') : t('toggle.collapse')}
          title={collapsed ? t('toggle.open') : t('toggle.collapse')}
          onClick={() => toggleSidebar()}
        >
          {!wide && (
            <span className="dshp-railMark" aria-hidden="true">
              <SlotOutlet
                slotKey="sidebar.brand.mark"
                ownerProps={{ size: 24 }}
                opts={{ fallback: <FishMark size={24} /> }}
              />
            </span>
          )}
        </button>
      </div>
      {/* <div className="dshp-sectionHeader">
        <span className="dshp-sectionHeaderTitle">工作面板</span>
      </div> */}
      <div className="dshp-panelArea">
        <button
          type="button"
          className="dshp-menuItem dshp-newSession"
          title={t('session.new.label')}
          onClick={() => startSession()}
        >
          <span className="dshp-menuItemIcon"><ChatOutline size={wide ? 14 : 18} /></span>
          <span className="dshp-menuItemLabel">{t('session.new')}</span>
        </button>
        <SlotOutlet slotKey="sidebar.panel.action" ownerProps={{ wide }} />
      </div>

      <div className="dshp-regionArea">
        <SlotOutlet
          slotKey="sidebar.workspaces"
          ownerProps={{
            wide,
            expandSidebar: () => {
              if (collapsed)
                toggleSidebar()
            },
          }}
        />
      </div>

      <div className="dshp-footArea">
        <div className="dshp-footerActions">
          <SlotOutlet slotKey="sidebar.footer.action" ownerProps={{ wide }} />
        </div>
        <div className="dshp-settingsArea">
          <SlotOutlet slotKey="sidebar.settings" ownerProps={{ wide }} />
        </div>
      </div>
    </div>
  )
}

/**
 * 注册：等待 sidebar 槽声明（layout 的 AppFrame renderSlot("sidebar")）后，
 * 以 priority -1 shadow 官方 ui-sidebar 条目；children 仅声明新增的
 * sidebar.panel.action 协议槽。
 * @param ctx - 客户端根上下文。
 */
export function installSidebarRoot(ctx: Context): void {
  ctx.slots.inject('sidebar' as never, () =>
    ctx.slots.register(
      {
        name: 'sidebar',
        id: 'dsh-tauri-panel',
        priority: -1,
        locale: NS,
        children: {
          'sidebar.panel.action': { kind: 'list', scope: 'root' },
        },
        inject: () => ({
          startSession: (workspaceId?: WorkspaceId) => ctx.workspaces.startSession(workspaceId),
          toggleSidebar: () => ctx.layout.toggleSidebar(),
        }),
      } as never,
      SidebarRootClone,
    ))
}
