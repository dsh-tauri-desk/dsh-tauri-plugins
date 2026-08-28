/**
 * dsh-tauri-temp-session 宿主半区（node half）：工作区可选 + 无工作区临时会话。
 *
 * 职责：
 *   1. 内核客户端补丁（幂等，`kernelPatch` 配置可关）：使无工作区会话获得 cwd
 *      标签 → chipTitle 非空 → 组合输入框可输入、可发送（见 kernel-patch.ts）；
 *   2. HTTP 路由 `POST <prefix>/reserve`：为一次新的临时会话预留独立目录
 *      <tempRoot>/session-<uuid>；客户端随后以 sessions.create({ sessionId, cwd })
 *      创建会话（服务端 ensureSession 会递归建目录并写入 header.cwd）；
 *   3. 启动清理：注销 workspace 注册表为临时目录物化的 Workspace 记录（保持
 *      临时会话 Ungrouped）；删除既不在存活 Agent 也不在持久化列表中、超过
 *      保留时长的临时目录（见 cleanup.ts）；
 *   4. 系统提示注入：处于临时目录中的会话，向模型说明其工作目录的临时语义
 *      （软性约束，与 dsh 沙盒"读取不设限"的设计一致）。
 *
 * 注：除类型外零依赖 @deepseek-ai/* 包（文件操作只使用 node: 内建模块），仅依赖
 * cordis 注入的宿主服务。
 */
import type { HostContext, PluginConfig, SystemPromptContext } from './types'
import { join } from 'node:path'
import { cleanup, isUnderRoot } from './cleanup'
import {
  CLEANUP_EFFECT,
  RESERVE_ROUTE_EFFECT,
  TEMP_SESSION_PLUGIN_NAME,
  TEMP_SESSION_SECTION_ORDER,
} from './constants'
import { patchConversationBundle, resolveDshHome } from './kernel-patch'
import { createReserveRoute } from './routes'

/** 插件名（cordis 插件身份，与包名一致）。 */
export const name = TEMP_SESSION_PLUGIN_NAME

/** 需要的宿主服务：webServer（路由）、workspaceRegistry（清理注销）、systemPrompt（提示注入）、agents（存活判定）。 */
export const inject = ['webServer', 'workspaceRegistry', 'systemPrompt', 'agents']

/** systemPrompt text 回调只读当前会话的 header.cwd。 */
function readSessionCwd(context: SystemPromptContext | undefined): string | undefined {
  const cwd = context?.scope?.session?.header?.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : undefined
}

/**
 * 插件入口。
 * @param ctx - cordis 宿主上下文。
 * @param config - 行配置（见 cordis.patch.yml；tempRoot 缺省 $DSH_HOME/tmp-sessions）。
 */
export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  const tempRoot = typeof config?.tempRoot === 'string' && config.tempRoot !== ''
    ? config.tempRoot
    : join(resolveDshHome(), 'tmp-sessions')

  // 0) 内核客户端补丁（启动时同步执行，幂等；kernelPatch: false 可关闭）。
  if (config?.kernelPatch !== false)
    patchConversationBundle(ctx.logger)

  // 1) HTTP 路由：预留一个临时会话目录。
  ctx.effect(() => {
    const dispose = ctx.webServer.register(createReserveRoute(tempRoot))
    return () => dispose()
  }, RESERVE_ROUTE_EFFECT)

  // 2) 启动清理（尽力而为，不阻塞启动）。
  ctx.effect(() => {
    void cleanup(ctx, tempRoot)
  }, CLEANUP_EFFECT)

  // 3) 系统提示：临时目录会话的语义说明。
  ctx.systemPrompt.section({
    name: `plugin:${TEMP_SESSION_PLUGIN_NAME}`,
    order: TEMP_SESSION_SECTION_ORDER,
    text: (context: SystemPromptContext | undefined) => {
      const cwd = readSessionCwd(context)
      if (cwd === undefined || !isUnderRoot(tempRoot, cwd))
        return ''
      return `This session was started WITHOUT selecting a workspace. It runs in an isolated temporary scratch directory: ${cwd}. `
        + `Treat this directory as the session's own project root and keep all writes inside it. `
        + `It is independent from every other session and from the DeepSeek Harness Desktop installation directory; `
        + `do not modify files under the harness application directory. If the user wants to work on a real project, `
        + `they can switch the session to a workspace through the workspace picker.`
    },
  })
}
