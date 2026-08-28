# Generation

This skill was generated manually in the `dsh-tauri-desk/dsh-tauri-plugins`
workspace to codify dsh plugin development knowledge accumulated across the
repo's plugins and the DeepSeek Harness official docs.

## Sources

- Official DeepSeek Harness docs (master):
  - `docs/subsystems/extensions.zh.md` — extension subsystem & Cordis surface
  - `docs/subsystems/workspace.zh.md` — `ctx.workspaceRegistry`
  - `docs/subsystems/session.zh.md` — `ctx.sessions` / `ctx.sessionController`
  - `docs/subsystems/core.zh.md` — `ctx.agents` / `ctx.agentLoop` / presets
  - `docs/subsystems/tools.zh.md` — `ctx.tools` / `defineTool`
  - `docs/subsystems/system-prompt.zh.md` — `ctx.systemPrompt`
  - `docs/subsystems/skills.zh.md` — `ctx.skills`
  - `docs/cordis-primer.zh.md` — dispatch modes, inject/effect rules
  - `docs/cordis-api/inherited.md` — framework-inherited ctx
- Installed dsh release `.d.ts` files under
  `node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/*/lib/types/**`.
- The `dsh-tauri-desk/dsh-tauri-plugins` monorepo packages:
  `dsh-tauri`, `dsh-tauri-panel`, `dsh-tauri-panel-extension`,
  `dsh-tauri-session`, `dsh-tauri-ui`, `dsh-tauri-worktree`.
- The desktop shell `deepseek-harness-desktop` patch machinery
  (`src-tauri/src/service/workflow/*_patch.rs`).

## Content notes

- API signatures are pinned to the installed dsh release (0.1.1-rc.2);
  always re-verify against the installed `.d.ts` before relying on a
  signature.
- The capability fallback ladder (official API → shell patch → DOM patch →
  disable) is derived from the real session-deletion implementation
  (`SessionStore.remove` shell patch + plugin capability checks).
