import { formatEdges, formatPx, rectFromPoints } from './geometry.js'
import { mountToolbar, requestExit } from '../../content/toolbar.js'

export function mountMeasure(ctx) {
  let mode = 'element'
  let drag = null
  let frame = 0
  let point = null

  const outline = document.createElement('div')
  outline.className = 'outline'
  outline.hidden = true
  const label = document.createElement('div')
  label.className = 'measure-label'
  label.hidden = true
  const hint = document.createElement('p')
  hint.className = 'drag-hint'
  hint.textContent = 'Drag to measure'
  hint.hidden = true
  const layer = document.createElement('div')
  layer.className = 'hit-layer'
  layer.hidden = true
  ctx.root.append(outline, label, hint, layer)

  const toolbar = mountToolbar(ctx.root, {
    title: 'Measure',
    actions: [
      { id: 'element', label: 'Element', active: true, onClick: () => setMode('element') },
      { id: 'rectangle', label: 'Rectangle', active: false, onClick: () => setMode('rectangle') },
    ],
    onExit: requestExit,
  })

  function setMode(next) {
    mode = next
    toolbar.setActive(next)
    drag = null
    outline.hidden = true
    label.hidden = true
    layer.hidden = next !== 'rectangle'
    hint.hidden = next !== 'rectangle'
  }

  function showBox(rect, title, detail) {
    outline.hidden = false
    outline.style.left = `${rect.left}px`
    outline.style.top = `${rect.top}px`
    outline.style.width = `${rect.width}px`
    outline.style.height = `${rect.height}px`
    label.replaceChildren()
    const heading = document.createElement('strong')
    heading.textContent = title
    label.append(heading)
    if (detail) {
      const meta = document.createElement('span')
      meta.textContent = detail
      label.append(meta)
    }
    label.hidden = false
    label.style.left = '0px'
    label.style.top = '0px'
    const labelRect = label.getBoundingClientRect()
    let top = rect.top + 6
    let left = rect.left + 6
    if (rect.height < labelRect.height + 12) top = rect.bottom + 8
    if (left + labelRect.width > window.innerWidth - 8) {
      left = window.innerWidth - labelRect.width - 8
    }
    if (top + labelRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - labelRect.height - 8)
    }
    label.style.left = `${Math.max(8, left)}px`
    label.style.top = `${Math.max(8, top)}px`
  }

  function elementAt(x, y) {
    return document.elementsFromPoint(x, y).find((element) => element !== ctx.host && !ctx.host.contains(element)) ?? null
  }

  function showElement(x, y) {
    if (point && ctx.isOwnEvent(point)) {
      outline.hidden = true
      label.hidden = true
      return
    }
    const element = elementAt(x, y)
    if (!element) {
      outline.hidden = true
      label.hidden = true
      return
    }
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const name = element.id ? `${element.tagName.toLowerCase()}#${element.id}` : element.tagName.toLowerCase()
    showBox(
      rect,
      `${name}  ${formatPx(rect.width)} × ${formatPx(rect.height)}`,
      `padding ${edges(style, 'padding')} · border ${edges(style, 'border', 'Width')} · margin ${edges(style, 'margin')}`,
    )
  }

  window.addEventListener('pointermove', (event) => {
    point = event
    if (mode !== 'element') return
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (point) showElement(point.clientX, point.clientY)
    })
  }, { signal: ctx.signal, capture: true })

  window.addEventListener('scroll', () => {
    if (mode === 'element' && point) showElement(point.clientX, point.clientY)
  }, { signal: ctx.signal, capture: true, passive: true })

  window.addEventListener('pointerout', (event) => {
    if (event.relatedTarget || mode !== 'element') return
    outline.hidden = true
    label.hidden = true
  }, { signal: ctx.signal })

  layer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    drag = { x: event.clientX, y: event.clientY }
    hint.hidden = true
    layer.setPointerCapture(event.pointerId)
    paintRect(rectFromPoints(event.clientX, event.clientY, event.clientX, event.clientY))
  }, { signal: ctx.signal })

  layer.addEventListener('pointermove', (event) => {
    if (!drag) return
    paintRect(rectFromPoints(drag.x, drag.y, event.clientX, event.clientY))
  }, { signal: ctx.signal })

  layer.addEventListener('pointerup', (event) => {
    if (!drag) return
    const rect = rectFromPoints(drag.x, drag.y, event.clientX, event.clientY)
    drag = null
    if (rect.width < 2 && rect.height < 2) {
      outline.hidden = true
      label.hidden = true
      hint.hidden = false
      return
    }
    paintRect(rect)
  }, { signal: ctx.signal })

  function paintRect(rect) {
    showBox(rect, `${formatPx(rect.width)} × ${formatPx(rect.height)}`)
  }

  ctx.signal.addEventListener('abort', () => {
    if (frame) cancelAnimationFrame(frame)
  })
}

function edges(style, prefix, suffix = '') {
  const values = ['Top', 'Right', 'Bottom', 'Left'].map((side) => Number.parseFloat(style[prefix + side + suffix]) || 0)
  return formatEdges(values)
}
