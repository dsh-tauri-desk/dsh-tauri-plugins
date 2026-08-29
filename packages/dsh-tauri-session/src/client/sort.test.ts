import type { ArchiveRow } from './types'
import { describe, expect, it } from 'vitest'
import { groupArchive, rowSortValue } from './sort'

function row(partial: Partial<ArchiveRow> & { sessionId: string }): ArchiveRow {
  return {
    title: partial.sessionId,
    ...partial,
  }
}

describe('rowSortValue', () => {
  it('sorts by updated time, created time, or title', () => {
    const r = row({ sessionId: 'a', title: 'Alpha', updatedAt: 10, createdAt: 5 })
    expect(rowSortValue(r, 'updatedAt')).toBe(10)
    expect(rowSortValue(r, 'createdAt')).toBe(5)
    expect(rowSortValue(r, 'title')).toBe('alpha')
  })

  it('falls back to 0 when the sort key is absent', () => {
    const r = row({ sessionId: 'a' })
    expect(rowSortValue(r, 'updatedAt')).toBe(0)
    expect(rowSortValue(r, 'createdAt')).toBe(0)
  })
})

describe('groupArchive', () => {
  const rows: ArchiveRow[] = [
    row({ sessionId: 's1', title: '更新档案甲', workspaceId: 'w1', workspaceTitle: 'Minecraft', updatedAt: 100, createdAt: 50 }),
    row({ sessionId: 's2', title: '更新档案乙', workspaceId: 'w1', workspaceTitle: 'Minecraft', updatedAt: 200, createdAt: 40 }),
    row({ sessionId: 's3', title: '未分组档案', updatedAt: 300, createdAt: 30 }),
  ]

  it('keeps every group even when a session has no workspace (未分组)', () => {
    const groups = groupArchive(rows, 'updatedAt', '未分组')
    const ids = groups.map(g => g.id)
    expect(ids).toContain('w1')
    expect(ids).toContain('ungrouped')
  })

  it('orders groups by member recency', () => {
    // group w1 most-recent update = 200, ungrouped = 300 → ungrouped ranks first (desc).
    const groups = groupArchive(rows, 'updatedAt', '未分组')
    expect(groups[0].id).toBe('ungrouped')
    expect(groups[1].id).toBe('w1')
  })

  it('orders within a group by the sort method (updated time desc)', () => {
    const groups = groupArchive(rows, 'updatedAt', '未分组')
    const w1 = groups.find(g => g.id === 'w1')
    expect(w1?.rows.map(r => r.sessionId)).toEqual(['s2', 's1'])
  })

  it('orders within a group by created time (newest first) when so chosen', () => {
    const groups = groupArchive(rows, 'createdAt', '未分组')
    const w1 = groups.find(g => g.id === 'w1')
    expect(w1?.rows.map(r => r.sessionId)).toEqual(['s1', 's2'])
  })

  it('ranks groups with no creation timestamps after dated groups', () => {
    const mixed: ArchiveRow[] = [
      ...rows,
      row({ sessionId: 'undated', title: '未标注时间', workspaceId: 'w2', workspaceTitle: 'Undated' }),
    ]
    const groups = groupArchive(mixed, 'createdAt', '未分组')
    // w2 全部成员无 createdAt → 组聚合值 0，降序时应排在最后。
    expect(groups[groups.length - 1].id).toBe('w2')
  })
})
