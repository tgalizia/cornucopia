import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [16, 21, 28, 255]
const ACCENT = [62, 224, 160, 255]
const INK = [232, 238, 246, 255]
const BG_HEX = '#10151c'
const ACCENT_HEX = '#3ee0a0'
const INK_HEX = '#e8eef6'
const MUTED_HEX = '#8e9aab'

const CHEVRON = [[34, 34], [78, 64], [34, 94]]
const STROKE = 16
const CURSOR = { x: 92, y: 48, w: 14, h: 32, rx: 2 }

function inRoundRect(u, v, radius) {
  const x = Math.min(Math.max(u, radius), 1 - radius)
  const y = Math.min(Math.max(v, radius), 1 - radius)
  return Math.hypot(u - x, v - y) <= radius
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function inChevron(x, y) {
  const half = STROKE / 2
  for (let i = 0; i < CHEVRON.length - 1; i += 1) {
    const a = CHEVRON[i]
    const b = CHEVRON[i + 1]
    if (distToSegment(x, y, a[0], a[1], b[0], b[1]) <= half) return true
  }
  return false
}

function inCursor(x, y) {
  const { x: left, y: top, w, h, rx } = CURSOR
  if (x < left || x > left + w || y < top || y > top + h) return false
  const cx = Math.min(Math.max(x, left + rx), left + w - rx)
  const cy = Math.min(Math.max(y, top + rx), top + h - rx)
  return Math.hypot(x - cx, y - cy) <= rx
}

function sample(u, v) {
  if (!inRoundRect(u, v, 22 / 128)) return [0, 0, 0, 0]
  const x = u * 128
  const y = v * 128
  if (inCursor(x, y)) return INK
  if (inChevron(x, y)) return ACCENT
  return BG
}

function markSvg() {
  const points = CHEVRON.map((point) => point.join(',')).join(' ')
  return `<polyline points="${points}" fill="none" stroke="${ACCENT_HEX}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${CURSOR.x}" y="${CURSOR.y}" width="${CURSOR.w}" height="${CURSOR.h}" rx="${CURSOR.rx}" fill="${INK_HEX}"/>`
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Cornucopia">
  <rect width="128" height="128" rx="22" fill="${BG_HEX}"/>
  ${markSvg()}
</svg>
`
}

function raster(size) {
  const scale = 4
  const big = size * scale
  const samples = scale * scale
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const u = (x * scale + sx + 0.5) / big
          const v = (y * scale + sy + 0.5) / big
          const pixel = sample(u, v)
          r += pixel[0]
          g += pixel[1]
          b += pixel[2]
          a += pixel[3]
        }
      }
      const offset = (y * size + x) * 4
      out[offset] = Math.round(r / samples)
      out[offset + 1] = Math.round(g / samples)
      out[offset + 2] = Math.round(b / samples)
      out[offset + 3] = Math.round(a / samples)
    }
  }
  return out
}

function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" role="img" aria-label="Cornucopia">
  <rect width="480" height="160" rx="22" fill="${BG_HEX}"/>
  <g transform="translate(16 16)">
    <rect width="128" height="128" rx="22" fill="#1a212c"/>
    ${markSvg()}
  </g>
  <text x="168" y="78" fill="${INK_HEX}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="42" font-weight="600" letter-spacing="-0.04em">Cornucopia</text>
  <text x="168" y="108" fill="${MUTED_HEX}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="16" letter-spacing="0.04em">local developer tools</text>
</svg>
`
}

export async function renderIcons(dir = 'icons') {
  await mkdir(dir, { recursive: true })
  await mkdir('assets', { recursive: true })
  for (const size of [16, 32, 48, 128]) {
    await writeFile(path.join(dir, `icon${size}.png`), encodePng(size, size, raster(size)))
  }
  await writeFile('assets/icon.svg', iconSvg())
  await writeFile('assets/logo.svg', logoSvg())
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await renderIcons()
}
