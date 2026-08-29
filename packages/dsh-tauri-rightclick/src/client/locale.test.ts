import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { installLocale, NS, text } from './locale'

/** 假 locale 服务：可控 active 语言，记录注册的字典（经 locale.registered 读取）。 */
function fakeCtx(active: 'zh' | 'en'): Context {
  const registered: Array<{ ns: string, locale: string, dict: Record<string, string> }> = []
  return {
    locale: {
      registered,
      getLocale: () => ({ active, revision: 1 }),
      register: (ns: string, locale: string, dict: Record<string, string>) => {
        registered.push({ ns, locale, dict })
        return () => {}
      },
      subscribe: () => () => {},
    },
  } as unknown as Context
}

describe('text', () => {
  it('interpolates {name} placeholders (en)', () => {
    installLocale(fakeCtx('en'))
    expect(text('archiveWorkspaceConfirm', { title: 'Minecraft', count: 3 }))
      .toBe('Archive 3 sessions in “Minecraft”?')
  })

  it('interpolates {name} placeholders (zh)', () => {
    installLocale(fakeCtx('zh'))
    expect(text('archiveWorkspaceConfirm', { title: 'Minecraft', count: 3 }))
      .toBe('归档“Minecraft”中的 3 个会话？')
  })
})

describe('installLocale', () => {
  it('registers zh and en dictionaries under the plugin namespace', () => {
    const ctx = fakeCtx('zh')
    installLocale(ctx)
    const registered = (ctx.locale as any).registered as Array<{ ns: string, locale: string, dict: Record<string, string> }>
    const ns = new Set(registered.map(entry => entry.ns))
    const locales = new Set(registered.map(entry => entry.locale))
    expect(ns).toEqual(new Set([NS]))
    expect(locales).toEqual(new Set(['zh', 'en']))
  })

  it('zh dictionary keys are the authoritative key set', () => {
    const ctx = fakeCtx('zh')
    installLocale(ctx)
    const registered = (ctx.locale as any).registered as Array<{ ns: string, locale: string, dict: Record<string, string> }>
    const zh = registered.find(entry => entry.locale === 'zh')?.dict ?? {}
    const en = registered.find(entry => entry.locale === 'en')?.dict ?? {}
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(zh).length).toBeGreaterThan(20)
  })
})
