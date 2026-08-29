# 宿主 / 客户端架构

DeepSeek Harness 插件是 **Cordis 插件**，一个插件包包含两个独立加载的半区。加载器将每个半区挂载到各自的运行时：**宿主半区**运行在 node 进程，**客户端半区**运行在浏览器（WebView）。

## 双半区模型

```
┌─────────────────────────────┐      fetch /api/<插件>/*      ┌─────────────────────────────┐
│  宿主半区（node）           │ ◄──────────────────────────────► │  客户端半区（浏览器）        │
│  packages/<名称>/src/*.ts   │                                 │  packages/<名称>/src/client │
│  ctx.webServer / sessions   │                                 │  ctx.slots / locale /      │
│  workspaceRegistry / tools  │                                 │  sessions / workspaces     │
│  systemPrompt / agents ...  │                                 │  layout / renderer ...     │
└─────────────────────────────┘                                 └─────────────────────────────┘
```

- **宿主半区**（`src/index.ts`）拥有所有 I/O：Git、文件系统、进程、HTTP 路由、工具注册、系统提示词注入、Agent 生命周期。
- **客户端半区**（`src/client/index.ts`）向 slot 渲染 UI、补丁 DOM、管理多语文案与本地状态，并通过 `fetch('/api/<插件>/...')`（同源绝对路径）调用宿主路由。
- 插件可以是**仅宿主**（无 client 目录）或**仅客户端**（宿主侧导出空 `apply`），但加载器对每个发布的半区都期望存在可挂载入口。

## 生命周期

每个半区都是一个 Cordis 插件：

```ts
export const name = 'my-plugin'                      // 诊断标识
export const inject = ['webServer', 'sessions']      // 必需服务
export function apply(ctx, config?) { ... }          // 服务就绪后调用
```

- `inject` 声明服务；插件**仅在所有列出的服务就绪后**启动。加载顺序通过依赖表达，绝不用手动排序。
- `apply(ctx, config)` 是组装入口。所有注册都放在 `ctx.effect(() => disposer, effectId)` 内，使 reload/HMR/teardown 正确回滚。
- `ctx.effect` 的返回值是 disposer（或 disposer 的可迭代集合）。fiber 卸载时按注册逆序执行。
- 客户端 HMR：官方 dsh 客户端 HMR 可能卸载第三方插件而不重新挂载；桌面壳对 debug 构建打了补丁（把 rebuilt 降级为页面刷新）。

## 宿主 apply 顺序（通用实践）

1. 注册工具（`ctx.tools.register(tool)`）与系统提示词段落/上下文（`ctx.systemPrompt.section/context`）。
2. 订阅事件（`ctx.on('session/event', ...)`）做横切行为。
3. `ctx.effect(() => 迁移旧数据, '...')` 做一次性迁移。
4. `ctx.effect(() => buildRoutes(ctx).map(r => ctx.webServer.register(r)), '...')` —— 收集 disposer，卸载时移除每条路由。

## 客户端 apply 顺序

1. 安装文案（`installLocale(ctx)` —— `ctx.locale.register(ns, 'zh', dict)`）。
2. 在 `ctx.effect` 中挂载 css-render 样式。
3. 注册 slot 组件与 UI 行为（`ctx.slots.register(...)`）。
4. 通过 `ctx.effect` 管理 MutationObserver、监听器、定时器、hydration。

## 通信契约

- 路由位于 `/api/<插件>/*`（如 `/api/<插件>/archived`）。
- `routeHandler(fn, { mutate })`：`mutate: true` → `POST` + 回环来源校验；`false` → `GET`。错误转 `500` 返回 `{ error }` JSON，方法错误 405，非回环变更 403。
- 客户端 `request<T>(path, init)` 助手封装 fetch：JSON 解析、非 2xx → `Error(body.error ?? 请求失败 (status))`；变更调用加上 AbortController 超时，避免宿主卡死导致 UI 永久等待。

## 宿主上下文类型

`HostContext = any` 是 `src/types.ts` 中认可的接缝类型。功能代码应通过小型结构化接口（如 `SessionStoreSurface`）收窄其访问的服务，而不是把 `any` 扩散到整个代码库。

## 数据目录速查（JSONL 后端）

- 持久会话：`$DSH_HOME/sessions/<编码后-cwd-键>/<编码后-session-id>/session.jsonl.zstd`
- 工作区与归档状态：`$DSH_HOME/storages/workspace.json`
- 会话投影缓存：`$DSH_HOME/storages/session_projcache.json`

会话 id 编码把不安全码元转义为 `~XXXX`；cwd 键是易读的 `--<slug>--` 编码。扫描持久目录时复制官方的编码逻辑。
