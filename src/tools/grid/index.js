import { mountToolbar, requestExit } from '../../content/toolbar.js'
import {
  DEFAULT_GRID_SIZE,
  GRID_PRESETS,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  gridMetrics,
  gridSizeControl,
  parseGridSize,
} from './size.js'

let remembered = DEFAULT_GRID_SIZE

export function mountGrid(ctx) {
  const overlay = document.createElement('div')
  overlay.className = 'grid-overlay'
  ctx.root.append(overlay)

  let step = remembered

  const toolbar = mountToolbar(ctx.root, {
    title: 'Grid',
    actions: GRID_PRESETS.map((size) => ({
      id: String(size),
      label: `${size}`,
      active: size === step,
      onClick: () => apply(size),
    })),
    onExit: requestExit,
  })

  const field = document.createElement('label')
  field.className = 'grid-field'
  const input = document.createElement('input')
  input.className = 'grid-size'
  input.type = 'text'
  input.inputMode = 'numeric'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.placeholder = `${GRID_SIZE_MIN}–${GRID_SIZE_MAX}`
  input.title = `${GRID_SIZE_MIN}–${GRID_SIZE_MAX} px`
  input.setAttribute('aria-label', `Custom grid size in pixels, ${GRID_SIZE_MIN} to ${GRID_SIZE_MAX}`)
  input.setAttribute('aria-valuemin', String(GRID_SIZE_MIN))
  input.setAttribute('aria-valuemax', String(GRID_SIZE_MAX))
  input.addEventListener('focus', () => input.select())
  input.addEventListener('change', commitInput)
  window.addEventListener('keydown', onFieldKey, { capture: true, signal: ctx.signal })
  window.addEventListener('keyup', onFieldKey, { capture: true, signal: ctx.signal })

  const unit = document.createElement('span')
  unit.className = 'grid-unit'
  unit.textContent = 'px'
  field.append(input, unit)

  const exit = toolbar.element.querySelector('.exit')
  toolbar.element.insertBefore(field, exit)

  apply(step)

  let enterApplied = false

  function fieldFocused() {
    return ctx.root.getRootNode().activeElement === input
  }

  function onFieldKey(event) {
    if (!fieldFocused()) return
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (event.type === 'keydown') {
        commitInput()
        enterApplied = true
      } else if (!enterApplied) {
        commitInput()
      }
      if (event.type === 'keyup') enterApplied = false
      return
    }
    if (event.type !== 'keydown' || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    event.stopPropagation()
    const typed = parseGridSize(input.value)
    const base = typed ?? step
    apply(event.key === 'ArrowUp' ? base + 1 : base - 1)
  }

  function commitInput() {
    if (!apply(input.value)) showSize(step)
  }

  function showSize(size) {
    const control = gridSizeControl(size)
    toolbar.setActive(control.preset)
    input.value = control.custom
    field.classList.toggle('is-active', control.custom !== '')
  }

  function apply(next) {
    const size = parseGridSize(next)
    if (size == null) return false
    step = size
    remembered = size
    const metrics = gridMetrics(size)
    overlay.style.setProperty('--grid-step', `${metrics.step}px`)
    overlay.style.setProperty('--grid-major', `${metrics.major}px`)
    showSize(size)
    return true
  }
}
