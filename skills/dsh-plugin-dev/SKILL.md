---
name: dsh-plugin-dev
description: 开发 DeepSeek Harness（dsh）插件。适用于创建、扩展或调试 dsh 插件的宿主半区（node 进程）或客户端半区（浏览器 WebView），接入 ctx 服务注入、HTTP 路由、slot 注册、多语文案、工具注册、系统提示词，或在官方 API 缺失时规划功能退级方案。
license: MIT
compatibility: 需要 pnpm 10、TypeScript strict 模式，以及可运行的 DeepSeek Harness（dsh）实例用于端到端验证。
metadata:
  author: dsh-tauri-desk
  version: "2.0"
  source: 依据官方 DeepSeek Harness 文档与已安装 dsh 发行版类型声明编写
---

# DeepSeek Harness 插件开发

DeepSeek Harness（dsh）插件是 **Cordis 插件**，一个插件包由两个独立加载的半区组成：

- **宿主半区**（`src/*.ts`）：运行在 node 进程中，负责所有 I/O（Git、文件系统、进程、HTTP 路由、工具注册、系统提示词、Agent 生命周期）。
- **客户端半区**（`src/client/*.ts(x)`）：运行在浏览器 WebView 中，负责渲染 UI、DOM 补丁、多语文案与本地状态，并通过同源 `fetch('/api/<插件>/*')` 调用宿主半区的 HTTP 路由。

两个半区各自独立导出 `name`、`inject` 与 `apply(ctx, config?)`，由加载器分别挂载。

## 插件包结构

```
packages/<插件名>/
├── package.json          # dsh.client.inject / platform / bundle.patch
├── cordis.patch.yml      # 可选的 profile 补丁行（加载器插入）
├── src/
│   ├── index.ts          # 宿主半区：inject、apply、buildRoutes、工具、提示词
│   ├── types.ts          # 宿主类型（HostContext = any 作为接缝可接受）
│   ├── constants.ts      # 宿主常量
│   ├── http.ts           # 可选：routeHandler 助手（POST/GET + 回环校验）
│   ├── storage.ts        # 可选：JSON 持久化（原子写入）
│   └── client/
│       ├── index.ts      # 客户端半区：inject、apply、slot、样式、文案
│       ├── types.ts      # 客户端共享类型（唯一集中处）
│       ├── constants.ts  # 客户端共享常量（唯一集中处）
│       ├── locale.ts     # 中英文案字典
│       ├── styles.ts     # css-render 样式挂载
│       ├── store.ts      # 可选：SnapshotStore + fetch RPC
│       ├── components/   # 组件目录
│       └── <功能>.tsx    # slot 组件（kebab-case 文件名）
```

## 核心规则

1. **用 `inject` 声明依赖。** `export const inject = ['webServer', 'sessions', ...]`，插件会等待所有声明服务就绪后才执行 `apply`。不要访问未在 `inject` 中声明的 `ctx.<服务>`。
2. **每次注册都必须返回 disposer。** 注册操作放在 `ctx.effect(() => disposer, effectId)` 内，以便 reload/teardown 正确回滚。观察器、定时器、MutationObserver、样式挂载、事件监听都要清理。
3. **slot 注册是稳定协议。** 使用 `ctx.slots.register({ name, id, registrant, order, priority, inject }, Component)`，常量和 id 来自 `client/constants.ts`。可选渲染器缺失时必须优雅降级，绝不白屏。
4. **客户端类型与常量集中管理。** 共享类型放 `src/client/types.ts`，共享常量放 `src/client/constants.ts`，使用 type-only import。
5. **样式只允许 css-render。** 在 `apply()` 的 effect 中挂载；不使用 inline style 或手写 `<style>` 注入；图标组件从 github.com/gravity-ui/icons 复制 SVG。
6. **所有 I/O 只放宿主半区。** HTTP 路由严格限定方法；变更类路由必须校验来源（回环）与会话归属。
7. **绝不静默覆盖用户数据或分支。** 使用原子写入（临时文件 + rename），破坏性 Git 操作逐步校验。
8. **完成前运行完整验证：** `pnpm run lint --fix`、`pnpm run typecheck`、`pnpm run test -- --run`、`pnpm run build`。

## 参考文档索引

| 主题 | 参考 |
|-------|------|
| 宿主/客户端架构与生命周期 | [references/architecture.md](references/architecture.md) |
| 官方宿主侧 ctx 服务与 API 签名 | [references/host-api.md](references/host-api.md) |
| 官方客户端侧 ctx 服务与 slot 协议 | [references/client-api.md](references/client-api.md) |
| package.json dsh 清单、补丁行、构建配置 | [references/manifest.md](references/manifest.md) |
| ctx 依赖管理深入（inject/effect/事件） | [references/ctx-dependencies.md](references/ctx-dependencies.md) |
| 通用实现模式（路由/工具/样式/文案） | [references/patterns.md](references/patterns.md) |
| 功能退级阶梯（官方 API → 壳补丁 → DOM → 禁用） | [references/fallback.md](references/fallback.md) |
| 测试与验证 | [references/testing.md](references/testing.md) |

## 功能退级阶梯（规划功能前先读）

当功能需要当前官方 dsh 发行版未提供的宿主能力时，按从最优到最差的顺序规划**退级阶梯**：

1. **官方公开 API** —— `ctx.sessions`、`ctx.workspaceRegistry`、`ctx.sessionPersistence`、`ctx.agents`、`ctx.webServer`、`ctx.tools`、`ctx.systemPrompt`，客户端 `ctx.slots` / `ctx.sessions` / `ctx.workspaces`。务必对照**已安装** dsh 版本的 `.d.ts` 核实签名，绝不臆断 API 存在。
2. **桌面壳补丁** —— 官方 API 缺失时，桌面壳（桌面应用外壳）在启动前对捆绑的 dsh 核心做补丁（见 `src-tauri/src/service/workflow/*_patch.rs` 模式），以锚点校验、幂等、带单元测试的方式暴露窄面补充能力（例如 `SessionStore.remove(id)`）。插件侧做能力探测，缺失时报错。
3. **DOM 补丁** —— 客户端半区可通过 MutationObserver + capture 监听改写官方 DOM（portal 菜单、侧边栏行），使用稳定的 `aria-label` / `role` 选择器，绝不用生成的 CSS module 哈希。
4. **功能禁用 / 降级模式** —— 以上都不适用时禁用功能并输出明确日志，绝不静默半工作。

详细决策流程、壳补丁实现与测试见 [references/fallback.md](references/fallback.md)。

## 最小插件骨架

宿主半区（`src/index.ts`）：

```ts
export const name = 'my-plugin'
export const inject = ['webServer', 'sessions']

export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  ctx.effect(() => {
    const disposers = buildRoutes(ctx).map(route => ctx.webServer.register(route))
    return () => { for (const d of disposers) d() }
  }, 'my-plugin: routes')
}
```

客户端半区（`src/client/index.ts`）：

```ts
export const name = 'my-plugin'
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  installLocale(ctx)
  ctx.effect(() => mountMyStyles(), 'my-plugin: styles')
  ctx.effect(() => ctx.slots.register(
    { name: SLOT_NAME, id: COMPONENT_ID, registrant: PLUGIN_NAME, order, priority },
    MyComponent,
  ), 'my-plugin: slot')
}
```

## HTTP 路由助手模式

`src/http.ts` 封装 `routeHandler(fn, { mutate })`：`mutate: true` 只允许 `POST` 且校验回环来源；`false` 只允许 `GET`。处理器返回 `[status, payload]` 元组；抛 `Error` 转为 500。参考实现见 `packages/*/src/http.ts`。

## 快速检查清单

- [ ] 宿主 `inject` 列表覆盖 `apply` 中每个 `ctx.<服务>`
- [ ] 客户端 `inject` 列表覆盖 `apply` 中每个 `ctx.<服务>`
- [ ] 每个 `ctx.effect` 返回的 disposer 移除其添加的一切
- [ ] slot 的 id/registrant/order/priority 来自 `client/constants.ts`
- [ ] 共享客户端类型在 `client/types.ts`
- [ ] 样式只在 `apply()` effect 中挂载，仅用 css-render
- [ ] 变更类 HTTP 路由校验方法 + 回环
- [ ] `pnpm run lint --fix && pnpm run typecheck && pnpm run test -- --run && pnpm run build`
