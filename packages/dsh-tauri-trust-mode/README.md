# dsh-tauri-trust-mode

DeepSeek Harness 桌面端的「信任模式」插件：在设置侧边栏提供一个开关，一键切换 Harness 的权限预设，免去 Agent 执行高权限命令时逐次弹出的审批。

## 机制

改写 `$DSH_HOME/settings.yaml` 的 `permissionPresets.defaultPreset`：

- `danger-full-access`：非受限沙箱 + 审批策略 `never`（不再询问）
- `workspace-write`：工作区可写沙箱 + 审批策略 `ask`（逐次询问，默认）

切换对**之后新建的会话**生效，既有会话不受影响；可随时关回 `workspace-write`，不损失任何 agent preset 能力。

## 架构（host half / client half）

- 宿主侧 `src/index.ts` 注册 `GET /api/dsh-trust-mode/status` 与 `POST /api/dsh-trust-mode/set`，
  直接读写 `settings.yaml`（文本级最小编辑，保留注释、缩小竞态窗口）。
- 客户端 `src/client/index.ts` 在 `settings.section` 槽注册分区项，渲染开关 UI，
  经同源 `fetch` 与宿主侧通信。

## 开发

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```
