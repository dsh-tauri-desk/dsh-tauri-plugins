# dsh-tauri

[![npm version][npm-version-src]][npm-version-href]
[![license][license-src]][license-href]

`dsh-tauri` 是 DSH Tauri 桌面壳的基础插件。它提供一个无宿主行为的 host half，以及运行在 DSH iframe 中的客户端消息桥。

![dsh-tauri 导航桥](public/[placeholder])

## 功能

- 将宿主导航栏的侧边栏开关转发至 `layout.toggleSidebar`。
- 将后退、前进命令转发至浏览器历史记录。
- 向宿主回报侧边栏折叠状态和历史边界。
- 隐藏与桌面导航栏重复的官方折叠控件。
- 在插件自身异常时向宿主报告，避免静默失败。

## 安装

```bash
pnpm add dsh-tauri
```

将 `dsh-tauri` 加入 DSH 插件配置即可。客户端入口会通过包元数据自动注入。

## API

```ts
import { apply } from 'dsh-tauri'
import { inject, name } from 'dsh-tauri/client'
```

通常不需要手动调用 `apply` 或 `dsh-tauri/client`；它们由 DSH loader 使用。`inject` 包含 `layout` 服务。

## 相关包

- [`dsh-tauri-ui`](../dsh-tauri-ui)：桌面化 UI。
- [`dsh-tauri-worktree`](../dsh-tauri-worktree)：会话级 Git worktree。

## 许可证

[MIT](../../LICENSE.md) © [Hairyf](https://github.com/hairyf)

[npm-version-src]: https://img.shields.io/npm/v/dsh-tauri?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://www.npmjs.com/package/dsh-tauri
[license-src]: https://img.shields.io/github/license/dsh-tauri-desk/plugins-workspace.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/dsh-tauri-desk/plugins-workspace/blob/main/LICENSE.md
