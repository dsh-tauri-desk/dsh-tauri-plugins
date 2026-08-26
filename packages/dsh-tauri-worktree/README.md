# dsh-tauri-worktree

[![npm version][npm-version-src]][npm-version-href]
[![license][license-src]][license-href]

`dsh-tauri-worktree` 为 DSH 会话提供 Git worktree 隔离。每个工作树会话拥有独立目录，Agent 可以安全地修改代码，而不会影响本地主工作区。

![dsh-tauri-worktree 工作流](public/[placeholder])

## 功能

- 按项目路径和会话 ID 创建稳定、可复用的隔离工作树。
- 注册 `create_worktree`、`checkout_worktree` 工具。
- 提供创建、状态、检出和放弃 API：`/api/dsh-worktree/*`。
- 将工作树状态注入系统提示：`is_worktree: true`。
- 检出时创建或切换本地分支，并带回完整会话历史。
- 放弃工作树时清理临时分支和 ledger 记录。

## 安装

```bash
pnpm add dsh-tauri-worktree
```

```ts
export default {
  plugins: ['dsh-tauri-worktree'],
}
```

## 用户流程

1. 用户明确要求使用 worktree 后，Agent 调用 `create_worktree`。
2. 插件创建 `~/.dsh/worktrees/[hash]/[dirname]`，并把会话交接到新工作树。
3. 在工作树会话中修改、测试和提交代码。
4. 用户明确请求或批准后，才能调用 `checkout_worktree`；该操作会把改动带回本地分支并移除工作树。
5. 如果不需要保留改动，可从面板执行放弃操作。

> `checkout_worktree` 是用户授权操作。任务完成、PR 合并或 Agent 的便利性都不能代替用户授权。

## 配置

可选配置 `worktreesRoot`，用于更改默认的 `~/.dsh` 根目录：

```ts
export default {
  plugins: [{
    name: 'dsh-tauri-worktree',
    config: { worktreesRoot: '/path/to/dsh' },
  }],
}
```

## API

宿主侧导出 `computeHash`、`worktreePath`、`ensureWorktree`、`checkoutToLocal` 和 `discardWorktree` 等辅助函数；客户端入口提供工作树模式选择、状态面板和交互对话框。一般应用只需启用插件，不必直接调用这些 API。

## 要求

- 项目目录必须是 Git 仓库。
- 宿主环境需要可执行的 `git`。
- 插件需要 DSH 的 tools、systemPrompt、webServer、sessions、workspaceRegistry 和 agents 服务。

## 许可证

[MIT](../../LICENSE.md) © [Hairyf](https://github.com/hairyf)

[npm-version-src]: https://img.shields.io/npm/v/dsh-tauri-worktree?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://www.npmjs.com/package/dsh-tauri-worktree
[license-src]: https://img.shields.io/github/license/dsh-tauri-desk/plugins-workspace.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/dsh-tauri-desk/plugins-workspace/blob/main/LICENSE.md
