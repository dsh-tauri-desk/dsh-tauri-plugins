# Client-half `ctx` Services & Slot Protocol

Client halves run inside the browser; the context is a Cordis `Context` typed
as `ClientContext` (`@deepseek-ai/dsh-client-runtime/client`). Services are
injected via `export const inject` and consumed through `ctx.<key>`.

## Client service inventory (installed dsh release)

| Service | Package | Purpose |
|---------|---------|---------|
| `ctx.slots` | dsh-client-runtime | Slot registry: register/inject/install/renderSlot |
| `ctx.sessions` | dsh-client-runtime | Session list snapshot, open/clear/search/fork/provide/scope |
| `ctx.workspaces` | dsh-client-runtime | Workspace list snapshot, manager refresh, archiveSession |
| `ctx.locale` | dsh-client-locale | Locale register/subscribe/getLocale |
| `ctx.layout` | dsh-client-ui-layout | Sidebar toggle, shell chrome |
| `ctx.renderer` (via slots) | dsh-client-ui-renderer | SlotOutlet, useHost, createSlotRenderer |
| `ctx.remote.*` | dsh-client-connection | Wire RPC namespaces (session/workspace/...) |

## `ctx.slots` — SlotRegistry

The single registration API is `ctx.slots.register` (typed via `SlotCore`):

```ts
ctx.slots.register(
  {
    name: SLOT_NAME,          // slot seat key, e.g. 'settings.section'
    id: COMPONENT_ID,         // stable component id
    registrant: PLUGIN_NAME,  // diagnostics stamp
    order: NUMBER,            // display order
    priority: NUMBER,         // optional, lower wins for single slots
    inject: (props) => ({ ... }),  // optional props injection
  },
  Component,
)
```

- `register` runs through the caller's `ctx.effect`, so plugin unload cascades
  the removal — wrap it in `ctx.effect(() => ctx.slots.register(...), effectId)`.
- `ctx.slots.inject(key, callback)` — install effect for a slot's declaration
  lifetime (used by dsh-tauri-ui's sections projection).
- `ctx.slots.install(renderer)` / `installLocale(face)` — boot-once shell
  contracts; do not call from plugins.
- `ctx.slots.renderSlot('root', owner)` — shell-only.

Known slot seats (from installed ui-layout/ui-sidebar/workspace packages):

- `root` — single, DO NOT register (would shadow the whole frame)
- `shell.overlay` — list slot, floats over the app (used by dsh-tauri-ui)
- `sidebar.settings` — settings gear seat (dsh-tauri-ui trigger, priority -1)
- `settings.section` — settings page sections (dsh-tauri-session archive page)
- `settings.onboarding` — onboarding sections
- `conversation.input.dock` — composer dock (worktree references it)
- `sidebar` / `sidebar.workspace` — sidebar seats

Because `settings.section` and other UI seats are not declared in
`dsh-client-runtime`'s SlotMap (declaration ownership lives in ui-sidebar /
ui-layout), plugins pass the options object with an explicit `as never` cast —
this is the established precedent in `dsh-tauri-session/src/client/index.ts`
and `dsh-tauri-worktree`.

## `ctx.sessions` — client sessions face (ISessions)

```ts
readonly list: ObservableSnapshot<SessionListState>   // { ids, byId, current, phase }
open(id: SessionId): void
clear(): void
search(query, signal): Promise<RpcResult<...>>
fork(opts: { sessionId, atSeq?, increaseTitle? }): Promise<SessionId>
provide(descriptor): () => void
scope(id) / scopeOf(ctx) / sessionOf(ctx) / binding(id)
```

`SessionListState.byId[sessionId]` carries `{ id, title, displayTitle, cwd,
updatedAt, blank, ... }` — `blank: true` marks temporary new-session rows
(exclude them from archive/delete counts). There is **no client-side
refresh/delete** on the official `ISessions` face; `ctx.sessions.refresh()`
used by dsh-tauri-session is a cast/extension — re-sync the host list instead
after mutations (see fallback.md).

## `ctx.workspaces` — client workspaces face

```ts
readonly list: ObservableSnapshot<WorkspaceListState>
// { items: WorkspaceView[], archivedSessionIds, phase, ... }
manager?.refresh?.()   // re-pull workspace baseline (used after mutations)
archiveSession(sessionId)   // official archive verb
```

`WorkspaceView` = `{ workspaceId, path, title?, sessionIds }`.

## `ctx.locale`

```ts
ctx.locale.register(ns, locale, dict)   // e.g. register('my-plugin', 'zh', DICT_ZH)
ctx.locale.subscribe(listener)
ctx.locale.getLocale().active
```

Pattern (from dsh-tauri-session/src/client/locale.ts): module-level
`activeLocale` + `localeRev` SnapshotStore; `text(key, values?)` renders
`{placeholder}` templates; `useLocale()` subscribes to rev so components
re-render on locale change. Keep zh/en key sets identical.

## `ctx.layout`

`ctx.layout.toggleSidebar()` and other chrome verbs (used by dsh-tauri's nav
bridge). Inject `'layout'` when the plugin needs shell chrome access.

## Store & state patterns

- `createSnapshotStore(initial)` / `useSyncExternalStore(store.subscribe,
  store.getSnapshot)` — module-level shared state
  (`dsh-tauri-session/src/client/store.ts`).
- `defineStore(...)` — engine store instances for slot-scoped state.
- `useProjection` / `useSession` standard props are auto-injected into
  session-scoped slot components.

## DOM patching rules (when official UI must change)

The client half may patch official DOM (portal menus, sidebar rows) but must:

- Use stable selectors: `role=`, `aria-label`, `data-slot`, plugin-prefixed
  classes — never generated CSS-module hashes.
- Read React identity via Fiber keys **read-only** when the DOM lacks data
  attributes (see `workspace-patch.ts` `reactKey`).
- Use `MutationObserver` + capture listeners; clean up everything in the
  effect disposer.
- Never remove/replace React-managed nodes wholesale; edit label text nodes
  and innerHTML of icon containers instead.
