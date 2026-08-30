import type { ClientContext } from 'dsh-tauri/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_ARCHIVE_SECTION_EFFECT,
  SESSION_REGISTRANT,
  SESSION_SECTION_ID,
  SESSION_SECTION_ORDER,
  SETTINGS_SECTION_SLOT,
} from './constants'
import { apply } from './index'
import { ArchivePanel } from './panel'
import { mountSessionStyles } from './styles'
import { installWorkspaceArchivePatch } from './workspace-patch'

vi.mock('dsh-tauri/client', () => ({
  compat: vi.fn((ctx: ClientContext) => ctx),
}))

vi.mock('./locale', () => ({
  installLocale: vi.fn(),
  text: vi.fn(() => 'Archive'),
}))

vi.mock('./panel', () => ({
  ArchivePanel: vi.fn(),
}))

vi.mock('./styles', () => ({
  mountSessionStyles: vi.fn(() => vi.fn()),
}))

vi.mock('./workspace-patch', () => ({
  installWorkspaceArchivePatch: vi.fn(() => vi.fn()),
}))

describe('apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('waits for the settings section slot before registering the archive panel', () => {
    let injectCallback: (() => unknown) | undefined
    const registerCleanup = vi.fn()
    const injectCleanup = vi.fn()
    const register = vi.fn((_options: unknown, _component: unknown) => registerCleanup)
    const inject = vi.fn((name: string, callback: () => unknown) => {
      expect(name).toBe(SETTINGS_SECTION_SLOT)
      injectCallback = callback
      return injectCleanup
    })
    const effect = vi.fn((callback: () => unknown, _name: string) => callback())
    const ctx = {
      effect,
      locale: {},
      sessions: {},
      slots: { inject, register },
      workspaces: {},
    } as unknown as ClientContext

    apply(ctx)

    expect(inject).toHaveBeenCalledOnce()
    expect(register).not.toHaveBeenCalled()

    expect(injectCallback).toBeTypeOf('function')
    const registrationCleanup = injectCallback?.() as (() => void) | undefined
    expect(register).toHaveBeenCalledOnce()
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      name: SETTINGS_SECTION_SLOT,
      id: SESSION_SECTION_ID,
      order: SESSION_SECTION_ORDER,
      registrant: SESSION_REGISTRANT,
      label: expect.any(Function),
      inject: expect.any(Function),
    }), ArchivePanel)

    const registration = register.mock.calls[0]?.[0] as {
      label: () => string
      inject: () => unknown
    }
    expect(registration.label()).toBe('Archive')
    expect(registration.inject()).toEqual({
      sessionsRuntime: ctx.sessions,
      workspacesRuntime: ctx.workspaces,
    })
    expect(registrationCleanup).toBe(registerCleanup)

    const archiveEffectIndex = effect.mock.calls.findIndex(([, name]) => name === SESSION_ARCHIVE_SECTION_EFFECT)
    expect(archiveEffectIndex).toBeGreaterThanOrEqual(0)
    expect(effect.mock.results[archiveEffectIndex]?.value).toBe(injectCleanup)

    const styleCleanup = vi.mocked(mountSessionStyles).mock.results[0]?.value
    const workspaceCleanup = vi.mocked(installWorkspaceArchivePatch).mock.results[0]?.value
    for (const result of effect.mock.results)
      (result.value as () => void)()
    registrationCleanup?.()

    expect(styleCleanup).toHaveBeenCalledOnce()
    expect(injectCleanup).toHaveBeenCalledOnce()
    expect(workspaceCleanup).toHaveBeenCalledOnce()
    expect(registerCleanup).toHaveBeenCalledOnce()
  })
})
