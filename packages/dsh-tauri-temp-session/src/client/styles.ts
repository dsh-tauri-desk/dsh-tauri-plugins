/**
 * styles.ts — 芯片"箭头 → ×"悬停变换与回退 × 按钮的样式（css-render 对象树）。
 *
 * 色彩取 DSH 设计变量（--dsw-alias-label-secondary）；全部为静态几何，无动态
 * custom property。仅由 apply() 的 styles effect 挂载与卸载。
 */
import { CssRender } from 'css-render'
import {
  CHIP_ATTR,
  CLEAR_ATTR,
  TEMP_SESSION_CLASSES as s,
  SWAP_ATTR,
  TEMP_SESSION_STYLE_ID,
} from './constants'

export function mountTempSessionStyles(): () => void {
  if (typeof document === 'undefined')
    return () => {}
  const cssr = CssRender()
  if (cssr.find(TEMP_SESSION_STYLE_ID) !== null)
    return () => {}
  const { c } = cssr
  /**
   * 已装原位替换的芯片作用域：只用于**后代**图标规则——SWAP_ATTR 同时是芯片
   * 按钮的状态标记，直接命中按钮的规则会把它压成 16px 盒、挤掉工作区文案。
   */
  const swapScope = `[${CHIP_ATTR}][${SWAP_ATTR}]`
  const style = c([
    // 原位替换组件本体（带稳定 class 的替换 span）：与出厂箭头同尺寸，色彩取次要标签色。
    c(`.${s.swap}`, {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      flex: 'none',
      cursor: 'pointer',
      color: 'var(--dsw-alias-label-secondary, #8b8b8b)',
    }),
    // 两枚图标叠放于组件中央，共享过渡。
    c(`${swapScope} .${s.drop}, ${swapScope} .${s.clear}`, {
      position: 'absolute',
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      margin: 'auto',
      display: 'block',
      transition: 'opacity .16s ease, transform .16s ease',
    }),
    c(`${swapScope} .${s.drop}`, {
      opacity: '1',
      transform: 'rotate(0deg) scale(1)',
    }),
    c(`${swapScope} .${s.clear}`, {
      opacity: '0',
      transform: 'rotate(-90deg) scale(.5)',
    }),
    c(`${swapScope}:hover .${s.drop}`, {
      opacity: '0',
      transform: 'rotate(90deg) scale(.5)',
    }),
    c(`${swapScope}:hover .${s.clear}`, {
      opacity: '1',
      transform: 'rotate(0deg) scale(1)',
    }),
    // 结构回退：按钮右侧的独立 ×。
    c(`[${CLEAR_ATTR}]`, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      padding: '0',
      border: 'none',
      borderRadius: '50%',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary, #8b8b8b)',
      cursor: 'pointer',
      flex: 'none',
      marginLeft: '2px',
    }),
  ])
  style.mount({ id: TEMP_SESSION_STYLE_ID, head: true })
  return () => style.unmount({ id: TEMP_SESSION_STYLE_ID })
}
