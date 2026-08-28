/**
 * dsh-tauri-trust-mode 宿主侧（node half）：切换 Harness 权限预设，免除逐次执行审批。
 *
 * 机制与 deepseek-harness-desktop 的信任模式一致：改写 $DSH_HOME/settings.yaml 的
 * permissionPresets.defaultPreset —— danger-full-access（不再询问）与 workspace-write
 * （逐次询问）之间切换。变更对之后新建的会话生效，不触碰任何 agent preset 组成，
 * 也不依赖 harness 内部 RPC，因此跨平台一致、可随时关回。
 *
 * 落盘采用文本级最小编辑（只定位/追加 permissionPresets 分节下的 defaultPreset 一行，
 * 其余内容原样保留），避免 YAML 往返序列化丢注释、也缩小与 harness 写入的竞态窗口。
 */
import type { HostContext } from './types.js'
import { TRUST_MODE_API_PREFIX, TRUST_MODE_PLUGIN_NAME } from './constants.js'
import { routeHandler } from './http.js'
import { setTrustMode, trustModeEnabled } from './settings.js'

/** 插件名（诊断元数据，与 cordis.patch.yml 的 id/name 一致）。 */
export const name = TRUST_MODE_PLUGIN_NAME

/** 宿主侧需要的服务：webServer（注册 /api/dsh-trust-mode/* 路由）。 */
export const inject = ['webServer']

/** 构建 HTTP 路由：status（读）/ set（写）。 */
export function buildRoutes(): any[] {
  return [
    {
      kind: 'exact',
      path: `${TRUST_MODE_API_PREFIX}/status`,
      handler: routeHandler(async () => [200, { enabled: trustModeEnabled() }]),
    },
    {
      kind: 'exact',
      path: `${TRUST_MODE_API_PREFIX}/set`,
      handler: routeHandler(async (body: { enabled?: boolean }) => {
        const enabled = Boolean(body.enabled)
        try {
          setTrustMode(enabled)
          return [200, { ok: true, enabled }]
        }
        catch (error) {
          return [500, { error: error instanceof Error ? error.message : String(error) }]
        }
      }, { mutate: true }),
    },
  ]
}

/**
 * 插件入口：注册信任模式的 HTTP 路由。客户端经 /api/dsh-trust-mode/* 调用。
 * @param ctx - 宿主根上下文（须已注入 webServer）。
 */
export function apply(ctx: HostContext): void {
  ctx.effect(() => {
    const disposers = buildRoutes().map((route: any) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers)
        dispose()
    }
  })
}
