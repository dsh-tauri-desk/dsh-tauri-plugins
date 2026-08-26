/**
 * styles.ts — 会话区替换界面（居中占位内容区）的样式注入。
 *
 * 宽度约束（对齐官方内容列）由宿主 dsh-tauri-panel 统一提供
 * （.dshp-panelViewColumn：max-width var(--dsh-chat-content-width, 748px)、
 * width 100%、margin 0 auto、满高）——本插件只负责内容自身布局
 * （垂直居中占位），零宽度关注。
 *
 * 面板区条目复用 dsh-tauri-panel 全局注入的 dshp-menuItem 系列样式，无需自备。
 * 注入幂等：同 id 的 <style> 只插一次。
 */
const STYLE_ID = 'dsh-tauri-panel-placeholder-styles'

const CSS = `
.dshp-placeholderCenter{box-sizing:border-box;min-height:100%;color:var(--dsw-alias-label-primary);align-items:center;justify-content:center;display:flex}
.dshp-placeholderText{font-size:15px;color:var(--dsw-alias-label-secondary);user-select:none}
`

/** 注入会话区替换界面样式（幂等：同 id 只插一次）。 */
export function installPanelStyles(): void {
  if (typeof document === 'undefined')
    return
  if (document.getElementById(STYLE_ID) !== null)
    return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
