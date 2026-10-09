import { describe, expect, it } from 'vitest'
import { parseDocsFont } from '../src/shared/docs-font.js'
import { fontCss } from '../src/shared/typography.js'
import { pageAccessError } from '../src/shared/page.js'
import { clearRemoval, pendingClearRecord, readPendingClear } from '../src/tools/clear-data/index.js'
import { formatEdges, formatPx, rectFromPoints } from '../src/tools/measure/geometry.js'
import { getPageTool, tools } from '../src/tools/registry.js'
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
    expect(pageAccessError('')).toBe("This page can't be inspected.")
    expect(pageAccessError('not a url')).toBe("This page can't be inspected.")
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

describe('registry', () => {
  it('registers each tool once', () => {
    expect(tools.map((tool) => tool.id)).toEqual([
      'typography',
      'color',
      'measure',
      'grid',
      'viewport',
      'clear-data',
    ])
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length)
    expect(getPageTool('typography')?.mount).toBeTypeOf('function')
    expect(getPageTool('viewport')).toBeNull()
    expect(tools.filter((tool) => tool.kind === 'page').every((tool) => typeof tool.mount === 'function')).toBe(true)
  })
})
