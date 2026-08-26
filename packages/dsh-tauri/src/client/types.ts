/** 宿主命令所需的业务面（由插件体注入 ctx.layout）。 */
export interface NavBridgeHandlers {
  toggleSidebar: () => void
}

/** 会话访问栈中的页面。 */
export interface Page {
  key: string | null
  el: HTMLElement | null
}

/** 记录动作（与宿主 `PluginError.action` 语义一致）。 */
export type ErrorAction = 'runtime' | 'install' | 'update' | 'remove'

declare global {
  interface Window {
    /** 插件接管标记：桌面端 NAV_SHIM_JS 检测到后停止收发，避免双重执行。 */
    __dsh_tauri_bridge__?: boolean
  }
}
