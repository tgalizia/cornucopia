import { CSS_NAMED_COLORS } from './color-names.js'

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

export function toHex(r, g, b) {
  return `#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`
}

function distance(color, r, g, b) {
  return (color.r - r) ** 2 + (color.g - g) ** 2 + (color.b - b) ** 2
}

export function nearestColorName(r, g, b) {
  const red = clampByte(r)
  const green = clampByte(g)
  const blue = clampByte(b)
  let best = CSS_NAMED_COLORS[0]
  let bestDistance = distance(best, red, green, blue)
  for (let index = 1; index < CSS_NAMED_COLORS.length; index += 1) {
    const color = CSS_NAMED_COLORS[index]
    const next = distance(color, red, green, blue)
    if (next < bestDistance) {
      best = color
      bestDistance = next
    }
  }
  return best.name
}

export function describeColor(r, g, b) {
  const red = clampByte(r)
  const green = clampByte(g)
  const blue = clampByte(b)
  return {
    r: red,
    g: green,
    b: blue,
    hex: toHex(red, green, blue),
    rgb: `rgb(${red}, ${green}, ${blue})`,
    name: nearestColorName(red, green, blue),
  }
}

function channel(value) {
  const srgb = clampByte(value) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

function luminance(color) {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

export function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

export function formatContrast(ratio) {
  return ratio.toFixed(2)
}

export function contrastGrade(ratio) {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA large'
  return 'Fail'
}
