import { MSG } from '../shared/messages.js'
import { pageAccessError, toolbarState } from '../shared/page.js'
import { describeColor } from '../shared/color.js'
import { sampleDataUrl } from '../shared/sample.js'
import { addPaletteEntry, clearPalette, readPalette } from '../shared/palette.js'
import { placeDetachedPopup } from '../shared/popup-bounds.js'
import { parseViewportInput, restorePlan, viewportResizeBlock, windowSizeForViewport } from '../shared/viewport.js'
import { VIEWPORT_PRESETS } from '../tools/viewport/index.js'
import { clearRemoval, CLEAR_PERMISSIONS, PENDING_CLEAR, readPendingClear } from '../tools/clear-data/index.js'
import { getPageTool } from '../tools/registry.js'
import {
  PENDING_RENAME,
  RENAME_ORIGINS,
  TAB_MARKER,
  TAB_TITLES,
  assignTitle,
  claimTitle,
  normalizeTabTitle,
  pendingRenameRecord,
  readPendingRename,
  readTitleRecords,
  removeByTab,
  removeTitle,
  retargetTab,
  shouldDropTitle,
  validMarker,
} from '../tools/rename/title.js'

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

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (!info.url && info.status !== 'complete') return
  void applyToolbar(tab)
})

chrome.tabs.onCreated.addListener((tab) => {
  void applyToolbar(tab)
})

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void retargetStoredTitle(removedTabId, addedTabId)
  chrome.tabs.get(addedTabId).then((tab) => applyToolbar(tab)).catch(() => {})
})

chrome.tabs.onRemoved.addListener((tabId, info) => {
  void forgetTabTitle(tabId, info)
})

chrome.permissions.onAdded.addListener(() => {
  void finishPendingClear()
  void finishRename()
})

void finishPendingClear()

let detachedId = null
let grantWindowId = null
let renameGrantWindowId = null

async function openMenu(tab) {
  if (!tab?.id || pageAccessError(tab.url)) {
    await applyToolbar(tab)
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
    case MSG.claimTabTitle:
      if (!sender.tab?.id) return { ok: false, error: 'No tab.' }
      return claimStoredTitle(sender.tab.id, message.marker)
    case MSG.readTabTitle:
      return readStoredTitle(message.tabId ?? tabId)
    case MSG.renameTab:
      return renameTab(message.tabId ?? tabId, message.title, message.persist !== false)
    case MSG.restoreTabTitle:
      return restoreTabTitle(message.tabId ?? tabId)
    case MSG.openRenameGrant:
      return openRenameGrant(message.tabId ?? tabId, message.title)
    case MSG.finishRename:
      return finishRename(message.tabId)
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
  const canRename = await chrome.permissions.contains(RENAME_ORIGINS)
  return {
    ok: true,
    tabId,
    windowId,
    host: site?.host || 'this site',
    accessError: current.accessError ?? null,
    toolId: current.toolId ?? null,
    palette,
    canClear,
    canRename,
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
  for (const tab of tabs) {
    void applyToolbar(tab)
    void clearColorCursor(tab.id)
  }
})

async function applyToolbar(tab) {
  const next = toolbarState(tab?.url)
  if (!next || !Number.isInteger(tab?.id)) return
  try {
    await chrome.action.setTitle({ tabId: tab.id, title: next.title })
    if (next.enabled) await chrome.action.enable(tab.id)
    else await chrome.action.disable(tab.id)
  } catch {
    // The tab closed while the toolbar was updating.
  }
}

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

async function readRecords() {
  const stored = await chrome.storage.local.get(TAB_TITLES)
  return readTitleRecords(stored[TAB_TITLES])
}

async function writeRecords(records) {
  await chrome.storage.local.set({ [TAB_TITLES]: records })
}

async function tabExists(tabId) {
  try {
    await chrome.tabs.get(tabId)
    return true
  } catch {
    return false
  }
}

async function readPageTitleState(tabId) {
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (key) => ({
      marker: sessionStorage.getItem(key),
      title: document.title,
    }),
    args: [TAB_MARKER],
  })
  return {
    marker: validMarker(injected?.result?.marker),
    title: typeof injected?.result?.title === 'string' ? injected.result.title : '',
  }
}

async function claimStoredTitle(tabId, marker) {
  const records = await readRecords()
  const id = validMarker(marker)
  const liveTabIds = new Set()
  const owner = id ? records[id]?.tabId : null
  if (owner != null && owner !== tabId && await tabExists(owner)) liveTabIds.add(owner)
  const result = claimTitle(records, { id, tabId, liveTabIds }, () => crypto.randomUUID())
  const previousTab = result.id ? records[result.id]?.tabId : null
  if (result.copied || (result.title && previousTab !== tabId)) await writeRecords(result.records)
  return { ok: true, marker: result.id, title: result.title, copied: result.copied }
}

async function readStoredTitle(tabId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  let page
  try {
    page = await readPageTitleState(tabId)
  } catch {
    return { ok: false, error: "This page can't be inspected." }
  }
  const records = await readRecords()
  const record = page.marker ? records[page.marker] : null
  const byTab = Object.entries(records).find(([, item]) => item.tabId === tabId)
  const stored = record?.title || byTab?.[1]?.title || ''
  let held = false
  if (!stored) {
    try {
      const live = await chrome.tabs.sendMessage(tabId, { type: MSG.titleLock })
      held = Boolean(live?.custom)
    } catch {
      held = false
    }
  }
  return {
    ok: true,
    title: stored || page.title,
    custom: Boolean(stored) || held,
    canPersist: await chrome.permissions.contains(RENAME_ORIGINS),
  }
}

async function renameTab(tabId, rawTitle, persist) {
  const title = normalizeTabTitle(rawTitle)
  if (!title) return restoreTabTitle(tabId)
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  const canPersist = persist && await chrome.permissions.contains(RENAME_ORIGINS)
  let marker = null
  let previous = null
  if (canPersist) {
    const records = await readRecords()
    previous = records
    let page = { marker: null }
    try {
      page = await readPageTitleState(tabId)
    } catch {
      page = { marker: null }
    }
    marker = page.marker
    const owner = marker ? records[marker]?.tabId : null
    if (owner != null && owner !== tabId && await tabExists(owner)) marker = null
    if (!marker || !records[marker]) marker = crypto.randomUUID()
    await writeRecords(assignTitle(records, { id: marker, tabId, title }))
  }
  const shown = await showOnTab(tabId, { title, marker })
  if (!shown?.ok) {
    if (previous) await writeRecords(previous)
    return shown
  }
  return { ok: true, title, custom: true, persisted: Boolean(canPersist) }
}

async function restoreTabTitle(tabId) {
  const inspected = await inspectTab(tabId)
  if (inspected.error) return { ok: false, error: inspected.error }
  const records = await readRecords()
  let marker = null
  try {
    marker = (await readPageTitleState(tabId)).marker
  } catch {
    marker = null
  }
  let next = marker ? removeTitle(records, marker) : records
  next = removeByTab(next, tabId)
  await writeRecords(next)
  const released = await releaseOnTab(tabId)
  if (!released?.ok) return released
  return { ok: true, title: released.title || '', custom: false, persisted: false }
}

async function showOnTab(tabId, { title, marker }) {
  const message = { type: MSG.applyTabTitle, title, marker: marker ?? null }
  try {
    const response = await chrome.tabs.sendMessage(tabId, message)
    if (response?.ok) return response
  } catch {
    // The rename script is not on this page yet.
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['rename.js'],
    })
    return await chrome.tabs.sendMessage(tabId, message)
  } catch {
    return { ok: false, error: 'Could not rename this tab.' }
  }
}

async function releaseOnTab(tabId) {
  const message = { type: MSG.releaseTabTitle }
  try {
    const response = await chrome.tabs.sendMessage(tabId, message)
    if (response?.ok) return response
  } catch {
    // The rename script is not on this page yet.
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['rename.js'],
    })
    return await chrome.tabs.sendMessage(tabId, message)
  } catch {
    return { ok: false, error: 'Could not restore this tab.' }
  }
}

async function retargetStoredTitle(removedTabId, addedTabId) {
  const records = await readRecords()
  const next = retargetTab(records, removedTabId, addedTabId)
  if (JSON.stringify(next) === JSON.stringify(records)) return
  await writeRecords(next)
}

async function forgetTabTitle(tabId, info) {
  let windowCount = 0
  if (info?.isWindowClosing) {
    try {
      windowCount = (await chrome.windows.getAll({ windowTypes: ['normal'] })).length
    } catch {
      windowCount = 0
    }
  }
  if (!shouldDropTitle(Boolean(info?.isWindowClosing), windowCount)) return
  const records = await readRecords()
  const next = removeByTab(records, tabId)
  if (Object.keys(next).length !== Object.keys(records).length) await writeRecords(next)
  try {
    const stored = await chrome.storage.local.get(PENDING_RENAME)
    if (readPendingRename(stored[PENDING_RENAME])?.tabId === tabId) {
      await chrome.storage.local.remove(PENDING_RENAME)
    }
  } catch {
    // A closed tab can leave the grant record to expire on its own.
  }
}

async function openRenameGrant(tabId, title) {
  const name = normalizeTabTitle(title)
  if (!name) return { ok: false, error: 'Enter a name.' }
  const id = Number(tabId)
  if (!Number.isInteger(id)) return { ok: false, error: "This page can't be inspected." }
  const inspected = await inspectTab(id)
  if (inspected.error) return { ok: false, error: inspected.error }
  if (renameGrantWindowId != null) {
    try {
      await chrome.windows.update(renameGrantWindowId, { focused: true })
      await chrome.storage.local.set({
        [PENDING_RENAME]: pendingRenameRecord(id, name, null),
      })
      return { ok: true }
    } catch {
      renameGrantWindowId = null
    }
  }
  await chrome.storage.local.set({
    [PENDING_RENAME]: pendingRenameRecord(id, name, null),
  })
  const width = 340
  const height = 360
  const url = chrome.runtime.getURL(`rename-grant.html?tabId=${id}`)
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
    renameGrantWindowId = created?.id ?? null
    const grantTabId = created?.tabs?.[0]?.id
    if (Number.isInteger(grantTabId)) {
      await chrome.storage.local.set({
        [PENDING_RENAME]: pendingRenameRecord(id, name, grantTabId),
      })
    }
  } catch {
    const created = await chrome.windows.create({ url, type: 'popup', width, height, focused: true })
    renameGrantWindowId = created?.id ?? null
  }
  return { ok: true }
}

async function finishRename(tabId) {
  let pending
  try {
    const stored = await chrome.storage.local.get(PENDING_RENAME)
    pending = readPendingRename(stored[PENDING_RENAME])
  } catch {
    return { ok: false, error: 'Could not rename this tab.' }
  }
  if (!pending) return { ok: false, error: 'That rename expired.' }
  if (Number.isInteger(tabId) && pending.tabId !== tabId) return { ok: false, error: 'That rename expired.' }
  const allowed = await chrome.permissions.contains(RENAME_ORIGINS)
  if (!allowed) return { ok: false, error: 'Permission was not granted.' }
  const result = await renameTab(pending.tabId, pending.title, true)
  await chrome.storage.local.remove(PENDING_RENAME)
  if (result?.ok) await closeRenameGrant(pending.tabId, pending.grantTabId)
  return result
}

async function closeRenameGrant(siteTabId, grantTabId) {
  const popupId = renameGrantWindowId
  renameGrantWindowId = null
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
    if (Number.isInteger(grantTabId) && grantTabId !== siteTabId) await chrome.tabs.remove(grantTabId)
  } catch {
    // The grant page closes itself after the name is saved.
  }
}
