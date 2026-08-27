import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { loadFilesystemSkillPlugin, packagedSkillsDir } from './index'

describe('packaged skills', () => {
  it('declares the filesystem provider platform dependency', () => {
    const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..')
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    expect(manifest.dependencies?.['@deepseek-ai/dsh-skill-filesystem']).toBeTruthy()
  })

  it('loads the provider through the DSH platform loader', async () => {
    const plugin = { name: 'skill-filesystem', apply: vi.fn() }
    const importPlugin = vi.fn().mockResolvedValue({ default: plugin })
    const unwrapExports = vi.fn(module => (module as { default: unknown }).default)

    await expect(loadFilesystemSkillPlugin({ import: importPlugin, unwrapExports })).resolves.toBe(plugin)
    expect(importPlugin).toHaveBeenCalledWith('@deepseek-ai/dsh-skill-filesystem')
  })

  it('ships the skill creator used by the New Skill action', () => {
    expect(existsSync(join(packagedSkillsDir(), 'skill-creator', 'SKILL.md'))).toBe(true)
  })

  it('ships the companion skill discovery helper', () => {
    expect(existsSync(join(packagedSkillsDir(), 'find-skills', 'SKILL.md'))).toBe(true)
  })
})
