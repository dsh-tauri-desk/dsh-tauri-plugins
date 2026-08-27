import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { packagedSkillsDir } from './index'

describe('packaged skills', () => {
  it('ships the skill creator used by the New Skill action', () => {
    expect(existsSync(join(packagedSkillsDir(), 'skill-creator', 'SKILL.md'))).toBe(true)
  })

  it('ships the companion skill discovery helper', () => {
    expect(existsSync(join(packagedSkillsDir(), 'find-skills', 'SKILL.md'))).toBe(true)
  })
})
