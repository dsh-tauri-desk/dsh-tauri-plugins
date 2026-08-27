# dsh-tauri-panel-extension

`dsh-tauri-panel-extension` 为 [`dsh-tauri-panel`](../dsh-tauri-panel) 增加侧栏“扩展”入口，在会话内容区提供技能与 MCP 管理。

## 功能

- 技能列表、搜索、来源筛选、启停、查看/编辑和打开目录。
- “新建技能”关闭扩展面板、打开当前工作区的空白会话，并预填 `/skill-creator `（不会自动提交）。
- “导入仓库”通过 GitHub 地址导入技能仓库；仓库技能优先显示，并提供可点击的 GitHub 图标。
- MCP 服务器增删改、启停、从 Claude Code/Codex 导入及重启提示。
- 不包含上游设置页标题“技能与 MCP”和市场模块。

宿主 API 使用同源前缀 `/dsh-tauri-panel-extension/*`，仓库状态保存在 `$DSH_HOME/dsh-tauri-panel-extension`。

## 上游来源

实现基于 [`qinyre/dsh-plugin-capabilities`](https://github.com/qinyre/dsh-plugin-capabilities) commit `3412f8ddf0a92bdc89a3bab104b480f8745ebfc1` 修改，详见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。开发源以 Git submodule 固定在 `../../soruce/dsh-plugin-capabilities`。

## 许可证

[MIT](../../LICENSE.md) © [Hairyf](https://github.com/hairyf)
