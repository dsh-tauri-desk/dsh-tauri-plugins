/**
 * chip.ts — Hero 工作区芯片（WorkspaceChip）的对账与"箭头 → ×"原位替换。
 *
 * 判定只接受 aria-label 的官方恒定文案，绝不结构回退——组合器的模型选择器按钮
 * 同样是 [图标, span 标签, 箭头] 三子元素，结构回退会误命中它（曾导致模型选择器
 * 下方多出一个 × 的 bug）。所有状态落在稳定 data-* 属性上，不依赖生成的 class。
 */
import {
  CHIP_ARIA_LABELS,
  CHIP_ATTR,
  CLEAR_ATTR,
  CLEAR_TEST_ID,
  TEMP_SESSION_CLASSES as s,
  SWAP_ATTR,
} from './constants'
import { chevronDownSvg, xmarkSvg } from './icons'
import { text } from './locale'

/** 芯片 → { original: 出厂 chevron 节点, swap: 本插件的悬停组件 }。 */
const swapped = new WeakMap<HTMLButtonElement, { original: Element, swap: HTMLSpanElement }>()

function isChipByLabel(el: Element): boolean {
  const aria = el.getAttribute('aria-label') ?? ''
  return (CHIP_ARIA_LABELS as readonly string[]).includes(aria)
}

/**
 * 判定 Hero 的工作区芯片按钮；命中后打 CHIP_ATTR，后续对账直接命中。
 * 绝不做结构回退（理由见文件头注释）。
 */
export function findChip(root: ParentNode = document): HTMLButtonElement | null {
  const marked = root.querySelector(`[${CHIP_ATTR}]`)
  if (marked !== null) {
    if (isChipByLabel(marked))
      return marked as HTMLButtonElement
    marked.removeAttribute(CHIP_ATTR)
  }
  const buttons = root.querySelectorAll('button[aria-haspopup="menu"]')
  for (const el of buttons) {
    if (isChipByLabel(el)) {
      el.setAttribute(CHIP_ATTR, '')
      return el as HTMLButtonElement
    }
  }
  return null
}

/** 移除回退 × 按钮（未选定工作区 / 已装原位替换时）。 */
export function removeClearButton(root: ParentNode = document): void {
  const el = root.querySelector(`[${CLEAR_ATTR}]`)
  el?.parentElement?.removeChild(el)
}

/** 还原出厂 chevron（未选定工作区 / 芯片重建后调用；幂等）。 */
export function restoreChevronSwap(chip: HTMLButtonElement): void {
  chip.removeAttribute(SWAP_ATTR)
  const state = swapped.get(chip)
  if (state === undefined)
    return
  swapped.delete(chip)
  try {
    if (state.swap.parentElement === chip)
      chip.replaceChild(state.original, state.swap)
  }
  catch {
    // 芯片已被 React 整体替换：忽略，新的芯片会在下轮对账时重装
  }
}

function stopEvent(event: Event): void {
  event.stopPropagation()
  event.preventDefault()
}

/** 悬停 × 组件的 title/aria 随当前语言刷新。 */
function applySwapLabels(swap: HTMLSpanElement): void {
  swap.setAttribute('aria-label', text('clearAria'))
  swap.title = text('clearTitle')
}

/**
 * 改标签文案：优先改既有文本节点的 nodeValue——textContent 会把节点整个换掉，
 * React 持有的旧文本节点随之游离，上游后续更新会写到游离节点上，工作区名将
 * 无法显示（文案卡死在我们写入的值）。
 */
function setLabelText(span: HTMLSpanElement, value: string): void {
  const first = span.firstChild
  if (first !== null && span.childNodes.length === 1 && first.nodeType === Node.TEXT_NODE) {
    if (first.nodeValue !== value)
      first.nodeValue = value
    return
  }
  if (span.textContent !== value)
    span.textContent = value
}

/**
 * 把芯片的下拉箭头原位替换为"悬停显示 ×"（选中工作区时）。
 * 结构 [图标, span 标签, 箭头] 不符时退回"按钮右侧 ×"的旧式方案。
 */
export function installChevronSwap(chip: HTMLButtonElement, onClear: () => Promise<void>): void {
  if (chip.children.length !== 3 || !(chip.children[1] instanceof HTMLSpanElement)) {
    ensureClearButton(chip, onClear)
    return
  }
  const chevron = chip.children[2]
  if (chevron.getAttribute(SWAP_ATTR) !== null)
    return
  const state = swapped.get(chip)
  if (state !== undefined) {
    // 已装过（芯片未被重建）：仅随语言刷新无障碍文案。
    applySwapLabels(state.swap)
    return
  }
  const swap = document.createElement('span')
  // 稳定 class 供盒样式挂载（SWAP_ATTR 同时打在按钮上作状态标记，见 styles.ts）。
  swap.className = s.swap
  swap.setAttribute(SWAP_ATTR, '')
  swap.setAttribute('role', 'button')
  applySwapLabels(swap)
  swap.innerHTML = `${chevronDownSvg(12, s.drop)}${xmarkSvg(12, s.clear)}`
  swap.addEventListener('pointerdown', stopEvent)
  swap.addEventListener('click', (event) => {
    stopEvent(event)
    void onClear()
  })
  swapped.set(chip, { original: chevron, swap })
  chip.setAttribute(SWAP_ATTR, '')
  chip.replaceChild(swap, chevron)
  removeClearButton()
}

/** 回退方案（芯片结构异常时）：按钮右侧的独立 ×。 */
export function ensureClearButton(chip: HTMLButtonElement, onClear: () => Promise<void>): void {
  const row = chip.parentElement
  if (row === null)
    return
  if (row.querySelector(`[${CLEAR_ATTR}]`) !== null)
    return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.setAttribute(CLEAR_ATTR, '')
  btn.setAttribute('data-testid', CLEAR_TEST_ID)
  btn.setAttribute('aria-label', text('clearAria'))
  btn.title = text('clearTitle')
  btn.innerHTML = xmarkSvg(10)
  btn.addEventListener('pointerdown', stopEvent)
  btn.addEventListener('click', (event) => {
    stopEvent(event)
    void onClear()
  })
  chip.insertAdjacentElement('afterend', btn)
}

/** DOM 对账：按"当前会话是否挂接工作区"更新芯片文案与 × 展示。 */
export function reconcileChip(chip: HTMLButtonElement, workspaceSelected: boolean, onClear: () => Promise<void>): void {
  const labelSpan = chip.children[1]
  if (!workspaceSelected) {
    // 未选定工作区（临时会话 / 尚无会话）：显示"选择工作区（可选）"，无 ×。
    if (labelSpan instanceof HTMLSpanElement)
      setLabelText(labelSpan, text('optional'))
    restoreChevronSwap(chip)
    removeClearButton()
    return
  }
  // 已选定工作区：箭头原位替换为"悬停显示 ×"（label 保持工作区名，不动）。
  installChevronSwap(chip, onClear)
}
