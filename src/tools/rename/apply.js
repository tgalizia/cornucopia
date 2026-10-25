import { MSG } from '../../shared/messages.js'
import { extensionContextAlive, invalidatedError } from '../../shared/extension-context.js'
import { TAB_MARKER, TAB_PAGE, createTitleLock, validMarker } from './title.js'

const SLOT = '__CORNUCOPIA_RENAME__'

function boot() {
  let lock
  try {
    lock = createTitleLock(document, {
      pageTitle: storedPageTitle(),
      onPageTitle: storePageTitle,
    })
  } catch {
    return { alive: () => false, stop() {} }
  }
  let stopped = false
  let generation = 0

  function onMessage(message, _sender, sendResponse) {
    if (stopped || !extensionContextAlive()) {
      stop()
      return
    }
    if (!message || typeof message.type !== 'string') return
    try {
      if (message.type === MSG.applyTabTitle) {
        generation += 1
        const marker = validMarker(message.marker)
        if (marker) sessionStorage.setItem(TAB_MARKER, marker)
        const result = lock.apply(message.title)
        storePageTitle(result.pageTitle)
        sendResponse({ ok: true, title: document.title })
        return
      }
      if (message.type === MSG.releaseTabTitle) {
        generation += 1
        clearStoredIds()
        const result = lock.restore()
        sendResponse({ ok: true, title: result.title })
        return
      }
      if (message.type === MSG.titleLock) {
        sendResponse({ ok: true, custom: lock.holding(), title: document.title })
      }
    } catch (error) {
      if (invalidatedError(error)) stop()
      else sendResponse({ ok: false, error: 'Could not rename this tab.' })
    }
  }

  function stop() {
    if (stopped) return
    stopped = true
    generation += 1
    try {
      lock.stop()
    } catch {
      // The title node is already gone.
    }
    try {
      chrome.runtime.onMessage.removeListener(onMessage)
    } catch {
      // The orphaned script can no longer reach the extension.
    }
  }

  try {
    chrome.runtime.onMessage.addListener(onMessage)
  } catch {
    return { alive: () => false, stop() {} }
  }
  void claim(lock, () => generation)
  return {
    alive: () => !stopped && extensionContextAlive(),
    stop,
  }
}

async function claim(lock, generation) {
  const mine = generation()
  let marker = null
  try {
    marker = validMarker(sessionStorage.getItem(TAB_MARKER))
  } catch {
    return
  }
  let response
  try {
    response = await chrome.runtime.sendMessage({ type: MSG.claimTabTitle, marker })
  } catch {
    return
  }
  if (mine !== generation() || !response?.ok || !extensionContextAlive()) return
  try {
    if (validMarker(response.marker)) sessionStorage.setItem(TAB_MARKER, response.marker)
    else if (marker) clearStoredIds()
  } catch {
    return
  }
  if (response.title) {
    const result = lock.apply(response.title)
    storePageTitle(result.pageTitle)
  }
}

function storedPageTitle() {
  try {
    const value = sessionStorage.getItem(TAB_PAGE)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

function storePageTitle(title) {
  try {
    if (title) sessionStorage.setItem(TAB_PAGE, title)
    else sessionStorage.removeItem(TAB_PAGE)
  } catch {
    // The page can refuse session storage. The visible title still updates.
  }
}

function clearStoredIds() {
  try {
    sessionStorage.removeItem(TAB_MARKER)
    sessionStorage.removeItem(TAB_PAGE)
  } catch {
    // The page can refuse session storage. The title lock still lets go.
  }
}

const previous = globalThis[SLOT]
if (!previous?.alive?.()) {
  try {
    previous?.stop?.()
  } catch {
    // The previous copy is already disconnected.
  }
  if (extensionContextAlive()) globalThis[SLOT] = boot()
}
