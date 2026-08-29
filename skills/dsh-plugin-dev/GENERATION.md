# 生成说明

本技能依据官方 DeepSeek Harness 文档与已安装 dsh 发行版的类型声明手工编写，
用于沉淀 dsh 插件开发知识。技能内容为通用知识，不引用任何特定插件的实现
名称。

## 来源

- 官方 DeepSeek Harness 文档（master 分支）：
  - `docs/subsystems/extensions.zh.md` — 扩展子系统与 Cordis 表面
  - `docs/subsystems/workspace.zh.md` — `ctx.workspaceRegistry`
  - `docs/subsystems/session.zh.md` — `ctx.sessions` / `ctx.sessionController`
  - `docs/subsystems/core.zh.md` — `ctx.agents` / `ctx.agentLoop` / presets
  - `docs/subsystems/tools.zh.md` — `ctx.tools` / `defineTool`
  - `docs/subsystems/system-prompt.zh.md` — `ctx.systemPrompt`
  - `docs/subsystems/skills.zh.md` — `ctx.skills`
  - `docs/cordis-primer.zh.md` — 分发模式、inject/effect 规则
  - `docs/cordis-api/inherited.md` — 框架继承的 ctx
- 已安装 dsh 发行版 `.d.ts`：
  `node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/*/lib/types/**`

## 内容说明

- API 签名以已安装 dsh 发行版（0.1.1-rc.2）为准；依赖某个签名前务必再对照
  已安装 `.d.ts` 核实。
- 功能退级阶梯（官方 API → 壳补丁 → DOM 补丁 → 禁用）来自真实实现经验：
  官方无会话删除 API，经桌面壳补丁暴露窄面能力，插件侧做能力探测。
