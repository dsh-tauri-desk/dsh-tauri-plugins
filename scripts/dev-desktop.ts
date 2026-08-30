import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setup } from './setup-desktop'

const repoRoot = resolve(import.meta.dirname, '..')
const desktopPath = resolve(repoRoot, 'packages/dsh-tauri-desktop')
const pnpmCommand = process.platform === 'win32' ? process.env.npm_execpath || resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.cjs') : 'pnpm'
const pnpmArgs = (args: string[]) => process.platform === 'win32' && pnpmCommand.endsWith('.cjs') ? [pnpmCommand, ...args] : args

await setup()

const processes = [
  spawn(process.execPath, pnpmArgs(['run', 'dev:plugins']), { cwd: repoRoot, stdio: 'inherit' }),
  spawn(process.execPath, pnpmArgs(['run', 'tauri', 'dev']), { cwd: desktopPath, stdio: 'inherit' }),
]

function stop(): void {
  for (const child of processes) {
    if (!child.killed)
      child.kill()
  }
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)

const exitCode = await new Promise<number>((resolveExit) => {
  let settled = false
  for (const child of processes) {
    child.once('exit', (code) => {
      if (!settled) {
        settled = true
        stop()
        resolveExit(code ?? 1)
      }
    })
  }
})

process.exitCode = exitCode
