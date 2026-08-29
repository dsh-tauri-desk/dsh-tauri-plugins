# 客户端 ctx 服务与 slot 协议

客户端半区运行在浏览器中；上下文是类型为 `ClientContext`
（`@deepseek-ai/dsh-client-runtime/client`）的 Cordis `Context`。服务通过
`export const inject` 注入，通过 `ctx.<key>` 消费。

## 客户端服务清单（已安装 dsh 发行版）

| 服务 | 包 | 用途 |
|---------|---------|---------|
| `ctx.slots` | dsh-client-runtime | slot 注册表：register/inject/install/renderSlot |
| `ctx.sessions` | dsh-client-runtime | 会话列表快照，open/clear/search/fork/provide/scope |
| `ctx.workspaces` | dsh-client-runtime | 工作区列表快照，manager refresh，archiveSession |
| `ctx.locale` | dsh-client-locale | 多语文案 register/subscribe/getLocale |
| `ctx.layout` | dsh-client-ui-layout | 侧边栏切换、外壳 chrome |
| `ctx.renderer`（经 slots） | dsh-client-ui-renderer | SlotOutlet、useHost、createSlotRenderer |
| `ctx.remote.*` | dsh-client-connection | wire RPC 命名空间（session/workspace/...） |

## `ctx.slots` — SlotRegistry

唯一注册 API 是 `ctx.slots.register`（经 `SlotCore` 类型化）：

```ts
ctx.slots.register(
  {
    name: SLOT_NAME,          // slot 座位键，如 'settings.section'
    id: COMPONENT_ID,         // 稳定组件 id
    registrant: PLUGIN_NAME,  // 诊断标记
    order: NUMBER,            // 展示顺序
    priority: NUMBER,         // 可选，single slot 中较小者胜出
    inject: (props) => ({ ... }),  // 可选 props 注入
  },
  Component,
)
```

- `register` 经由调用方的 `ctx.effect` 运行，因此插件卸载会级联移除——把它
  包在 `ctx.effect(() => ctx.slots.register(...), effectId)` 内。
- `ctx.slots.inject(key, callback)` — 为 slot 的声明生命周期安装 effect
  （用于设置分区导航投影）。
- `ctx.slots.install(renderer)` / `installLocale(face)` — 启动一次的外壳契约；
  插件不要调用。
- `ctx.slots.renderSlot('root', owner)` — 仅外壳可用。

已知 slot 座位（来自已安装 ui-layout/ui-sidebar/workspace 包）：

- `root` — single，**不要注册**（会遮蔽整个 frame）
- `shell.overlay` — list slot，浮于应用之上
- `sidebar.settings` — 设置齿轮座位
- `settings.section` — 设置页分区
- `settings.onboarding` — onboarding 分区
- `conversation.input.dock` — composer 停靠位
- `sidebar` / `sidebar.workspace` — 侧边栏座位

由于 `settings.section` 等 UI 座位未在 `dsh-client-runtime` 的 SlotMap 中
声明（声明权在 ui-sidebar / ui-layout），插件给选项对象加显式 `as never`
cast——这是既有先例。

## `ctx.sessions` — 客户端会话面（ISessions）

```ts
readonly list: ObservableSnapshot<SessionListState>   // { ids, byId, current, phase }
open(id: SessionId): void
clear(): void
search(query, signal): Promise<RpcResult<...>>
fork(opts: { sessionId, atSeq?, increaseTitle? }): Promise<SessionId>
provide(descriptor): () => void
scope(id) / scopeOf(ctx) / sessionOf(ctx) / binding(id)
```

`SessionListState.byId[sessionId]` 携带 `{ id, title, displayTitle, cwd,
updatedAt, blank, ... }`——`blank: true` 标记临时新建会话行（归档/删除计数
时应排除）。官方 `ISessions` 面上**没有客户端侧 refresh/delete**；
`ctx.sessions.refresh()` 属 cast/扩展——变更后应重新同步宿主列表
（见 fallback.md）。

## `ctx.workspaces` — 客户端工作区面

```ts
readonly list: ObservableSnapshot<WorkspaceListState>
// { items: WorkspaceView[], archivedSessionIds, phase, ... }
manager?.refresh?.()   // 重新拉取工作区基线（变更后使用）
archiveSession(sessionId)   // 官方归档动词
```

`WorkspaceView` = `{ workspaceId, path, title?, sessionIds }`。

## `ctx.locale`

```ts
ctx.locale.register(ns, locale, dict)   // 如 register('my-plugin', 'zh', DICT_ZH)
ctx.locale.subscribe(listener)
ctx.locale.getLocale().active
```

通用模式：模块级 `activeLocale` + `localeRev` SnapshotStore；`text(key,
values?)` 渲染 `{placeholder}` 模板；`useLocale()` 订阅 rev 使组件在语言
切换时重渲染。保持中英文案键集合一致。

## `ctx.layout`

`ctx.layout.toggleSidebar()` 与其他 chrome 动词。插件需要访问外壳 chrome 时
注入 `'layout'`。

## 状态模式

- `createSnapshotStore(initial)` / `useSyncExternalStore(store.subscribe,
  store.getSnapshot)` — 模块级共享状态。
- `defineStore(...)` — slot 作用域状态的引擎 store 实例。
- `useProjection` / `useSession` 标准 props 自动注入到会话作用域 slot 组件。

## DOM 补丁规则（需要改动官方 UI 时）

客户端半区可以补丁官方 DOM（portal 菜单、侧边栏行），但必须：

- 使用稳定选择器：`role=`、`aria-label`、`data-slot`、插件前缀 class——
  绝不用生成的 CSS-module 哈希。
- 在 DOM 缺乏 data 属性时，只读地通过 Fiber key 读取 React 身份。
- 使用 `MutationObserver` + capture 监听；在 effect disposer 中清理一切。
- 不要整体删除/替换 React 管理的节点；只改标签文本节点与图标容器的
  innerHTML。
