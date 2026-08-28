# Working Patterns from Existing Plugins

Concrete techniques harvested from the dsh-tauri-desk plugins. Read the
referenced source files for the full implementation.

## HTTP route RPC pattern (dsh-tauri-session / dsh-tauri-worktree)

Host (`src/index.ts`):

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
      handler: routeHandler(async body => [200, await permanentlyDeleteSession(ctx, dshHome, body)], { mutate: true }),
    },
  ]
}

export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  ctx.effect(() => {
    const disposers = buildRoutes(ctx, dshHome).map(route => ctx.webServer.register(route))
    return () => { for (const d of disposers) d() }
  }, `${SESSION_PLUGIN_NAME}: routes`)
}
```

`routeHandler(fn, { mutate })` (src/http.ts): method guard (POST for mutate,
GET otherwise), loopback guard for mutations, JSON body reading with size
limit, error → `{ error }` JSON. Return `[status, payload]`.

Client (`src/client/store.ts`):

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MUTATION_TIMEOUT_MS)
  try {
    const res = await fetch(`${SESSION_API_PREFIX}${path}`, {
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

## Tool registration + system prompt injection (dsh-tauri-worktree)

```ts
export const inject = ['tools', 'systemPrompt', 'webServer', 'sessions', 'workspaceRegistry', 'agents']

// tools: defineTool with typed schema
for (const tool of createToolSet(ctx, cfg, pendingHandoffs))
  ctx.tools.register(tool)

// events: observe session/event for turn/end handoffs
ctx.on('session/event', (session, event) => {
  if (event.type !== 'turn/end') return
  ...
})

// systemPrompt.context: dynamic per-assembly context (scoped by session)
ctx.systemPrompt.context({
  name: 'plugin:dsh-tauri-worktree:checkout',
  order: WORKTREE_SECTION_ORDER,
  text: (context) => { const id = context?.scope?.session?.id; ... },
})

// systemPrompt.section: standing instructions
ctx.systemPrompt.section({
  name: 'plugin:dsh-tauri-worktree',
  order: WORKTREE_SECTION_ORDER,
  text: (context) => { ... },
})
```

## Agent lifecycle (dsh-tauri-worktree)

- `ctx.agents.get(sessionId)` — find live agent.
- `ctx.agents.create(options)` — create agent + session under caller identity,
  returns `AgentHandle` with `dispose()`.
- `ctx.agents.resume(options)` — resume persisted session.
- `Agent.cancel(cause, opts)` / `agent.whenIdle()` / `agent.followup(msg)`.

## Slot registration with props injection (dsh-tauri-session)

```ts
ctx.effect(
  () => ctx.slots.register(
    {
      name: SETTINGS_SECTION_SLOT,          // 'settings.section'
      id: SESSION_SECTION_ID,
      order: SESSION_SECTION_ORDER,
      registrant: SESSION_REGISTRANT,
      label: () => text('section'),
      inject: () => ({ sessionsRuntime: ctx.sessions, workspacesRuntime: ctx.workspaces }),
    } as never,                             // slot not in runtime SlotMap
    ArchivePage,
  ),
  SESSION_ARCHIVE_SECTION_EFFECT,
)
```

## SnapshotStore + uSES (dsh-tauri-session)

```ts
export const archiveStore = createSnapshotStore<ArchiveUiState>({ ... })
export function useArchiveUi(): ArchiveUiState {
  return useSyncExternalStore(archiveStore.subscribe, archiveStore.getSnapshot)
}
// mutations: archiveStore.update(state => { state.x = ... })
```

After host-side mutations that bypass official frames (unarchive/delete/clear),
re-sync client mirrors explicitly: `refreshArchived()` + `workspaces.manager.refresh()`
+ `sessions.refresh()` (cast) — otherwise the UI keeps stale rows.

## Workspace DOM menu patch (dsh-tauri-session/client/workspace-patch.ts)

1. Watch project-row ellipsis buttons (`[role=treeitem][aria-expanded]`),
   record the group on click (capture phase).
2. Scan portal menus (`button[role=menuitem]`) for the "删除工作区" label;
   rewrite the label text node, keep the official icon container but swap its
   innerHTML to the official Gravity archive SVG, set
   `color: var(--dsw-alias-label-tertiary)` on the icon.
3. Intercept click (capture): collect session ids from group rows via Fiber
   key (exclude `blank` sessions), open a `Modal` confirm, then
   `archiveWorkspace(workspaceId, sessionIds)`.
4. Dispatch an outside `pointerdown` to close the official Menu.
5. Cleanup: disconnect observer, close dialog root, remove listeners.

## css-render styles (dsh-tauri-session/client/styles.ts)

```ts
const cssr = CssRender()
const { c } = cssr
const archiveStyle = c([
  c(`.${K.page}`, { display: 'flex', ... }),
  c(`.${K.deleteAll}.${K.deleteAll}:hover:not(:disabled)`, { background: '...' }), // double-class to beat official specificity
])

export function mountSessionStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (cssr.find(SESSION_STYLE_ID) !== null) return () => {}
  archiveStyle.mount({ id: SESSION_STYLE_ID, head: true })
  return () => archiveStyle.unmount({ id: SESSION_STYLE_ID })
}
```

## Locale (dsh-tauri-session/client/locale.ts)

Module-level `activeLocale` + `localeRev` store; `installLocale(ctx)` registers
zh/en dicts and bridges locale changes to rev; `text(key, values?)` renders
`{placeholder}` templates; `useLocale()` re-renders on rev bump.

## Nested ctx.inject (dsh-tauri-panel-extension)

`apply(ctx)` can defer work until lazy services resolve:

```ts
export const inject = ['webServer', 'skills']  // or:
export function apply(ctx) {
  ctx.inject(['webServer', 'skills'], (hostCtx: Context) => {
    ctx.effect(() => { ... }, 'effect-id')
  })
}
```

`ctx.inject(services, callback)` runs the callback with a context where the
listed services are available — useful for optional dependencies.

## Manifest basics (package.json dsh field)

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

See [manifest.md](manifest.md) for the full layout.
