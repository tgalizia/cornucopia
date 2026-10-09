import { MSG } from '../../shared/messages.js'
import { extensionContextAlive, invalidatedError } from '../../shared/extension-context.js'
import { retire } from '../../content/lifetime.js'
import { copyText } from '../../shared/clipboard.js'
import { placeNearPointer } from '../../content/place.js'
import { mountToolbar, requestExit } from '../../content/toolbar.js'

const PREVIEW_GAP = 120

export function mountColor(ctx) {
  const layer = document.createElement('div')
  layer.className = 'hit-layer'
  const chip = document.createElement('div')
  chip.className = 'chip is-live'
  chip.hidden = true
  ctx.root.append(layer, chip)

  let point = null
  let frame = 0
  let ticket = 0
  let busy = false
  let picking = false
  let hides = 0
  let previewTimer = 0
  let savedTimer = 0
  let copyTimer = 0
  let gap = PREVIEW_GAP
  let lastSample = 0
  let shownHex = ''
  let currentHex = ''

  const toolbar = mountToolbar(ctx.root, {
    title: 'Color picker',
    actions: [{ id: 'copy', label: 'Copy', onClick: () => { void copyCurrent() } }],
    onExit: requestExit,
  })

  layer.addEventListener('pointermove', (event) => {
    point = { x: event.clientX, y: event.clientY }
    if (frame || picking) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!point || picking) return
      placeChip(point.x, point.y)
      schedulePreview()
    })
  }, { signal: ctx.signal })

  layer.addEventListener('click', (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    point = { x: event.clientX, y: event.clientY }
    void commit(point.x, point.y)
  }, { signal: ctx.signal })

  window.addEventListener('scroll', () => {
    if (point) schedulePreview()
  }, { signal: ctx.signal, capture: true, passive: true })

  ctx.signal.addEventListener('abort', () => {
    if (frame) cancelAnimationFrame(frame)
    clearTimeout(previewTimer)
    clearTimeout(savedTimer)
    clearTimeout(copyTimer)
  })

  function placeChip(x, y) {
    if (!chip.childElementCount) {
      const text = document.createElement('p')
      text.textContent = '…'
      chip.append(text)
    }
    placeNearPointer(chip, x, y)
  }

  function schedulePreview() {
    if (previewTimer || busy || picking) return
    const wait = Math.max(0, gap - (Date.now() - lastSample))
    previewTimer = setTimeout(() => {
      previewTimer = 0
      void preview()
    }, wait)
  }

  async function preview() {
    if (!point || picking || busy || ctx.signal.aborted) return
    const { x, y } = point
    busy = true
    try {
      await read(x, y, false)
    } finally {
      busy = false
    }
    if (!ctx.signal.aborted && point && (point.x !== x || point.y !== y)) schedulePreview()
  }

  async function commit(x, y) {
    clearTimeout(previewTimer)
    previewTimer = 0
    await read(x, y, true)
    if (!ctx.signal.aborted && point) schedulePreview()
  }

  async function read(x, y, commitPick) {
    const mine = ++ticket
    if (commitPick) picking = true
    const hide = commitPick || coversPoint(x, y)
    if (hide) {
      hides += 1
      hideReadout()
      await waitForPaint()
    }
    let result
    try {
      result = await chrome.runtime.sendMessage({
        type: MSG.pickColor,
        x,
        y,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        commit: commitPick,
      })
    } catch (error) {
      if (invalidatedError(error)) retire()
      result = { ok: false, error: 'Could not read the pixel on this page.' }
    } finally {
      if (hide) {
        hides = Math.max(0, hides - 1)
        if (hides === 0) showReadout()
      }
      if (commitPick) picking = false
      lastSample = Date.now()
    }
    if (mine !== ticket || ctx.signal.aborted || !extensionContextAlive()) {
      if (!extensionContextAlive()) retire()
      return
    }
    gap = result?.ok ? PREVIEW_GAP : 500
    renderChip(result, commitPick)
  }

  function hideReadout() {
    chip.style.visibility = 'hidden'
    toolbar.element.style.visibility = 'hidden'
  }

  function showReadout() {
    try {
      chip.style.visibility = ''
      toolbar.element.style.visibility = ''
    } catch {
      // The overlay was removed with the extension context.
    }
  }

  function coversPoint(x, y) {
    if (chip.hidden) return false
    const rect = chip.getBoundingClientRect()
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
  }

  function renderChip(result, commitPick) {
    const x = point?.x ?? 0
    const y = point?.y ?? 0
    if (!result?.ok || !result.color) {
      if (commitPick || !currentHex) {
        currentHex = ''
        shownHex = ''
        chip.replaceChildren()
        const text = document.createElement('p')
        text.textContent = result?.error || 'Could not read the pixel on this page.'
        chip.append(text)
      }
      placeNearPointer(chip, x, y)
      return
    }
    const { color } = result
    currentHex = color.hex
    if (shownHex !== color.hex || !chip.querySelector('strong')) {
      shownHex = color.hex
      fillChip(color)
    }
    if (commitPick) flashSaved()
    placeNearPointer(chip, x, y)
  }

  function fillChip(color) {
    chip.replaceChildren()
    const swatch = document.createElement('i')
    swatch.style.background = color.hex
    swatch.setAttribute('aria-hidden', 'true')
    const text = document.createElement('div')
    const hex = document.createElement('strong')
    hex.textContent = color.hex
    const rgb = document.createElement('span')
    rgb.textContent = color.rgb
    const name = document.createElement('span')
    name.dataset.label = color.name
    name.textContent = color.name
    text.append(hex, rgb, name)
    chip.append(swatch, text)
  }

  function flashSaved() {
    const name = chip.querySelector('[data-label]')
    if (!name) return
    name.textContent = 'Saved'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      if (name.isConnected && name.textContent === 'Saved') name.textContent = name.dataset.label
    }, 700)
  }

  async function copyCurrent() {
    if (!currentHex) return
    const button = toolbar.element.querySelector('button:not(.exit)')
    const copied = await copyText(currentHex)
    if (ctx.signal.aborted || !button) return
    button.textContent = copied ? 'Copied' : 'Copy'
    if (!copied) return
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      if (button.isConnected) button.textContent = 'Copy'
    }, 900)
  }

  return () => {
    ctx.root.style.visibility = ''
  }
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 40)
      })
    })
  })
}
