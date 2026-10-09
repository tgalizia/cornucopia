const MIN_VIEWPORT = 200
const MAX_VIEWPORT = 7680

export const FULLSCREEN_VIEWPORT_REASON = 'Leave fullscreen to resize the window.'

export function viewportResizeBlock(os, windowState) {
  if (os === 'mac' && windowState === 'fullscreen') return FULLSCREEN_VIEWPORT_REASON
  return null
}

export function parseViewportInput(width, height) {
  const w = typeof width === 'number' ? width : Number(String(width).trim())
  const h = typeof height === 'number' ? height : Number(String(height).trim())
  if (!Number.isInteger(w) || !Number.isInteger(h)) return null
  if (w < MIN_VIEWPORT || h < MIN_VIEWPORT || w > MAX_VIEWPORT || h > MAX_VIEWPORT) return null
  return { width: w, height: h }
}

export function windowSizeForViewport(outer, viewport, target) {
  const frameWidth = outer.width - viewport.width
  const frameHeight = outer.height - viewport.height
  return {
    width: Math.max(1, Math.round(target.width + frameWidth)),
    height: Math.max(1, Math.round(target.height + frameHeight)),
  }
}

export function restorePlan(saved) {
  const bounds = {
    state: 'normal',
    width: Math.round(saved.width),
    height: Math.round(saved.height),
  }
  if (Number.isFinite(saved.left)) bounds.left = Math.round(saved.left)
  if (Number.isFinite(saved.top)) bounds.top = Math.round(saved.top)
  if (!saved.state || saved.state === 'normal') return { update: bounds, bounds: null }
  return { update: { state: saved.state }, bounds }
}
