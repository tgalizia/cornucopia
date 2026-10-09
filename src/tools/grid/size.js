export const GRID_PRESETS = [4, 8, 12, 16]
export const DEFAULT_GRID_SIZE = 8
export const GRID_MAJOR_STEPS = 8
export const GRID_SIZE_MIN = 1
export const GRID_SIZE_MAX = 128

export function parseGridSize(value) {
  const text = String(value ?? '').trim().toLowerCase().replace(/px$/, '').trim()
  if (!/^\d+$/.test(text)) return null
  const size = Number(text)
  if (size < GRID_SIZE_MIN) return GRID_SIZE_MIN
  if (size > GRID_SIZE_MAX) return GRID_SIZE_MAX
  return size
}

export function gridMetrics(step) {
  return { step, major: step * GRID_MAJOR_STEPS }
}

export function gridSizeControl(step) {
  if (GRID_PRESETS.includes(step)) return { preset: String(step), custom: '' }
  return { preset: null, custom: String(step) }
}
