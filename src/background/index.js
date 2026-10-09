import { MSG } from '../shared/messages.js'
import { pageAccessError } from '../shared/page.js'
import { describeColor } from '../shared/color.js'
import { sampleDataUrl } from '../shared/sample.js'
import { addPaletteEntry, clearPalette, readPalette } from '../shared/palette.js'
import { placeDetachedPopup } from '../shared/popup-bounds.js'
import { parseViewportInput, restorePlan, viewportResizeBlock, windowSizeForViewport } from '../shared/viewport.js'
import { VIEWPORT_PRESETS } from '../tools/viewport/index.js'
import { clearRemoval, CLEAR_PERMISSIONS, PENDING_CLEAR, readPendingClear } from '../tools/clear-data/index.js'
import { getPageTool } from '../tools/registry.js'

const WINDOW_SIZES = 'windowSizes'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  onMessage(message, sender).then(sendResponse, (error) => {
    console.error(error)
    sendResponse({ ok: false, error: 'Something went wrong.' })
  })
  return true
})

chrome.action.onClicked.addListener((tab) => {
  void openMenu(tab)
})

chrome.permissions.onAdded.addListener(() => {
  void finishPendingClear()
})

void finishPendingClear()

let detachedId = null
let grantWindowId = null

async function openMenu(tab) {
  if (!tab?.id || pageAccessError(tab.url)) {
    await openDetached(tab)
    return
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })
    const opened = await chrome.tabs.sendMessage(tab.id, { type: MSG.toggleMenu })
    if (!opened?.ok) await openDetached(tab)
  } catch (error) {
    console.error(error)
    await openDetached(tab)
  }
}

async function openDetached(tab) {
  if (detachedId != null) {
    try {
      await chrome.windows.update(detachedId, { focused: true })
      return
    } catch {
      detachedId = null
    }
  }
  const width = 320
  const height = 560
  const url = new URL(chrome.runtime.getURL('popup.html'))
  if (tab?.id) url.searchParams.set('tabId', String(tab.id))
  if (tab?.windowId) url.searchParams.set('windowId', String(tab.windowId))
  const options = {
    url: url.toString(),
    type: 'popup',
    width,
    height,
    focused: true,
  }
  try {
    if (tab?.windowId) {
      const win = await chrome.windows.get(tab.windowId)
      Object.assign(options, placeDetachedPopup(win, { width, height }))
    }
    const created = await chrome.windows.create(options)
    detachedId = created?.id ?? null
  } catch {
    // Saved coordinates can leave more than half the popup off-screen.
    // Drop them and let the browser choose a visible position.
    try {
      const created = await chrome.windows.create({
        url: options.url,
        type: 'popup',
        width,
        height,
        focused: true,
      })
      detachedId = created?.id ?? null
    } catch (error) {
      console.error(error)
    }
  }
}

async function onMessage(message, sender) {
  const tabId = message?.tabId ?? sender.tab?.id ?? null
  switch (message?.type) {
    case MSG.status:
      return status(tabId)
    case MSG.menuContext:
      return menuContext(sender)
    case MSG.openGrant:
      return openGrant(message.tabId)
    case MSG.activate:
      return activate(tabId, message.toolId)
    case MSG.deactivate:
      return deactivate(tabId)
    case MSG.pickColor:
      return pickColor(sender.tab, message)
    case MSG.getPalette:
      return { ok: true, palette: await readPalette() }
    case MSG.clearPalette:
      return { ok: true, palette: await clearPalette() }
    case MSG.getViewport:
      return getViewport(tabId, message.windowId)
    case MSG.resizeViewport:
      return resizeViewport(tabId, message)
    case MSG.restoreViewport:
      return restoreViewport(tabId, message.windowId)
    case MSG.siteLabel:
      return siteLabel(tabId)
    case MSG.clearSiteData:
      return clearRequested(tabId, sender)
    default:
      return { ok: false, error: 'Unknown message.' }
  }
}

async function inspectTab(tabId) {
  if (!tabId) return { error: "This page can't be inspected." }
  let tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return { error: "This page can't be inspected." }
  }
  if (tab.url) {
    const error = pageAccessError(tab.url)
    if (error) return { error }
    const url = new URL(tab.url)
    return { tab, origin: url.origin, host: url.host }
  }
  try {
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => location.href,
    })
    const href = injected?.result
    const error = pageAccessError(href)
    if (error) return { error }
    const url = new URL(href)
    return { tab, origin: url.origin, host: url.host }
  } catch {
    return { error: "This page can't be inspected." }
  }
}

async function menuContext(sender) {
  const tabId = sender.tab?.id ?? null
  const windowId = sender.tab?.windowId ?? null
  const current = await status(tabId)
  const site = await siteLabel(tabId)
  const palette = await readPalette()
  const canClear = await chrome.permissions.contains(CLEAR_PERMISSIONS)
  return {
    ok: true,
    tabId,
    windowId,
    host: site?.host || 'this site',
    accessError: current.accessError ?? null,
    toolId: current.toolId ?? null,
    palette,
    canClear,
    viewportBlock: await viewportGate(windowId),
  }
}

async function openGrant(tabId) {
  const id = Number(tabId)
  if (!Number.isInteger(id)) return { ok: false, error: "This page can't be inspected." }
  if (grantWindowId != null) {
    try {
      await chrome.windows.update(grantWindowId, { focused: true })
      return { ok: true }
    } catch {
      grantWindowId = null
    }
  }
  const width = 340
  const height = 260
  const url = chrome.runtime.getURL(`grant.html?tabId=${id}`)
  const options = { url, type: 'popup', width, height, focused: true }
  try {
    const tab = await chrome.tabs.get(id)
    if (tab.windowId) {
      const win = await chrome.windows.get(tab.windowId)
      Object.assign(options, placeDetachedPopup(win, { width, height }))
    }
  } catch {
    // The browser picks a position when the site window is unavailable.
  }
  try {
    const created = await chrome.windows.create(options)
    grantWindowId = created?.id ?? null
  } catch {
    const created = await chrome.windows.create({ url, type: 'popup', width, height, focused: true })
    grantWindowId = created?.id ?? null
  }
  return { ok: true }
}

async function status(tabId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: true, toolId: null, accessError: inspected.error }
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: MSG.status })
    return { ok: true, toolId: response?.toolId ?? null, accessError: null }
  } catch {
    return { ok: true, toolId: null, accessError: null }
  }
}

async function activate(tabId, toolId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  if (!getPageTool(toolId)) return { ok: false, error: 'Unknown tool.' }
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['content.js'],
  })
  await clearColorCursor(tabId)
  return chrome.tabs.sendMessage(tabId, { type: MSG.mount, toolId })
}

async function deactivate(tabId) {
  if (!tabId) return { ok: true, toolId: null }
  await clearColorCursor(tabId)
  try {
    await chrome.tabs.sendMessage(tabId, { type: MSG.unmount })
  } catch {
    // The content script is already gone.
  }
  return { ok: true, toolId: null }
}

const COLOR_CURSOR = 'html, html *, html *::before, html *::after { cursor: crosshair !important; }'

async function clearColorCursor(tabId) {
  if (!tabId) return
  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: COLOR_CURSOR,
      origin: 'USER',
    })
  } catch {
    // Nothing was inserted for this tab.
  }
}

chrome.tabs.query({}).then((tabs) => {
  for (const tab of tabs) void clearColorCursor(tab.id)
})

async function pickColor(tab, message) {
  if (!tab?.id || !tab.windowId) return { ok: false, error: 'Could not read the pixel on this page.' }
  const x = Number(message.x)
  const y = Number(message.y)
  const innerWidth = Number(message.innerWidth)
  const innerHeight = Number(message.innerHeight)
  if (![x, y, innerWidth, innerHeight].every(Number.isFinite) || innerWidth <= 0 || innerHeight <= 0) {
    return { ok: false, error: 'Could not read the pixel on this page.' }
  }
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    const pixel = await sampleDataUrl(dataUrl, x, y, innerWidth, innerHeight)
    const color = describeColor(pixel.r, pixel.g, pixel.b)
    if (message.commit === false) return { ok: true, color }
    const palette = await addPaletteEntry(color)
    return { ok: true, color, palette }
  } catch (error) {
    console.error(error)
    return { ok: false, error: 'Could not read the pixel on this page.' }
  }
}

async function readViewport(tabId) {
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ width: window.innerWidth, height: window.innerHeight }),
  })
  const viewport = injected?.result
  if (!viewport?.width || !viewport?.height) throw new Error('Missing viewport')
  return viewport
}

async function savedWindows() {
  const data = await chrome.storage.session.get(WINDOW_SIZES)
  return data[WINDOW_SIZES] ?? {}
}

async function rememberWindow(windowId, outer, viewport) {
  const sizes = await savedWindows()
  const key = String(windowId)
  if (sizes[key]) return
  sizes[key] = {
    width: outer.width,
    height: outer.height,
    left: outer.left,
    top: outer.top,
    state: outer.state,
    viewportWidth: viewport?.width ?? null,
    viewportHeight: viewport?.height ?? null,
    preset: null,
  }
  await chrome.storage.session.set({ [WINDOW_SIZES]: sizes })
}

async function rememberPreset(windowId, preset) {
  const sizes = await savedWindows()
  const key = String(windowId)
  if (!sizes[key]) return
  sizes[key].preset = preset
  await chrome.storage.session.set({ [WINDOW_SIZES]: sizes })
}

function presetForWidth(width) {
  return VIEWPORT_PRESETS.includes(width) ? width : null
}

async function viewportGate(windowId) {
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

async function getViewport(tabId, windowId) {
  const viewportBlock = await viewportGate(windowId)
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error, viewportBlock }
  try {
    const viewport = await readViewport(tabId)
    const saved = (await savedWindows())[String(windowId)]
    return { ok: true, viewport, canRestore: Boolean(saved), preset: saved?.preset ?? null, viewportBlock }
  } catch {
    return { ok: false, error: "This page can't be inspected.", viewportBlock }
  }
}

async function resizeViewport(tabId, message) {
  const target = parseViewportInput(message.width, message.height)
  if (!target) return { ok: false, error: 'Enter a width and height between 200 and 7680.' }
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  const windowId = message.windowId
  try {
    let outer = await chrome.windows.get(windowId)
    const block = viewportResizeBlock((await chrome.runtime.getPlatformInfo()).os, outer.state)
    if (block) return { ok: false, error: block, viewportBlock: block }
    await rememberWindow(windowId, outer, await readViewport(tabId))
    if (outer.state === 'maximized' || outer.state === 'fullscreen' || outer.state === 'minimized') {
      await chrome.windows.update(windowId, { state: 'normal' })
      outer = await chrome.windows.get(windowId)
    }
    const viewport = await readViewport(tabId)
    const next = windowSizeForViewport(outer, viewport, target)
    await chrome.windows.update(windowId, {
      state: 'normal',
      width: next.width,
      height: next.height,
    })
    const preset = presetForWidth(target.width)
    await rememberPreset(windowId, preset)
    return { ok: true, viewport: await readViewport(tabId), canRestore: true, preset }
  } catch {
    return { ok: false, error: "Couldn't resize this window." }
  }
}

async function restoreViewport(tabId, windowId) {
  const sizes = await savedWindows()
  const key = String(windowId)
  const saved = sizes[key]
  if (!saved) return { ok: false, error: 'No saved window size yet.' }
  try {
    await applyRestore(windowId, tabId, saved)
    delete sizes[key]
    await chrome.storage.session.set({ [WINDOW_SIZES]: sizes })
    let viewport = null
    try {
      viewport = await readViewport(tabId)
    } catch {
      viewport = null
    }
    return { ok: true, viewport, canRestore: false, preset: null }
  } catch {
    return { ok: false, error: "Couldn't restore this window." }
  }
}

async function applyRestore(windowId, tabId, saved) {
  const plan = restorePlan(saved)
  try {
    await chrome.windows.update(windowId, plan.update)
  } catch {
    await restoreBoundsOrViewport(windowId, tabId, saved, plan.bounds)
    return
  }
  if (!plan.bounds) return
  const after = await chrome.windows.get(windowId)
  const stateLanded = after.state === saved.state
  const sizeLanded = Math.abs(after.width - saved.width) <= 4 && Math.abs(after.height - saved.height) <= 4
  if (!stateLanded && !sizeLanded) await restoreBoundsOrViewport(windowId, tabId, saved, plan.bounds)
}

async function restoreBoundsOrViewport(windowId, tabId, saved, bounds) {
  if (bounds) {
    try {
      await chrome.windows.update(windowId, bounds)
      return
    } catch {
      // Saved outer bounds can land outside the screen. Fall back to the page viewport.
    }
  }
  if (!saved.viewportWidth || !saved.viewportHeight) throw new Error('restore failed')
  let outer = await chrome.windows.get(windowId)
  if (outer.state === 'maximized' || outer.state === 'fullscreen' || outer.state === 'minimized') {
    await chrome.windows.update(windowId, { state: 'normal' })
    outer = await chrome.windows.get(windowId)
  }
  const viewport = await readViewport(tabId)
  const next = windowSizeForViewport(outer, viewport, {
    width: saved.viewportWidth,
    height: saved.viewportHeight,
  })
  await chrome.windows.update(windowId, {
    state: 'normal',
    width: next.width,
    height: next.height,
  })
}

async function siteLabel(tabId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  return { ok: true, host: inspected.host, origin: inspected.origin }
}

const clearing = new Map()
const recentClears = new Map()

function grantSenderTabId(sender, siteTabId) {
  const url = sender?.url || sender?.tab?.url || sender?.tab?.pendingUrl || ''
  if (!url.startsWith(chrome.runtime.getURL('grant.html'))) return null
  const id = sender?.tab?.id
  if (!Number.isInteger(id) || id === siteTabId) return null
  return id
}

async function clearRequested(tabId, sender) {
  const grantTabId = grantSenderTabId(sender, tabId)
  const result = await clearSiteData(tabId)
  if (result?.ok) void returnToSite(tabId, grantTabId)
  return result
}

function clearSiteData(tabId) {
  const recent = recentClears.get(tabId)
  if (recent && Date.now() - recent.at < 5000) return Promise.resolve(recent.result)
  if (!clearing.has(tabId)) {
    const job = performClear(tabId).then((result) => {
      if (result?.ok) recentClears.set(tabId, { at: Date.now(), result })
      return result
    }).finally(() => clearing.delete(tabId))
    clearing.set(tabId, job)
  }
  return clearing.get(tabId)
}

async function finishPendingClear() {
  try {
    const stored = await chrome.storage.local.get(PENDING_CLEAR)
    const pending = readPendingClear(stored[PENDING_CLEAR])
    if (!pending) {
      if (stored[PENDING_CLEAR]) await chrome.storage.local.remove(PENDING_CLEAR)
      return { ok: false, error: 'Nothing to clear.' }
    }
    const allowed = await chrome.permissions.contains(CLEAR_PERMISSIONS)
    if (!allowed) return { ok: false, error: 'Permission was not granted.' }
    const result = await clearSiteData(pending.tabId)
    if (result?.ok) await returnToSite(pending.tabId, pending.grantTabId)
    return result
  } catch {
    return { ok: false, error: 'Could not clear site data.' }
  }
}

async function performClear(tabId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  const allowed = await chrome.permissions.contains(CLEAR_PERMISSIONS)
  if (!allowed || !chrome.browsingData?.remove) {
    return { ok: false, error: 'Permission was not granted.' }
  }
  const { options, dataTypes } = clearRemoval(inspected.origin)
  try {
    await chrome.browsingData.remove(options, dataTypes)
    await chrome.tabs.reload(tabId)
  } catch {
    await chrome.storage.local.remove(PENDING_CLEAR)
    return { ok: false, error: 'Could not clear site data.' }
  }
  await chrome.storage.local.remove(PENDING_CLEAR)
  return { ok: true, host: inspected.host }
}

async function returnToSite(siteTabId, grantTabId) {
  const popupId = grantWindowId
  grantWindowId = null
  try {
    const site = await chrome.tabs.get(siteTabId)
    if (site.windowId != null) await chrome.windows.update(site.windowId, { focused: true })
    await chrome.tabs.update(siteTabId, { active: true })
  } catch {
    // The site tab can already be gone. Still close the grant window.
  }
  if (popupId != null) {
    try {
      await chrome.windows.remove(popupId)
      return
    } catch {
      // The grant page may already have closed itself.
    }
  }
  try {
    const grantIds = new Set()
    if (Number.isInteger(grantTabId) && grantTabId !== siteTabId) grantIds.add(grantTabId)
    const grantBase = chrome.runtime.getURL('grant.html')
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      const url = tab.url || tab.pendingUrl || ''
      if (tab.id != null && url.startsWith(grantBase)) grantIds.add(tab.id)
    }
    if (grantIds.size > 0) await chrome.tabs.remove([...grantIds])
  } catch {
    // The grant page closes itself after a successful clear.
  }
}
