# Host / Client Architecture

DeepSeek Harness plugins are Cordis plugins with two independently loaded
halves that share one package. The loader mounts each half in its own runtime:
the **host half** runs in the node process, the **client half** runs in the
browser (WebView).

## Two-half model

```
┌─────────────────────────────┐      fetch /api/<plugin>/*      ┌─────────────────────────────┐
│  Host half (node)           │ ◄──────────────────────────────► │  Client half (browser)     │
│  packages/<name>/src/*.ts   │                                 │  packages/<name>/src/client │
│  ctx.webServer / sessions   │                                 │  ctx.slots / locale /      │
│  workspaceRegistry / tools  │                                 │  sessions / workspaces     │
│  systemPrompt / agents ...  │                                 │  layout / renderer ...     │
└─────────────────────────────┘                                 └─────────────────────────────┘
```

- **Host half** (`src/index.ts`) owns all I/O: git, filesystem, processes,
  HTTP routes, tool registration, system prompt injection, agent lifecycle.
- **Client half** (`src/client/index.ts`) renders UI into slots, patches the
  DOM, manages locale and local store state, and calls host routes via
  `fetch('/api/<plugin>/...')` (same-origin, absolute path).
- A plugin may be **host-only** (no client dir) or **client-only**
  (e.g. `dsh-tauri-panel` exports an empty host `apply`), but the loader still
  expects a mountable entry per half that ships.

## Lifecycle

Each half is a Cordis plugin:

```ts
export const name = 'my-plugin'                      // diagnostics identity
export const inject = ['webServer', 'sessions']      // required services
export function apply(ctx, config?) { ... }          // called once services ready
```

- `inject` declares services; the plugin starts **only after** every listed
  service is ready. Loading order is expressed through dependencies, never
  manual sequencing.
- `apply(ctx, config)` is the assembly entry point. Register everything inside
  `ctx.effect(() => disposer, effectId)` so reload/HMR/teardown unwinds
  correctly.
- `ctx.effect` return value is a disposer (or iterable of disposers). The
  effect id is diagnostic only. On fiber unload, disposers run in reverse
  registration order.
- Client HMR: the official dsh client-HMR path may unload third-party plugins
  without remounting them; the desktop shell patches this for debug builds
  (`client_hmr_patch.rs` downgrades rebuilt to a page reload).

## Host apply order (from existing plugins)

1. Register tools (`ctx.tools.register(tool)`) and system prompt
   sections/contexts (`ctx.systemPrompt.section/context`).
2. Subscribe to events (`ctx.on('session/event', ...)`) for cross-cutting
   behaviors.
3. `ctx.effect(() => migrate legacy data, '...')` for one-time migrations.
4. `ctx.effect(() => buildRoutes(ctx).map(r => ctx.webServer.register(r)), '...')`
   — collect disposers so unload removes every route.

## Client apply order (per AGENTS.md)

1. Install locale (`installLocale(ctx)` — `ctx.locale.register(ns, 'zh', dict)`).
2. Mount css-render styles inside `ctx.effect`.
3. Register slot components and UI behaviors (`ctx.slots.register(...)`).
4. Manage MutationObservers, listeners, timers, hydration via `ctx.effect`.

## Communication contract

- Routes live under `/api/<plugin>/*` (e.g. `/api/dsh-session/archived`).
- `routeHandler(fn, { mutate })`: `mutate: true` → `POST` + loopback origin
  guard; `false` → `GET`. Errors become `500` with `{ error }` JSON, 405 for
  wrong method, 403 for non-loopback mutations.
- Client `request<T>(path, init)` helper wraps fetch with JSON parsing and
  non-OK → `Error(body.error ?? 请求失败 (status))`; add an AbortController
  timeout for mutating calls so a stalled host never hangs the UI forever.

## Host context typing

`HostContext = any` is the accepted seam type in `src/types.ts` (see
`dsh-tauri-session/src/types.ts`). Feature code should narrow the services it
touches with small structural interfaces (e.g. `SessionStoreSurface`) instead
of spreading `any` through the codebase.

## Reference plugins in this repo

| Plugin | Half focus | Notable techniques |
|--------|-----------|--------------------|
| `dsh-tauri` | client | pure message bridge, `ctx.layout.toggleSidebar`, css-render tweaks |
| `dsh-tauri-ui` | client | settings dialog → sidebar, slot-shadow, `SlotOutlet`, graceful fallback |
| `dsh-tauri-panel` | none | empty host apply pattern |
| `dsh-tauri-panel-extension` | host | `ctx.inject(['webServer','skills'], cb)`, skills provider remount |
| `dsh-tauri-session` | both | archive page, DOM workspace-menu patch, route RPCs, shell-patch API |
| `dsh-tauri-worktree` | both | tools + systemPrompt + agents + webServer, ledger persistence |
