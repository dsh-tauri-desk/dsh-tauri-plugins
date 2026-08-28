# Capability Fallback Ladder

When a feature needs a host capability that the installed official dsh release
does not expose, follow this ladder from most preferred to least. Each rung
must be verified, guarded, and logged — never silently half-work.

## The ladder

```
1. Official public API
        │  missing?
        ▼
2. Desktop shell patch (deepseek-harness-desktop)
        │  missing / shell absent?
        ▼
3. DOM patch (client half only)
        │  not applicable?
        ▼
4. Feature disabled + clear log/message
```

## 1. Official public API (first choice)

Verify the signature against the **installed** dsh's `.d.ts` files:

```text
node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/<pkg>/lib/types/**/*.d.ts
```

Never assume an API exists just because the docs mention it — the desktop
shell pins a specific release and may lag the docs. Check:

- `ctx.sessions` — SessionStore (no public delete/remove in 0.1.1-rc.2)
- `ctx.sessionPersistence` — no delete either
- `ctx.workspaceRegistry` — `archiveSession` yes, `unarchive` no
- `ctx.agents` — `AgentHandle.dispose()` is the correct live-agent teardown
- `ctx.webServer` / `ctx.tools` / `ctx.systemPrompt` — full public API

## 2. Desktop shell patch

When the official API is missing, the desktop shell
(`D:\dsh-tauri-desk\deepseek-harness-desktop`) can patch the bundled dsh core
**before launch**. Precedent: `SessionStore.remove(id)` added via
`src-tauri/src/service/workflow/session_patch.rs` (invoked from
`workflow::launch`, alongside `workspace_patch.rs`, `renderer_patch.rs`,
`client_hmr_patch.rs`).

### Shell patch anatomy

```rust
// 1. Anchor constants — must match the exact bundled source (HARDCODE pinned).
const PATCH_MARKER: &str = "dsh-tauri-desktop: <feature>"
const ANCHOR: &str = "/** exact upstream comment/code to anchor on */"
const INSERTION: &str = r#"/** patch doc */ <injected code>"#;

// 2. Pure patch_source() with PatchOutcome { AlreadyPatched, AnchorMissing, Patched }.
// 3. apply(app_handle): locate active core install dir, read index.js, patch
//    idempotently, write back; missing file or anchor → log & skip.
// 4. Unit tests: patches_method, patch_is_idempotent, skips_partial_layout.
```

Key rules:

- The patch must be **idempotent** (marker check first).
- Anchor on a stable upstream comment/signature; if anchors drift (dsh update),
  **skip and warn** — never corrupt the core.
- Only add a narrow facade over an existing official lifecycle (e.g.
  `remove(id)` delegating to the existing `entry.detach()`), never rewrite
  official behavior.
- Wire `apply()` into `workflow::mod.rs::launch` **before** the dsh process
  starts and before plugins load.

### Plugin-side capability check

The plugin host half must detect the patched API and fail loudly if absent:

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

## 3. DOM patch (client half)

For UI-only changes, the client half can rewrite official DOM. Precedent:
`dsh-tauri-session/src/client/workspace-patch.ts` (rewrites the workspace
menu's "删除工作区" into "归档会话" with an official Gravity icon and a
confirmation Modal).

Rules (see also client-api.md DOM section):

- Stable selectors only (`role=menuitem`, `aria-*`, `data-slot`,
  plugin-prefixed classes).
- Rewrite label text nodes / icon containers; do not delete React-managed
  nodes.
- Intercept clicks in the capture phase (`stopImmediatePropagation`), then
  dispatch an outside `pointerdown` to close the official Menu.
- Override official danger styles with `!important` inline styles scoped to
  your class (official CSS module classes have generated hashes and higher
  specificity).
- Clean up every listener/observer in the effect disposer.

## 4. Feature disable / degraded mode

If no rung applies, disable the feature and communicate clearly:

- Log `console.warn('[plugin] ... disabled, reason ...')`.
- Skip registration so the official UI keeps working (no white screen).
- Precedent: `dsh-tauri-ui` skips sidebar registration when
  `SlotOutlet` is unavailable (renderer patch missing).

## Decision procedure

1. Read the installed `.d.ts` for the desired verb — does a public API exist?
2. If not, can the desktop shell patch add a narrow facade over an existing
   lifecycle? Implement + unit test the patch, wire into launch.
3. Can the client half achieve the goal via DOM rewriting without host state?
4. Otherwise disable with a clear message.

## Real case study: session deletion

- Goal: permanently delete archived sessions (in-memory + durable).
- Official API: `ctx.sessions` has no `remove`; `sessionPersistence` has no
  delete; `workspaceRegistry.delete` deletes only the registration.
- Shell patch: `session_patch.rs` adds `SessionStore.remove(id)` delegating to
  the official `entry.detach()`.
- Plugin: capability-check `sessions.remove`, then remove workspace accounting
  (`requireTable().update`), archive set (`enqueueOperation`/`setState`),
  durable dir (`removeSessionDataDir` with id-encoding markers), and resync
  client sessions/workspaces.
- Result: deleted sessions vanish from the live store immediately; without the
  patch the plugin errors loudly instead of half-deleting.
