import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { buildRoutes, checkoutToLocal, ensureWorktree } from '../src/index.js'

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

  it('checkoutToLocal hands an owned branch back without creating a duplicate branch', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-owned-handoff-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')
      const branch = 'dsh/owned-feature'
      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-owned', {
        sourceSessionId: 'sess-0',
        branchName: branch,
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      await writeFile(join(wt, 'committed.txt'), 'owned\n')
      await runGit(wt, ['add', 'committed.txt'])
      await runGit(wt, ['commit', '-q', '-m', 'owned work'])
      const worktreeHead = await runGit(wt, ['rev-parse', 'HEAD'])

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-owned',
        branch_name: branch,
      })
      if (!result.ok)
        throw new Error(result.error)

      expect(await runGit(repo, ['branch', '--show-current'])).toBe(branch)
      expect(await runGit(repo, ['rev-parse', 'HEAD'])).toBe(worktreeHead)
      expect((await runGit(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'])).split('\n').sort()).toEqual([
        branch,
        'main',
      ])
      expect(await runGit(repo, ['worktree', 'list'])).not.toContain(wt)
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  }, 10_000)

  it('checkoutToLocal rejects a dirty local repository before releasing the owned branch', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-owned-rollback-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')
      const branch = 'dsh/rollback-feature'
      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-rollback', {
        sourceSessionId: 'sess-0',
        branchName: branch,
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      await writeFile(join(wt, 'a.txt'), 'feature\n')
      await runGit(wt, ['add', 'a.txt'])
      await runGit(wt, ['commit', '-q', '-m', 'conflicting feature work'])
      await writeFile(join(repo, 'a.txt'), 'local dirty\n')

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-rollback',
        branch_name: branch,
      })

      expect(result.ok).toBe(false)
      if (result.ok)
        throw new Error('expected checkout failure')
      expect(result.error).toContain('本地主工作区存在未提交改动')
      expect(await runGit(repo, ['branch', '--show-current'])).toBe('main')
      expect(await readFile(join(repo, 'a.txt'), 'utf8')).toBe('local dirty\n')
      expect(await runGit(wt, ['branch', '--show-current'])).toBe(branch)
      expect(await runGit(repo, ['worktree', 'list', '--porcelain'])).toContain(`branch refs/heads/${branch}`)
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('checkoutToLocal rolls an owned branch back when handback preparation fails', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-handback-rollback-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')
      const branch = 'dsh/handback-rollback'
      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-handback', {
        sourceSessionId: 'sess-0',
        branchName: branch,
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      await writeFile(join(wt, 'committed.txt'), 'owned\n')
      await runGit(wt, ['add', 'committed.txt'])
      await runGit(wt, ['commit', '-q', '-m', 'owned work'])

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-handback',
        branch_name: branch,
      }, {
        beforeRemove: async () => ({ ok: false, error: 'injected handback failure' }),
      })

      expect(result.ok).toBe(false)
      if (result.ok)
        throw new Error('expected checkout failure')
      expect(result.error).toContain('injected handback failure')
      expect(await runGit(repo, ['branch', '--show-current'])).toBe('main')
      expect(await runGit(wt, ['branch', '--show-current'])).toBe(branch)
      expect(await runGit(repo, ['worktree', 'list', '--porcelain'])).toContain(`branch refs/heads/${branch}`)
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('checkoutToLocal still rejects an unrelated existing branch', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-existing-branch-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')
      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-existing', {
        sourceSessionId: 'sess-0',
      })
      if (!created.ok)
        throw new Error(created.error)
      await runGit(repo, ['branch', 'existing-target'])

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-existing',
        branch_name: 'existing-target',
      })

      expect(result).toEqual({
        ok: false,
        error: '本地分支已存在且不属于当前工作树，为避免覆盖其提交而拒绝检出：existing-target',
      })
      expect(await runGit(repo, ['branch', '--show-current'])).toBe('main')
      expect(await runGit(created.binding.worktreePath, ['rev-parse', 'HEAD'])).toBe(await runGit(repo, ['rev-parse', 'main']))
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('checkoutToLocal rejects unsupported worktree changes without deleting them', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-dirty-reject-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const worktreesRoot = join(rootDir, 'worktrees')
      const created = await ensureWorktree({}, worktreesRoot, repo, 'sess-dirty', {
        sourceSessionId: 'sess-0',
      })
      if (!created.ok)
        throw new Error(created.error)
      const wt = created.binding.worktreePath
      await writeFile(join(wt, 'keep.txt'), 'unstaged\n')
      await writeFile(join(wt, 'untracked.txt'), 'untracked\n')

      const result = await checkoutToLocal({}, worktreesRoot, {
        sessionId: 'sess-dirty',
        branch_name: 'dsh/dirty-feature',
      }, { carryStaged: true })

      expect(result.ok).toBe(false)
      if (result.ok)
        throw new Error('expected checkout failure')
      expect(result.error).toContain('未暂存或未跟踪改动')
      expect(await readFile(join(wt, 'keep.txt'), 'utf8')).toBe('unstaged\n')
      expect(await readFile(join(wt, 'untracked.txt'), 'utf8')).toBe('untracked\n')
      expect(await runGit(repo, ['branch', '--show-current'])).toBe('main')
      await expect(runGit(repo, ['rev-parse', '--verify', 'refs/heads/dsh/dirty-feature'])).rejects.toThrow()
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

  it('checkoutToLocal refuses to discard staged work when carryStaged is disabled', async () => {
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

      expect(result).toEqual({
        ok: false,
        error: '隔离工作树存在已暂存改动；请启用 carry_staged 或先提交这些改动再检出',
      })
      expect(await runGit(repo, ['branch', '--show-current'])).toBe('main')
      expect(await runGit(repo, ['status', '--short'])).toBe('')
      expect(await readFile(join(wt, 'a.txt'), 'utf8')).toBe('v9-staged\n')
      expect(await runGit(wt, ['diff', '--cached', '--name-only'])).toBe('a.txt')
      await expect(runGit(repo, ['rev-parse', '--verify', 'refs/heads/dsh/feature-y'])).rejects.toThrow()
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})

/** 最小宿主 ctx：只提供 status/create 路由用到的 sessions/workspaceRegistry 面。 */
function hostCtx(sessions: Record<string, unknown>): any {
  return {
    sessions: {
      get: (id: string) => sessions[id],
      list: () => Object.values(sessions),
    },
    workspaceRegistry: {
      resolveByPath: async () => undefined,
    },
  }
}

/** 可发出事件（data/end）的假请求，供 routeHandler 读取 body。 */
function fakeReq(overrides: Record<string, unknown>, body?: unknown): any {
  const listeners = new Map<string, Array<(...args: any[]) => void>>()
  const req: any = {
    method: 'GET',
    url: '/',
    socket: { remoteAddress: '127.0.0.1' },
    on: (event: string, fn: (...args: any[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn])
      return req
    },
    ...overrides,
  }
  queueMicrotask(() => {
    if (body !== undefined) {
      for (const fn of listeners.get('data') ?? []) fn(Buffer.from(JSON.stringify(body)))
    }
    for (const fn of listeners.get('end') ?? []) fn()
  })
  return req
}

/** 捕获 writeHead/end 的假响应。 */
function fakeRes(): any {
  const res: any = {}
  res.writeHead = (code: number) => {
    res.code = code
  }
  res.end = (payload?: string) => {
    res.payload = payload
  }
  return res
}

describe('dsh-tauri-worktree status/create routes', () => {
  it('/status returns isGit: null for an unresolved session instead of guessing from process.cwd()', async () => {
    const routes = buildRoutes(hostCtx({}), { worktreesRoot: join(tmpdir(), 'wt-status-unknown') })
    const status = routes.find(route => route.path === '/api/dsh-worktree/status')!
    const res = fakeRes()
    await status.handler(fakeReq({ url: '/api/dsh-worktree/status?sessionId=ghost' }), res)
    expect(res.code).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ mode: 'local', projectPath: '', isGit: null })
  })

  it('/status reports isGit: true for a known session inside a git repository', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'wt-status-git-'))
    try {
      const repo = await makeRepo(join(rootDir, 'repo'))
      const routes = buildRoutes(hostCtx({ 'sess-1': { header: { cwd: repo } } }), {
        worktreesRoot: join(rootDir, 'worktrees'),
      })
      const status = routes.find(route => route.path === '/api/dsh-worktree/status')!
      const res = fakeRes()
      await status.handler(fakeReq({ url: '/api/dsh-worktree/status?sessionId=sess-1' }), res)
      expect(res.code).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.mode).toBe('local')
      expect(body.isGit).toBe(true)
      expect(body.projectPath).toBe(repo)
    }
    finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('/create rejects when the source session directory cannot be resolved', async () => {
    const routes = buildRoutes(hostCtx({}), { worktreesRoot: join(tmpdir(), 'wt-create-unknown') })
    const create = routes.find(route => route.path === '/api/dsh-worktree/create')!
    const res = fakeRes()
    await create.handler(fakeReq({ method: 'POST' }, { sessionId: 'ghost' }), res)
    expect(res.code).toBe(400)
    expect(JSON.parse(res.payload).error).toContain('无法解析会话工作目录')
  })
})
