import { describe, expect, it } from 'vitest'
import { parseViewportInput, restorePlan, viewportResizeBlock, windowSizeForViewport } from '../src/shared/viewport.js'
import { pixelOffset } from '../src/shared/sample.js'

describe('windowSizeForViewport', () => {
  it('adds the browser frame to the requested viewport', () => {
    expect(windowSizeForViewport(
      { width: 1200, height: 900 },
      { width: 1000, height: 800 },
      { width: 375, height: 700 },
    )).toEqual({ width: 575, height: 800 })
  })
})

describe('parseViewportInput', () => {
  it('accepts integers in range', () => {
    expect(parseViewportInput('375', ' 800 ')).toEqual({ width: 375, height: 800 })
    expect(parseViewportInput(1440, 900)).toEqual({ width: 1440, height: 900 })
  })

  it('rejects partial, tiny, and huge sizes', () => {
    expect(parseViewportInput('', '800')).toBeNull()
    expect(parseViewportInput('375.5', '800')).toBeNull()
    expect(parseViewportInput(199, 800)).toBeNull()
    expect(parseViewportInput(800, 7681)).toBeNull()
  })
})

describe('restorePlan', () => {
  it('remaximizes a window that started maximized, with bounds if that is ignored', () => {
    expect(restorePlan({ state: 'maximized', width: 1400, height: 900, left: 0, top: 25 })).toEqual({
      update: { state: 'maximized' },
      bounds: { state: 'normal', width: 1400, height: 900, left: 0, top: 25 },
    })
    expect(restorePlan({ state: 'minimized', width: 800, height: 600 }).update).toEqual({ state: 'minimized' })
  })

  it('restores a normal window size and position', () => {
    expect(restorePlan({ state: 'normal', width: 1100.2, height: 800.4, left: 12.6, top: 40 })).toEqual({
      update: {
        state: 'normal',
        width: 1100,
        height: 800,
        left: 13,
        top: 40,
      },
      bounds: null,
    })
  })
})

describe('viewportResizeBlock', () => {
  it('blocks macOS fullscreen, where Chrome cannot restore the window', () => {
    expect(viewportResizeBlock('mac', 'fullscreen')).toBe('Leave fullscreen to resize the window.')
    expect(viewportResizeBlock('mac', 'maximized')).toBeNull()
    expect(viewportResizeBlock('mac', 'normal')).toBeNull()
    expect(viewportResizeBlock('win', 'fullscreen')).toBeNull()
    expect(viewportResizeBlock('linux', 'fullscreen')).toBeNull()
  })
})

describe('pixelOffset', () => {
  it('maps viewport css pixels onto the captured bitmap', () => {
    expect(pixelOffset(10, 20, 1000, 800, 2000, 1600)).toEqual({ x: 20, y: 40 })
  })

  it('clamps the last pixel', () => {
    expect(pixelOffset(1000, 800, 1000, 800, 2000, 1600)).toEqual({ x: 1999, y: 1599 })
  })
})
