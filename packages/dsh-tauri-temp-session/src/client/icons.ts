/**
 * Gravity UI Icons `xmark.svg` / `chevron-down.svg`（供 React 树之外的 DOM 插入）。
 * Source: https://github.com/gravity-ui/icons/blob/main/svgs/xmark.svg
 *         https://github.com/gravity-ui/icons/blob/main/svgs/chevron-down.svg
 * License: MIT, © 2022 YANDEX LLC (see NOTICE).
 */

const XMARK_PATH = 'M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8 3.47 4.53a.75.75 0 0 1 0-1.06'

const CHEVRON_DOWN_PATH = 'M2.97 5.47a.75.75 0 0 1 1.06 0L8 9.44l3.97-3.97a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06'

function gravitySvg(size: number, path: string, className?: string): string {
  const classAttr = className === undefined ? '' : ` class="${className}"`
  return `<svg xmlns="http://www.w3.org/2000/svg"${classAttr} width="${size}" height="${size}" fill="none" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${path}" clip-rule="evenodd"/></svg>`
}

/** × 图标（取消工作区选择；原位替换与回退按钮共用）。 */
export function xmarkSvg(size = 12, className?: string): string {
  return gravitySvg(size, XMARK_PATH, className)
}

/** 下拉箭头（悬停时被 × 隐去的出厂位）。 */
export function chevronDownSvg(size = 12, className?: string): string {
  return gravitySvg(size, CHEVRON_DOWN_PATH, className)
}
