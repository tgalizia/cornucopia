const BLOCKED = "This page can't be inspected."

export const ACTION_TITLE = 'Cornucopia'

export function pageAccessError(url) {
  if (!url) return BLOCKED
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return BLOCKED
    if (isChromeWebStore(parsed)) return BLOCKED
  } catch {
    return BLOCKED
  }
  return null
}

function isChromeWebStore(url) {
  if (url.hostname === 'chromewebstore.google.com') return true
  return url.hostname === 'chrome.google.com' && /^\/webstore(\/|$)/.test(url.pathname)
}

export function toolbarState(url) {
  if (url == null) return null
  const error = pageAccessError(url)
  if (error) return { enabled: false, title: error }
  return { enabled: true, title: ACTION_TITLE }
}
