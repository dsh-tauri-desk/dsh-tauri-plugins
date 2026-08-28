import type { HostContext, WorkspaceRecord } from './types'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { STALE_TEMP_MS, TEMP_SESSION_PLUGIN_NAME } from './constants'

/** 路径包含判断：容忍 Windows/类 Unix 分隔符混写（临时目录比较在双平台进行）。 */
export function isUnderRoot(root: string, path: unknown): boolean {
  if (typeof path !== 'string' || path === '')
    return false
  const normalizedRoot = root.replace(/[/\\]+$/, '')
  const normalizedPath = path.replace(/[/\\]+$/, '')
  if (normalizedPath === normalizedRoot)
    return true
  return normalizedPath.startsWith(`${normalizedRoot}${sep}`)
    || normalizedPath.startsWith(`${normalizedRoot}/`)
    || normalizedPath.startsWith(`${normalizedRoot}\\`)
}

/**
 * 从目录项中筛出可清理的临时目录 id：既非存活 Agent 会话、也非持久化会话。
 * 独立纯函数，便于不挂 fs 地测试保留逻辑。
 */
export function prunableSessionIds(
  entryNames: readonly string[],
  live: ReadonlySet<string>,
  persisted: ReadonlySet<string>,
): string[] {
  return entryNames.filter(id => !live.has(id) && !persisted.has(id))
}

/** 启动清理：注销临时目录的 Workspace 记录，并删除过期且无主的临时目录。 */
export async function cleanup(ctx: HostContext, tempRoot: string): Promise<void> {
  try {
    await mkdir(tempRoot, { recursive: true })

    // workspace 注册表 bootstrap 会按 header.cwd 为任何目录物化 Workspace 记录；
    // 临时目录属于本插件，启动时注销这些记录（会话与日志保留，仅取消归属），
    // 使临时会话在侧边栏保持 Ungrouped。
    const registry = ctx.workspaceRegistry
    if (registry !== undefined && typeof registry.list === 'function') {
      for (const workspace of registry.list() as WorkspaceRecord[]) {
        if (isUnderRoot(tempRoot, workspace?.path))
          void registry.delete(workspace.id)
      }
    }

    // 清理：既非存活 Agent 也不在持久化列表、且超过保留时长的临时目录。
    const live = new Set<string>()
    if (ctx.agents !== undefined && typeof ctx.agents.list === 'function') {
      for (const agent of ctx.agents.list()) {
        const id = agent?.session?.id
        if (id !== undefined)
          live.add(id)
      }
    }
    const persisted = new Set<string>()
    const persistence = ctx.get?.('sessionPersistence')
    if (persistence !== undefined && typeof persistence.list === 'function') {
      for (const header of await persistence.list())
        persisted.add(header.id)
    }
    const entries = await readdir(tempRoot, { withFileTypes: true }).catch(() => [])
    const dirNames = entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
    const now = Date.now()
    for (const id of prunableSessionIds(dirNames, live, persisted)) {
      const dir = join(tempRoot, id)
      const info = await stat(dir).catch(() => null)
      if (info === null)
        continue
      if (now - info.mtimeMs > STALE_TEMP_MS)
        await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }
  catch (error) {
    ctx.logger?.warn?.(`${TEMP_SESSION_PLUGIN_NAME}: cleanup failed: ${String(error)}`)
  }
}
