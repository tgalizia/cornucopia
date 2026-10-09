import { describe, expect, it } from 'vitest'
import { CSS_NAMED_COLORS } from '../src/shared/color-names.js'
import {
  contrastGrade,
  contrastRatio,
  describeColor,
  formatContrast,
  nearestColorName,
  toHex,
} from '../src/shared/color.js'

const KNOWN = {
  aliceblue: '#f0f8ff',
  aqua: '#00ffff',
  black: '#000000',
  fuchsia: '#ff00ff',
  gray: '#808080',
  lightgoldenrodyellow: '#fafad2',
  mediumspringgreen: '#00fa9a',
  rebeccapurple: '#663399',
  red: '#ff0000',
  white: '#ffffff',
  yellowgreen: '#9acd32',
}

describe('named colors', () => {
  it('lists the opaque CSS color keywords once', () => {
    const names = CSS_NAMED_COLORS.map((color) => color.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('transparent')
    expect(names).toHaveLength(148)
    for (const color of CSS_NAMED_COLORS) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('keeps the published hex values', () => {
    for (const [name, hex] of Object.entries(KNOWN)) {
      expect(CSS_NAMED_COLORS.find((color) => color.name === name)?.hex).toBe(hex)
    }
  })
})

describe('nearestColorName', () => {
  it('returns the exact CSS name', () => {
    expect(nearestColorName(255, 0, 0)).toBe('red')
    expect(nearestColorName(0, 0, 0)).toBe('black')
    expect(nearestColorName(255, 255, 255)).toBe('white')
    expect(nearestColorName(102, 51, 153)).toBe('rebeccapurple')
  })

  it('prefers the first spelling when two names share a color', () => {
    expect(nearestColorName(0, 255, 255)).toBe('aqua')
    expect(nearestColorName(128, 128, 128)).toBe('gray')
    expect(nearestColorName(255, 0, 255)).toBe('fuchsia')
  })
})

describe('describeColor', () => {
  it('formats hex, rgb, and a name', () => {
    expect(describeColor(255, 0, 0)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      hex: '#ff0000',
      rgb: 'rgb(255, 0, 0)',
      name: 'red',
    })
    expect(toHex(1.2, 2.6, 3)).toBe('#010303')
  })
})

describe('contrast', () => {
  it('rates black on white as AAA', () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })
    expect(ratio).toBeCloseTo(21, 5)
    expect(formatContrast(ratio)).toBe('21.00')
    expect(contrastGrade(ratio)).toBe('AAA')
    expect(contrastGrade(4.5)).toBe('AA')
    expect(contrastGrade(3)).toBe('AA large')
    expect(contrastGrade(2)).toBe('Fail')
  })
})
