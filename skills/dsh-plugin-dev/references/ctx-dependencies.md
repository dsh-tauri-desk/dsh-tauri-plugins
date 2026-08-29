# ctx 依赖管理

本参考覆盖 dsh 插件所基于的 Cordis 依赖/分发模型，附带通用用法。逐服务
签名见 [host-api.md](host-api.md) 与 [client-api.md](client-api.md)。

## 五个核心概念（官方 cordis-primer）

1. **插件是实现 Service 的对象。** 带可选 `inject` + `apply(ctx)` 的函数，
   或 Service 子类；生命周期由 Cordis 挂载。
2. **上下文是服务的容器。** 每个服务占据稳定 `ctx.<key>`；插件按 key 查找
   服务，绝不 import 实现。
3. **`inject` 声明服务依赖。** 插件仅在声明服务就绪后启动；加载顺序遵循
   依赖图。
4. **类型化事件用于通信。** 服务经 TypeScript 声明合并注册事件名，并用
   `emit` / `waterfall` / `parallel` / `serial` / `bail` 分发。
5. **注册是可逆的副作用。** 提示词段落、工具 schema、适配器、提供方、
   监听器经 `ctx.effect()` / `ctx.on()` 安装，reload/teardown 时回滚。

## inject 与 ctx.inject

### 静态 `export const inject`

```ts
export const inject = ['webServer', 'sessions', 'workspaceRegistry']
```

多数插件使用。加载器在调用 `apply` 前解析这些服务。两个半区各有独立
inject 列表：

- 宿主：`['tools', 'systemPrompt', 'webServer', 'sessions', 'workspaceRegistry', 'agents']`、
  `['webServer', 'sessions', 'workspaceRegistry']`、`['webServer', 'skills']`
  等。
- 客户端：`['slots', 'locale']`、`['slots', 'layout', 'locale']`、
  `['layout']` 等。

### 惰性 `ctx.inject(services, callback)`

```ts
export function apply(ctx: Context, config?: Config): void {
  ctx.inject(['webServer', 'skills'], (hostCtx: Context) => {
    ctx.effect(() => { /* 仅当两者都存在时挂载 */ }, 'effect-id')
  })
}
```

用于把重量级 provider 挂载推迟到某服务存在之后。回调上下文还能访问平台
插件加载器以解析 DSH 自有包。

## ctx.effect 纪律

- 每个需要在 reload/HMR/teardown 时撤销的注册都放进
  `ctx.effect(() => disposer, label)`。
- disposer 可以是单个函数或函数集合（逆序释放——用于有序 teardown 链，
  如 Agent 工厂生命周期）。
- 标签仅诊断用；保持稳定且插件前缀（`'my-plugin: routes'`）。
- 必须按顺序 teardown 的复合 effect 应在精确位置 yield 嵌套 disposer；
  绝不要用并发兄弟包装器包住承载顺序语义的 disposer（官方文档对
  `ctx.agents.register` 的 disposer 专门强调过）。

## 事件分发模式（官方 primer 表）

| 模式 | 是否 await | 顺序 | 有返回值？ |
|------|----------|-------|----------|
| `emit` | 否 | 注册顺序 | 否 |
| `waterfall` | 否 | 注册顺序 | 是 |
| `parallel` | 是 | 全部并行 | 否 |
| `serial` | 是 | 注册顺序 | 是 |
| `bail` | 否 | 注册顺序，直到某监听器返回 bail 值 | 是 |

waterfall 监听器收到 `(...args, next)`；调用 `next()` 执行链条其余部分，
下游返回值经 `next()` 向上回流。不调用 `next()` 直接返回则短路。

## 实用事件用法

```ts
// 宿主：响应会话事件流
ctx.on('session/event', (session: Session, event: SessionEvent) => {
  if (event.type === 'turn/end') { ... }
})

// 客户端：语言变更桥
ctx.locale.subscribe(() => { localeRev.update(s => { s.rev += 1 }) })
```

## 作用域过滤分发

若干事件按 scope 过滤（`@deepseek-ai/dsh-scope`）：`agent/*`、
`system-prompt/assemble`、会话事件。在 agent 作用域上下文中注册的监听器只
收到该 agent 的分发；全局监听器看到全部。分发时显式传 carrier
（`scopeTarget(session, ...)`），使过滤与调用注册的上下文无关。

## 客户端跨域边界

`ctx.sessions`（客户端 `ISessions`）刻意几乎只读："writes stay inside the
sessions domain"。客户端插件通过 `open/clear` 导航/选择，但破坏性或领域
变更工作必须走**宿主半区** RPC 路由——然后重新同步客户端镜像
（`workspaces.manager.refresh()`、`ctx.sessions.refresh()` cast、归档 store
刷新）。这个边界正是归档/取消归档/删除放在宿主并经由
`/api/<插件>/*` 调用的原因。

## 能力探测模式

依赖补丁或版本敏感 API 时，检测并大声失败，而不是臆断：

```ts
const surface = ctx.sessions as SessionStoreSurface | undefined
if (live && !surface?.remove)
  throw new Error('宿主未提供 SessionStore.remove，请先更新桌面壳')
```

这使插件跨 dsh 版本与壳构建保持诚实。
