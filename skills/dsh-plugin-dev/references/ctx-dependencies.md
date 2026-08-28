# ctx Dependency Management

This reference covers the Cordis dependency/dispatch model that dsh plugins
build on, with concrete usage from this repo. See
[host-api.md](host-api.md) and [client-api.md](client-api.md) for per-service
signatures.

## The five core concepts (from official cordis-primer)

1. **A plugin implements a Service.** A function with optional `inject` +
   `apply(ctx)`, or a Service subclass; lifecycle mounted by Cordis.
2. **A context is a service container.** Each service occupies a stable
   `ctx.<key>`; plugins look up by key, never by importing the implementation.
3. **`inject` declares service dependencies.** Plugins start only after
   declared services are ready; load order follows the dependency graph.
4. **Typed events for communication.** Services declare event names via
   TypeScript declaration merging and dispatch with `emit` / `waterfall` /
   `parallel` / `serial` / `bail`.
5. **Registration is reversible.** Prompt sections, tool schemas, adapters,
   providers, and listeners install through `ctx.effect()` / `ctx.on()` and
   unwind on reload/teardown.

## inject vs ctx.inject

### Static `export const inject`

```ts
export const inject = ['webServer', 'sessions', 'workspaceRegistry']
```

Used by most repo plugins. The loader resolves these before calling `apply`.
Both halves have their own inject lists:

- Host: `['tools', 'systemPrompt', 'webServer', 'sessions', 'workspaceRegistry', 'agents']`
  (dsh-tauri-worktree), `['webServer', 'sessions', 'workspaceRegistry']`
  (dsh-tauri-session), `['webServer', 'skills']` (dsh-tauri-panel-extension).
- Client: `['slots', 'locale']` (dsh-tauri-session),
  `['slots', 'layout', 'locale']` (dsh-tauri-ui), `['layout']` (dsh-tauri).

### Lazy `ctx.inject(services, callback)`

```ts
export function apply(ctx: Context, config?: Config): void {
  ctx.inject(['webServer', 'skills'], (hostCtx: Context) => {
    ctx.effect(() => { /* mounts only when both exist */ }, 'effect-id')
  })
}
```

Used by dsh-tauri-panel-extension to defer heavy provider mounting until the
skill registry is present. The callback context can also reach the platform
plugin loader for resolving DSH-owned packages.

## ctx.effect discipline

- Every registration that must be undone on reload/HMR/teardown goes inside
  `ctx.effect(() => disposer, label)`.
- The disposer may be a single function or an iterable of functions (disposed
  in reverse order — use this for ordered teardown chains, e.g. agent factory
  lifecycle).
- The label is diagnostic; keep it stable and plugin-prefixed
  (`'dsh-tauri-session: routes'`).
- Composite effects that must tear down IN ORDER should yield nested disposers
  at exact positions; never wrap a disposer that carries ordering semantics in
  a concurrent sibling (the official docs call this out for
  `ctx.agents.register`'s disposer).

## Event dispatch modes (official primer table)

| Mode | Awaited? | Order | Returns? |
|------|----------|-------|----------|
| `emit` | no | registration order | no |
| `waterfall` | no | registration order | yes |
| `parallel` | yes | all in parallel | no |
| `serial` | yes | registration order | yes |
| `bail` | no | registration order until a listener returns a bail value | yes |

Waterfall listeners receive `(...args, next)`; calling `next()` runs the rest
of the chain, and downstream returns flow back up through `next()`. Not
calling `next()` short-circuits.

## Practical event usage

```ts
// Host: react to session event stream (worktree handoffs)
ctx.on('session/event', (session: Session, event: SessionEvent) => {
  if (event.type === 'turn/end') { ... }
})

// Host: flush durability
// (persistence plugin subscribes; the store's flush() is the entry point)

// Client: locale change bridge
ctx.locale.subscribe(() => { localeRev.update(s => { s.rev += 1 }) })
```

## Scope-filtered dispatch

Several events are scope-filtered (`@deepseek-ai/dsh-scope`): `agent/*`,
`system-prompt/assemble`, session events. Listeners registered in an
agent-scoped context receive only that agent's dispatches; global listeners
see all. When dispatching, pass the carrier explicitly
(`scopeTarget(session, ...)`) so filtering works regardless of which context
invoked the registration.

## Client-side cross-domain boundary

`ctx.sessions` (client `ISessions`) is intentionally read-mostly: "writes stay
inside the sessions domain". Client plugins navigate/select via `open/clear`,
but destructive or domain-changing work must go through the **host half** RPC
routes — then re-sync the client mirrors (`workspaces.manager.refresh()`,
`ctx.sessions.refresh()` cast, archive store refresh). This boundary is why
archive/unarchive/delete live in the host and are invoked via `/api/dsh-session/*`.

## Capability detection pattern

When depending on a patched or version-sensitive API, detect + fail loudly
rather than assume:

```ts
const surface = ctx.sessions as SessionStoreSurface | undefined
if (live && !surface?.remove)
  throw new Error('宿主未提供 SessionStore.remove，请先更新桌面壳')
```

This keeps plugins honest across dsh versions and shell builds.
