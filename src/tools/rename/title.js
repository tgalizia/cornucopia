export const TAB_TITLES = 'tabTitles'
export const TAB_MARKER = 'cornucopiaTab'
export const TAB_PAGE = 'cornucopiaTabPage'
export const PENDING_RENAME = 'pendingTabRename'
export const RENAME_ORIGINS = {
  origins: ['http://*/*', 'https://*/*'],
}

const TITLE_MAX = 300
const PENDING_RENAME_MS = 2 * 60 * 1000
const MARKER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeTabTitle(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.slice(0, TITLE_MAX)
}

export function validMarker(value) {
  return typeof value === 'string' && MARKER_ID.test(value) ? value : null
}

export function readTitleRecords(stored) {
  const source = stored && typeof stored === 'object' ? stored : {}
  const records = {}
  for (const [id, record] of Object.entries(source)) {
    const marker = validMarker(id)
    const title = normalizeTabTitle(record?.title)
    if (!marker || !title) continue
    records[marker] = {
      title,
      tabId: Number.isInteger(record.tabId) ? record.tabId : null,
    }
  }
  return records
}

export function assignTitle(records, { id, tabId, title }) {
  const marker = validMarker(id)
  const name = normalizeTabTitle(title)
  const next = {}
  for (const [key, record] of Object.entries(records ?? {})) {
    if (key === marker) continue
    if (Number.isInteger(tabId) && record?.tabId === tabId) continue
    next[key] = record
  }
  if (!marker || !name || !Number.isInteger(tabId)) return next
  next[marker] = { title: name, tabId }
  return next
}

export function removeTitle(records, id) {
  const marker = validMarker(id)
  if (!marker || !records?.[marker]) return { ...(records ?? {}) }
  const next = { ...records }
  delete next[marker]
  return next
}

export function removeByTab(records, tabId) {
  const next = {}
  for (const [id, record] of Object.entries(records ?? {})) {
    if (record?.tabId === tabId) continue
    next[id] = record
  }
  return next
}

export function retargetTab(records, removedTabId, addedTabId) {
  const next = {}
  for (const [id, record] of Object.entries(records ?? {})) {
    next[id] = record?.tabId === removedTabId ? { ...record, tabId: addedTabId } : record
  }
  return next
}

export function claimTitle(records, { id, tabId, liveTabIds }, createId) {
  const source = records ?? {}
  const marker = validMarker(id)
  const record = marker ? source[marker] : null
  if (record) {
    const ownerLive = record.tabId != null
      && record.tabId !== tabId
      && liveTabIds?.has(record.tabId)
    if (ownerLive) {
      const copyId = createId()
      return {
        records: assignTitle(source, { id: copyId, tabId, title: record.title }),
        id: copyId,
        title: record.title,
        copied: true,
      }
    }
    return {
      records: assignTitle(source, { id: marker, tabId, title: record.title }),
      id: marker,
      title: record.title,
      copied: false,
    }
  }
  const owned = Object.entries(source).find(([, item]) => item.tabId === tabId)
  if (!owned) return { records: source, id: null, title: null, copied: false }
  return { records: source, id: owned[0], title: owned[1].title, copied: false }
}

export function shouldDropTitle(isWindowClosing, windowCount) {
  if (!isWindowClosing) return true
  return Number(windowCount) > 1
}

export function pendingRenameRecord(tabId, title, grantTabId, now = Date.now()) {
  return {
    tabId,
    title: normalizeTabTitle(title),
    grantTabId: Number.isInteger(grantTabId) ? grantTabId : null,
    at: now,
  }
}

export function readPendingRename(record, now = Date.now()) {
  if (!record || !Number.isInteger(record.tabId)) return null
  const title = normalizeTabTitle(record.title)
  if (!title) return null
  if (typeof record.at !== 'number' || now - record.at > PENDING_RENAME_MS) return null
  return {
    tabId: record.tabId,
    title,
    grantTabId: Number.isInteger(record.grantTabId) ? record.grantTabId : null,
  }
}

export function nextLockState(state, event) {
  const custom = state?.custom ?? null
  const pageTitle = state?.pageTitle ?? ''
  if (event.type === 'apply') {
    const name = normalizeTabTitle(event.title)
    if (!name) return nextLockState({ custom, pageTitle }, { type: 'restore' })
    return {
      custom: name,
      pageTitle: custom == null ? String(event.current ?? pageTitle) : pageTitle,
      show: name,
    }
  }
  if (event.type === 'restore') return { custom: null, pageTitle, show: pageTitle }
  if (event.type === 'page') {
    const incoming = String(event.title ?? '')
    if (custom == null) return { custom: null, pageTitle: incoming, show: incoming }
    if (incoming === custom) return { custom, pageTitle, show: custom }
    return { custom, pageTitle: incoming, show: custom }
  }
  return { custom, pageTitle, show: custom ?? pageTitle }
}

export function createTitleLock(doc, options = {}) {
  const remembered = typeof options.pageTitle === 'string' && options.pageTitle
    ? options.pageTitle
    : (doc.title || '')
  let state = { custom: null, pageTitle: remembered }
  let titleObserver = null
  let headObserver = null
  let headParent = null
  const onPageTitle = options.onPageTitle

  function show() {
    const next = state.custom ?? state.pageTitle
    if (doc.title !== next) doc.title = next
  }

  function commit(next) {
    const previous = state.pageTitle
    state = next
    if (state.pageTitle !== previous) onPageTitle?.(state.pageTitle)
    show()
  }

  function onTitleChanged() {
    commit(nextLockState(state, { type: 'page', title: doc.title || '' }))
  }

  function observeTitle() {
    titleObserver?.disconnect()
    titleObserver = null
    const titleEl = doc.querySelector?.('title')
    if (!titleEl || typeof MutationObserver !== 'function') return
    titleObserver = new MutationObserver(onTitleChanged)
    titleObserver.observe(titleEl, { childList: true, subtree: true, characterData: true })
  }

  function watch() {
    observeTitle()
    if (typeof MutationObserver !== 'function') return
    const parent = doc.head || doc.documentElement
    if (!parent || parent === headParent) return
    headObserver?.disconnect()
    headParent = parent
    headObserver = new MutationObserver(() => {
      const nextParent = doc.head || doc.documentElement
      if (nextParent && nextParent !== headParent) {
        watch()
        return
      }
      observeTitle()
    })
    headObserver.observe(parent, { childList: true })
  }

  function stop() {
    titleObserver?.disconnect()
    headObserver?.disconnect()
    titleObserver = null
    headObserver = null
    headParent = null
  }

  return {
    apply(title) {
      commit(nextLockState(state, { type: 'apply', title, current: doc.title || '' }))
      if (state.custom != null) watch()
      else stop()
      return { title: state.show, custom: state.custom != null, pageTitle: state.pageTitle }
    },
    restore() {
      commit(nextLockState(state, { type: 'restore' }))
      stop()
      return { title: state.show, custom: false, pageTitle: state.pageTitle }
    },
    holding() {
      return state.custom != null
    },
    stop,
  }
}
