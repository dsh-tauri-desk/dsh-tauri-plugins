/**
 * renderer.d.ts — 对 '@deepseek-ai/dsh-client-ui-renderer' 的脚本式 ambient
 * 声明（本文件**无顶层 import**，保持全局脚本身份，使 declare module 成为
 * 真正的环境模块声明，不要求目标模块在类型空间可解析）。
 *
 * 背景：renderer 运行时模块只导出 apply/inject；我们依赖 deepseek-harness-pkg
 * 的一行导出补丁（exports.SlotOutlet = SlotOutlet）拿到 SlotOutlet —— 它从
 * HostContext 渲染任意已声明槽位（含标准 kit / 错误边界 / 子槽递归），
 * 是本插件“整槽替换 sidebar 后仍渲染官方子槽（workspaces/settings/brand…）
 * 与面板区协议槽（sidebar.panel.action）”的钥匙。类型此处按其最小表面声明。
 */
declare module '@deepseek-ai/dsh-client-ui-renderer' {
  /** SlotOutlet 的非链式渲染选项（字面镜像 renderer 的 RenderOpts）。 */
  export interface SlotOutletOpts {
    /** list 槽按 id 过滤（官方面板渲染 settings.section 用 {only: active}）。 */
    only?: string
    entryKey?: string
    /** 槽无 live 条目时渲染的兜底内容。 */
    fallback?: import('react').ReactNode
    hookContext?: unknown
  }

  export interface SlotOutletProps {
    /** 目标槽 key（如 'sidebar.workspaces' / 'sidebar.panel.action'）。 */
    slotKey: string
    /** 槽声明的 owner props 共享。 */
    ownerProps: Record<string, unknown>
    opts?: SlotOutletOpts
  }

  /** 从 HostContext 渲染任意已声明槽位。 */
  export function SlotOutlet(props: SlotOutletProps): import('react').ReactNode
}
