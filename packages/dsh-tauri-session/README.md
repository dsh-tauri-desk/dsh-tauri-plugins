# dsh-tauri-session

DeepSeek Harness 桌面端插件：把工作区浏览器里的「删除工作区」改为「归档工作区」，
并提供「已归档的聊天」设置页（搜索 / 排序 / 分组 / 项目选择 / 取消归档）。

采用 host half / client half 架构，与 `dsh-tauri-worktree` 同构：

- `src/*.ts`：宿主侧（node half）实现。
- `src/client/*.ts(x)`：浏览器侧（browser half）实现，渲染设置分区与 DOM 补丁。

## 功能

- **工作区会话组控件**：把官方工作区浏览器每个组的「删除工作区」改写为「归档工作区」，
  行为改为「归档该工作区全部会话」（不再删除工作区）。
- **设置页「归档」**：在设置侧边栏新增「归档」导航项，内容为「已归档的聊天」列表。
- **归档页控件**：搜索框（搜索已归档的聊天）、排序方式（更新时间 / 创建时间 / 按字母排序）、
  分组方式（按组排序 / 按子项目排序）、项目选择框。
- **分组规则**：排序方式同时影响「组」与「组内聊天」；组按成员聚合值排序，
  组内按排序方式排序；无项目组统一命名为「未分组」。
- **取消归档**：删除该会话的归档记录后，回到其原来的工作区组（归档从不修改宿主工作区的
  sessionIds 记账，因此会话在组内保留的位置自动恢复显示）。
- **僵尸会话清理**：插件初始化时自动清理「会话存在但工作目录已不存在」的僵尸归档记录。

## 归档机制（插件自持有）

宿主 `WorkspaceRegistry` 只暴露 `archiveSession`，**没有**把会话移出归档集（unarchive）的方法。
因此本插件**自持有**归档集合（`~/.dsh/dsh-tauri-session/archive.json`），从不调用宿主的
`archiveSession`，也从不修改工作区的 sessionIds。归档只记录：

```ts
interface ArchivedSessionRecord {
  sessionId: string
  workspaceId?: string // 归档时所属的工作区组
  beforeSessionId?: string // 组内顺序锚点
  archivedAt: number
}
```

取消归档 = 删除记录；会话因其工作区记账从未被改动，会在原组原位上重新出现。

## 宿主路由（/api/dsh-session/*）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/archived` | 归档会话 id + 每个会话的创建元数据（读 host session header） |
| POST | `/archive` | 归档单个会话（按 cwd 解析工作区） |
| POST | `/archive-workspace` | 归档整个工作区组（一次写入多条记录） |
| POST | `/unarchive` | 取消归档（删除记录） |
| POST | `/clear` | 清空归档（全部会话回到原组） |
| POST | `/prune` | 清理僵尸归档（工作目录已不存在） |

## 目录约定

- 插件自有状态目录：`$DSH_HOME/dsh-tauri-session/`（默认 `~/.dsh/dsh-tauri-session/`）。

## 开发

```bash
pnpm install
pnpm -F dsh-tauri-session typecheck
pnpm -F dsh-tauri-session test -- --run
pnpm -F dsh-tauri-session build
```

全局校验：

```bash
pnpm run lint --fix
pnpm run typecheck
pnpm run test -- --run
pnpm run build
```
