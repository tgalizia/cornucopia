import { tools } from '../tools/registry.js'
import { MSG } from '../shared/messages.js'
import { CLEAR_PERMISSIONS } from '../tools/clear-data/index.js'
import { VIEWPORT_PRESETS } from '../tools/viewport/index.js'
import { contrastGrade, contrastRatio, formatContrast } from '../shared/color.js'
import { copyText } from '../shared/clipboard.js'
import { extensionContextAlive, invalidatedError } from '../shared/extension-context.js'
import { viewportResizeBlock } from '../shared/viewport.js'
import { retire } from '../content/lifetime.js'

export function startPopup(root, { onClose } = {}) {
  const embedded = location.protocol !== 'chrome-extension:'
  const toolsEl = root.querySelector('#tools')
  const panelEl = root.querySelector('#panel')
  const noticeEl = root.querySelector('#notice')
  const footerEl = root.querySelector('#footer')

  const state = {
    tabId: null,
    windowId: null,
    host: 'this site',
    accessError: null,
    toolId: null,
    palette: [],
    panel: null,
    viewport: null,
    preset: null,
    canRestore: false,
    viewportBlock: null,
    canClear: false,
    busy: false,
    notice: '',
  }

  init()
  watchFullscreen()

  async function init() {
    try {
      await load()
    } catch (error) {
      if (stopIfDisconnected(error)) return
      state.notice = "Couldn't open Cornucopia."
      render()
    }
  }

  async function load() {
    if (embedded) await loadEmbedded()
    else await loadExtensionPage()
    render()
  }

  async function loadEmbedded() {
    const ctx = await send({ type: MSG.menuContext })
    if (!ctx?.ok) {
      state.notice = ctx?.error || "Couldn't open Cornucopia."
      return
    }
    state.tabId = ctx.tabId
    state.windowId = ctx.windowId
    state.host = ctx.host || 'this site'
    state.accessError = ctx.accessError ?? null
    state.toolId = ctx.toolId ?? null
    state.palette = ctx.palette ?? []
    state.canClear = Boolean(ctx.canClear)
    state.viewportBlock = ctx.viewportBlock ?? null
  }

  async function loadExtensionPage() {
    const params = new URLSearchParams(location.search)
    const queryTab = Number(params.get('tabId'))
    const queryWindow = Number(params.get('windowId'))
    if (Number.isInteger(queryTab) && queryTab > 0) {
      state.tabId = queryTab
      state.windowId = Number.isInteger(queryWindow) && queryWindow > 0 ? queryWindow : null
      const site = await send({ type: MSG.siteLabel, tabId: state.tabId })
      state.host = site?.host || 'this site'
      const status = await send({ type: MSG.status, tabId: state.tabId })
      state.accessError = status?.accessError ?? (site?.ok ? null : (site?.error || "This page can't be inspected."))
      state.toolId = status?.toolId ?? null
      if (status && !status.ok && status.error) state.notice = status.error
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const win = await chrome.windows.getCurrent()
      state.tabId = tab?.id ?? null
      state.windowId = win?.id ?? null
      if (tab?.url) {
        try {
          state.host = new URL(tab.url).host
        } catch {
          state.host = 'this site'
        }
      }
      if (!state.tabId) {
        state.accessError = "This page can't be inspected."
      } else {
        const status = await send({ type: MSG.status, tabId: state.tabId })
        state.accessError = status.accessError ?? null
        state.toolId = status.toolId ?? null
        if (!status.ok && status.error) state.notice = status.error
      }
    }
    const palette = await send({ type: MSG.getPalette })
    state.palette = palette.palette ?? []
    state.canClear = await chrome.permissions.contains(CLEAR_PERMISSIONS)
    state.viewportBlock = await readViewportBlock(state.windowId)
  }

  async function readViewportBlock(windowId) {
    if (!windowId) return null
    try {
      const [platform, win] = await Promise.all([
        chrome.runtime.getPlatformInfo(),
        chrome.windows.get(windowId),
      ])
      return viewportResizeBlock(platform.os, win.state)
    } catch {
      return null
    }
  }

  function watchFullscreen() {
    if (!embedded) {
      if (!chrome.windows?.onBoundsChanged) return
      const onBoundsChanged = (win) => {
        if (!root.isConnected) {
          chrome.windows.onBoundsChanged.removeListener(onBoundsChanged)
          return
        }
        if (win.id !== state.windowId) return
        void applyFrameState(win.state)
      }
      chrome.windows.onBoundsChanged.addListener(onBoundsChanged)
      return
    }
    let timer = 0
    const onResize = () => {
      if (!root.isConnected) {
        window.removeEventListener('resize', onResize)
        window.clearTimeout(timer)
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void refreshViewportBlock()
      }, 250)
    }
    window.addEventListener('resize', onResize)
  }

  async function applyFrameState(windowState) {
    let os
    try {
      os = (await chrome.runtime.getPlatformInfo()).os
    } catch {
      return
    }
    if (!stillOpen()) return
    setViewportBlock(viewportResizeBlock(os, windowState))
  }

  async function refreshViewportBlock() {
    if (!state.windowId) return
    try {
      const result = await send({
        type: MSG.getViewport,
        tabId: state.tabId,
        windowId: state.windowId,
      })
      if (!stillOpen()) return
      setViewportBlock(result?.viewportBlock ?? null)
    } catch (error) {
      stopIfDisconnected(error)
    }
  }

  function setViewportBlock(next) {
    if (next === state.viewportBlock) return
    state.viewportBlock = next
    if (next) state.panel = null
    render()
  }

  function closeUi() {
    if (onClose) onClose()
    else window.close()
  }

  function stopIfDisconnected(error) {
    if (!embedded) return false
    const disconnected = (error && invalidatedError(error)) || !extensionContextAlive()
    if (!disconnected) return false
    retire()
    closeUi()
    return true
  }

  function stillOpen() {
    try {
      if (!root.isConnected) return false
    } catch (error) {
      stopIfDisconnected(error)
      return false
    }
    return !stopIfDisconnected()
  }

  function render() {
    if (!stillOpen()) return
    try {
      const notice = state.notice || state.accessError || ''
      noticeEl.hidden = !notice
      noticeEl.textContent = notice
      const active = tools.find((tool) => tool.id === state.toolId)
      footerEl.textContent = active?.pageHint || 'Esc exits a page tool.'
      renderTools()
      renderPanel()
    } catch (error) {
      let stop = false
      try {
        stop = embedded && (invalidatedError(error) || !extensionContextAlive())
      } catch {
        stop = embedded
      }
      if (!stop) throw error
      try { retire() } catch { /* Already disconnected. */ }
      try { closeUi() } catch { /* The page bindings are already gone. */ }
    }
  }

  function renderTools() {
    toolsEl.replaceChildren()
    for (const tool of tools) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'tool'
      const blocked = tool.id === 'viewport' && state.viewportBlock
      button.disabled = Boolean(state.accessError) || state.busy || Boolean(blocked)
      const label = document.createElement('span')
      label.className = 'tool-label'
      label.textContent = tool.label
      const hint = document.createElement('span')
      hint.className = 'tool-hint'
      hint.textContent = blocked || tool.hint
      button.append(label, hint)
      if (tool.kind === 'page') {
        const on = state.toolId === tool.id
        button.setAttribute('aria-pressed', on ? 'true' : 'false')
        if (on) {
          const mark = document.createElement('span')
          mark.className = 'tool-state'
          mark.textContent = 'On'
          button.insertBefore(mark, hint)
        }
      } else {
        button.setAttribute('aria-expanded', state.panel === tool.id ? 'true' : 'false')
      }
      button.addEventListener('click', () => {
        void onTool(tool)
      })
      toolsEl.append(button)
    }
  }

  async function onTool(tool) {
    if (state.accessError || state.busy || (tool.id === 'viewport' && state.viewportBlock)) return
    if (tool.kind === 'page') {
      const turningOff = state.toolId === tool.id
      const result = await send(turningOff
        ? { type: MSG.deactivate, tabId: state.tabId }
        : { type: MSG.activate, tabId: state.tabId, toolId: tool.id })
      if (!stillOpen()) return
      if (!result?.ok) {
        state.notice = result?.error || 'Could not start this tool.'
        render()
        return
      }
      closeUi()
      return
    }
    state.panel = state.panel === tool.id ? null : tool.id
    state.notice = ''
    if (state.panel === 'viewport') await loadViewport()
    render()
  }

  function renderPanel() {
    panelEl.replaceChildren()
    if (state.panel === 'viewport') panelEl.append(viewportBlock())
    if (state.panel === 'clear-data') panelEl.append(clearBlock())
    if (state.toolId === 'color' || state.palette.length > 0) panelEl.append(paletteBlock())
  }

  function viewportBlock() {
    const block = document.createElement('section')
    block.className = 'block'
    const heading = document.createElement('h2')
    heading.textContent = 'Viewport'
    const current = document.createElement('p')
    current.className = 'viewport-now'
    current.textContent = state.viewport
      ? `${state.viewport.width} × ${state.viewport.height}`
      : 'Current size unavailable'
    const presets = document.createElement('div')
    presets.className = 'presets'
    for (const width of VIEWPORT_PRESETS) {
      const button = document.createElement('button')
      button.type = 'button'
      const active = state.preset === width
      button.textContent = String(width)
      button.disabled = state.busy || !state.viewport
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
      button.title = active ? 'Restore the window' : `Resize the viewport to ${width}px wide`
      button.addEventListener('click', () => {
        if (active) void restoreSize()
        else void applySize(width, state.viewport.height)
      })
      presets.append(button)
    }
    const form = document.createElement('form')
    form.className = 'row'
    const widthInput = field('Width', state.viewport?.width)
    const heightInput = field('Height', state.viewport?.height)
    const times = document.createElement('span')
    times.textContent = '×'
    const apply = document.createElement('button')
    // The submit-type setter throws "Extension context invalidated" from a
    // content script whose extension was reloaded. Enter still submits the form.
    apply.type = 'button'
    apply.textContent = 'Apply'
    apply.disabled = state.busy
    form.append(widthInput, times, heightInput, apply)
    apply.addEventListener('click', () => {
      void applySize(widthInput.value, heightInput.value)
    })
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      void applySize(widthInput.value, heightInput.value)
    })
    const restore = document.createElement('button')
    restore.type = 'button'
    restore.className = 'ghost'
    restore.textContent = 'Restore'
    restore.disabled = state.busy || !state.canRestore
    restore.addEventListener('click', () => {
      void restoreSize()
    })
    block.append(heading, current, presets, form, restore)
    return block
  }

  function field(label, value) {
    const input = document.createElement('input')
    input.inputMode = 'numeric'
    input.autocomplete = 'off'
    input.setAttribute('aria-label', label)
    input.value = value ? String(value) : ''
    return input
  }

  async function loadViewport() {
    const result = await send({
      type: MSG.getViewport,
      tabId: state.tabId,
      windowId: state.windowId,
    })
    if (!stillOpen()) return
    if (!result?.ok) {
      state.notice = result?.error || "This page can't be inspected."
      state.viewport = null
      state.viewportBlock = result?.viewportBlock ?? state.viewportBlock
      if (state.viewportBlock) state.panel = null
      return
    }
    state.viewport = result.viewport
    state.canRestore = Boolean(result.canRestore)
    state.preset = result.preset ?? null
    state.viewportBlock = result.viewportBlock ?? null
    if (state.viewportBlock) state.panel = null
  }

  async function applySize(width, height) {
    state.busy = true
    state.notice = ''
    render()
    const result = await send({
      type: MSG.resizeViewport,
      tabId: state.tabId,
      windowId: state.windowId,
      width,
      height,
    })
    if (!stillOpen()) return
    state.busy = false
    if (!result?.ok) {
      state.notice = result?.error || "Couldn't resize this window."
      if (result?.viewportBlock) {
        state.viewportBlock = result.viewportBlock
        state.panel = null
      }
    } else {
      state.viewport = result.viewport
      state.canRestore = Boolean(result.canRestore)
      state.preset = result.preset ?? null
    }
    render()
  }

  async function restoreSize() {
    state.busy = true
    state.notice = ''
    render()
    const result = await send({
      type: MSG.restoreViewport,
      tabId: state.tabId,
      windowId: state.windowId,
    })
    if (!stillOpen()) return
    state.busy = false
    if (!result?.ok) {
      state.notice = result?.error || "Couldn't restore this window."
    } else {
      state.viewport = result.viewport
      state.canRestore = false
      state.preset = null
    }
    render()
  }

  function clearBlock() {
    const block = document.createElement('section')
    block.className = 'block'
    const heading = document.createElement('h2')
    heading.textContent = 'Clear site data'
    const copy = document.createElement('p')
    copy.className = 'muted'
    copy.textContent = state.canClear
      ? `Deletes cookies for ${state.host}'s domain and Cache Storage for this origin. Then reloads.`
      : `Chrome will ask once for permission. Cornucopia then clears cookies for ${state.host}'s domain and Cache Storage for this origin.`
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'danger'
    button.textContent = state.canClear ? 'Clear this site' : 'Continue'
    button.disabled = state.busy
    button.addEventListener('click', () => {
      if (!embedded && !state.canClear && !state.busy) {
        const requested = chrome.permissions.request(CLEAR_PERMISSIONS)
        state.busy = true
        state.notice = ''
        render()
        requested.then((granted) => {
          if (!stillOpen()) return
          state.busy = false
          if (!granted) {
            state.notice = 'Permission was not granted.'
            render()
            return
          }
          state.canClear = true
          void onClear()
        }, () => {
          if (!stillOpen()) return
          state.busy = false
          state.notice = 'Permission was not granted.'
          render()
        })
        return
      }
      void onClear()
    })
    block.append(heading, copy, button)
    return block
  }

  async function onClear() {
    if (state.canClear) {
      state.busy = true
      render()
      const result = await send({ type: MSG.clearSiteData, tabId: state.tabId })
      if (!stillOpen()) return
      state.busy = false
      state.notice = result?.ok ? 'Cleared. Reloading…' : (result?.error || 'Could not clear site data.')
      render()
      return
    }
    await send({ type: MSG.openGrant, tabId: state.tabId })
    closeUi()
  }

  function paletteBlock() {
    const block = document.createElement('section')
    block.className = 'block'
    const heading = document.createElement('h2')
    heading.textContent = 'Session palette'
    block.append(heading)
    if (state.palette.length >= 2) {
      const ratio = contrastRatio(state.palette[0], state.palette[1])
      const line = document.createElement('p')
      line.className = 'contrast'
      const score = document.createElement('b')
      score.textContent = `${formatContrast(ratio)} ${contrastGrade(ratio)}`
      line.append(`${state.palette[0].hex} on ${state.palette[1].hex}: `, score)
      block.append(line)
    }
    if (state.palette.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'muted'
      empty.textContent = 'Move over the page, then click to save a color.'
      block.append(empty)
      return block
    }
    const list = document.createElement('div')
    list.className = 'swatch-list'
    for (const color of state.palette) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'swatch'
      const swatch = document.createElement('i')
      swatch.style.background = /^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : '#000000'
      const hex = document.createElement('b')
      hex.textContent = `${color.hex}  ${color.name}`
      const rgb = document.createElement('span')
      rgb.textContent = color.rgb
      row.append(swatch, hex, rgb)
      row.addEventListener('click', async () => {
        const copied = await copyText(color.hex)
        if (!stillOpen()) return
        hex.textContent = copied ? 'Copied' : color.hex
        if (copied) {
          setTimeout(() => {
            if (!stillOpen()) return
            hex.textContent = `${color.hex}  ${color.name}`
          }, 900)
        }
      })
      list.append(row)
    }
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'ghost'
    clear.textContent = 'Clear palette'
    clear.addEventListener('click', async () => {
      const result = await send({ type: MSG.clearPalette })
      if (result?.ok) state.palette = []
      render()
    })
    block.append(list, clear)
    return block
  }

  function send(message) {
    if (stopIfDisconnected()) return Promise.resolve({ ok: false })
    try {
      return Promise.resolve(chrome.runtime.sendMessage(message)).catch((error) => {
        if (stopIfDisconnected(error)) return { ok: false }
        throw error
      })
    } catch (error) {
      if (stopIfDisconnected(error)) return Promise.resolve({ ok: false })
      return Promise.reject(error)
    }
  }
}
