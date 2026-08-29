# 功能退级阶梯

当功能需要已安装官方 dsh 发行版未暴露的宿主能力时，按从最优到最差的顺序
走这条阶梯。每一级都必须经过验证、守卫与日志记录——绝不静默半工作。

## 阶梯

```
1. 官方公开 API
        │  缺失?
        ▼
2. 桌面壳补丁
        │  缺失 / 无壳?
        ▼
3. DOM 补丁（仅客户端半区）
        │  不适用?
        ▼
4. 功能禁用 + 明确日志/提示
```

## 1. 官方公开 API（首选）

对照**已安装** dsh 的 `.d.ts` 核实签名：

```text
node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/<包>/lib/types/**/*.d.ts
```

绝不要因为文档提到某 API 就假定它存在——桌面壳固定某个发行版，可能滞后于
文档。检查：

- `ctx.sessions` — SessionStore（0.1.1-rc.2 无公开 delete/remove）
- `ctx.sessionPersistence` — 同样无 delete
- `ctx.workspaceRegistry` — 有 `archiveSession`，无 `unarchive`
- `ctx.agents` — `AgentHandle.dispose()` 是活跃 Agent 的正确拆除路径
- `ctx.webServer` / `ctx.tools` / `ctx.systemPrompt` — 完整公开 API

## 2. 桌面壳补丁

官方 API 缺失时，桌面壳（桌面应用外壳）可以在启动 dsh **之前**对捆绑的
dsh 核心打补丁。先例：通过 `src-tauri/src/service/workflow/session_patch.rs`
添加 `SessionStore.remove(id)`（与 `workspace_patch.rs`、
`renderer_patch.rs`、`client_hmr_patch.rs` 并列，在 `workflow::launch` 中
调用）。

### 壳补丁结构

```rust
// 1. 锚点常量——必须精确匹配捆绑源码（HARDCODE 固定版本）。
const PATCH_MARKER: &str = "dsh-tauri-desktop: <功能>"
const ANCHOR: &str = "/** 精确的上游注释/代码锚点 */"
const INSERTION: &str = r#"/** 补丁说明 */ <注入代码>"#;

// 2. 纯函数 patch_source()，返回 PatchOutcome { AlreadyPatched, AnchorMissing, Patched }。
// 3. apply(app_handle)：定位活跃核心安装目录，读 index.js，幂等打补丁，
//    写回；文件或锚点缺失 → 记录日志并跳过。
// 4. 单元测试：patches_<功能>、patch_is_idempotent、skips_partial_layout。
```

关键规则：

- 补丁必须**幂等**（先做 marker 检查）。
- 锚定在稳定上游注释/签名上；锚点漂移（dsh 更新）时**跳过并告警**——绝不
  破坏核心。
- 只对既有官方生命周期添加窄面门面（如 `remove(id)` 委托既有
  `entry.detach()`），绝不改写官方行为。
- 在 `workflow::mod.rs::launch` 中、**dsh 进程启动之前且插件加载之前**调用
  `apply()`。

### 插件侧能力探测

插件宿主半区必须检测补丁 API，缺失时报错：

```ts
interface SessionStoreSurface {
  get?: (id: string) => SessionLike | undefined
  remove?: (id: string) => boolean
}
const sessions = ctx.sessions as SessionStoreSurface | undefined
if (sessions?.get?.(id)) {
  if (!sessions.remove)
    throw new Error('宿主未提供 SessionStore.remove，请先更新桌面壳')
  if (!sessions.remove(id))
    throw new Error(`无法从内存会话中移除 '${id}'`)
}
```

## 3. DOM 补丁（客户端半区）

仅 UI 类变更，客户端半区可改写官方 DOM。规则（另见 client-api.md 的 DOM
章节）：

- 只用稳定选择器（`role=menuitem`、`aria-*`、`data-slot`、插件前缀 class）。
- 改写标签文本节点 / 图标容器；不删除 React 管理的节点。
- 在 capture 阶段拦截点击（`stopImmediatePropagation`），随后派发外部
  `pointerdown` 关闭官方 Menu。
- 用 `!important` 内联样式覆盖官方危险样式（官方 CSS module 类是生成哈希，
  特异性更高）。
- 在 effect disposer 中清理每个监听器/观察器。

## 4. 功能禁用 / 降级模式

任何一级都不适用时，禁用功能并明确传达：

- 输出 `console.warn('[插件] ... 已禁用，原因 ...')`。
- 跳过注册，官方 UI 保持工作（不白屏）。
- 先例：渲染器补丁缺失时（`SlotOutlet` 不可用）跳过侧边栏注册，官方设置
  对话框照常工作。

## 决策流程

1. 读取已安装 `.d.ts` 查找所需动词——有公开 API 吗？
2. 若没有，桌面壳能否对既有生命周期添加窄面门面？实现 + 单测补丁，接入
   launch。
3. 客户端半区能否在不改宿主状态的情况下通过 DOM 改写达成目标？
4. 否则禁用并输出明确提示。

## 实战案例：会话删除

- 目标：彻底删除归档会话（内存 + 持久）。
- 官方 API：`ctx.sessions` 无 `remove`；`sessionPersistence` 无 delete；
  `workspaceRegistry.delete` 只删注册。
- 壳补丁：添加 `SessionStore.remove(id)`，委托官方 `entry.detach()`。
- 插件：能力探测 `sessions.remove`，然后移除工作区账本
  （`requireTable().update`）、归档集合（`enqueueOperation`/`setState`）、
  持久目录（带 id 编码 marker 的目录删除），并重新同步客户端会话/工作区。
- 结果：删除的会话立即从活跃 store 消失；没有补丁时插件明确报错而不是
  半删除。
