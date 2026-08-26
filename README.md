# dsh-tauri-plugins

[![npm version][npm-version-src]][npm-version-href]
[![license][license-src]][license-href]

为 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 提供 Tauri 桌面端能力的插件工作区。插件遵循 DSH 的 **host half / client half** 模型：宿主侧负责工具、路由和系统上下文，客户端负责 iframe 内的 UI 与消息桥接。

![dsh-tauri 插件工作区](public/[placeholder])

## 插件

| 包 | 说明 | 版本 |
| --- | --- | --- |
| [`dsh-tauri`](./packages/dsh-tauri) | Tauri 宿主导航栏与 DSH iframe 之间的消息桥 | `0.2.0` |
| [`dsh-tauri-ui`](./packages/dsh-tauri-ui) | Tauri 风格 UI，包括设置侧边栏 | `0.1.0` |
| [`dsh-tauri-worktree`](./packages/dsh-tauri-worktree) | 为会话创建隔离 Git worktree，并支持检出回本地 | `0.1.3` |
| [`dsh-tauri-panel`](./packages/dsh-tauri-panel) | Tauri 面板 UI 的扩展包（当前为基础骨架） | `0.0.0` |
| [`dsh-tauri-panel-placeholder`](./packages/dsh-tauri-panel-placeholder) | 面板占位实现，用于预留集成入口 | `0.0.0` |

`dsh-tauri-tsdown` 是工作区内部使用的 tsdown 配置包，不作为运行时插件发布。

## 安装

在 DSH 项目中安装需要的插件：

```bash
pnpm add dsh-tauri dsh-tauri-ui dsh-tauri-worktree
```

然后在 DSH 配置中启用插件（具体配置格式以 DSH 当前版本为准）：

```ts
import { defineConfig } from '@deepseek-ai/dsh'

export default defineConfig({
  plugins: [
    'dsh-tauri',
    'dsh-tauri-ui',
    'dsh-tauri-worktree',
  ],
})
```

插件的客户端部分由包的 `dsh.client.inject` 元数据自动注入。若只需要其中一项能力，也可以只安装对应的包。

## 能力概览

### 导航桥

`dsh-tauri` 将宿主导航栏的侧边栏、后退和前进命令转发给 DSH 客户端，并向宿主回报侧边栏状态与历史边界。同时隐藏与宿主重复的折叠控件。

### 桌面化设置

`dsh-tauri-ui` 把 DSH 设置对话框改造成左侧停靠的设置栏。它使用 slot 注册点，不修改核心 UI 结构；当 renderer 补丁不可用时，会自动降级为官方设置对话框。

### 会话级 Worktree

`dsh-tauri-worktree` 为每个会话创建独立的 Git worktree，避免不同 Agent 会话互相覆盖文件。用户可以在工作树中继续对话，也可以明确请求“检出本地”，将改动保留到本地分支。

![隔离工作树流程](public/[placeholder])

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

运行单个包的测试：

```bash
pnpm --filter dsh-tauri-worktree test
```

## 设计约定

- 每个插件都导出宿主侧 `apply`，客户端入口位于 `src/client`。
- 客户端插件应通过稳定的 slot、locale 和服务注入点扩展 DSH，避免依赖生成的 CSS module 类名。
- 涉及 Git、文件系统或宿主 API 的能力只放在 host half；浏览器侧通过同源 HTTP 路由或消息协议访问。
- `checkout_worktree` 只在用户明确请求或批准后执行。

## 许可证

[MIT](./LICENSE.md) © [Hairyf](https://github.com/hairyf)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/dsh-tauri?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://www.npmjs.com/package/dsh-tauri
[license-src]: https://img.shields.io/github/license/dsh-tauri-desk/plugins-workspace.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/dsh-tauri-desk/plugins-workspace/blob/main/LICENSE.md
