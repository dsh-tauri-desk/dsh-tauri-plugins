# 清单、构建与 ctx 依赖管理

## package.json 的 `dsh` 字段

```json
{
  "name": "dsh-tauri-<插件名>",
  "type": "module",
  "version": "0.4.9",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js",
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["README.md", "cordis.patch.yml", "dist"],
  "dsh": {
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-primitives"],
      "platform": "web"
    },
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc",
    "test": "vitest"
  }
}
```

要点：

- 全仓库 `"type": "module"`。
- 宿主半区入口是包根（`dist/index.js`）；客户端半区经 `./client` 导出
  （`dist/client.js`）。
- `dsh.client.inject` 列出客户端半区运行时依赖供打包。
- `dsh.client.platform` 为 `"web"`。
- `dsh.bundle.patch` 指向 profile 补丁文件。
- `dsh` 字段是 harness 加载器发现并挂载插件的方式。

## cordis.patch.yml

profile 加载器的最小插入行：

```yaml
- insert:
    - id: dsh-tauri-<插件名>
      name: dsh-tauri-<插件名>
```

桌面壳也用补丁行做其他用途（如 Windows 极简模式修复写入 profile
`cordis.patch.yml` 挂载行）。插件自己的补丁文件保持最小：id + name。

## 构建流水线（tsdown）

- `tsdown` 构建两个半区：`dist/index.js`（ESM 宿主）与 `dist/client.js`
  （CJS 浏览器包，`window.__ModuleLoader__.load({id, factory})`）。
- `dev` 运行 `tsdown --watch`。
- 桌面 debug 构建从资源目录链接插件源码（无 node_modules）；宿主半区经平台
  加载器（`ctx.loader.import`）解析 DSH 自有包。
- 修改插件后：重建（`pnpm -F <名称> build`）并**重启桌面壳**——仅刷新页面
  不会重载宿主半区。客户端 bundle 在 dev 下可热更新。

## ctx 依赖管理（深入）

### inject（声明式）

```ts
export const inject = ['webServer', 'sessions']
```

插件 `apply` 会等待所有命名服务存在。**列出 `apply` 中触碰的每个服务**——
未声明的 `ctx.foo` 访问得到 `undefined` 与运行时错误，而非类型错误（宿主
接缝用 `any`）。

### ctx.inject（惰性/可选）

```ts
ctx.inject(['webServer', 'skills'], (hostCtx) => { ... })
```

服务可用后运行回调；适用于能力可选、插件仍应在缺失时挂载的场景。

### ctx.effect（可释放副作用）

```ts
ctx.effect(() => {
  const disposer = doSomething()
  return disposer          // 卸载/reload 时调用
}, 'my-plugin: 标签')
```

返回值可以是 disposer 或 disposer 的可迭代集合（逆序释放）。每个内聚关注点
用一个 effect，带稳定标签。绝不在 effect 外注册全局副作用。

### ctx.on / 事件订阅

```ts
ctx.on('session/event', (session, event) => { ... })
```

返回 disposer；优先用 `ctx.effect(() => ctx.on(...))` 使其正确回滚。

### 按分发模式分类的事件

- emit：`session/created`、`session/disposed`、`session/event`、
  `agent/created`、`agent/disposed`、`agent/error`、`agent/status`、
  `system-prompt/change`、`skills/change`、`webserver/index-inject`
- waterfall：`system-prompt/assemble`、`tools/pre-execute`
- parallel：`session/flush`
- serial/bail：策略类事件

### 作用域

- 宿主：`ctx.agents.withInitiator(agent, op)` / `withoutInitiator(op)` 做
  发起者归属。
- 客户端：`ctx.sessions.scope(id)` / `scopeOf(ctx)` / `sessionOf(ctx)` /
  `binding(id)`；agent 作用域上下文携带 `scope.session`。

## 常见失败模式

| 现象 | 可能原因 |
|---------|--------------|
| `/api/<插件>/...` 404 | 宿主半区未加载 / dist 过期 / 路由未注册 / 路径前缀错误 / 端口错误 |
| 405 | 方法不匹配（mutate 路由用了 GET） |
| 403 | 变更路由的非回环调用方 |
| 路由工作但 UI 卡死 | 客户端等待宿主 RPC 无超时；加 AbortController |
| 会话删除后又出现 | 持久目录已删但内存 SessionStore 条目仍在 → 需壳补丁 `remove`（见 fallback.md） |
| 样式不生效 | style id 已被其他插件挂载；css-render `find()` 守卫 |
| 白屏 | slot 注册错误或渲染器 fallback 缺失 |
