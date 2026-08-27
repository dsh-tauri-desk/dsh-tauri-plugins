import { afterEach, describe, expect, it } from 'vitest'
import {
  concealSettingsObstructions,
  getSettingsObstructionTargets,
} from './settings-obstructions'

function appendSlot(parent: HTMLElement, slotKey: string): void {
  const anchor = document.createElement('div')
  anchor.dataset.slot = slotKey
  parent.append(anchor)
}

async function flushMutationObserver(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('settings obstructions', () => {
  it('deduplicates slot hosts and independently mounted overlays', () => {
    const sharedHost = document.createElement('section')
    sharedHost.dataset.dshBetterSidebar = ''
    appendSlot(sharedHost, 'sidebar')

    const conversationHost = document.createElement('section')
    appendSlot(conversationHost, 'conversation')

    const detailsHost = document.createElement('section')
    appendSlot(detailsHost, 'details')

    const externalHost = document.createElement('section')
    externalHost.dataset.dshBetterSidebar = ''

    document.body.append(sharedHost, conversationHost, detailsHost, externalHost)

    expect(getSettingsObstructionTargets(document)).toEqual([
      sharedHost,
      conversationHost,
      detailsHost,
      externalHost,
    ])
  })

  it('restores the exact prior opacity and inert state during cleanup', () => {
    const sharedHost = document.createElement('section')
    sharedHost.dataset.dshBetterSidebar = ''
    sharedHost.style.opacity = '0.4'
    sharedHost.inert = false
    appendSlot(sharedHost, 'sidebar')

    const conversationHost = document.createElement('section')
    conversationHost.inert = true
    appendSlot(conversationHost, 'conversation')

    const externalHost = document.createElement('section')
    externalHost.dataset.dshBetterSidebar = ''
    externalHost.style.opacity = '0.75'
    externalHost.inert = false

    const unrelated = document.createElement('section')
    unrelated.style.opacity = '0.9'
    unrelated.inert = false

    document.body.append(sharedHost, conversationHost, externalHost, unrelated)

    const restore = concealSettingsObstructions(document)

    for (const element of [sharedHost, conversationHost, externalHost]) {
      expect(element.style.opacity).toBe('0')
      expect(element.inert).toBe(true)
    }
    expect(unrelated.style.opacity).toBe('0.9')
    expect(unrelated.inert).toBe(false)

    restore()
    restore()

    expect(sharedHost.style.opacity).toBe('0.4')
    expect(sharedHost.inert).toBe(false)
    expect(conversationHost.style.opacity).toBe('')
    expect(conversationHost.inert).toBe(true)
    expect(externalHost.style.opacity).toBe('0.75')
    expect(externalHost.inert).toBe(false)
    expect(unrelated.style.opacity).toBe('0.9')
    expect(unrelated.inert).toBe(false)
  })

  it('preserves inline opacity priority and true property absence', () => {
    const importantHost = document.createElement('section')
    importantHost.dataset.dshBetterSidebar = ''
    importantHost.style.setProperty('opacity', '0.4', 'important')

    const absentHost = document.createElement('section')
    appendSlot(absentHost, 'conversation')

    document.body.append(importantHost, absentHost)

    const restore = concealSettingsObstructions(document)

    expect(importantHost.style.getPropertyValue('opacity')).toBe('0')
    expect(importantHost.style.getPropertyPriority('opacity')).toBe('important')
    expect(absentHost.style.getPropertyValue('opacity')).toBe('0')
    expect(absentHost.style.getPropertyPriority('opacity')).toBe('important')

    restore()

    expect(importantHost.style.getPropertyValue('opacity')).toBe('0.4')
    expect(importantHost.style.getPropertyPriority('opacity')).toBe('important')
    expect(absentHost.style.getPropertyValue('opacity')).toBe('')
    expect(absentHost.style.getPropertyPriority('opacity')).toBe('')
    expect(absentHost.style.cssText).not.toContain('opacity')
  })

  it('conceals late mounts and remounts while recording each target once', async () => {
    const existingHost = document.createElement('section')
    existingHost.dataset.dshBetterSidebar = ''
    existingHost.style.setProperty('opacity', '0.6', 'important')
    document.body.append(existingHost)

    const restore = concealSettingsObstructions(document)

    // A child mutation reconciles the existing target. Its original state must
    // not be replaced by the already-concealed state.
    existingHost.append(document.createElement('span'))

    const lateHost = document.createElement('section')
    lateHost.dataset.dshBetterSidebar = ''
    lateHost.style.opacity = '0.7'
    document.body.append(lateHost)
    await flushMutationObserver()

    expect(lateHost.style.getPropertyValue('opacity')).toBe('0')
    expect(lateHost.inert).toBe(true)

    lateHost.remove()
    const remountedHost = document.createElement('section')
    appendSlot(remountedHost, 'details')
    document.body.append(remountedHost)
    await flushMutationObserver()

    expect(remountedHost.style.getPropertyValue('opacity')).toBe('0')
    expect(remountedHost.inert).toBe(true)

    restore()

    expect(existingHost.style.getPropertyValue('opacity')).toBe('0.6')
    expect(existingHost.style.getPropertyPriority('opacity')).toBe('important')
    expect(lateHost.style.opacity).toBe('0.7')
    expect(lateHost.inert).toBe(false)
    expect(remountedHost.style.getPropertyValue('opacity')).toBe('')
    expect(remountedHost.inert).toBe(false)
  })

  it('disconnects observation before cleanup so later mounts remain untouched', async () => {
    const restore = concealSettingsObstructions(document)
    restore()

    const postCleanupHost = document.createElement('section')
    postCleanupHost.dataset.dshBetterSidebar = ''
    postCleanupHost.style.opacity = '0.8'
    document.body.append(postCleanupHost)
    await flushMutationObserver()

    expect(postCleanupHost.style.opacity).toBe('0.8')
    expect(postCleanupHost.inert).toBe(false)
  })
})
