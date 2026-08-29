# 通用实现模式

从 dsh 插件开发实践中提炼的具体技法（不依赖任何特定插件实现）。

## HTTP 路由 RPC 模式

宿主（`src/index.ts`）：

```ts
export const inject = ['webServer', 'sessions', 'workspaceRegistry']

export function buildRoutes(ctx: HostContext, dshHome: string): any[] {
  return [
    {
      kind: 'exact',
      path: `${API_PREFIX}/archived`,
      handler: routeHandler(async () => [200, buildArchivedPayload(ctx)]),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/delete`,
      handler: routeHandler(async body => [200, await permanentlyDelete(ctx, dshHome, body)], { mutate: true }),
    },
  ]
}

export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  ctx.effect(() => {
    const disposers = buildRoutes(ctx, dshHome).map(route => ctx.webServer.register(route))
    return () => { for (const d of disposers) d() }
  }, 'my-plugin: routes')
}
```

`routeHandler(fn, { mutate })`（src/http.ts）：方法守卫（mutate 用 POST，
否则 GET）、变更类回环守卫、带大小限制的 JSON body 读取、错误 → `{ error }`
JSON。返回 `[status, payload]`。

客户端（`src/client/store.ts`）：

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MUTATION_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_PREFIX}${path}`, {
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      ...init,
    })
    const body = await res.json().catch(() => ({} as { error?: string }))
    if (!res.ok)
      throw new Error(body.error ?? `请求失败 (${res.status})`)
    return body as T
  }
  finally {
    clearTimeout(timeout)
  }
}
```

## 工具注册 + 系统提示词注入

```ts
export const inject = ['tools', 'systemPrompt', 'webServer', 'sessions', 'workspaceRegistry', 'agents']

// 工具：带类型 schema 的 defineTool
for (const tool of createToolSet(ctx, cfg))
  ctx.tools.register(tool)

// 事件：观察 session/event
ctx.on('session/event', (session, event) => {
  if (event.type === 'turn/end') { ... }
})

// systemPrompt.context：动态按组装上下文（按会话作用域）
ctx.systemPrompt.context({
  name: 'plugin:my-plugin:context',
  order: SECTION_ORDER,
  text: (context) => { const id = context?.scope?.session?.id; ... },
})

// systemPrompt.section：常驻指令
ctx.systemPrompt.section({
  name: 'plugin:my-plugin',
  order: SECTION_ORDER,
  text: (context) => { ... },
})
```

## Agent 生命周期

- `ctx.agents.get(sessionId)` — 查找活跃 Agent。
- `ctx.agents.create(options)` — 在调用方身份下创建 agent + session，返回带
  `dispose()` 的 `AgentHandle`。
- `ctx.agents.resume(options)` — 恢复持久会话。
- `Agent.cancel(cause, opts)` / `agent.whenIdle()` / `agent.followup(msg)`。

## Slot 注册与 props 注入

```ts
ctx.effect(
  () => ctx.slots.register(
    {
      name: SETTINGS_SECTION_SLOT,
      id: SECTION_ID,
      order: SECTION_ORDER,
      registrant: PLUGIN_NAME,
      label: () => text('section'),
      inject: () => ({ sessionsRuntime: ctx.sessions, workspacesRuntime: ctx.workspaces }),
    } as never,                             // slot 不在运行时 SlotMap
    FeaturePage,
  ),
  'my-plugin: section',
)
```

## SnapshotStore + uSES

```ts
export const store = createSnapshotStore<UiState>({ ... })
export function useUi(): UiState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
// 变更：store.update(state => { state.x = ... })
```

宿主侧绕过官方帧的变更（unarchive/delete/clear）之后，显式重新同步客户端
镜像：`refreshArchived()` + `workspaces.manager.refresh()` +
`sessions.refresh()`（cast）——否则 UI 保留过期行。

## 工作区 DOM 菜单补丁

1. 监听项目行省略号按钮（`[role=treeitem][aria-expanded]`），点击时记录组
   （capture 阶段）。
2. 扫描 portal 菜单（`button[role=menuitem]`）中的"删除工作区"标签；改写
   标签文本节点，保留官方图标容器但把 innerHTML 换成官方 SVG，设置
   `color: var(--dsw-alias-label-tertiary)`。
3. capture 拦截点击：从组行经 Fiber key 收集会话 id（排除 `blank` 会话），
   打开 `Modal` 确认，然后批量归档。
4. 派发外部 `pointerdown` 关闭官方 Menu。
5. 清理：断开观察器、关闭对话框根、移除监听器。

## css-render 样式

```ts
const cssr = CssRender()
const { c } = cssr
const style = c([
  c(`.${K.page}`, { display: 'flex', ... }),
  // 双类抬高特异性，覆盖官方 ghost hover
  c(`.${K.danger}.${K.danger}:hover:not(:disabled)`, { background: '...' }),
])

export function mountStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (cssr.find(STYLE_ID) !== null) return () => {}
  style.mount({ id: STYLE_ID, head: true })
  return () => style.unmount({ id: STYLE_ID })
}
```

## 多语文案

模块级 `activeLocale` + `localeRev` store；`installLocale(ctx)` 注册中英文案
并把语言变更桥到 rev；`text(key, values?)` 渲染 `{placeholder}` 模板；
`useLocale()` 在 rev 变化时重渲染。

## 嵌套 ctx.inject（惰性依赖）

```ts
export function apply(ctx) {
  ctx.inject(['webServer', 'skills'], (hostCtx: Context) => {
    ctx.effect(() => { ... }, 'effect-id')
  })
}
```

`ctx.inject(services, callback)` 在服务可用后以包含这些服务的上下文运行
回调——适合可选依赖。

## 清单基础（package.json dsh 字段）

```json
{
  "dsh": {
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-primitives"],
      "platform": "web"
    },
    "bundle": { "patch": "./cordis.patch.yml" }
  },
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js"
  }
}
```

详见 [manifest.md](manifest.md)。
