import { describe, expect, it } from 'vitest'
import { placeDetachedPopup } from '../src/shared/popup-bounds.js'

const popup = { width: 320, height: 560 }

describe('placeDetachedPopup', () => {
  it('sits inside the anchor window, inset from the top-right', () => {
    expect(placeDetachedPopup({ left: 100, top: 40, width: 1200, height: 800 }, popup)).toEqual({
      left: 964,
      top: 88,
    })
  })

  it('keeps a window on a display to the left of the origin', () => {
    expect(placeDetachedPopup({ left: -1600, top: -200, width: 1400, height: 900 }, popup)).toEqual({
      left: -536,
      top: -152,
    })
  })

  it('pins to the anchor origin when the window is smaller than the popup', () => {
    expect(placeDetachedPopup({ left: 40, top: 80, width: 200, height: 300 }, popup)).toEqual({
      left: 40,
      top: 80,
    })
  })

  it('does not invent a position when the anchor has no bounds', () => {
    expect(placeDetachedPopup({}, popup)).toEqual({ left: 0, top: 0 })
  })
})
