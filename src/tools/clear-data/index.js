export const CLEAR_PERMISSIONS = {
  permissions: ['browsingData'],
  origins: ['http://*/*', 'https://*/*'],
}

export const PENDING_CLEAR = 'pendingSiteClear'
const PENDING_CLEAR_MS = 2 * 60 * 1000

export function pendingClearRecord(tabId, grantTabId, now = Date.now()) {
  return {
    tabId,
    grantTabId: Number.isInteger(grantTabId) ? grantTabId : null,
    at: now,
  }
}

export function readPendingClear(record, now = Date.now()) {
  if (!record || !Number.isInteger(record.tabId)) return null
  if (typeof record.at !== 'number' || now - record.at > PENDING_CLEAR_MS) return null
  return {
    tabId: record.tabId,
    grantTabId: Number.isInteger(record.grantTabId) ? record.grantTabId : null,
  }
}

export function clearRemoval(origin) {
  return {
    options: { origins: [origin] },
    dataTypes: {
      cookies: true,
      cacheStorage: true,
    },
  }
}
