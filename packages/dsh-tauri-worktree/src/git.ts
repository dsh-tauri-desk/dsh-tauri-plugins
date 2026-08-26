import type { GitOptions, OperationResult } from './types.js'
import { execFile } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const value = error as { stderr?: unknown, message?: unknown }
    return String(value.stderr ?? value.message ?? error).trim()
  }
  return String(error).trim()
}

export async function git(args: string[], cwd: string, options: GitOptions = {}): Promise<OperationResult<{ out: string }>> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: options.timeout ?? 30_000,
      maxBuffer: 8 * 1024 * 1024,
      signal: options.signal,
    })
    return { ok: true, out: String(stdout).trim() }
  }
  catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export async function gitToplevel(path: string): Promise<string | null> {
  const result = await git(['rev-parse', '--show-toplevel'], path)
  return result.ok ? resolve(result.out) : null
}

export function projectDirname(projectPath: string): string {
  return basename(resolve(projectPath))
}

export async function shortHead(worktreePath: string): Promise<string> {
  const result = await git(['rev-parse', '--short', 'HEAD'], worktreePath)
  return result.ok ? result.out : '?'
}

export async function headSubject(worktreePath: string): Promise<string> {
  const result = await git(['log', '-1', '--pretty=%s'], worktreePath)
  return result.ok && result.out ? result.out : '?'
}
