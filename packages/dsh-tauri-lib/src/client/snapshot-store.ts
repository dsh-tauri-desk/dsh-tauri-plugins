/**
 * 自包含的双版本快照 store（DSH rc.1-alpha.1 通用）。
 *
 * 背景：DSH 的 `createSnapshotStore` 在 rc.2 来自 `@deepseek-ai/dsh-client-runtime`，
 * 在 alpha 来自 `@deepseek-ai/dsh-client-store`（seed）。两者模块名不同、且只存在于
 * 各自版本的表里，单 bundle 无法同时解析。为了让 `dsh-tauri-*` 插件在 rc.2 + alpha
 * 上一致工作，这里 vendor 一个零外部依赖的实现（DSH-better-sidebar「自包含」哲学），
 * API 与 dsh 运行时一致：`{ getSnapshot, subscribe, update, set }`，`update` 走 draft
 * 变更；`getSnapshot` 在两次通知之间引用稳定（uSES 契约）。
 */
export interface SnapshotStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
  update: (mutator: (draft: T) => void) => void
  set: (next: T) => void
}

/**
 * 创建一个快照 store。`update` 通过结构化克隆产新快照再交给 draft 变更，
 * 因此 `getSnapshot()` 只在本 store 变更时返回新引用（uSES 安全）。
 * 适用于平面、可序列化的插件 UI 状态。
 */
export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let state = initial
  const listeners = new Set<() => void>()
  function notify(): void {
    for (const listener of listeners)
      listener()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update: (mutator) => {
      const next = structuredClone(state) as T
      mutator(next)
      state = next
      notify()
    },
    set: (next) => {
      state = next
      notify()
    },
  }
}
