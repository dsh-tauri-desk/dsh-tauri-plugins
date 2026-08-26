import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
/**
 * store.ts — dsh-tauri-ui 设置侧边栏的共享 UI 状态。
 *
 * 触发器（sidebar.settings 槽内）与侧边栏（shell.overlay 槽内）是同一插件
 * 的两个独立注册条目，凭一个模块级 SnapshotStore 共享开关/当前分区/搜索词：
 *   - 触发器把 open 置 true（并可选跳到某分区）；
 *   - 侧边栏订阅 open/activeId/query 渲染，Esc 或“返回应用”置 false。
 *
 * createSnapshotStore 是 zustand-backed 的 uSES 安全状态源
 * （getSnapshot 在变更间返回同一引用；update 走 immer draft）。
 */
import { useSyncExternalStore } from 'react'

/**
 * 左栏宽度合约，与官方 sidebar 面板一致：
 * defineStore init sidebar:280，setSidebar clamp clampWidth(px, 264, 420)，关闭即忘
 * （官方“closing a panel forgets its drag width”——不持久化，重开回默认）。
 */
export const RAIL_WIDTH_MIN = 264
export const RAIL_WIDTH_MAX = 420
export const RAIL_WIDTH_DEFAULT = 280

/** 钳制到左栏合约区间（镜像官方 clampWidth 语义）。 */
export function clampRailWidth(px: number): number {
  return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, px))
}

/** 设置侧边栏 UI 状态。 */
export interface SettingsUiState {
  /** 侧边栏是否已打开。 */
  open: boolean
  /** 当前激活的设置分区 id（官方 SettingsPanel 的 activeId 同义）。 */
  activeId: string | undefined
  /** 左栏搜索词（只过滤设置项列表）。 */
  query: string
  /**
   * 左栏当前宽度（px）。undefined = 未设定，渲染时用 RAIL_WIDTH_DEFAULT，
   * 并在打开时按官方 sidebar 的实际渲染宽度同步（关闭时复位回 undefined）。
   */
  railWidth: number | undefined
}

/** 全局唯一共享状态源（模块级单例；插件重载时随 bundle 重建，可接受）。 */
export const settingsStore = createSnapshotStore<SettingsUiState>({
  open: false,
  activeId: undefined,
  query: '',
  railWidth: undefined,
})

/** 打开侧边栏；可选直接跳到一个设置分区（onboarding 的 openSection 用）。 */
export function openSettings(sectionId?: string): void {
  settingsStore.update((s) => {
    s.open = true
    if (sectionId !== undefined)
      s.activeId = sectionId
  })
}

/** 关闭侧边栏并复位视图状态（与官方 close 的复位语义一致；宽度也即忘）。 */
export function closeSettings(): void {
  settingsStore.update((s) => {
    s.open = false
    s.activeId = undefined
    s.query = ''
    s.railWidth = undefined
  })
}

/** 切换左栏当前分区。 */
export function selectSection(id: string): void {
  settingsStore.update((s) => {
    s.activeId = id
  })
}

/** 拖拽中实时写入左栏宽度（调用方已按合约钳制）。 */
export function setRailWidth(px: number): void {
  settingsStore.update((s) => {
    s.railWidth = px
  })
}

/** 组件内读取 UI 状态（uSES；state 引用在 update 之间稳定）。 */
export function useSettingsUi(): SettingsUiState {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getSnapshot)
}
