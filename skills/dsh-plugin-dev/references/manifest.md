# Manifest, Build & ctx Dependency Management

## package.json `dsh` field

```json
{
  "name": "dsh-tauri-session",
  "type": "module",
  "version": "0.4.9",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js",
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["README.md", "cordis.patch.yml", "dist"],
  "dsh": {
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-primitives"],
      "platform": "web"
    },
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc",
    "test": "vitest"
  }
}
```

Key points:

- `"type": "module"` everywhere (repo rule).
- Host half entry is the package root (`dist/index.js`); client half is
  `dist/client.js` via the `./client` export.
- `dsh.client.inject` lists client-half runtime dependencies for bundling.
- `dsh.client.platform` is `"web"`.
- `dsh.bundle.patch` points at the profile patch file.
- The `dsh` field is how the harness loader discovers and mounts the plugin.

## cordis.patch.yml

Minimal insertion rows for the profile loader:

```yaml
- insert:
    - id: dsh-tauri-session
      name: dsh-tauri-session
```

The desktop shell also uses patch rows for other purposes (e.g.
`win_inspector.rs` writes profile `cordis.patch.yml` mount lines). Keep the
plugin's own patch file minimal: id + name.

## Build pipeline (tsdown)

- `tsdown` builds both halves: `dist/index.js` (ESM host) and `dist/client.js`
  (CJS browser bundle with `window.__ModuleLoader__.load({id, factory})`).
- `dev` runs `tsdown --watch`.
- Desktop debug builds link plugin sources from a resource directory without
  node_modules; host halves resolve DSH-owned packages through the platform
  loader (`ctx.loader.import`), see dsh-tauri-panel-extension.
- After changing a plugin: rebuild (`pnpm -F <name> build`) and restart the
  desktop shell — page refresh alone does not reload the host half. Client
  bundles may hot-reload in dev via `pnpm run dev:web` from the dsh checkout.

## ctx dependency management (in depth)

### inject (declarative)

```ts
export const inject = ['webServer', 'sessions']
```

Plugin `apply` waits until all named services exist. List **every** service
touched in `apply` — an undeclared `ctx.foo` access yields `undefined` and a
runtime failure, not a type error (host seams use `any`).

### ctx.inject (lazy/optional)

```ts
ctx.inject(['webServer', 'skills'], (hostCtx) => { ... })
```

Callback runs once the services are available; useful when a capability is
optional and the plugin should still mount without it.

### ctx.effect (disposable side effects)

```ts
ctx.effect(() => {
  const disposer = doSomething()
  return disposer          // called on unload/reload
}, 'my-plugin: label')
```

Return value may be a disposer or an iterable of disposers (disposed in
reverse). Use one effect per cohesive concern with a stable label. Never
register a global side effect outside an effect.

### ctx.on / event subscription

```ts
ctx.on('session/event', (session, event) => { ... })
```

Returns a disposer; prefer `ctx.effect(() => ctx.on(...))` so it unwinds.

### Events by dispatch mode

- emit: `session/created`, `session/disposed`, `session/event`,
  `agent/created`, `agent/disposed`, `agent/error`, `agent/status`,
  `system-prompt/change`, `skills/change`, `webserver/index-inject`
- waterfall: `system-prompt/assemble`, `tools/pre-execute`
- parallel: `session/flush`
- serial/bail: policy events

### Scoping

- Host: `ctx.agents.withInitiator(agent, op)` / `withoutInitiator(op)` for
  initiator attribution.
- Client: `ctx.sessions.scope(id)` / `scopeOf(ctx)` / `sessionOf(ctx)` /
  `binding(id)`; agent-scoped contexts carry `scope.session`.

## Common failure modes

| Symptom | Likely cause |
|---------|--------------|
| 404 on `/api/<plugin>/...` | Host half not loaded / stale dist / route not registered / wrong path prefix / wrong port |
| 405 | Method mismatch (GET vs POST on mutate route) |
| 403 | Non-loopback caller on mutate route |
| Route works but UI hangs | Client waits on host RPC without timeout; add AbortController |
| Session reappears after delete | Durable dir removed but in-memory SessionStore entry remains → needs shell-patch `remove` (see fallback.md) |
| Styles not applied | Style id already mounted by another plugin; css-render `find()` guard |
| Blank page | Slot registration error or missing renderer fallback |
