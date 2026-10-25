import { MSG } from '../../shared/messages.js'
import { PENDING_RENAME, RENAME_ORIGINS, readPendingRename } from './title.js'

const params = new URLSearchParams(location.search)
const tabId = Number(params.get('tabId'))
const titleEl = document.querySelector('#title')
const noticeEl = document.querySelector('#notice')
const button = document.querySelector('#allow')

button.disabled = true
init()

async function init() {
  if (!Number.isInteger(tabId)) {
    showNotice('That rename expired.')
    return
  }
  const pending = await readPending()
  if (!pending || pending.tabId !== tabId) {
    showNotice('That rename expired.')
    return
  }
  titleEl.textContent = pending.title
  if (await chrome.permissions.contains(RENAME_ORIGINS)) {
    await finish()
    return
  }
  button.disabled = false
}

button.addEventListener('click', () => {
  let request
  try {
    request = chrome.permissions.request(RENAME_ORIGINS)
  } catch {
    showNotice('Permission was not granted.')
    return
  }
  button.disabled = true
  noticeEl.hidden = true
  waitUntilGranted(request).then(async (granted) => {
    if (!granted) {
      showNotice('Permission was not granted.')
      button.disabled = false
      return
    }
    await finish()
  })
})

async function finish() {
  button.disabled = true
  showNotice('Saving the name…')
  let result = null
  try {
    result = await chrome.runtime.sendMessage({ type: MSG.finishRename, tabId })
  } catch {
    result = null
  }
  if (!result?.ok) {
    showNotice(result?.error || 'Could not rename this tab.')
    button.disabled = false
    return
  }
  window.close()
}

async function readPending() {
  try {
    const stored = await chrome.storage.local.get(PENDING_RENAME)
    return readPendingRename(stored[PENDING_RENAME])
  } catch {
    return null
  }
}

function waitUntilGranted(requestPromise) {
  return new Promise((resolve) => {
    let settled = false
    const finishGrant = (granted) => {
      if (settled) return
      settled = true
      chrome.permissions.onAdded.removeListener(onAdded)
      resolve(granted)
    }
    const onAdded = () => {
      chrome.permissions.contains(RENAME_ORIGINS).then((ok) => {
        if (ok) finishGrant(true)
      }).catch(() => {})
    }
    chrome.permissions.onAdded.addListener(onAdded)
    Promise.resolve(requestPromise).then(
      (granted) => finishGrant(granted === true),
      () => finishGrant(false),
    )
  })
}

function showNotice(message) {
  noticeEl.hidden = false
  noticeEl.textContent = message
}
