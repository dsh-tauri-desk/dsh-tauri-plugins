import type { SkillRow } from './routes.ts'
import type { SkillRootEntry } from './state.ts'
import type { HostSkill } from './types.ts'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { API_PREFIX } from './constants.ts'
import { mountPanelExtensionRoutes, repositoryForSkill, sortSkillRows, toSkillRow } from './routes.ts'

const invocation = { modelInvocable: true, userInvocable: true }

function skill(name: string, path: string): HostSkill {
  return {
    name,
    description: name,
    invocation,
    source: 'custom',
    provider: 'filesystem',
    resourceBase: { kind: 'directory', path },
  }
}

describe('skill repository metadata', () => {
  const checkout = join('tmp', 'dsh-tauri-panel-extension', 'repos', 'git-one', 'repo')
  const entry: SkillRootEntry = {
    id: 'git-one',
    kind: 'git',
    label: 'owner/repo',
    url: 'https://github.com/owner/repo',
    roots: [checkout],
    materialDir: join('tmp', 'dsh-tauri-panel-extension', 'repos', 'git-one'),
    addedAt: 1,
  }

  it('exposes stable registration and clickable GitHub metadata', () => {
    expect(repositoryForSkill(skill('repo-skill', join(checkout, 'repo-skill')), [entry])).toEqual({
      id: 'git-one',
      label: 'owner/repo',
      kind: 'git',
      githubUrl: 'https://github.com/owner/repo',
    })
  })

  it('does not match sibling paths that only share a string prefix', () => {
    expect(repositoryForSkill(skill('outside', `${checkout}-other`), [entry])).toBeUndefined()
  })

  it('sorts repository rows before other rows while preserving group order', () => {
    const ordinary = toSkillRow(skill('ordinary', join('tmp', 'ordinary')), [], undefined)
    const firstRepo = toSkillRow(skill('first-repo', join(checkout, 'first')), [entry], undefined)
    const secondRepo = toSkillRow(skill('second-repo', join(checkout, 'second')), [entry], undefined)
    const rows: SkillRow[] = [ordinary, firstRepo, secondRepo]
    expect(sortSkillRows(rows).map(row => row.name)).toEqual(['first-repo', 'second-repo', 'ordinary'])
  })
})

describe('host route namespace', () => {
  it('uses the panel extension API prefix', () => {
    expect(API_PREFIX).toBe('/dsh-tauri-panel-extension')
  })

  it('authenticates every registered route before manager logic', async () => {
    const routes: Array<{ handler: (request: any, response: any) => Promise<void> | void }> = []
    const requestRejection = vi.fn(() => 401 as const)
    const dispose = mountPanelExtensionRoutes({
      connection: { requestRejection },
      skills: {
        list: vi.fn(() => Promise.reject(new Error('must not run'))),
        get: vi.fn(() => Promise.reject(new Error('must not run'))),
      },
      webServer: {
        register: (route) => {
          routes.push(route)
          return () => {}
        },
      },
    }, {
      profileDirPath: 'unused',
      remountProvider: () => Promise.reject(new Error('must not run')),
    })
    expect(routes).toHaveLength(16)
    for (const route of routes) {
      const writeHead = vi.fn()
      const end = vi.fn()
      await route.handler({ method: 'POST' }, { writeHead, end })
      expect(writeHead).toHaveBeenCalledWith(401)
      expect(end).toHaveBeenCalledWith('unauthorized')
    }
    expect(requestRejection).toHaveBeenCalledTimes(routes.length)
    dispose()
  })
})
