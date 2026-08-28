import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESET_KEY,
  PERMISSION_PRESETS_SECTION,
  TRUST_PRESET,
} from './constants.js'
import { readPreset, upsertScalar } from './settings.js'

const SAMPLE = [
  'ui-theme:',
  '  preference: light',
  'agent-presets:',
  '  default: cordis',
  'llm-pi-ai:',
  '  providers:',
  '    zai-coding-cn:',
  '      apiKeyEnv: ZAI_CODING_CN_API_KEY',
].join('\n')

describe('readPreset', () => {
  it('reads preset from section', () => {
    expect(readPreset('permissionPresets:\n  defaultPreset: danger-full-access\n')).toBe('danger-full-access')
  })

  it('returns undefined when section absent', () => {
    expect(readPreset(SAMPLE)).toBeUndefined()
  })

  it('ignores deeper nesting', () => {
    const text = 'permissionPresets:\n  other: 1\nouter:\n    defaultPreset: danger-full-access\n'
    expect(readPreset(text)).toBeUndefined()
  })
})

describe('upsertScalar', () => {
  it('appends section when missing and preserves content', () => {
    const out = upsertScalar(SAMPLE, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, TRUST_PRESET)
    expect(out.startsWith(SAMPLE)).toBe(true)
    expect(out).toContain('permissionPresets:\n  defaultPreset: danger-full-access\n')
  })

  it('replaces existing key in place', () => {
    const text = 'ui-theme:\n  preference: light\npermissionPresets:\n  defaultPreset: workspace-write\n'
    const out = upsertScalar(text, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, TRUST_PRESET)
    expect(out).toContain('  defaultPreset: danger-full-access')
    expect(out).not.toContain('workspace-write')
    expect(out.startsWith('ui-theme:\n  preference: light\npermissionPresets:\n')).toBe(true)
  })

  it('inserts into existing section end', () => {
    const text = 'permissionPresets:\n  other: 1\nui-theme:\n  preference: light\n'
    const out = upsertScalar(text, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, TRUST_PRESET)
    expect(out).toBe('permissionPresets:\n  other: 1\n  defaultPreset: danger-full-access\nui-theme:\n  preference: light\n')
  })

  it('is idempotent', () => {
    const once = upsertScalar(SAMPLE, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, TRUST_PRESET)
    const twice = upsertScalar(once, PERMISSION_PRESETS_SECTION, DEFAULT_PRESET_KEY, TRUST_PRESET)
    expect(once).toBe(twice)
  })
})
