/**
 * opener.ts — 宿主侧外链打开：仅接受 http/https URL，并用系统默认浏览器打开。
 * 打开走 detached 子进程，不阻塞宿主事件循环；Windows 用 rundll32 的
 * FileProtocolHandler（不把 URL 当文件系统路径交给 PowerShell）。
 */

import { spawn } from 'node:child_process'
import process from 'node:process'

/** 仅允许 http/https 的 URL 白名单校验；其余协议（file:、javascript: 等）一律拒绝。 */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string')
    return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  }
  catch {
    return null
  }
}

/** detached 子进程启动（失败即 reject，成功则 unref 不等待）。 */
function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/** 用系统默认浏览器打开一个已校验的 http/https URL。 */
export async function openUrl(url: string): Promise<void> {
  if (process.platform === 'win32') {
    await spawnDetached('rundll32.exe', ['url.dll,FileProtocolHandler', url])
    return
  }
  if (process.platform === 'darwin') {
    await spawnDetached('open', [url])
    return
  }
  await spawnDetached('xdg-open', [url])
}
