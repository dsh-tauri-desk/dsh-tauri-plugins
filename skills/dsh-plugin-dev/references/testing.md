# 测试与验证

完成任何插件改动前运行（仓库规则）：

```bash
pnpm run lint --fix
pnpm run typecheck
pnpm run test -- --run
pnpm run build
```

## 单包命令

```bash
pnpm -F <插件名> typecheck
pnpm -F <插件名> test -- --run
pnpm -F <插件名> build
```

## 单元测试（Vitest）

- `foo.ts` → 同目录 `foo.test.ts`。
- 用 `describe` / `it` / `expect`；禁止恒真占位测试。
- 优先测试纯函数、状态转换、HTTP 方法/授权边界、存储原子性与公开协议。

### HTTP 路由测试

用假 req/res 直接测 `routeHandler`：

- 错误方法 → 405
- 非回环变更 → 403
- 缺 body 字段 → 业务错误 → 500 `{ error }`
- 成功 → `[200, payload]`

### 注册表状态机测试

伪造注册表：

```ts
interface FakeRegistry {
  enqueueOperation: (fn) => Promise<void>
  requireState: () => FakeRegistryState
  setState: (state) => Promise<void>
}
```

断言：移除单 id 保留其余状态；无变更时不写入；清空集合；缺变更面时报
版本兼容错误。

### 纯函数测试

分组/排序用行 fixture；Git/ledger/存储转换做状态断言。

## 壳补丁测试（Rust）

每个 `*_patch.rs` 内的单元测试：

- `patches_<功能>` — 打补丁含锚点的 fixture 后产生 marker + 注入代码。
- `patch_is_idempotent` — 打已补丁源码返回 `AlreadyPatched`。
- `skips_partial_upstream_layout` — 锚点缺失 → `AnchorMissing`（不破坏）。

运行：

```bash
cd src-tauri
cargo test service::workflow::<patch模块>
cargo check
```

## 手动端到端验证

1. 重建插件：`pnpm -F <插件名> build`。
2. **重启桌面壳**——仅刷新页面不会重载宿主半区或应用启动期壳补丁。
3. 在 DevTools Network 中核实确切 HTTP 请求：路径名、方法、端口、状态。
   404 通常是 dist 过期或路径错误；405 是方法不匹配；403 是来源。
4. 破坏性操作同时检查持久状态与活跃内存：
   - 持久：`$DSH_HOME/sessions/...` 目录、`$DSH_HOME/storages/workspace.json`
     （`archivedSessionIds`、`tables.workspaces[*].sessionIds`）
   - 活跃：会话是否立即从 UI 消失，还是仅重启后？（后者说明内存
     SessionStore 仍持有它——见 fallback.md。）

## 数据布局速查（JSONL 后端）

```text
$DSH_HOME/sessions/<编码后-cwd-键>/<编码后-session-id>/session.jsonl.zstd
$DSH_HOME/storages/workspace.json        # 工作区记录 + 归档集合
$DSH_HOME/storages/session_projcache.json
```

`encodeSessionId` 把不安全码元转义为 `~XXXX`；cwd 键是易读的 `--<slug>--`
编码。扫描持久目录时复制官方的编码逻辑。

## 开发环境事实

- debug 构建使用独立 `$DSH_HOME`（如 `.dsh.dev`），与 release 数据隔离。
- 会话/工作区状态位于 `$DSH_HOME/sessions/` 与 `$DSH_HOME/storages/`。
