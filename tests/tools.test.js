import { describe, expect, it } from 'vitest'
import { parseDocsFont } from '../src/shared/docs-font.js'
import { fontCss } from '../src/shared/typography.js'
import { pageAccessError, toolbarState } from '../src/shared/page.js'
import { clearRemoval, pendingClearRecord, readPendingClear } from '../src/tools/clear-data/index.js'
import { formatEdges, formatPx, rectFromPoints } from '../src/tools/measure/geometry.js'
import { getPageTool, tools } from '../src/tools/registry.js'
import {
  assignTitle,
  claimTitle,
  nextLockState,
  normalizeTabTitle,
  pendingRenameRecord,
  readPendingRename,
  readTitleRecords,
  removeByTab,
  retargetTab,
  shouldDropTitle,
  validMarker,
} from '../src/tools/rename/title.js'
import { gridMetrics, gridSizeControl, parseGridSize } from '../src/tools/grid/size.js'

describe('fontCss', () => {
  it('writes a font shorthand and color', () => {
    expect(fontCss({
      family: 'Georgia, serif',
      size: '16px',
      weight: '700',
      style: 'italic',
      lineHeight: '24px',
      color: 'rgb(0, 0, 0)',
    })).toBe('font: italic 700 16px/24px Georgia, serif;\ncolor: rgb(0, 0, 0);')
  })

  it('omits normal weight, style, and line-height', () => {
    expect(fontCss({
      family: 'Georgia, serif',
      size: '18px',
      weight: '400',
      style: 'normal',
      lineHeight: 'normal',
      color: 'rgb(0, 0, 0)',
    })).toBe('font: 18px Georgia, serif;\ncolor: rgb(0, 0, 0);')
  })

  it('quotes a family with spaces and skips unknown docs fields', () => {
    expect(fontCss(parseDocsFont("italic 700 14.6667px 'Courier New'"))).toBe(
      "font: italic 700 14.6667px 'Courier New';",
    )
    expect(fontCss({
      family: 'Comic Sans MS',
      size: '11pt',
      weight: '400',
      style: 'normal',
      lineHeight: '—',
      color: '—',
    })).toBe("font: 11pt 'Comic Sans MS';")
  })
})

describe('parseDocsFont', () => {
  it('reads the canvas font shorthand', () => {
    expect(parseDocsFont("400 14.6667px 'Courier New'")).toMatchObject({
      style: 'normal',
      weight: '400',
      size: '14.6667px',
      family: "'Courier New'",
      lineHeight: '—',
    })
    expect(parseDocsFont('italic 700 16px/24px Arial, sans-serif')).toMatchObject({
      style: 'italic',
      weight: '700',
      size: '16px',
      lineHeight: '24px',
      family: 'Arial, sans-serif',
    })
    expect(parseDocsFont('')).toBeNull()
    expect(parseDocsFont('not a font')).toBeNull()
  })
})

describe('pageAccessError', () => {
  it('allows http and https only', () => {
    expect(pageAccessError('https://example.com/docs')).toBeNull()
    expect(pageAccessError('http://localhost:3000/')).toBeNull()
    expect(pageAccessError('chrome://extensions')).toBe("This page can't be inspected.")
    expect(pageAccessError('https://chromewebstore.google.com/detail/abc')).toBe("This page can't be inspected.")
    expect(pageAccessError('https://chrome.google.com/webstore/detail/abc')).toBe("This page can't be inspected.")
    expect(pageAccessError('https://chrome.google.com/')).toBeNull()
    expect(pageAccessError('')).toBe("This page can't be inspected.")
    expect(pageAccessError('not a url')).toBe("This page can't be inspected.")
  })
})

describe('toolbarState', () => {
  it('greys out pages that cannot be inspected', () => {
    const blocked = { enabled: false, title: "This page can't be inspected." }
    expect(toolbarState('chrome://extensions')).toEqual(blocked)
    expect(toolbarState('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/popup.html')).toEqual(blocked)
    expect(toolbarState('about:blank')).toEqual(blocked)
    expect(toolbarState('https://chromewebstore.google.com/detail/abc')).toEqual(blocked)
    expect(toolbarState('')).toEqual(blocked)
  })

  it('leaves the button unchanged until a tab has an address', () => {
    expect(toolbarState(undefined)).toBeNull()
    expect(toolbarState(null)).toBeNull()
  })

  it('enables http and https', () => {
    expect(toolbarState('https://example.com/docs')).toEqual({ enabled: true, title: 'Cornucopia' })
    expect(toolbarState('http://localhost:3000/')).toEqual({ enabled: true, title: 'Cornucopia' })
  })
})

describe('clearRemoval', () => {
  it('clears cookies and cache storage for one origin', () => {
    expect(clearRemoval('https://example.com')).toEqual({
      options: { origins: ['https://example.com'] },
      dataTypes: { cookies: true, cacheStorage: true },
    })
  })

  it('keeps a pending clear only for a couple of minutes', () => {
    const now = 1_000_000
    expect(readPendingClear(pendingClearRecord(12, 34, now), now)).toEqual({
      tabId: 12,
      grantTabId: 34,
    })
    expect(readPendingClear(pendingClearRecord(12, null, now), now).grantTabId).toBeNull()
    expect(readPendingClear({ tabId: 12, at: now - (2 * 60 * 1000) - 1 }, now)).toBeNull()
    expect(readPendingClear(null, now)).toBeNull()
    expect(readPendingClear({ at: now }, now)).toBeNull()
  })
})

describe('measure geometry', () => {
  it('formats edges and dragged rectangles', () => {
    expect(formatPx(12)).toBe('12')
    expect(formatPx(12.5)).toBe('12.5')
    expect(formatEdges([8, 8, 8, 8])).toBe('8')
    expect(formatEdges([8, 16, 8, 16])).toBe('8 16 8 16')
    expect(rectFromPoints(40, 10, 10, 30)).toEqual({ left: 10, top: 10, width: 30, height: 20 })
  })
})

describe('grid size', () => {
  it('accepts a pixel size and keeps a major line every 8 steps', () => {
    expect(parseGridSize('8')).toBe(8)
    expect(parseGridSize(' 12px ')).toBe(12)
    expect(parseGridSize('0')).toBe(1)
    expect(parseGridSize('129')).toBe(128)
    expect(parseGridSize('500')).toBe(128)
    expect(parseGridSize('8.5')).toBeNull()
    expect(parseGridSize('')).toBeNull()
    expect(gridMetrics(8)).toEqual({ step: 8, major: 64 })
    expect(gridMetrics(4)).toEqual({ step: 4, major: 32 })
    expect(gridSizeControl(16)).toEqual({ preset: '16', custom: '' })
    expect(gridSizeControl(10)).toEqual({ preset: null, custom: '10' })
  })
})

describe('tab titles', () => {
  const first = '11111111-1111-4111-8111-111111111111'
  const second = '22222222-2222-4222-8222-222222222222'

  it('normalizes a name and treats a blank one as restore', () => {
    expect(normalizeTabTitle('  Notes   today  ')).toBe('Notes today')
    expect(normalizeTabTitle('\n\t')).toBe('')
    expect(normalizeTabTitle(null)).toBe('')
    expect(normalizeTabTitle('a'.repeat(400))).toHaveLength(300)
    expect(validMarker(first)).toBe(first)
    expect(validMarker('not-an-id')).toBeNull()
    expect(validMarker('../secrets')).toBeNull()
  })

  it('keeps one name per tab and follows a replaced tab', () => {
    let records = assignTitle({}, { id: first, tabId: 1, title: '  Notes  ' })
    records = assignTitle(records, { id: second, tabId: 1, title: 'Other' })
    expect(records).toEqual({ [second]: { title: 'Other', tabId: 1 } })
    records = retargetTab(records, 1, 9)
    expect(records[second].tabId).toBe(9)
    expect(removeByTab(records, 9)).toEqual({})
    expect(readTitleRecords({
      [first]: { title: ' Kept ', tabId: 3 },
      nope: { title: 'Dropped', tabId: 4 },
      [second]: { title: '   ', tabId: 5 },
    })).toEqual({ [first]: { title: 'Kept', tabId: 3 } })
  })

  it('copies a name when a second live tab has the same marker', () => {
    const records = assignTitle({}, { id: first, tabId: 1, title: 'Notes' })
    const copied = claimTitle(records, { id: first, tabId: 2, liveTabIds: new Set([1]) }, () => second)
    expect(copied.copied).toBe(true)
    expect(copied.id).toBe(second)
    expect(copied.title).toBe('Notes')
    expect(copied.records[first]).toEqual({ title: 'Notes', tabId: 1 })
    expect(copied.records[second]).toEqual({ title: 'Notes', tabId: 2 })
  })

  it('reuses a name for a restored tab and hands it across origins', () => {
    const records = assignTitle({}, { id: first, tabId: 1, title: 'Notes' })
    const restored = claimTitle(records, { id: first, tabId: 4, liveTabIds: new Set() })
    expect(restored.copied).toBe(false)
    expect(restored.id).toBe(first)
    expect(restored.records[first]).toEqual({ title: 'Notes', tabId: 4 })
    const moved = claimTitle(records, { id: null, tabId: 1, liveTabIds: new Set() })
    expect(moved).toMatchObject({ id: first, title: 'Notes', copied: false, records })
  })

  it('holds the custom name when the page changes the title', () => {
    const applied = nextLockState(
      { custom: null, pageTitle: '' },
      { type: 'apply', title: ' Notes ', current: 'Inbox' },
    )
    expect(applied).toEqual({ custom: 'Notes', pageTitle: 'Inbox', show: 'Notes' })
    const held = nextLockState(applied, { type: 'page', title: 'Inbox (1)' })
    expect(held).toEqual({ custom: 'Notes', pageTitle: 'Inbox (1)', show: 'Notes' })
    expect(nextLockState(held, { type: 'page', title: 'Notes' })).toEqual(held)
    expect(nextLockState(held, { type: 'restore' })).toEqual({
      custom: null,
      pageTitle: 'Inbox (1)',
      show: 'Inbox (1)',
    })
    expect(nextLockState(applied, { type: 'apply', title: '   ' })).toEqual({
      custom: null,
      pageTitle: 'Inbox',
      show: 'Inbox',
    })
  })

  it('drops a closed tab and keeps names when the last window closes', () => {
    expect(shouldDropTitle(false, 2)).toBe(true)
    expect(shouldDropTitle(true, 2)).toBe(true)
    expect(shouldDropTitle(true, 1)).toBe(false)
    expect(shouldDropTitle(true, 0)).toBe(false)
  })

  it('forgets a pending rename after a couple of minutes', () => {
    const now = 1_000_000
    expect(readPendingRename(pendingRenameRecord(12, '  Notes ', 34, now), now)).toEqual({
      tabId: 12,
      title: 'Notes',
      grantTabId: 34,
    })
    expect(readPendingRename(pendingRenameRecord(12, 'Notes', null, now), now).grantTabId).toBeNull()
    expect(readPendingRename(pendingRenameRecord(12, '   ', 34, now), now)).toBeNull()
    expect(readPendingRename({ tabId: 12, title: 'Notes', at: now - (2 * 60 * 1000) - 1 }, now)).toBeNull()
    expect(readPendingRename(null, now)).toBeNull()
  })
})

describe('registry', () => {
  it('registers each tool once', () => {
    expect(tools.map((tool) => tool.id)).toEqual([
      'typography',
      'color',
      'measure',
      'grid',
      'viewport',
      'rename',
      'clear-data',
    ])
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length)
    expect(getPageTool('typography')?.mount).toBeTypeOf('function')
    expect(getPageTool('viewport')).toBeNull()
    expect(tools.filter((tool) => tool.kind === 'page').every((tool) => typeof tool.mount === 'function')).toBe(true)
  })
})
