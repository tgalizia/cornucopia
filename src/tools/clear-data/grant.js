import { MSG } from '../../shared/messages.js'
import { CLEAR_PERMISSIONS, PENDING_CLEAR, pendingClearRecord, readPendingClear } from './index.js'

const SESSION_PENDING = 'cornucopia-clear-tab'
const params = new URLSearchParams(location.search)
const tabId = Number(params.get('tabId'))
const hostEl = document.querySelector('#host')
const noticeEl = document.querySelector('#notice')
const button = document.querySelector('#allow')

button.disabled = true
init()

async function init() {
  if (!Number.isInteger(tabId)) {
    showNotice("This page can't be inspected.")
    return
  }
  if (await pendingForThisTab()) {
    const granted = await waitUntilGranted(3000)
    if (granted) {
      await runClear()
      return
    }
  }
  try {
    const site = await chrome.runtime.sendMessage({ type: MSG.siteLabel, tabId })
    if (!site?.ok) {
      showNotice(site?.error || "This page can't be inspected.")
      return
    }
    hostEl.textContent = site.host
    button.disabled = false
  } catch {
    showNotice("This page can't be inspected.")
  }
}

button.addEventListener('click', () => {
  let request
  try {
    request = chrome.permissions.request(CLEAR_PERMISSIONS)
  } catch {
    showNotice('Permission was not granted.')
    return
  }
  const saved = rememberPending()
  button.disabled = true
  noticeEl.hidden = true
  waitUntilGranted(0, request).then(async (granted) => {
    await saved
    if (!granted) {
      await forgetPending()
      showNotice('Permission was not granted.')
      button.disabled = false
      return
    }
    return runClear()
  })
})

async function runClear() {
  button.disabled = true
  showNotice('Clearing this site…')
  const result = await requestClear()
  if (!result?.ok) {
    await forgetPending()
    showNotice(result?.error || 'Could not clear site data.')
    button.disabled = false
    return
  }
  await forgetPending()
  await leaveGrantPage()
}

async function requestClear() {
  let last = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      last = await chrome.runtime.sendMessage({ type: MSG.clearSiteData, tabId })
      if (last) return last
    } catch {
      last = null
    }
    await delay(250)
  }
  return last
}

async function leaveGrantPage() {
  try {
    const site = await chrome.tabs.get(tabId)
    if (site.windowId != null) await chrome.windows.update(site.windowId, { focused: true })
    await chrome.tabs.update(tabId, { active: true })
  } catch {
    // The service worker also focuses the site before closing this tab.
  }
  try {
    const current = await chrome.tabs.getCurrent()
    if (current?.id != null) {
      chrome.tabs.remove(current.id)
      window.close()
      return
    }
  } catch {
    // A popup window can still close itself.
  }
  window.close()
}

function rememberPending() {
  sessionStorage.setItem(SESSION_PENDING, String(tabId))
  const write = (grantTabId) => chrome.storage.local.set({
    [PENDING_CLEAR]: pendingClearRecord(tabId, grantTabId),
  })
  return chrome.tabs.getCurrent().then(
    (tab) => write(tab?.id),
    () => write(null),
  ).catch(() => {})
}

function forgetPending() {
  sessionStorage.removeItem(SESSION_PENDING)
  return chrome.storage.local.remove(PENDING_CLEAR).catch(() => {})
}

async function pendingForThisTab() {
  if (sessionStorage.getItem(SESSION_PENDING) === String(tabId)) return true
  try {
    const stored = await chrome.storage.local.get(PENDING_CLEAR)
    return readPendingClear(stored[PENDING_CLEAR])?.tabId === tabId
  } catch {
    return false
  }
}

function waitUntilGranted(limitMs, requestPromise) {
  return new Promise((resolve) => {
    let settled = false
    let poll = 0
    let timer = 0
    const finish = (granted) => {
      if (settled) return
      settled = true
      clearInterval(poll)
      clearTimeout(timer)
      chrome.permissions.onAdded.removeListener(onAdded)
      resolve(granted)
    }
    const onAdded = () => {
      chrome.permissions.contains(CLEAR_PERMISSIONS).then((ok) => {
        if (ok) finish(true)
      }).catch(() => {})
    }
    const check = () => {
      chrome.permissions.contains(CLEAR_PERMISSIONS).then((ok) => {
        if (ok) finish(true)
      }).catch(() => {})
    }
    chrome.permissions.onAdded.addListener(onAdded)
    check()
    poll = setInterval(check, 200)
    if (limitMs > 0) timer = setTimeout(() => finish(false), limitMs)
    if (requestPromise) {
      Promise.resolve(requestPromise).then(
        (granted) => finish(granted === true),
        () => finish(false),
      )
    }
  })
}

function showNotice(message) {
  noticeEl.hidden = false
  noticeEl.textContent = message
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
