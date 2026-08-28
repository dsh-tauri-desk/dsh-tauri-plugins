export const TEMP_SESSION_PLUGIN_NAME = 'dsh-tauri-temp-session'

export const TEMP_SESSION_LOCALE_NAMESPACE = TEMP_SESSION_PLUGIN_NAME

/** 与宿主半区 src/constants.ts 保持同值（跨 bundle 无共享来源）。 */
export const TEMP_SESSION_API_PREFIX = '/api/dsh-tauri-temp-session'

export const LOCALE_EFFECT = `${TEMP_SESSION_PLUGIN_NAME}: locale`

export const STYLES_EFFECT = `${TEMP_SESSION_PLUGIN_NAME}: styles`

export const RUNTIME_EFFECT = `${TEMP_SESSION_PLUGIN_NAME}: hero chip & temp sessions`

export const TEMP_SESSION_STYLE_ID = `${TEMP_SESSION_PLUGIN_NAME}-styles`

export const CHIP_ATTR = `data-${TEMP_SESSION_PLUGIN_NAME}-chip`

/** 原位替换（chevron → 悬停 ×）组件及其挂载标记。 */
export const SWAP_ATTR = `data-${TEMP_SESSION_PLUGIN_NAME}-swap`

/** 结构回退的独立 × 按钮。 */
export const CLEAR_ATTR = `data-${TEMP_SESSION_PLUGIN_NAME}-clear`

export const CLEAR_TEST_ID = `${TEMP_SESSION_PLUGIN_NAME}-clear`

export const TEMP_SESSION_CLASSES = {
  /** 原位替换组件（悬停 × 的容器 span）；盒样式只允许挂在这个 class 上。 */
  swap: `${TEMP_SESSION_PLUGIN_NAME}-swap`,
  /** 出厂 chevron（悬停时隐去）。 */
  drop: `${TEMP_SESSION_PLUGIN_NAME}-drop`,
  /** 悬停时浮现的 ×。 */
  clear: `${TEMP_SESSION_PLUGIN_NAME}-clear`,
} as const

/** Hero 工作区芯片按钮的 aria-label（dsh 官方两种语言的恒定文案；只按文案匹配）。 */
export const CHIP_ARIA_LABELS = ['选择工作区', 'Choose workspace'] as const

/** autoEnsure 的最小触发间隔：抑制 store 抖动导致的重复创建。 */
export const AUTO_ENSURE_INTERVAL_MS = 2000
