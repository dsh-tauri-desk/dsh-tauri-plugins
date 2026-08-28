import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import {
  ASK_PRESET,
  DEFAULT_PRESET_KEY,
  PERMISSION_PRESETS_SECTION,
  TRUST_PRESET,
} from './constants.js'

/**
 * $DSH_HOME/settings.yaml 路径。与官方 dsh（${DSH_HOME:-$HOME/.dsh}）保持一致：
 * - 环境变量 DSH_HOME 非空时优先（桌面端启动 harness 时即按此注入，保证读写同一份）；
 * - 否则默认 $HOME/.dsh（与官方 node 安装共用同一份用户数据）。
 */
export function settingsPath(): string {
  const env = process.env.DSH_HOME
  const home = env && env.trim() ? env.trim() : join(homedir(), '.dsh')
  return join(home, 'settings.yaml')
}

/**
 * 读取 settings 文本中当前的权限预设名；未配置该分节/键时返回 undefined。
 *
 * 只认识「顶格分节 + 两空格缩进的直接子键」这一种规整形态：遇到下一个顶格
 * 键即认为分节结束，更深层嵌套不会误判成本分节的键。
 */
export function readPreset(text: string): string | undefined {
  const lines = text.split('\n')
  const header = `${PERMISSION_PRESETS_SECTION}:`
  const secIdx = lines.findIndex(line => line.trimEnd() === header)
  if (secIdx < 0)
    return undefined
  const keyPrefix = `  ${DEFAULT_PRESET_KEY}:`
  for (let i = secIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd()
    // 顶格且非空、非注释 → 已离开本分节
    if (trimmed !== '' && !trimmed.startsWith('#') && !startsIndented(lines[i]))
      break
    if (lines[i].startsWith(keyPrefix)) {
      const value = lines[i].slice(keyPrefix.length).trim()
      if (value !== '')
        return value
    }
  }
  return undefined
}

/**
 * 在 YAML 文本里把顶层 section 分节下的 key 设为 value（幂等，保持规整缩进）。
 *
 * 分节已存在时：命中同名键则替换其值，否则插到该分节的**末尾**（即下一个顶格
 * 键之前，或文件末尾）。分节不存在时：追加到文件末尾。始终以单个换行结尾。
 */
export function upsertScalar(text: string, section: string, key: string, value: string): string {
  const lines = text.split('\n')
  const header = `${section}:`
  const keyPrefix = `  ${key}:`
  const rendered = `  ${key}: ${value}`

  const secIdx = lines.findIndex(line => line.trimEnd() === header)
  if (secIdx >= 0) {
    let replaceAt: number | undefined
    let insertAt = lines.length

    for (let i = secIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trimEnd()
      if (trimmed !== '' && !trimmed.startsWith('#') && !startsIndented(line)) {
        insertAt = i // 下一个顶格键：分节到此结束，插在它前面
        break
      }
      if (line.startsWith(keyPrefix)) {
        replaceAt = i
        break
      }
    }

    if (replaceAt !== undefined)
      lines[replaceAt] = rendered
    else
      lines.splice(insertAt, 0, rendered)
    return joinLines(lines)
  }

  // 分节不存在：去掉尾部空行后追加，避免与前文之间夹一段空行。
  while (lines.length > 0 && lines[lines.length - 1].trim() === '')
    lines.pop()
  lines.push(header)
  lines.push(rendered)
  return joinLines(lines)
}

/** 该行是否以空白开头（即属于某个分节的缩进内容）。 */
function startsIndented(line: string): boolean {
  return line.length > 0 && (line[0] === ' ' || line[0] === '\t')
}

/** 把行序列拼回文本，并保证以换行结尾。 */
function joinLines(lines: string[]): string {
  let out = lines.join('\n')
  if (!out.endsWith('\n'))
    out += '\n'
  return out
}

/** 信任模式是否已开启（即默认预设为 danger-full-access）。 */
export function trustModeEnabled(): boolean {
  try {
    return readPreset(readFileSync(settingsPath(), 'utf8')) === TRUST_PRESET
  }
  catch {
    return false
  }
}

/**
 * 开启/关闭信任模式：把默认权限预设在 danger-full-access 与 workspace-write 之间切换。
 *
 * 幂等；内容无变化时**不写盘**（避免无谓地改动 mtime 触发 harness 重载）。
 * 变更对**之后新建的会话**生效，既有会话保持创建时固定的权限，不受影响。
 */
export function setTrustMode(enabled: boolean): void {
  const path = settingsPath()
  let text = ''
  try {
    text = readFileSync(path, 'utf8')
  }
  catch (error) {
    // 新用户尚未产生 settings.yaml：从空文本开始，写入时创建该文件。
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }

  const target = enabled ? TRUST_PRESET : ASK_PRESET
  const next = upsertScalar(text, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, target)
  if (next === text)
    return

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, next, 'utf8')
}
