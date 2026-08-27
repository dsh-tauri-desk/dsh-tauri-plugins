import type { SkillRow } from './routes.ts'
import type { SkillRootEntry } from './state.ts'
import type { HostSkill } from './types.ts'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { API_PREFIX } from './constants.ts'
import { repositoryForSkill, sortSkillRows, toSkillRow } from './routes.ts'

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
})
