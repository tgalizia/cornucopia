import { copyText } from '../../shared/clipboard.js'
import { MISSING, parseDocsFont } from '../../shared/docs-font.js'
import { fontCss } from '../../shared/typography.js'
import { placeNearPointer } from '../../content/place.js'
import { mountToolbar, requestExit } from '../../content/toolbar.js'

const FIELDS = [
  ['Family', 'family'],
  ['Size', 'size'],
  ['Weight', 'weight'],
  ['Style', 'style'],
  ['Line height', 'lineHeight'],
  ['Spacing', 'letterSpacing'],
  ['Color', 'color'],
  ['Align', 'align'],
  ['Transform', 'transform'],
]

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'])

export function mountTypography(ctx) {
  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.hidden = true
  const title = document.createElement('p')
  title.className = 'tip-title'
  const list = document.createElement('dl')
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.textContent = 'Copy CSS'
  const status = document.createElement('p')
  status.className = 'tip-status'
  status.textContent = 'Click to pin'
  tip.append(title, list, status, copy)
  ctx.root.append(tip)
  mountToolbar(ctx.root, { title: 'Typography', onExit: requestExit })

  let lastKey = ''
  let currentCss = ''
  let frame = 0
  let point = null
  let pinned = false

  copy.addEventListener('click', async (event) => {
    event.stopPropagation()
    if (!currentCss) return
    const copied = await copyText(currentCss)
    copy.textContent = copied ? 'Copied' : 'Copy CSS'
  })

  const onDocs = location.hostname === 'docs.google.com' && location.pathname.startsWith('/document')

  function showEmpty(message = 'No text under the pointer') {
    if (lastKey === message) return
    lastKey = message
    currentCss = ''
    title.textContent = message
    list.replaceChildren()
    copy.hidden = true
  }

  function showStyle(style, heading = 'Text') {
    const key = `${heading}\n${JSON.stringify(style)}`
    if (key === lastKey) return
    lastKey = key
    currentCss = fontCss(style)
    title.textContent = heading
    copy.hidden = !currentCss
    copy.textContent = 'Copy CSS'
    list.replaceChildren()
    for (const [label, keyName] of FIELDS) {
      const text = style[keyName]
      if (!text || text === MISSING) continue
      const term = document.createElement('dt')
      term.textContent = label
      const value = document.createElement('dd')
      value.textContent = text
      list.append(term, value)
    }
  }

  function textElementAt(x, y) {
    const node = caretNode(x, y)
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement
    if (readableText(element)) return element
    if (!onDocs) return null
    const word = document.elementsFromPoint(x, y).find((item) => {
      return item.classList?.contains('kix-wordhtmlgenerator-word-node')
    })
    return readableText(word) ? word : null
  }

  function readableText(element) {
    if (!element || element === ctx.host || SKIPPED_TAGS.has(element.tagName)) return false
    return Boolean(element.textContent?.trim())
  }

  function update(event) {
    if (ctx.isOwnEvent(event)) return
    const x = event.clientX
    const y = event.clientY
    const rect = onDocs ? docsRectAt(x, y) : null
    const rectStyle = rect ? styleFromRect(rect) : null
    if (rectStyle) showStyle(rectStyle)
    else {
      const element = textElementAt(x, y)
      if (element) showStyle(readStyle(element))
      else if (onDocs && overDocsCanvas(x, y) && !docsHasAnnotations()) {
        const caret = docsCaretStyle()
        if (caret) showStyle(caret, 'Text cursor')
        else showEmpty('Reload this Google Doc to read fonts')
      } else showEmpty()
    }
    placeNearPointer(tip, x, y)
  }

  function setPinned(next) {
    pinned = next
    tip.classList.toggle('is-pinned', pinned)
    status.textContent = pinned ? 'Pinned' : 'Click to pin'
  }

  window.addEventListener('pointermove', (event) => {
    point = event
    if (pinned || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (point && !pinned) update(point)
    })
  }, { signal: ctx.signal, capture: true })

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || ctx.isOwnEvent(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (pinned) {
      setPinned(false)
      update(event)
      return
    }
    setPinned(true)
  }, { signal: ctx.signal, capture: true })

  ctx.signal.addEventListener('abort', () => {
    if (frame) cancelAnimationFrame(frame)
  })
}

function docsHasAnnotations() {
  return Boolean(document.querySelector('.kix-canvas-tile-content svg rect[aria-label]'))
}

let docsHitStyle = null
let docsHitStyleFailed = false

function docsRectAt(x, y) {
  const hit = docsRectFromPoint(x, y)
  if (hit) return hit
  let best = null
  let bestArea = Infinity
  for (const rect of document.querySelectorAll('.kix-canvas-tile-content svg rect[aria-label]')) {
    if (!rect.getAttribute('aria-label')) continue
    const box = rect.getBoundingClientRect()
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue
    const area = box.width * box.height
    if (area <= 0 || area >= bestArea) continue
    best = rect
    bestArea = area
  }
  return best
}

function docsRectFromPoint(x, y) {
  const style = ensureDocsHitStyle()
  if (!style) return null
  style.disabled = false
  try {
    const element = document.elementFromPoint(x, y)
    if (!element?.matches?.('.kix-canvas-tile-content svg rect[aria-label]')) return null
    if (!element.getAttribute('aria-label')) return null
    return element
  } finally {
    style.disabled = true
  }
}

function ensureDocsHitStyle() {
  if (docsHitStyle || docsHitStyleFailed) return docsHitStyle
  try {
    const style = document.createElement('style')
    style.textContent = [
      '.kix-canvas-tile-content{pointer-events:none!important}',
      '.kix-canvas-tile-content svg rect{pointer-events:all!important}',
    ].join('')
    ;(document.head || document.documentElement).append(style)
    style.disabled = true
    docsHitStyle = style
    return style
  } catch {
    docsHitStyleFailed = true
    return null
  }
}

function styleFromRect(rect) {
  const font = rect.getAttribute('data-font-css') || rect.getAttribute('data-style') || ''
  const style = parseDocsFont(font)
  if (!style) return null
  const color = rect.getAttribute('data-font-color') || rect.getAttribute('data-color')
  if (color) style.color = color
  return style
}

function overDocsCanvas(x, y) {
  for (const canvas of document.querySelectorAll('canvas.kix-canvas-tile-content')) {
    const box = canvas.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true
  }
  return false
}

function docsCaretStyle() {
  const family = docsField('#docs-font-family', '#fontFamilySelect', 'input[aria-label="Font"]')
  const sizeRaw = docsField('#docs-font-size', '#fontSizeSelect', 'input[aria-label="Font size"]')
  if (!family) return null
  const size = /^\d+(?:\.\d+)?$/.test(sizeRaw) ? `${sizeRaw}pt` : (sizeRaw || MISSING)
  return {
    family,
    size,
    weight: docsSelected('boldButton') ? '700' : '400',
    style: docsSelected('italicButton') ? 'italic' : 'normal',
    lineHeight: MISSING,
    letterSpacing: MISSING,
    color: docsTextColor() || MISSING,
    align: docsAlign(),
    transform: MISSING,
  }
}

function docsField(...selectors) {
  for (const selector of selectors) {
    const root = document.querySelector(selector)
    const value = controlValue(root)
    if (value) return value
  }
  return ''
}

function controlValue(root) {
  if (!root) return ''
  if (root instanceof HTMLInputElement && root.value.trim()) return root.value.trim()
  const input = root.querySelector?.('input')
  if (input?.value.trim()) return input.value.trim()
  const caption = root.querySelector?.('.goog-toolbar-menu-button-caption')
  return caption?.textContent?.trim() || ''
}

function docsSelected(id) {
  const button = document.getElementById(id)
  if (!button) return false
  return button.getAttribute('aria-pressed') === 'true'
    || button.classList.contains('goog-toolbar-button-checked')
}

function docsAlign() {
  if (docsSelected('alignCenterButton')) return 'center'
  if (docsSelected('alignRightButton')) return 'right'
  if (docsSelected('alignJustifyButton')) return 'justify'
  if (docsSelected('alignLeftButton')) return 'left'
  return MISSING
}

function docsTextColor() {
  const node = document.querySelector('#textColorButton .docs-text-color-indicator')
  if (!node) return ''
  const inline = node.style.backgroundColor || node.style.borderBottomColor
  if (inline) return inline
  const bg = getComputedStyle(node).backgroundColor
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return ''
  return bg
}

function caretNode(x, y) {
  if (typeof document.caretPositionFromPoint === 'function') {
    return document.caretPositionFromPoint(x, y)?.offsetNode ?? null
  }
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(x, y)?.startContainer ?? null
  }
  return null
}

function readStyle(element) {
  const style = getComputedStyle(element)
  return {
    family: style.fontFamily,
    size: style.fontSize,
    weight: style.fontWeight,
    style: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
    align: style.textAlign,
    transform: style.textTransform,
  }
}
