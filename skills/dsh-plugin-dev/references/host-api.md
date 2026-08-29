# 官方宿主侧 ctx 服务

权威签名来自已安装 dsh 发行版的
`node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/*/lib/types/**/*.d.ts`，
以及官方文档
<https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/subsystems>
（`extensions.zh.md`、`workspace.zh.md`、`session.zh.md`、`core.zh.md`、
`tools.zh.md`、`system-prompt.zh.md`、`skills.zh.md`）。**在假设任何签名前，
务必对照已安装版本的 `.d.ts` 核实——官方 API 在不同发行版之间会变化。**
桌面壳会固定某个具体 dsh 发行版并对其打补丁，详见 [fallback.md](fallback.md)。

## 框架继承的 ctx（Cordis 核心）

每个插件无论层级如何都能看到这些（docs/cordis-api/inherited.md）：

- `ctx.on / ctx.once` — 注册事件监听（可释放）
- `ctx.emit / ctx.parallel / ctx.serial / ctx.bail / ctx.waterfall` — 分发事件
- `ctx.plugin / ctx.inject` — 加载插件 / 惰性声明所需服务
- `ctx.effect` — 绑定到 fiber 的可释放副作用
- `ctx.get / ctx.set / ctx.provide / ctx.accessor / ctx.mixin` — 服务存储访问
- `ctx.extend / ctx.isolate / ctx.intercept` — 派生子上下文
- `ctx.root / ctx.fiber / ctx.registry / ctx.reflect / ctx.events / ctx.logger`
- `ctx.timer`（+ interval/timeout/throttle/debounce 助手）
- `ctx.loader`、`ctx.hmr`

分发模式：`emit`（观察）、`waterfall`（包装，`(args, next)`）、`parallel`
（并行扇出）、`serial`（按序等待）、`bail`（停在首个 bail 值）。

## `ctx.webServer` — WebServer（`@deepseek-ai/dsh-host-webserver`）

所有插件用来服务客户端半区的 HTTP 路由注册表。

```ts
register(route: {
  kind: 'exact' | 'prefix'
  path: string                      // 绝对路径名，无结尾斜杠
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}): () => void                      // disposer

registerUpgrade(route: { path: string, handler }) : () => void
registerFallback(handler): () => void
tapIndex(transform: (html: string) => string): () => void
get port(): number
get host(): '127.0.0.1' | '0.0.0.0'
```

注意：

- 重复 `(kind, path)` 会抛错——路由模式是组合层契约。
- `exact` 逐字匹配路径名（query 经 `URL.pathname` 去除）；`prefix` 匹配 `p` 与 `p/<任意>`。
- 未匹配请求落到 fallback（SPA dist）或启动期间 404。
- 触发 `webserver/index-inject`（收集结构化 index 注入行）。

## `ctx.sessions` — SessionStore（`@deepseek-ai/dsh-session`）

内存仅追加会话存储——**活跃会话的唯一真源**。持久化由独立插件订阅
`session/event` 并在 `session/flush`/dispose 时冲刷。

```ts
create(id?: SessionId, options?: CreateSessionOptions): Session
prepare(id?: SessionId, options?: PrepareSessionOptions): Session   // 不进入 store
enter(session: Session): () => void                                 // detach disposer
announce(session: Session): void
flush(session: Session): Promise<boolean>
get(id: SessionId): Session | undefined
list(): Session[]
fork(source, boundary?, childSessionId?): Session
```

**重要：** 官方 API 中没有公开的 delete/remove/close/unload（截至 0.1.1-rc.2）。
`enter()` 的 disposer 只对调用方自己 prepare 的会话有效。桌面壳补丁暴露
`SessionStore.remove(id)`（见 [fallback.md](fallback.md)）。绝不要直接触碰
私有的 `store` 内部结构。

会话事件：`session/created`（emit）、`session/disposed`（emit）、
`session/event`（emit，每个追加事件）、`session/flush`（parallel）。

## `ctx.sessionPersistence` — SessionPersistence

持久化仅追加存储（`@deepseek-ai/dsh-session-persistence`，后端
`dsh-session-persistence-jsonl`）。**这里也没有删除 API**——删除持久化数据
由壳补丁 + 插件宿主半区的文件系统操作完成。

```ts
locate(meta: SessionHeader): SessionLocation | undefined
readRaw(id, signal?): Promise<SessionRawArtifact | undefined>
create(meta: SessionHeader): Promise<void>           // 注册/惰性物化
append(id, events): Promise<void>
prepare(id, signal?): Promise<SessionPreparation>
load(id): Promise<SessionInspection>
inspect(id, signal?): Promise<SessionInspection>
readFrom(id, fromSeq, signal?): Promise<{ meta, events }>
list(signal?): Promise<SessionHeader[]>
listSnapshots(signal?): Promise<SessionPersistenceSnapshot[]>
```

## `ctx.workspaceRegistry` — WorkspaceRegistry

基于规范路径的持久工作区记录。

```ts
create(path: string, title?: string): Promise<Workspace>
get(id: WorkspaceId): Workspace | undefined
list(): Workspace[]
delete(id: WorkspaceId): Promise<boolean>            // 仅注册，保留会话
insertBefore(id, beforeId?): Promise<readonly WorkspaceId[]>
get archivedSessionIds(): readonly SessionId[]
archiveSession(sessionId): Promise<void>
resolveByPath(path): Promise<Workspace | undefined>
```

`Workspace` 实体方法：`setTitle`、`attachSession`、`insertSessionBefore`、
`detachSession`、`status()`；`sessionIds` 是按规范 cwd 相等性过滤后的
header 校验账本。`archiveSession` 只从分组界面隐藏——绝不触碰会话日志或
工作区账本。

**没有公开的 unarchive。** 插件通过注册表内部状态机（`enqueueOperation` /
`requireState` / `setState`）以结构化 cast 实现——见宿主实现。这是脆弱接缝：
必须做能力探测并在缺失时报错。

## `ctx.sessionController` / `ctx.workspaceController`

承载生成式 `ctx.remote.session` / `ctx.remote.workspace` wire 命名空间的宿主
服务（面向浏览器的 RPC）。需要与官方 GUI 相同的动词时使用：
`list/search/create/rename/fork/prompt/cancel/page/follow/control` 与
`create/rename/delete/insertBefore/insertSessionBefore/archiveSession/follow`。

## `ctx.tools` — ToolRuntime

工具注册表 + 带守卫的执行流水线。

```ts
register(definition: ToolDefinition): () => void
// 内部还有 schemas()/execute()
```

使用 `@deepseek-ai/dsh-tools` 的 `defineTool({ name, description, parameters,
output, execute, ... })` 构建工具——带 `InferArgs`/`InferValue` 的类型化
schema DSL。`output.schema` 必填；`execute` 必须观察 `exec.signal`；可选
`finalizeContent`、`timeoutMs`、`isConcurrencySafe`、`presentCall`、
`presentResult`。流水线事件：`tools/pre-execute`（waterfall）、
`tools/execute`（wrap）、`tools/post-execute`、`tools/result`。

## `ctx.systemPrompt` — SystemPrompt

提示词段落/上下文组装注册表。

```ts
section(section: PromptSection): () => void
context(context: PromptContext): () => void
suppressRuntimeContext(): () => void
tools(provider: (ctx) => ToolProviderResult): () => void
variable(name, provider): () => void
assemble(context?): Promise<PromptAssembly>
```

`PromptSection` 形如 `{ name, order, text(context) }`；`PromptContext` 增加
priority。`system-prompt/assemble` 是 waterfall；`system-prompt/change` 是
emit。

## `ctx.agents` — AgentRegistry

活跃 Agent 注册表 + 发起者链。

```ts
currentInitiator(): Agent | undefined
requireInitiator(): Agent
withInitiator<T>(agent, op): T
withoutInitiator<T>(op): T
setFactory(factory): () => void
create(options: CreateAgentOptions): Promise<AgentHandle>   // agent + session
resume(options: ResumeAgentOptions): Promise<AgentHandle>   // 持久会话
register(agent): () => void
enter(agent, owner?): () => void
announce(agent): void
get(id): Agent | undefined
isOwnedBy(id, owner): boolean
list(): Agent[]
roots(): Agent[]
```

`AgentHandle.dispose()` 停止循环、注销、从 store 移除会话并展开作用域世界——
这是活跃 Agent 的正确拆除路径，不应只用 `SessionStore.remove`。Agent 事件：
`agent/created`、`agent/disposed`、`agent/error`、`agent/status`、
`agent/request`、inbox 事件等（全部 scope 过滤 emit）。

## `ctx.agentLoop`、`ctx.agentPresets`、`ctx.agentDefaultModel`

- `ctx.agentLoop` — 具体 Agent 工厂/驱动器：`create(id, options, meta)`、
  `createAgent(ownerCtx, options)`、`resume(ownerCtx, options)`。
- `ctx.agentPresets` — preset 注册表：`list()`、`resolve()`、
  `select(agent, preset)`、`standingKeyFor(id?)`。
- `ctx.agentDefaultModel` — `currentSelection()`、`saveSelection(next)`。

## `ctx.skills` — skills 注册表

Provider 注册表 + 合并目录；`list()`、`get(name, options)`、`snapshot()`。
skill 名称为 kebab-case。本地发现优先级：`project-dsh`
（`<root>/.dsh/skills`，rank 100）、`project-agents`（`<root>/.agents/skills`，
rank 200）、`custom`、`user-dsh`、`user-agents`、`bundled`。

## `ctx.cordisInspect`、`ctx.dynamicCordisRunner`、`ctx.inspector`

扩展/动态插件管理（面向模型的 inspect 工具、动态 Plugin/Package 生命周期、
inspector 发布）。主要用于官方扩展子系统；插件作者通常不需要直接使用。

## 更多服务

`ctx.fs`、`ctx.storageDomain`、`ctx.llm`、`ctx.scope`、`ctx.subagent`、
`ctx.schedule`、`ctx.goal`、`ctx.jobs`、`ctx.userApproval`、`ctx.timeout`、
`ctx.attachment`、`ctx.authorization`、`ctx.sandbox`、`ctx.bash`、
`ctx.pwsh`、`ctx.terminal` 等还有许多。完整清单见
`node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/` 下各包的
`lib/types/**/*.d.ts`。

## 尚未使用的服务（新功能候选）

`agentLoop`、`agentPresets`、`agentDefaultModel`、`sessionController`、
`workspaceController`、`directoryPicker`、`cordisInspect`、
`dynamicCordisRunner`、`inspector`、`fs`、`storageDomain`、`llm`、`scope`、
`subagent`、`schedule`、`goal`、`jobs`、`userApproval`、`timeout`、
`attachment`、`authorization`、`sandbox`、`bash`、`pwsh`、`terminal` ——
使用前查阅其 `.d.ts` 与官方子系统文档。
