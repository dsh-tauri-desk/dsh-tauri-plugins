import { describe, expect, it } from 'vitest'
import { CHIP_ATTR, SWAP_ATTR, TEMP_SESSION_STYLE_ID } from './constants'
import { mountTempSessionStyles } from './styles'

function mountedStyleText(): string | undefined {
  // css-render 以 cssr-id 属性挂载（见其 utils.js），不是标准 id。
  return document.querySelector(`style[cssr-id="${TEMP_SESSION_STYLE_ID}"]`)?.textContent
}

describe('mountTempSessionStyles', () => {
  it('mounts idempotently and unmounts only via the owning disposer', () => {
    const unmount = mountTempSessionStyles()
    const unmountAgain = mountTempSessionStyles()
    expect(mountedStyleText()).not.toBeUndefined()

    unmountAgain()
    expect(mountedStyleText()).not.toBeUndefined()

    unmount()
    expect(mountedStyleText()).toBeUndefined()
  })

  it('never applies a box rule to the chip button itself', () => {
    const unmount = mountTempSessionStyles()
    const css = mountedStyleText() ?? ''
    // 回归守卫：SWAP_ATTR 同时打在芯片按钮上作状态标记，任何直接命中
    // [chip][swap]{...} 的盒规则都会把按钮压成 16px、挤掉工作区文案；
    // 属性作用域只允许出现在后代选择器（后随空格/逗号/:hover 等）。
    expect(css).not.toMatch(new RegExp(`\\[${CHIP_ATTR}\\]\\[${SWAP_ATTR}\\][^ .,:~+]`))
    unmount()
  })
})
