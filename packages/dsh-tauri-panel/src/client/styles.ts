/**
 * styles.ts — 克隆 SidebarRoot 的样式注入。
 *
 * 整槽替换的收益：外壳 DOM 与样式完全自控，不依赖官方 CSS module 的 hash
 * 类名（hHd-Xa_* 随构建版本漂移）。类名统一 `dshp-` 前缀；数值镜像官方
 * SidebarRoot.module.css（0.1.1-rc.2），并按需求改造：
 *   - logoRow 高度 60px → 32px、底部间距 8px → 4px（①②）；
 *   - 新会话按钮移入面板区、改为 workspace 菜单项行样式（③④，
 *     镜像官方 Rows.module.css 的 .sessionRow：32px / radius 8px / padding 0 8px /
 *     hover var(--dsw-alias-interactive-bg-hover)）。
 * 动画（rail-in 150ms 49px、fade、wide-in）与滚动条 linger（quietBars）保留官方行为。
 * 注入幂等：同 id 的 <style> 只插一次；插件卸载由宿主卸载 bundle，样式留存可接受。
 */
const STYLE_ID = 'dsh-tauri-panel-styles'

const CSS = `
.dshp-root{--dshp-padding:12px;height:100%;padding:6px var(--dshp-padding);box-sizing:border-box;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;font-size:14px;display:flex}
.dshp-root.dshp-collapsed{padding:18px 10px 6px}
.dshp-root.dshp-quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}
.dshp-fading>*{opacity:0;transition:opacity .15s var(--ds-ease-in-out)}
.dshp-railIn .dshp-iconButton,.dshp-railIn .dshp-menuItem,.dshp-railIn .dshp-regionArea{animation:dshp-rail-in .15s var(--ds-ease-in-out) backwards}
.dshp-railIn .dshp-footArea{animation:dshp-rail-fade-in .15s var(--ds-ease-in-out) backwards}
@keyframes dshp-rail-in{0%{opacity:0;transform:translate(49px)}}
@keyframes dshp-rail-fade-in{0%{opacity:0}}
.dshp-logoRow{box-sizing:border-box;flex:none;justify-content:flex-end;align-items:center;gap:8px;height:32px;margin-bottom:4px;padding:4px 0 4px 4px;display:flex;overflow:hidden}
.dshp-collapsed .dshp-logoRow{justify-content:flex-start;height:32px;margin-bottom:4px;padding:0}
.dshp-brand{min-width:0;color:inherit;cursor:pointer;background:transparent;border:none;flex:1;align-items:center;padding:0;display:inline-flex;overflow:hidden}
.dshp-brandIdentity{align-items:center;gap:8px;min-width:0;height:24px;display:inline-flex}
.dshp-brandMark{flex:none;justify-content:center;align-items:center;display:inline-flex}
.dshp-brandName{letter-spacing:.04em;align-items:center;gap:6px;min-width:0;height:24px;font-size:18px;font-weight:600;line-height:24px;display:inline-flex}
.dshp-fallbackBrandName{letter-spacing:0;white-space:nowrap;font-size:17px}
.dshp-iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:transparent;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dshp-iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshp-collapsed .dshp-iconButton{width:36px;height:36px;color:var(--dsw-alias-label-primary)}
.dshp-railMark{justify-content:center;align-items:center;display:inline-flex}
.dshp-panelArea{flex:none;flex-direction:column;align-items:stretch;gap:2px;margin:0 0 8px;display:flex}
.dshp-collapsed .dshp-panelArea{align-items:center;gap:4px}
.dshp-menuItem{box-sizing:border-box;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-radius:8px;align-items:center;gap:0;padding:0 8px;height:32px;min-width:0;display:flex;font-family:inherit;font-size:14px;line-height:22px;text-align:left;overflow:hidden}
.dshp-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshp-menuItemSelected,.dshp-menuItemSelected:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshp-menuItemIcon{flex:none;width:16px;height:20px;color:var(--dsw-alias-label-tertiary);justify-content:center;align-items:center;display:inline-flex}
.dshp-menuItemLabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 6px 0 4px;min-width:0}
.dshp-collapsed .dshp-menuItem{justify-content:center;width:36px;height:36px;padding:0}
.dshp-collapsed .dshp-menuItemLabel{display:none}
.dshp-regionArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dshp-padding));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:hidden}
.dshp-collapsed .dshp-regionArea{margin-left:0;margin-right:0;padding-left:0}
.dshp-footArea{flex-direction:column;flex:none;display:flex}
.dshp-settingsArea,.dshp-footerActions{flex:none;width:100%;min-width:0}
.dshp-footerActions{display:flex}
.dshp-collapsed .dshp-footArea{align-items:center}
.dshp-collapsed .dshp-settingsArea,.dshp-collapsed .dshp-footerActions{justify-content:center;width:auto;display:flex}
/* 会话区替换座位（宿主决定宽度约束）：滚动容器 + 内容列。
   内容列镜像官方会话内容列 .Md3f7G_column（max-width var(--dsh-chat-content-width)、
   width 100%、margin 0 auto、flex column、gap 16px）；替换后官方
   ConversationRoot（定义该变量处）不渲染，以 748px（官方默认值）兜底，
   外层若已有定义则继承生效——子插件零宽度关注。 */
.dshp-panelView{height:100%;box-sizing:border-box;min-width:0;overflow-y:auto}
.dshp-panelViewColumn{max-width:var(--dsh-chat-content-width,748px);min-height:100%;width:100%;margin:0 auto;flex-direction:column;gap:16px;display:flex}
@media (prefers-reduced-motion:reduce){.dshp-fading>*,.dshp-railIn .dshp-iconButton,.dshp-railIn .dshp-menuItem,.dshp-railIn .dshp-footArea,.dshp-railIn .dshp-regionArea{transition:none;animation:none}}
`

/** 注入面板样式（幂等：同 id 只插一次）。 */
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
