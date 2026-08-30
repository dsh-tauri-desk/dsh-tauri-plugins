import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

export function setup(): void {
  const repoRoot = resolve(import.meta.dirname, '..')
  const desktopPath = resolve(repoRoot, 'packages/dsh-tauri-desktop')
  const envPath = resolve(desktopPath, '.env')
  const pluginsPath = resolve(repoRoot, 'packages')

  const submodule = spawnSync('git', ['ls-files', '--stage', '--', 'packages/dsh-tauri-desktop'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  const isTrackedSubmodule = submodule.status === 0 && submodule.stdout.trimStart().startsWith('160000 ')

  if (isTrackedSubmodule) {
    const result = spawnSync('git', ['submodule', 'update', '--init', '--recursive', 'packages/dsh-tauri-desktop'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })

    if (result.status !== 0)
      process.exit(result.status ?? 1)
  }
  else if (!existsSync(resolve(desktopPath, 'package.json'))) {
    console.error('[tauri-desktop] submodule is not initialized and no local checkout was found')
    process.exit(1)
  }

  const envLine = `DEV_INTERNAL_PLUGINS_DIR=${pluginsPath}`
  const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  const envLines = env.split(/\r?\n/)
  const envKeyIndex = envLines.findIndex(line => /^\s*DEV_INTERNAL_PLUGINS_DIR\s*=/.test(line))

  if (envKeyIndex >= 0)
    envLines[envKeyIndex] = envLine
  else
    envLines.push(envLine)

  const nextEnv = `${envLines.join('\n').trimEnd()}\n`
  if (nextEnv !== env)
    writeFileSync(envPath, nextEnv, 'utf8')

  const pnpmCommand = process.platform === 'win32' ? process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.cjs') : 'pnpm'
  const pnpmArgs = process.platform === 'win32' && pnpmCommand.endsWith('.cjs') ? [pnpmCommand, 'install'] : ['install']
  const install = spawnSync(process.execPath, pnpmArgs, {
    cwd: desktopPath,
    stdio: 'inherit',
  })

  if (install.status !== 0)
    process.exit(install.status ?? 1)

  console.log(`[tauri-desktop] configured and installed ${envPath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename))
  setup()
