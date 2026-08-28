# Official Host-half `ctx` Services

Authoritative signatures come from the installed dsh release's
`node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/*/lib/types/**/*.d.ts`
and the official docs at
<https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/subsystems>
(`extensions.zh.md`, `workspace.zh.md`, `session.zh.md`, `core.zh.md`,
`tools.zh.md`, `system-prompt.zh.md`, `skills.zh.md`). **Always verify the
installed version's `.d.ts` before assuming a signature — official APIs change
between releases.** The desktop shell pins a specific dsh release
(`0.1.1-rc.2` for this workspace) and patches it; see
[fallback.md](fallback.md).

## Framework-inherited ctx (Cordis core)

Every plugin sees these regardless of harness tier
(docs/cordis-api/inherited.md):

- `ctx.on / ctx.once` — register event listener (disposable)
- `ctx.emit / ctx.parallel / ctx.serial / ctx.bail / ctx.waterfall` — dispatch
- `ctx.plugin / ctx.inject` — load a plugin / declare required services lazily
- `ctx.effect` — disposable side effect tied to the fiber
- `ctx.get / ctx.set / ctx.provide / ctx.accessor / ctx.mixin` — service store
- `ctx.extend / ctx.isolate / ctx.intercept` — derive child contexts
- `ctx.root / ctx.fiber / ctx.registry / ctx.reflect / ctx.events / ctx.logger`
- `ctx.timer` (+ interval/timeout/throttle/debounce helpers)
- `ctx.loader`, `ctx.hmr`

Dispatch modes: `emit` (observe), `waterfall` (wrap, `(args, next)`),
`parallel` (fan out), `serial` (await in order), `bail` (stop at first value).

## `ctx.webServer` — WebServer (`@deepseek-ai/dsh-host-webserver`)

The HTTP route registry used by every plugin to serve its client half.

```ts
register(route: {
  kind: 'exact' | 'prefix'
  path: string                      // absolute pathname, no trailing slash
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}): () => void                      // disposer

registerUpgrade(route: { path: string, handler }) : () => void
registerFallback(handler): () => void
tapIndex(transform: (html: string) => string): () => void
get port(): number
get host(): '127.0.0.1' | '0.0.0.0'
```

Notes:

- Duplicate `(kind, path)` throws — route patterns are a composition contract.
- `exact` matches the pathname verbatim (query stripped via `URL.pathname`);
  `prefix` matches `p` and `p/<anything>`.
- Unmatched requests hit the fallback (SPA dist) or 404 during startup.
- Emits `webserver/index-inject` (collect structured index injection rows).

## `ctx.sessions` — SessionStore (`@deepseek-ai/dsh-session`)

In-memory append-only session store — **the single source of truth for live
sessions**. Persistence is a separate plugin that subscribes to
`session/event` and flushes on `session/flush`/dispose.

```ts
create(id?: SessionId, options?: CreateSessionOptions): Session
prepare(id?: SessionId, options?: PrepareSessionOptions): Session   // not entered
enter(session: Session): () => void                                 // detach disposer
announce(session: Session): void
flush(session: Session): Promise<boolean>
get(id: SessionId): Session | undefined
list(): Session[]
fork(source, boundary?, childSessionId?): Session
```

**Important:** there is **no public delete/remove/close/unload** in the
official API (as of 0.1.1-rc.2). `enter()`'s disposer only works for sessions
the caller itself prepared. The desktop shell patches `SessionStore.remove(id)`
(see [fallback.md](fallback.md) and `session_patch.rs`). Never reach into
private `store` internals.

Session events: `session/created` (emit), `session/disposed` (emit),
`session/event` (emit, every appended event), `session/flush` (parallel).

## `ctx.sessionPersistence` — SessionPersistence

Durable append-only storage (`@deepseek-ai/dsh-session-persistence`,
backend `dsh-session-persistence-jsonl`). There is **no delete API** here
either — deleting durable data is done by the shell patch + filesystem work
in the plugin host half.

```ts
locate(meta: SessionHeader): SessionLocation | undefined
readRaw(id, signal?): Promise<SessionRawArtifact | undefined>
create(meta: SessionHeader): Promise<void>           // register/lazy materialize
append(id, events): Promise<void>
prepare(id, signal?): Promise<SessionPreparation>
load(id): Promise<SessionInspection>
inspect(id, signal?): Promise<SessionInspection>
readFrom(id, fromSeq, signal?): Promise<{ meta, events }>
list(signal?): Promise<SessionHeader[]>
listSnapshots(signal?): Promise<SessionPersistenceSnapshot[]>
```

Durable layout (JSONL backend): `$DSH_HOME/sessions/<encoded-cwd-key>/<encoded-session-id>/session.jsonl.zstd`.
The cwd key is a lossy human-navigable encoding (`--<slug>--`); the session id
is escaped via `~XXXX` for unsafe code units. Copy `encodeSessionId` from
`dsh-tauri-session/src/index.ts` when scanning directories.

## `ctx.workspaceRegistry` — WorkspaceRegistry

Durable workspace records over canonical paths.

```ts
create(path: string, title?: string): Promise<Workspace>
get(id: WorkspaceId): Workspace | undefined
list(): Workspace[]
delete(id: WorkspaceId): Promise<boolean>            // registration only, keeps sessions
insertBefore(id, beforeId?): Promise<readonly WorkspaceId[]>
get archivedSessionIds(): readonly SessionId[]
archiveSession(sessionId): Promise<void>
resolveByPath(path): Promise<Workspace | undefined>
```

`Workspace` entity methods: `setTitle`, `attachSession`, `insertSessionBefore`,
`detachSession`, `status()`; `sessionIds` is the header-validated account
(filtered by canonical cwd equality). `archiveSession` only hides from
grouping surfaces — it never touches session logs or workspace accounting.

**No public unarchive.** The plugin uses the registry's internal state machine
(`enqueueOperation` / `requireState` / `setState`) with a structural cast —
see `dsh-tauri-session/src/index.ts`. This is a fragile seam: guard it with
capability checks and error loudly if absent.

## `ctx.sessionController` / `ctx.workspaceController`

Host services behind the generated `ctx.remote.session` / `ctx.remote.workspace`
wire namespaces (browser-facing RPC). Use them when you need the same verbs the
official GUI uses: `list/search/create/rename/fork/prompt/cancel/page/follow/control`
and `create/rename/delete/insertBefore/insertSessionBefore/archiveSession/follow`.

## `ctx.tools` — ToolRuntime

Tool registry + guarded execution pipeline.

```ts
register(definition: ToolDefinition): () => void
// plus schemas()/execute() internals
```

Build tools with `defineTool({ name, description, parameters, output, execute, ... })`
from `@deepseek-ai/dsh-tools` — typed schema DSL with `InferArgs`/`InferValue`.
`output.schema` is mandatory; `execute` must observe `exec.signal`; optional
`finalizeContent`, `timeoutMs`, `isConcurrencySafe`, `presentCall`,
`presentResult`. Pipeline events: `tools/pre-execute` (waterfall),
`tools/execute` (wrap), `tools/post-execute`, `tools/result`.

See `dsh-tauri-worktree/src/index.ts` for a real `create_worktree` /
`checkout_worktree` / `discard_worktree` tool set.

## `ctx.systemPrompt` — SystemPrompt

Prompt section/context assembly registry.

```ts
section(section: PromptSection): () => void
context(context: PromptContext): () => void
suppressRuntimeContext(): () => void
tools(provider: (ctx) => ToolProviderResult): () => void
variable(name, provider): () => void
assemble(context?): Promise<PromptAssembly>
```

`PromptSection` has `{ name, order, text(context) }`; `PromptContext` adds
priority. `system-prompt/assemble` is a waterfall; `system-prompt/change` is
emit. Worktree plugin injects `is_worktree: true` via a section and checkout
context via `context()`.

## `ctx.agents` — AgentRegistry

Live agent registry + initiating-agent chain.

```ts
currentInitiator(): Agent | undefined
requireInitiator(): Agent
withInitiator<T>(agent, op): T
withoutInitiator<T>(op): T
setFactory(factory): () => void
create(options: CreateAgentOptions): Promise<AgentHandle>   // agent + session
resume(options: ResumeAgentOptions): Promise<AgentHandle>   // persisted
register(agent): () => void
enter(agent, owner?): () => void
announce(agent): void
get(id): Agent | undefined
isOwnedBy(id, owner): boolean
list(): Agent[]
roots(): Agent[]
```

`AgentHandle.dispose()` stops the loop, unregisters, removes the session from
the store, and unwinds the scoped world — **the correct teardown path for a
live agent**, not `SessionStore.remove` alone. Agent events: `agent/created`,
`agent/disposed`, `agent/error`, `agent/status`, `agent/request`, inbox
events, etc. (all scope-filtered emit).

## `ctx.agentLoop`, `ctx.agentPresets`, `ctx.agentDefaultModel`

- `ctx.agentLoop` — concrete agent factory/driver: `create(id, options, meta)`,
  `createAgent(ownerCtx, options)`, `resume(ownerCtx, options)`.
- `ctx.agentPresets` — preset registry: `list()`, `resolve()`, `select(agent,
  preset)`, `standingKeyFor(id?)`.
- `ctx.agentDefaultModel` — `currentSelection()`, `saveSelection(next)`.

## `ctx.skills` — skills registry

Provider registry + merged catalog; `list()`, `get(name, options)`, `snapshot()`.
Skill names are kebab-case. Local discovery ranks: `project-dsh`
(`<root>/.dsh/skills`, rank 100), `project-agents` (`<root>/.agents/skills`,
rank 200), `custom`, `user-dsh`, `user-agents`, `bundled`.

## `ctx.cordisInspect`, `ctx.dynamicCordisRunner`, `ctx.inspector`

Extension/dynamic-plugin management (model-facing inspect tools, dynamic
Plugin/Package lifecycle, inspector publish). Mostly used by the official
extension subsystem; plugin authors rarely need these directly.

## `ctx.fs`, `ctx.storageDomain`, `ctx.llm`, `ctx.scope`, `ctx.subagent`, …

Many more services exist (`dsh-fs`, `dsh-storage-domain`, `dsh-llm`,
`dsh-scope`, `dsh-subagent`, `dsh-schedule`, `dsh-goal`, ...). Check the
installed package list under
`node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/` and each package's
`lib/types/**/*.d.ts` for the full inventory. `dsh-tauri-plugins` currently
uses: `webServer`, `sessions`, `workspaceRegistry`, `sessionPersistence`
(indirect), `tools`, `systemPrompt`, `agents`, `skills`, plus client-side
`slots`, `locale`, `layout`, `sessions`, `workspaces`, `renderer`.

## Services NOT yet used by this repo (candidates for new features)

`agentLoop`, `agentPresets`, `agentDefaultModel`, `sessionController`,
`workspaceController`, `directoryPicker`, `cordisInspect`,
`dynamicCordisRunner`, `inspector`, `fs`, `storageDomain`, `llm`, `scope`,
`subagent`, `schedule`, `goal`, `jobs`, `userApproval`, `timeout`,
`attachment`, `authorization`, `sandbox`, `bash`, `pwsh`, `terminal` — consult
their `.d.ts` and the official subsystem docs before use.
