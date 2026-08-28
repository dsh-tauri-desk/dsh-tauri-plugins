---
name: dsh-plugin-dev
description: Develop DeepSeek Harness (dsh) plugins in the dsh-tauri-desk/dsh-tauri-plugins monorepo. Use when creating, extending, or debugging a dsh plugin's host half (node) or client half (browser), wiring ctx service injections, HTTP routes, slots, locale, tools, system prompts, or planning capability fallbacks when official APIs are missing.
license: MIT
compatibility: Requires the dsh-tauri-plugins workspace, pnpm 10, TypeScript strict, and a running DeepSeek Harness (dsh) instance for end-to-end verification.
metadata:
  author: dsh-tauri-desk
  version: "1.0"
  source: Generated from https://github.com/dsh-tauri-desk/dsh-tauri-plugins and https://github.com/deepseek-ai/deepseek-harness
---

# dsh Plugin Development

Build plugins for DeepSeek Harness inside `packages/<plugin-name>/` of the
[dsh-tauri-plugins](https://github.com/dsh-tauri-desk/dsh-tauri-plugins) monorepo.
Every plugin is a **two-half** Cordis plugin: a host half (`src/*.ts`, runs in
the node host) and a client half (`src/client/*.ts(x)`, runs in the browser
WebView). The halves communicate over plugin-owned HTTP routes under
`/api/<plugin>/*` registered with `ctx.webServer`.

## Plugin anatomy

```
packages/<name>/
├── package.json          # dsh.client.inject / platform / bundle.patch
├── cordis.patch.yml      # optional profile patch rows (loader insertion)
├── src/
│   ├── index.ts          # host half: inject, apply, buildRoutes, tools, prompts
│   ├── types.ts          # host types (HostContext = any is allowed at seams)
│   ├── constants.ts      # host constants
│   ├── http.ts           # optional routeHandler helper (POST/GET + loopback guard)
│   ├── storage.ts        # optional JSON persistence (atomic writes)
│   └── client/
│       ├── index.ts      # client half: inject, apply, slots, styles, locale
│       ├── types.ts      # client shared types (single source)
│       ├── constants.ts  # client shared constants (single source)
│       ├── locale.ts     # zh/en dictionaries
│       ├── styles.ts     # css-render mount
│       ├── store.ts      # optional SnapshotStore + fetch RPCs
│       └── <feature>.tsx # slot components (kebab-case file names)
```

Host and client halves are loaded independently: `export const name` and
`export const inject` plus `export function apply(ctx, config?)` on each.

## Core rules (from AGENTS.md)

1. **inject declares dependencies.** `export const inject = ['webServer', 'sessions', ...]`.
   The host waits for those services to be ready before `apply` runs. Never
   reach for a service not declared in `inject`.
2. **Every registration returns a disposer.** Register inside `ctx.effect(() =>
   disposer, effectId)` so reload/teardown unwinds cleanly. Observers, timers,
   MutationObservers, style mounts, and listeners must all be cleaned up.
3. **Slot registration is a stable protocol.** Use
   `ctx.slots.register({ name, id, registrant, order, priority, inject }, Component)`
   with constants from `client/constants.ts`. Missing optional renderers must
   fall back gracefully, never white-screen.
4. **Client types/constants are centralized.** Put shared types in
   `src/client/types.ts`, shared constants in `src/client/constants.ts`. Use
   type-only imports.
5. **Styles via css-render only.** Mount in `apply()` effects; no inline styles
   or raw `<style>` injection; icon components copy SVGs from
   `github.com/gravity-ui/icons`.
6. **Host does all I/O.** Git, filesystem, process, and host APIs live only in
   the host half. HTTP routes restrict methods; mutating routes must validate
   origin (loopback) and session ownership.
7. **Never silently overwrite user data or branches.** Use atomic writes
   (tmp + rename), verify destructive git operations at every step.
8. **Run full verification before finishing:** `pnpm run lint --fix`,
   `pnpm run typecheck`, `pnpm run test -- --run`, `pnpm run build`.

## Reference map

| Topic | Reference |
|-------|-----------|
| Host/client architecture & lifecycle | [references/architecture.md](references/architecture.md) |
| Official host-half `ctx` services & API signatures | [references/host-api.md](references/host-api.md) |
| Official client-half `ctx` services & slot protocol | [references/client-api.md](references/client-api.md) |
| package.json `dsh` manifest, patch rows, build config | [references/manifest.md](references/manifest.md) |
| ctx dependency management (inject/effect/events) in depth | [references/ctx-dependencies.md](references/ctx-dependencies.md) |
| Working patterns from existing plugins (worktree/session/panel/ui) | [references/patterns.md](references/patterns.md) |
| Capability fallback ladder (official API → shell patch → DOM → disable) | [references/fallback.md](references/fallback.md) |
| Testing and verification | [references/testing.md](references/testing.md) |

## Capability fallback ladder (read before planning features)

When a feature needs a host capability the current official dsh release does
not expose, plan a **fallback ladder** from most to least preferred. This was
the exact pattern used for session deletion (no official
`ctx.sessions.remove`):

1. **Official public API** — `ctx.sessions`, `ctx.workspaceRegistry`,
   `ctx.sessionPersistence`, `ctx.agents`, `ctx.webServer`, `ctx.tools`,
   `ctx.systemPrompt`, client `ctx.slots`/`ctx.sessions`/`ctx.workspaces`.
   Verify the signature against the installed dsh version's `.d.ts` files —
   never assume an API exists.
2. **Shell patch** — when the official API is missing, the desktop shell
   (`deepseek-harness-desktop`) patches the bundled dsh core before launch
   (see `src-tauri/src/service/workflow/*_patch.rs`), exposing a narrow,
   anchor-checked, idempotent addition (e.g. `SessionStore.remove(id)`).
   Plugin detects presence via capability check and errors loudly if absent.
3. **DOM patch** — browser half can rewrite official UI (portal menus,
   sidebar rows) via MutationObserver + capture listeners, using stable
   `aria-label`/`role` selectors, never generated CSS-module hashes.
4. **Feature disable / degraded mode** — if none of the above applies, disable
   the feature and log a clear message; never silently half-work.

See [references/fallback.md](references/fallback.md) for the full decision
procedure, including how to implement and test a shell patch.

## Minimal plugin skeleton

Host half (`src/index.ts`):

```ts
export const name = 'my-plugin'
export const inject = ['webServer', 'sessions']

export function apply(ctx: HostContext, config: PluginConfig = {}): void {
  ctx.effect(() => {
    const disposers = buildRoutes(ctx).map(route => ctx.webServer.register(route))
    return () => { for (const d of disposers) d() }
  }, 'my-plugin: routes')
}
```

Client half (`src/client/index.ts`):

```ts
export const name = 'my-plugin'
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  installLocale(ctx)
  ctx.effect(() => mountMyStyles(), 'my-plugin: styles')
  ctx.effect(() => ctx.slots.register(
    { name: SLOT_NAME, id: COMPONENT_ID, registrant: PLUGIN_NAME, order, priority },
    MyComponent,
  ), 'my-plugin: slot')
}
```

## HTTP route helper pattern

`src/http.ts` wraps `routeHandler(fn, { mutate })`: `mutate: true` restricts
to `POST` and loopback origin; `false` restricts to `GET`. Return `[status,
payload]` tuples; throw `Error` for 500s. See
`packages/dsh-tauri-session/src/http.ts` for the reference implementation.

## Quick verification checklist

- [ ] Host inject list matches every `ctx.<service>` touched
- [ ] Client inject list matches every `ctx.<service>` touched
- [ ] Every `ctx.effect` returns a disposer that removes what it added
- [ ] Slot id/registrant/order/priority come from `client/constants.ts`
- [ ] Shared client types live in `client/types.ts`
- [ ] Styles mounted only in `apply()` effects, css-render only
- [ ] Mutating HTTP routes guard method + loopback
- [ ] `pnpm run lint --fix && pnpm run typecheck && pnpm run test -- --run && pnpm run build`
