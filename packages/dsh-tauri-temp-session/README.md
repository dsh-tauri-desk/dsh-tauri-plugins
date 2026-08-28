# dsh-tauri-temp-session

为 DeepSeek Harness 桌面端提供**工作区可选**与**无工作区临时会话**：不选工作区即可直接开始对话，每个临时会话运行在一个隔离的一次性目录里。

## 功能

- **工作区可选**：Hero 空状态的工作区芯片在未选定工作区时显示"选择工作区（可选）"，点击仍打开原选择菜单；已选定工作区时，下拉箭头原位变为悬停显示的 ×，点击 × 取消工作区选择、切回一个新的临时会话。
- **临时会话**：每次创建临时会话时由宿主预留独立目录 `<tempRoot>/session-<uuid>`（默认 `$DSH_HOME/tmp-sessions/…`），会话 cwd、沙盒 `workspace-write` 边界与侧边栏分组（Ungrouped）都由该目录派生。
- **新建会话默认临时**：侧边栏"新建会话"（无显式工作区）默认创建临时会话，跳过上游"连接最近工作区"的行为；工作区行内的 + 仍走原路径。
- **兜底补位**：当前无会话时自动预建一个空白临时会话，保证组合输入框可用——启动期仅在无可自动连接的最近工作区时补位（保留上游"自动恢复最近会话"）；运行期（删除/归档当前会话后）始终补位。
- **启动清理**：注销 workspace 注册表为临时目录物化的 Workspace 记录（保持临时会话 Ungrouped）；删除既不在存活 Agent 也不在持久化列表中、超过 7 天的临时目录。
- **系统提示注入**：处于临时目录中的会话，向模型说明其工作目录的临时语义（软性约束；dsh 沙盒不限制读取）。

## 内核补丁

dsh 内核 `@deepseek-ai/dsh-client-ui-conversation` 的 ConversationRoot 在 `workspaces.phase === "ready"` 时会把无工作区会话的 chipTitle 置空，组合输入框随之进入 inert（"必须选工作区"的实现点）。本插件启动时对该客户端 bundle 做一行最小替换（与桌面项目对待内核文件的方式一致：启动时修补安装的内核文件）：

- **幂等**：bundle 已含本插件标记时跳过；含旧独立版插件（`dsh-temp-session`）标记时同样视为已修补；
- **可恢复**：首次修补前备份原文件为 `<bundle>.dsh-tauri-temp-session.bak`；
- **可关闭**：在 cordis 行配置中设 `kernelPatch: false` 即完全不触碰内核文件（输入框限制恢复上游行为）；
- **漂移告警**：上游版本改变目标代码时跳过并高调记录（`conversation bundle drifted`），随插件版本跟进。

## 迁移说明

自独立版 `dsh-temp-session` 迁移：请先卸载旧插件再安装本包。两者同时安装时不会冲突（旧标记按已修补处理、路由前缀不同），但清理逻辑会重复执行。标识变更对照：

| 独立版 | 本包 |
| --- | --- |
| 插件名 `dsh-temp-session` | `dsh-tauri-temp-session` |
| 路由前缀 `/api/dsh-temp-session` | `/api/dsh-tauri-temp-session` |
| 备份后缀 `.dsh-temp-session.bak` | `.dsh-tauri-temp-session.bak` |

## 要求

- 宿主服务：`webServer`、`workspaceRegistry`、`systemPrompt`、`agents`；
- 客户端服务：`locale`、`sessions`、`workspaces`；
- 客户端经同源 `fetch` 访问宿主路由（Tauri 内嵌 webServer）。

## 已知限制

- 内核补丁依赖上游压缩源逐字匹配，dsh 升级后可能漂移（跳过并告警，不影响其余功能）；
- 临时目录的隔离是**软性**的：模型被系统提示约束写入，但 dsh 沙盒不限制读取；
- 补位复用的空白临时会话按"空白 + 无工作区 + 非 subagent"判定，subagent 子会话被显式排除。

## 许可证

[MIT](../../LICENSE.md) © [DahliaVoid](https://github.com/DahliaVoid)
