# dsh-tauri-panel

[![npm version][npm-version-src]][npm-version-href]
[![license][license-src]][license-href]

`dsh-tauri-panel` 是 Tauri 桌面端面板能力的扩展入口。当前版本提供稳定的插件包结构和客户端注入点，后续面板组件将在此基础上演进。

![dsh-tauri-panel 面板](public/[placeholder])

## 安装

```bash
pnpm add dsh-tauri-panel
```

```ts
export default {
  plugins: ['dsh-tauri-panel'],
}
```

## 当前状态

这是一个基础骨架包。它可以被 DSH loader 正常加载，但当前不主动渲染面板或注册宿主行为。需要面板扩展入口的集成可以先依赖此包，未来版本将保持兼容地增加能力。

## 相关包

- [`dsh-tauri-ui`](../dsh-tauri-ui)：通用桌面 UI。
- [`dsh-tauri-panel-placeholder`](../dsh-tauri-panel-placeholder)：占位实现。

## 许可证

[MIT](../../LICENSE.md) © [Hairyf](https://github.com/hairyf)

[npm-version-src]: https://img.shields.io/npm/v/dsh-tauri-panel?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://www.npmjs.com/package/dsh-tauri-panel
[license-src]: https://img.shields.io/github/license/dsh-tauri-desk/plugins-workspace.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/dsh-tauri-desk/plugins-workspace/blob/main/LICENSE.md
