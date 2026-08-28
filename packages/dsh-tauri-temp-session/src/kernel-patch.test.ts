import { describe, expect, it } from 'vitest'
import { CONVERSATION_PATCH } from './constants'
import { applyConversationPatch } from './kernel-patch'

/** 与上游压缩源同构的最小样例（含完整 `from` 片段）。 */
const UPSTREAM_SNIPPET
  = 'var chipTitle=(workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd));return chipTitle'

describe('applyConversationPatch', () => {
  it('patches fresh content and embeds the mark', () => {
    const result = applyConversationPatch(UPSTREAM_SNIPPET, CONVERSATION_PATCH)
    expect(result.status).toBe('patched')
    expect(result.content).toContain(CONVERSATION_PATCH.mark)
    expect(result.content).not.toContain('workspaces.phase === "ready"')
    expect(result.content).toContain('workspaceLabel(cwd)')
  })

  it('is idempotent when the current mark is present', () => {
    const once = applyConversationPatch(UPSTREAM_SNIPPET, CONVERSATION_PATCH)
    const twice = applyConversationPatch(once.content, CONVERSATION_PATCH)
    expect(twice.status).toBe('already')
    expect(twice.content).toBe(once.content)
  })

  it('treats the legacy standalone-plugin mark as already patched', () => {
    const legacyMark = CONVERSATION_PATCH.legacyMark ?? ''
    const legacyPatched = UPSTREAM_SNIPPET.replace('(workspaces.phase === "ready" || ', `(${legacyMark} `)
    expect(legacyPatched).not.toContain(CONVERSATION_PATCH.mark)
    const result = applyConversationPatch(legacyPatched, CONVERSATION_PATCH)
    expect(result.status).toBe('already')
    expect(result.content).toBe(legacyPatched)
  })

  it('reports drift when the target text is missing', () => {
    const upstream = 'var somethingElse = 1'
    const result = applyConversationPatch(upstream, CONVERSATION_PATCH)
    expect(result.status).toBe('drifted')
    expect(result.content).toBe(upstream)
  })
})
