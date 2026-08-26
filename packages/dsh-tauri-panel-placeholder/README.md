# dsh-tauri-panel-placeholder

[![npm version][npm-version-src]][npm-version-href]
[![license][license-src]][license-href]

`dsh-tauri-panel-placeholder` 是面板扩展的占位插件。它保留与正式面板包一致的加载形态，适合在开发、演示或等待真实面板实现时使用。

![面板占位界面](public/[placeholder])

## 安装

```bash
pnpm add dsh-tauri-panel-placeholder
```

```ts
export default {
  plugins: ['dsh-tauri-panel-placeholder'],
}
```

## 当前状态

该包只提供可加载的基础入口，不渲染实际面板，也不注册额外的 host API。需要真实面板时，请改用 [`dsh-tauri-panel`](../dsh-tauri-panel) 或等待后续实现。

## 许可证

[MIT](../../LICENSE.md) © [Hairyf](https://github.com/hairyf)

[npm-version-src]: https://img.shields.io/npm/v/dsh-tauri-panel-placeholder?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://www.npmjs.com/package/dsh-tauri-panel-placeholder
[license-src]: https://img.shields.io/github/license/dsh-tauri-desk/plugins-workspace.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/dsh-tauri-desk/plugins-workspace/blob/main/LICENSE.md
