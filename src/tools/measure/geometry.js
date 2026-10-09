export function formatPx(value) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

export function formatEdges(values) {
  const nums = values.map((value) => formatPx(value))
  return nums.every((value) => value === nums[0]) ? nums[0] : nums.join(' ')
}

export function rectFromPoints(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}
