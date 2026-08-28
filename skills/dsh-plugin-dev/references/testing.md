# Testing & Verification

Run these before finishing any plugin change (repo rule, from AGENTS.md):

```bash
pnpm run lint --fix
pnpm run typecheck
pnpm run test -- --run
pnpm run build
```

## Per-plugin commands

```bash
pnpm -F dsh-tauri-session typecheck
pnpm -F dsh-tauri-session test -- --run
pnpm -F dsh-tauri-session build
```

## Unit tests (Vitest)

- `foo.ts` → same-directory `foo.test.ts`.
- Use `describe` / `it` / `expect`; no always-true placeholder tests.
- Prefer testing pure functions, state transitions, HTTP method/authorization
  boundaries, storage atomicity, and public protocols.

### HTTP route tests

Test `routeHandler` directly with fake req/res:

- wrong method → 405
- non-loopback mutation → 403
- missing body field → business error → 500 `{ error }`
- success → `[200, payload]`

### Registry state machine tests

`dsh-tauri-session/src/index.test.ts` fakes the registry:

```ts
interface FakeRegistry {
  enqueueOperation: (fn) => Promise<void>
  requireState: () => FakeRegistryState
  setState: (state) => Promise<void>
}
```

Tests assert: single-id removal preserves the rest of the state; no write when
the update is a no-op; clear empties the set; missing mutation surface rejects
with a version-compatibility message.

### Pure function tests

`dsh-tauri-session/src/client/archive-sort.test.ts` covers grouping/sorting
with row fixtures. `dsh-tauri-worktree` tests git/ledger/storage transitions.

## Shell patch tests (deepseek-harness-desktop)

Rust unit tests inside each `*_patch.rs`:

- `patches_<feature>` — patching a fixture containing the anchor produces the
  marker + injected code.
- `patch_is_idempotent` — patching an already-patched source returns
  `AlreadyPatched`.
- `skips_partial_upstream_layout` — anchor missing → `AnchorMissing` (no
  corruption).

Run:

```bash
cd src-tauri
cargo test service::workflow::session_patch
cargo check
```

## Manual end-to-end verification

1. Rebuild the plugin: `pnpm -F <name> build`.
2. **Restart the desktop shell** — page refresh alone does not reload the host
   half or apply launch-time shell patches.
3. Verify the exact HTTP requests in DevTools Network: pathname, method, port,
   status. 404 usually means stale dist or wrong path; 405 is method mismatch;
   403 is origin.
4. For destructive operations, check both durable state and live memory:
   - durable: `$DSH_HOME/sessions/...` directories,
     `$DSH_HOME/storages/workspace.json` (`archivedSessionIds`,
     `tables.workspaces[*].sessionIds`)
   - live: does the session vanish from the UI immediately, or only after
     restart? (The latter indicates the in-memory SessionStore still holds it
     — see fallback.md.)

## Data layout quick reference (JSONL backend)

```text
$DSH_HOME/sessions/<encoded-cwd-key>/<encoded-session-id>/session.jsonl.zstd
$DSH_HOME/storages/workspace.json        # workspace records + archive set
$DSH_HOME/storages/session_projcache.json
```

`encodeSessionId` escapes unsafe code units as `~XXXX`; the cwd key is a
lossy `--<slug>--` encoding. Copy the encoder from
`dsh-tauri-session/src/index.ts` when scanning durable directories.

## Dev environment facts (this machine)

- `DSH_HOME=C:\Users\hairy\.dsh` (release), debug builds use `.dsh.dev`.
- Dev sessions live under `C:\Users\hairy\.dsh\sessions\<encoded-cwd>\session-<id>\`.
- Workspace/archive state: `C:\Users\hairy\.dsh\storages\workspace.json`.
