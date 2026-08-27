import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { checkoutToLocal, ensureWorktree } from '../src/index.js'

const execFileAsync = promisify(execFile)

/** 在仓库内执行 git，返回 stdout（去尾空白）。失败时抛错。 */
async function runGit(workdir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: workdir })
  return String(stdout).trim()
}

/** 初始化一个带两个已提交文件的 git 仓库，返回仓库路径。 */
async function makeRepo(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  await runGit(dir, ['init', '-q', '-b', 'main'])
  await runGit(dir, ['config', 'user.email', 'test@example.com'])
  await runGit(dir, ['config', 'user.name', 'Test'])
  // 关闭行尾转换（本机可能配置了 core.autocrlf=true），保证检出/写入的文件内容可精确断言。
  await runGit(dir, ['config', 'core.autocrlf', 'false'])
  await runGit(dir, ['config', 'core.eol', 'lf'])
  await writeFile(join(dir, 'a.txt'), 'v1\n')
  await writeFile(join(dir, 'keep.txt'), 'k1\n')
  await writeFile(join(dir, 'del.txt'), 'd1\n')
  await runGit(dir, ['add', '.'])
  await runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/** 在仓库里制造一组暂存改动（修改/新增/删除）+ 一个未暂存改动，返回 status 快照。 */
async function stageChanges(repo: string): Promise<void> {
  await writeFile(join(repo, 'a.txt'), 'v2\n')
  await writeFile(join(repo, 'new.txt'), 'n1\n')
  await rm(join(repo, 'del.txt'), { force: true })
  await runGit(repo, ['add', '-A'])
  // 未暂存改动：不应被携带
  await writeFile(join(repo, 'keep.txt'), 'k2-unstaged\n')
}

describe('dsh-tauri-worktree carry staged', () => {
  it('ensureWorktree carries staged changes when carryStaged: true', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-carry-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      await stageChanges(repo)
      const worktreesRoot = join(rootDir, 'worktrees')

      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-1', {
        sourceSessionId: 'sess-0',
        carryStaged: true,
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath

      // 暂存修改/新增已携带且内容正确；暂存删除后文件不存在
      expect(await readFile(join(wt, 'a.txt'), 'utf8')).toBe('v2\n')
      expect(await readFile(join(wt, 'new.txt'), 'utf8')).toBe('n1\n')
      await expect(readFile(join(wt, 'del.txt'), 'utf8')).rejects.toThrow()
      // 未暂存改动不携带：工作树里保持 HEAD 内容
      expect(await readFile(join(wt, 'keep.txt'), 'utf8')).toBe('k1\n')
      // 工作树状态：只有三个暂存项，无未暂存/未跟踪干扰
      const status = (await runGit(wt, ['status', '--short'])).split('\n').sort()
      expect(status).toEqual(['A  new.txt', 'D  del.txt', 'M  a.txt'])
      // 源仓库状态完全不受影响（暂存与未暂存都在）
      const srcStatus = (await runGit(repo, ['status', '--short'])).split('\n').sort()
      expect(srcStatus).toEqual([' M keep.txt', 'A  new.txt', 'D  del.txt', 'M  a.txt'])
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('ensureWorktree does not carry staged changes by default', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-nocarry-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      await stageChanges(repo)
      const worktreesRoot = join(rootDir, 'worktrees')

      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-2', {
        sourceSessionId: 'sess-0',
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath

      // 工作树是干净的 HEAD 检出
      expect(await readFile(join(wt, 'a.txt'), 'utf8')).toBe('v1\n')
      expect(await runGit(wt, ['status', '--short'])).toBe('')
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('checkoutToLocal carries staged changes into the local checkout when carryStaged: true', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-co-carry-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')

      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-3', {
        sourceSessionId: 'sess-0',
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      // 工作树先提交一份改动，再暂存一份改动（暂存内容在强制移除工作树时会被丢弃）
      await writeFile(join(wt, 'committed.txt'), 'c1\n')
      await runGit(wt, ['add', 'committed.txt'])
      await runGit(wt, ['commit', '-q', '-m', 'wt work'])
      await writeFile(join(wt, 'a.txt'), 'v9-staged\n')
      await runGit(wt, ['add', 'a.txt'])

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-3',
        branch_name: 'dsh/feature-x',
      }, { carryStaged: true })
      if (!result.ok)
        throw new Error(result.error)

      // 本地仓库切到新分支，已提交改动保留
      expect(await runGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('dsh/feature-x')
      expect(await readFile(join(repo, 'committed.txt'), 'utf8')).toBe('c1\n')
      // 暂存改动携带回本地并保持「已暂存」状态
      expect(await readFile(join(repo, 'a.txt'), 'utf8')).toBe('v9-staged\n')
      expect(await runGit(repo, ['diff', '--cached', '--name-only'])).toBe('a.txt')
      expect(await runGit(repo, ['status', '--short'])).toBe('M  a.txt')
      // 工作树已被移除
      expect(await runGit(repo, ['worktree', 'list'])).not.toContain(created.binding.worktreePath)
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('checkoutToLocal carries only committed work by default', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-co-nocarry-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')

      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-4', {
        sourceSessionId: 'sess-0',
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      await writeFile(join(wt, 'committed.txt'), 'c1\n')
      await runGit(wt, ['add', 'committed.txt'])
      await runGit(wt, ['commit', '-q', '-m', 'wt work'])
      await writeFile(join(wt, 'a.txt'), 'v9-staged\n')
      await runGit(wt, ['add', 'a.txt'])

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-4',
        branch_name: 'dsh/feature-y',
      })
      if (!result.ok)
        throw new Error(result.error)

      // 已提交改动带回，暂存改动不带回
      expect(await readFile(join(repo, 'committed.txt'), 'utf8')).toBe('c1\n')
      expect(await readFile(join(repo, 'a.txt'), 'utf8')).toBe('v1\n')
      expect(await runGit(repo, ['diff', '--cached', '--name-only'])).toBe('')
      expect(await runGit(repo, ['status', '--short'])).toBe('')
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
