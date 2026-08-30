import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PANEL_DATA_ATTRIBUTES } from '../src/client/constants'
import { shouldClosePanelForSidebarTarget } from '../src/client/service'

// dsh-client-runtime 的 client 构造为浏览器专用 bundle（window.__ModuleLoader__），
// 测试环境无法加载，这里与 index.test.ts 一致地对它取替身。
vi.mock('dsh-tauri/client', () => ({
  createExternalStore: () => ({
    getSnapshot: () => null,
    set: () => undefined,
    subscribe: () => () => undefined,
  }),
}))

/**
 * shouldClosePanelForSidebarTarget 的 DOM 回归测试：面板只应在点击侧栏内
 * 真正的导航动作（会话行、搜索结果、设置等）时关闭；空白区、面板本体、
 * 工作区“分组方式”“添加工作区”按钮与折叠行保持面板。
 */

/** 构建包着节点列表的侧栏根，返回 innerHTML 容器便于按选择器取元素。 */
function mountSidebar(html: string): HTMLElement {
  const root = document.createElement('div')
  root.setAttribute(PANEL_DATA_ATTRIBUTES.sidebar, '')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function pick(root: HTMLElement, selector: string): Element {
  const el = root.querySelector(selector)
  if (!el)
    throw new Error(`missing fixture: ${selector}`)
  return el
}

describe('shouldClosePanelForSidebarTarget', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = mountSidebar(`
      <div data-dshp-panel-view>panel view</div>
      <button data-dshp-panel-action>panel action</button>
      <div class="blank-space">empty</div>
      <button aria-label="视图选项">group by</button>
      <button aria-label="添加工作区">add workspace</button>
      <div role="treeitem" aria-expanded="true">
        workspace header
        <button type="button">workspace menu</button>
        <button type="button">new session in workspace</button>
      </div>
      <div role="treeitem" aria-selected="false">session row</div>
      <div role="treeitem" aria-selected="true">selected session row</div>
      <button role="treeitem" aria-selected="false">search result</button>
      <div class="dshp-regionArea"><button type="button">footer/settings action</button></div>
    `)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the panel when clicking blank space in the sidebar', () => {
    const blank = root.querySelector('.blank-space')!
    expect(shouldClosePanelForSidebarTarget(blank)).toBe(false)
  })

  it('keeps the panel inside the panel view and panel action item', () => {
    expect(shouldClosePanelForSidebarTarget(pick(root, '[data-dshp-panel-view]'))).toBe(false)
    expect(shouldClosePanelForSidebarTarget(pick(root, '[data-dshp-panel-action]'))).toBe(false)
  })

  it('keeps the panel on the workspace view-options and add-workspace controls', () => {
    expect(shouldClosePanelForSidebarTarget(pick(root, 'button[aria-label="视图选项"]'))).toBe(false)
    expect(shouldClosePanelForSidebarTarget(pick(root, 'button[aria-label="添加工作区"]'))).toBe(false)
  })

  it('keeps the panel on the workspace collapse row but not its inner actions', () => {
    const row = pick(root, '[role="treeitem"][aria-expanded="true"]')
    expect(shouldClosePanelForSidebarTarget(row)).toBe(false)
  })

  it('closes the panel on workspace-header inner buttons', () => {
    const buttons = root.querySelectorAll('[role="treeitem"][aria-expanded="true"] button')
    for (const button of buttons)
      expect(shouldClosePanelForSidebarTarget(button)).toBe(true)
  })

  it('closes the panel on session rows and search results', () => {
    expect(shouldClosePanelForSidebarTarget(pick(root, '[role="treeitem"][aria-selected="false"]'))).toBe(true)
    expect(shouldClosePanelForSidebarTarget(pick(root, '[role="treeitem"][aria-selected="true"]'))).toBe(true)
    expect(shouldClosePanelForSidebarTarget(pick(root, 'button[role="treeitem"]'))).toBe(true)
  })

  it('closes the panel on generic interactive sidebar controls', () => {
    expect(shouldClosePanelForSidebarTarget(pick(root, '.dshp-regionArea button'))).toBe(true)
  })

  it('returns false for targets outside the sidebar', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    expect(shouldClosePanelForSidebarTarget(outside)).toBe(false)
  })

  it('returns false for null targets', () => {
    expect(shouldClosePanelForSidebarTarget(null)).toBe(false)
  })
})
