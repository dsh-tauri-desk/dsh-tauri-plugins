import type { IncomingMessage, ServerResponse } from 'node:http'

/** 宿主 ctx 不在插件侧做类型化（仓库先例：dsh-tauri-worktree）；服务面以运行时守卫消费。 */
export type HostContext = any

/** 行配置；tempRoot 缺省解析为 $DSH_HOME/tmp-sessions（无 $DSH_HOME 时 ~/.dsh/tmp-sessions）。 */
export interface PluginConfig {
  tempRoot?: string
  /** 是否在启动时修补 conversation 内核 bundle（默认开启）。 */
  kernelPatch?: boolean
}

export type JsonBody = Record<string, unknown>

export type RouteResult = [number, unknown]

export type RouteFunction = (body: JsonBody, req: IncomingMessage) => Promise<RouteResult>

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

export interface ExactRoute {
  kind: 'exact'
  path: string
  handler: RouteHandler
}

/** conversation 内核 bundle 补丁规格。 */
export interface ConversationPatchSpec {
  /** 被修补的上游包名。 */
  package: string
  /** 预期的上游压缩源片段。 */
  from: string
  /** 替换后的片段（内嵌插件标记）。 */
  to: string
  /** 本插件补丁标记（幂等判据）。 */
  mark: string
  /** 独立版 dsh-temp-session 的旧标记：命中视为已修补，避免重复备份或误报漂移。 */
  legacyMark?: string
}

export type PatchStatus = 'patched' | 'already' | 'drifted'

export interface PatchResult {
  status: PatchStatus
  /** 处理后的 bundle 文本（already / drifted 时为原文）。 */
  content: string
}

/** workspaceRegistry 物化的 Workspace 记录子集（启动清理仅消费 id 与 path）。 */
export interface WorkspaceRecord {
  id: string
  path?: string
}

/** cordis logger 的非类型化子集（宿主 ctx 未类型化）。 */
export interface LoggerLike {
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
}

/** systemPrompt text 回调收到的 context 子集（本插件只读当前会话的 header.cwd）。 */
export interface SystemPromptContext {
  scope?: {
    session?: {
      header?: {
        cwd?: unknown
      }
    }
  }
}
