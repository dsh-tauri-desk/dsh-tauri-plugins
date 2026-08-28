/**
 * 内核客户端补丁：dsh-client-ui-conversation 的 ConversationRoot 在
 * `workspaces.phase === "ready"` 时把无工作区会话的 chipTitle 置空，组合输入框
 * 随之进入 inert（"必须选工作区"的实现点）。与桌面项目对待内核文件的方式一致：
 * 启动时对安装的内核 bundle 做一行最小替换——保留备份、打标记、幂等；上游代码
 * 漂移时跳过并高调记录（随插件版本跟进）。
 */
import type { ConversationPatchSpec, LoggerLike, PatchResult } from './types'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { CONVERSATION_PATCH, PATCH_BACKUP_SUFFIX, TEMP_SESSION_PLUGIN_NAME } from './constants'

/** 解析 DSH_HOME：$DSH_HOME 优先，否则 ~/.dsh。 */
export function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '')
    return fromEnv.trim()
  return join(homedir(), '.dsh')
}

/**
 * 定位被服务的 dsh-client-ui-conversation 客户端 bundle：
 *   1) 从当前 dsh 进程入口（argv[1] = …/dsh/lib/bin.js 或包装脚本）做 Node 解析；
 *   2) $DSH_HOME/profiles/node_modules 的 flat fallback 位置；
 *   3) argv[1] 的兄弟候选（unscoped 布局下 dsh-client-ui-conversation 与 dsh 同级）。
 */
export function resolveConversationBundle(bundleRel = 'lib/client.js'): string | undefined {
  const pkgName = CONVERSATION_PATCH.package
  const unscopedName = pkgName.split('/').pop() ?? pkgName
  const candidates: string[] = []
  const argv1 = process.argv[1]
  if (typeof argv1 === 'string' && argv1 !== '') {
    try {
      const anchor = join(dirname(argv1), '__dsh_tauri_temp_session_anchor__.js')
      const req = createRequire(pathToFileURL(anchor))
      candidates.push(req.resolve(`${pkgName}/package.json`))
    }
    catch {
      // 入口锚点解析失败时继续尝试其余候选
    }
  }
  candidates.push(join(resolveDshHome(), 'profiles', 'node_modules', pkgName, 'package.json'))
  if (typeof argv1 === 'string' && argv1 !== '')
    candidates.push(join(dirname(argv1), '..', unscopedName, 'package.json'))
  for (const pkgJson of candidates) {
    const bundle = join(dirname(pkgJson), bundleRel)
    if (existsSync(bundle))
      return bundle
  }
  return undefined
}

/**
 * 纯函数核心：对 bundle 文本应用（或确认）补丁。
 * - already：已含本插件标记（或独立版旧标记，视为同一补丁）；
 * - drifted：目标代码消失且无任何标记（上游升级改变实现，插件需跟进）；
 * - patched：完成替换。
 */
export function applyConversationPatch(content: string, spec: ConversationPatchSpec): PatchResult {
  if (content.includes(spec.mark) || (spec.legacyMark !== undefined && content.includes(spec.legacyMark)))
    return { status: 'already', content }
  if (!content.includes(spec.from))
    return { status: 'drifted', content }
  return { status: 'patched', content: content.replace(spec.from, spec.to) }
}

/** 对 conversation 客户端 bundle 应用（或确认已应用）内核补丁；失败不抛出，仅记录。 */
export function patchConversationBundle(logger?: LoggerLike): boolean {
  try {
    const bundle = resolveConversationBundle()
    if (bundle === undefined) {
      logger?.warn?.(`${TEMP_SESSION_PLUGIN_NAME}: could not locate the conversation client bundle; composer gate stays upstream`)
      return false
    }
    const result = applyConversationPatch(readFileSync(bundle, 'utf8'), CONVERSATION_PATCH)
    if (result.status === 'already')
      return true
    if (result.status === 'drifted') {
      logger?.warn?.(`${TEMP_SESSION_PLUGIN_NAME}: conversation bundle drifted from the expected code — update the plugin (target text not found)`)
      return false
    }
    copyFileSync(bundle, `${bundle}${PATCH_BACKUP_SUFFIX}`)
    writeFileSync(bundle, result.content, 'utf8')
    logger?.info?.(`${TEMP_SESSION_PLUGIN_NAME}: conversation bundle patched (optional-workspace composer)`)
    return true
  }
  catch (error) {
    logger?.warn?.(`${TEMP_SESSION_PLUGIN_NAME}: conversation bundle patch failed: ${String(error)}`)
    return false
  }
}
