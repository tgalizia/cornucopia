// Chrome disconnects an injected content script when the extension is reloaded,
// updated, or disabled. Later chrome.* calls, and sometimes DOM calls, throw
// "Extension context invalidated."

export function extensionContextAlive() {
  try {
    return Boolean(globalThis.chrome?.runtime?.id)
  } catch {
    return false
  }
}

export function invalidatedError(error) {
  try {
    const message = typeof error === 'string' ? error : `${error?.message ?? error ?? ''}`
    return message.includes('Extension context invalidated')
  } catch {
    return true
  }
}
