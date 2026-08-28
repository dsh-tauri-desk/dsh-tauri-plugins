import { afterEach, describe, expect, it } from 'vitest'
import { safeSessionDirectory } from './session-delete'

const DSH_HOME = 'C:\\Users\\tester\\.dsh'
const SESSIONS = `${DSH_HOME}\\sessions`

function location(path: string): { kind: string, path: string } {
  return { kind: 'jsonl', path }
}

/** jsonl 会话目录内的会话文件路径。 */
function sessionFile(sessionId: string): string {
  return `${SESSIONS}\\${sessionId}\\${sessionId}.jsonl`
}

describe('safeSessionDirectory', () => {
  const previous = process.env.DSH_HOME

  afterEach(() => {
    if (previous === undefined)
      delete process.env.DSH_HOME
    else
      process.env.DSH_HOME = previous
  })

  it('accepts the exact session directory under DSH_HOME/sessions', () => {
    process.env.DSH_HOME = DSH_HOME
    const sessionDir = `${SESSIONS}\\abc123`
    expect(safeSessionDirectory(location(sessionFile('abc123')), 'abc123')).toBe(sessionDir)
  })

  it('rejects a directory outside DSH_HOME/sessions', () => {
    process.env.DSH_HOME = DSH_HOME
    expect(() => safeSessionDirectory(location('C:\\Users\\tester\\other\\file.jsonl'), 'abc123'))
      .toThrow(/unsafe session directory/)
  })

  it('rejects a parent directory of the sessions root', () => {
    process.env.DSH_HOME = DSH_HOME
    expect(() => safeSessionDirectory(location(`${DSH_HOME}\\file.jsonl`), 'abc123'))
      .toThrow(/unsafe session directory/)
  })

  it('rejects when the directory basename differs from the session id', () => {
    process.env.DSH_HOME = DSH_HOME
    expect(() => safeSessionDirectory(location(sessionFile('other')), 'abc123'))
      .toThrow(/unsafe session directory/)
  })

  it('rejects when DSH_HOME is unavailable', () => {
    delete process.env.DSH_HOME
    expect(() => safeSessionDirectory(location(sessionFile('abc123')), 'abc123'))
      .toThrow(/DSH_HOME/)
  })
})
