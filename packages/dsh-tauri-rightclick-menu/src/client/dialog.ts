/** dialog.ts — Toast 提示与危险操作确认框（均为插件自有 DOM，不依赖官方组件）。 */

import type { ConfirmDialogOptions } from './types'
import { RIGHTCLICK_CLASSES as K, TOAST_DURATION_MS } from './constants'

/** 轻量 Toast（同一时刻只保留一条，自动消失）。 */
export function toast(message: string): void {
  document.querySelector(`.${K.toast}`)?.remove()
  const node = document.createElement('div')
  node.className = K.toast
  node.textContent = message
  document.body.appendChild(node)
  setTimeout(() => node.remove(), TOAST_DURATION_MS)
}

/**
 * 危险操作确认框：返回用户是否确认。点取消、遮罩空白处或按 Esc 均视为取消；
 * 关闭后焦点还给打开前的元素；Tab 在确认/取消间循环。
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const existingCancel = document.querySelector<HTMLElement>(`.${K.dialogBackdrop} [data-cancel]`)
  existingCancel?.click()
  return new Promise((resolve) => {
    const previousFocus = document.activeElement
    const backdrop = document.createElement('div')
    backdrop.className = K.dialogBackdrop
    const dialog = document.createElement('div')
    dialog.className = K.dialog
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-labelledby', 'dshcm-dialog-title')
    dialog.setAttribute('aria-describedby', 'dshcm-dialog-description')
    const heading = document.createElement('h2')
    heading.id = 'dshcm-dialog-title'
    heading.className = K.dialogTitle
    heading.textContent = options.title
    const description = document.createElement('p')
    description.id = 'dshcm-dialog-description'
    description.className = K.dialogMessage
    description.textContent = options.message
    const actions = document.createElement('div')
    actions.className = K.dialogActions
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = K.dialogButton
    cancel.dataset.cancel = ''
    cancel.textContent = options.cancelLabel
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = `${K.dialogButton} ${K.dialogConfirm}`
    confirm.textContent = options.confirmLabel
    actions.append(cancel, confirm)
    dialog.append(heading, description, actions)
    backdrop.appendChild(dialog)
    document.body.appendChild(backdrop)

    let settled = false
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(false)
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        const target = event.shiftKey
          ? (document.activeElement === cancel ? confirm : cancel)
          : (document.activeElement === confirm ? cancel : confirm)
        target.focus()
      }
    }
    function finish(value: boolean): void {
      if (settled)
        return
      settled = true
      document.removeEventListener('keydown', onKeyDown, true)
      backdrop.remove()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus()
      resolve(value)
    }
    cancel.onclick = () => finish(false)
    confirm.onclick = () => finish(true)
    backdrop.onpointerdown = (event) => {
      if (event.target === backdrop)
        finish(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    cancel.focus()
  })
}
