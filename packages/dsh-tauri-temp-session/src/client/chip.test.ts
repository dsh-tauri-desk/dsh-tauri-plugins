import { describe, expect, it } from 'vitest'
import { findChip, reconcileChip, removeClearButton, restoreChevronSwap } from './chip'
import {
  CHIP_ATTR,
  CLEAR_ATTR,
  CLEAR_TEST_ID,
  SWAP_ATTR,
  TEMP_SESSION_CLASSES,
} from './constants'

function mountChip(label = '选择工作区'): HTMLButtonElement {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.setAttribute('aria-haspopup', 'menu')
  chip.setAttribute('aria-label', label)
  const icon = document.createElement('i')
  const labelSpan = document.createElement('span')
  labelSpan.textContent = label
  const chevron = document.createElement('i')
  chevron.setAttribute('data-chev', 'factory')
  chip.append(icon, labelSpan, chevron)
  document.body.append(chip)
  return chip
}

const noopClear = (): Promise<void> => Promise.resolve()

describe('findChip', () => {
  it('matches only the official aria label and marks the chip', () => {
    document.body.innerHTML = ''
    const decoy = document.createElement('button')
    decoy.setAttribute('aria-haspopup', 'menu')
    decoy.setAttribute('aria-label', '选择模型')
    document.body.append(decoy)
    const chip = mountChip()

    const found = findChip()
    expect(found).toBe(chip)
    expect(chip.hasAttribute(CHIP_ATTR)).toBe(true)
    expect(decoy.hasAttribute(CHIP_ATTR)).toBe(false)
  })

  it('drops the mark from an element that no longer matches', () => {
    document.body.innerHTML = ''
    const chip = mountChip()
    expect(findChip()).toBe(chip)
    chip.setAttribute('aria-label', '选择模型')

    expect(findChip()).toBeNull()
    expect(chip.hasAttribute(CHIP_ATTR)).toBe(false)
  })
})

describe('reconcileChip', () => {
  it('shows the optional label without any clear affordance when unselected', () => {
    document.body.innerHTML = ''
    const chip = mountChip()

    reconcileChip(chip, false, noopClear)
    expect(chip.children[1]?.textContent).toBe('Choose workspace (optional)')
    expect(chip.hasAttribute(SWAP_ATTR)).toBe(false)
    expect(document.querySelector(`[${CLEAR_ATTR}]`)).toBeNull()
  })

  it('installs the hover swap when a workspace is selected', () => {
    document.body.innerHTML = ''
    const chip = mountChip()

    let cleared = 0
    reconcileChip(chip, true, () => {
      cleared += 1
      return Promise.resolve()
    })
    expect(chip.hasAttribute(SWAP_ATTR)).toBe(true)
    const swap = chip.querySelector(`[${SWAP_ATTR}]`)
    expect(swap).not.toBeNull()
    expect(swap?.querySelectorAll('svg').length).toBe(2)
    swap?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(cleared).toBe(1)
  })

  it('keeps swap icons under the stable classes for css-render rules', () => {
    document.body.innerHTML = ''
    const chip = mountChip()

    reconcileChip(chip, true, noopClear)
    expect(chip.querySelector(`.${TEMP_SESSION_CLASSES.drop}`)).not.toBeNull()
    expect(chip.querySelector(`.${TEMP_SESSION_CLASSES.clear}`)).not.toBeNull()
  })

  it('marks only the swap span with the stable class, never the chip button', () => {
    document.body.innerHTML = ''
    const chip = mountChip()

    reconcileChip(chip, true, noopClear)
    // 回归守卫：盒样式只允许命中替换 span；按钮带 SWAP_ATTR 作状态标记，
    // 若它也拿到 swap class，会被 16px 盒规则压掉工作区文案。
    const swap = chip.querySelector(`[${SWAP_ATTR}]`)
    expect(swap?.classList.contains(TEMP_SESSION_CLASSES.swap)).toBe(true)
    expect(chip.classList.contains(TEMP_SESSION_CLASSES.swap)).toBe(false)
  })

  it('updates the optional label through the existing text node', () => {
    document.body.innerHTML = ''
    const chip = mountChip()
    const label = chip.children[1]!
    const originalNode = label.firstChild

    reconcileChip(chip, false, noopClear)
    // 回归守卫：textContent 会替换节点，让 React 持有的文本节点游离、
    // 上游后续更新写到不可见节点上（选中工作区后文案无法恢复）。
    expect(label.firstChild).toBe(originalNode)
    expect(label.textContent).toBe('Choose workspace (optional)')
  })

  it('falls back to a standalone clear button when the chip structure differs', () => {
    document.body.innerHTML = ''
    const chip = document.createElement('button')
    chip.setAttribute('aria-haspopup', 'menu')
    chip.setAttribute('aria-label', '选择工作区')
    chip.append(document.createElement('span'))
    document.body.append(chip)

    reconcileChip(chip, true, noopClear)
    const fallback = document.querySelector(`[${CLEAR_ATTR}]`)
    expect(fallback).not.toBeNull()
    expect(fallback?.getAttribute('data-testid')).toBe(CLEAR_TEST_ID)
  })
})

describe('restoreChevronSwap', () => {
  it('restores the factory chevron and drops the swap marker', () => {
    document.body.innerHTML = ''
    const chip = mountChip()
    reconcileChip(chip, true, noopClear)
    expect(chip.querySelector('[data-chev="factory"]')).toBeNull()

    restoreChevronSwap(chip)
    expect(chip.hasAttribute(SWAP_ATTR)).toBe(false)
    expect(chip.querySelector('[data-chev="factory"]')).not.toBeNull()
    expect(chip.querySelector(`[${SWAP_ATTR}]`)).toBeNull()
  })

  it('removes the fallback clear button via removeClearButton', () => {
    document.body.innerHTML = ''
    const chip = document.createElement('button')
    chip.setAttribute('aria-haspopup', 'menu')
    chip.setAttribute('aria-label', '选择工作区')
    chip.append(document.createElement('span'))
    document.body.append(chip)
    reconcileChip(chip, true, noopClear)
    expect(document.querySelector(`[${CLEAR_ATTR}]`)).not.toBeNull()

    removeClearButton()
    expect(document.querySelector(`[${CLEAR_ATTR}]`)).toBeNull()
  })
})
