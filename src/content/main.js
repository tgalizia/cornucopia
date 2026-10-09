import { overlayCss } from './styles.js'
import { getPageTool } from '../tools/registry.js'
import { MSG } from '../shared/messages.js'
import { extensionContextAlive, invalidatedError } from '../shared/extension-context.js'
import { closeMenu, menuIsOpen, toggleMenu } from './menu.js'
import { onRetire, retire, watchExtensionLifetime } from './lifetime.js'

const HOST_STYLES = {
  position: 'fixed',
  inset: '0',
  'z-index': '2147483647',
  'pointer-events': 'none',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  width: 'auto',
  height: 'auto',
}

function boot() {
  let host = null
  let root = null
  let cleanup = null
  let toolId = null
  let frameObserver = null
  const boundViews = new WeakSet()
  const seenKeys = new WeakSet()

  watchExtensionLifetime()
  onRetire(() => {
    window.removeEventListener('pointerdown', guardInput, true)
    window.removeEventListener('pointermove', guardInput, true)
    window.removeEventListener('keydown', guardInput, true)
    window.removeEventListener('click', guardInput, true)
    window.removeEventListener('keydown', onEscape, true)
    try {
      chrome.runtime.onMessage.removeListener(onMessage)
    } catch {
      // The orphaned script can no longer reach the extension.
    }
    try {
      closeMenu()
    } catch {
      // The orphaned script can no longer touch the page.
    }
    destroyHost()
  })

  function guardInput(event) {
    if (extensionContextAlive()) return
    try {
      event.stopImmediatePropagation()
    } catch {
      // The page event is already detached from this script.
    }
    retire()
  }

  function destroyHost() {
    frameObserver?.disconnect()
    frameObserver = null
    const done = cleanup
    cleanup = null
    toolId = null
    try {
      done?.()
    } catch {
      // The overlay is going away either way.
    }
    try {
      host?.remove()
    } catch {
      // An orphaned content script can no longer change the page.
    }
    host = null
    root = null
  }

  function ensureHost() {
    if (host) return true
    const parent = document.documentElement || document.body
    if (!parent) return false
    host = document.createElement('div')
    host.id = 'cornucopia-root'
    for (const [key, value] of Object.entries(HOST_STYLES)) {
      host.style.setProperty(key, value, 'important')
    }
    const shadow = host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = overlayCss
    root = document.createElement('div')
    root.className = 'root'
    shadow.append(style, root)
    parent.append(host)
    return true
  }

  function mount(id) {
    const tool = getPageTool(id)
    if (!tool) return { ok: false, error: 'Unknown tool.' }
    destroyHost()
    if (!ensureHost()) return { ok: false, error: "This page can't be inspected." }
    const controller = new AbortController()
    try {
      const extra = tool.mount({
        host,
        root,
        signal: controller.signal,
        isOwnEvent(event) {
          return event.target === host || event.composedPath().includes(host)
        },
      })
      cleanup = () => {
        controller.abort()
        extra?.()
      }
      toolId = id
      watchDocsKeys()
      return { ok: true, toolId }
    } catch {
      controller.abort()
      destroyHost()
      return { ok: false, error: 'Could not start this tool.' }
    }
  }

  function onEscape(event) {
    if (!extensionContextAlive()) {
      retire()
      return
    }
    if (event.key !== 'Escape' || event.repeat || seenKeys.has(event)) return
    if (!menuIsOpen() && !toolId) return
    seenKeys.add(event)
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (menuIsOpen()) {
      closeMenu()
      return
    }
    try {
      chrome.runtime.sendMessage({ type: MSG.deactivate })
    } catch (error) {
      if (invalidatedError(error)) retire()
      else throw error
    }
  }

  const boundFrames = new WeakSet()

  function attachDocsView(iframe) {
    try {
      const view = iframe.contentWindow
      if (!view || boundViews.has(view)) return
      view.addEventListener('keydown', onEscape, true)
      iframe.contentDocument?.addEventListener('keydown', onEscape, true)
      boundViews.add(view)
    } catch {
      // A cross-origin frame does not accept listeners from this page.
    }
  }

  function bindDocsFrame(iframe) {
    if (!boundFrames.has(iframe)) {
      boundFrames.add(iframe)
      iframe.addEventListener('load', () => attachDocsView(iframe))
    }
    attachDocsView(iframe)
  }

  function watchDocsKeys() {
    if (location.hostname !== 'docs.google.com') return
    for (const iframe of document.querySelectorAll('iframe.docs-texteventtarget-iframe')) {
      bindDocsFrame(iframe)
    }
    frameObserver?.disconnect()
    frameObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue
          if (node.matches?.('iframe.docs-texteventtarget-iframe')) bindDocsFrame(node)
          else node.querySelectorAll?.('iframe.docs-texteventtarget-iframe').forEach(bindDocsFrame)
        }
      }
    })
    frameObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  function onMessage(message, _sender, sendResponse) {
    if (!extensionContextAlive()) {
      retire()
      return
    }
    if (!message || typeof message.type !== 'string') return
    try {
      if (message.type === MSG.status) {
        sendResponse({ ok: true, toolId })
        return
      }
      if (message.type === MSG.toggleMenu) {
        sendResponse({ ok: toggleMenu() })
        return
      }
      if (message.type === MSG.mount) {
        sendResponse(mount(message.toolId))
        return
      }
      if (message.type === MSG.unmount) {
        destroyHost()
        sendResponse({ ok: true, toolId: null })
      }
    } catch (error) {
      if (invalidatedError(error)) retire()
      else throw error
    }
  }

  window.addEventListener('pointerdown', guardInput, true)
  window.addEventListener('pointermove', guardInput, true)
  window.addEventListener('keydown', guardInput, true)
  window.addEventListener('click', guardInput, true)
  window.addEventListener('keydown', onEscape, true)
  chrome.runtime.onMessage.addListener(onMessage)

  let stopped = false
  onRetire(() => { stopped = true })
  return {
    alive() {
      return !stopped && extensionContextAlive()
    },
    retire,
  }
}

const SLOT = '__CORNUCOPIA__'
const previous = globalThis[SLOT]
if (previous?.alive?.() || (!previous && globalThis.__CORNUCOPIA_BOOTED__ && extensionContextAlive())) {
  // This world already has a live Cornucopia.
} else {
  try { previous?.retire?.() } catch { /* The previous copy is already disconnected. */ }
  try {
    document.dispatchEvent(new CustomEvent('cornucopia-retire', { detail: 'dead' }))
  } catch { /* A disconnected script can no longer reach the page. */ }
  if (extensionContextAlive()) {
    globalThis.__CORNUCOPIA_BOOTED__ = true
    globalThis[SLOT] = boot()
  }
}
