import { startPopup } from '../popup/app.js'
import { invalidatedError } from '../shared/extension-context.js'
import popupCss from '../popup/popup.css'

const HOST_STYLES = {
  position: 'fixed',
  top: '8px',
  right: '12px',
  width: '300px',
  'z-index': '2147483647',
  display: 'block',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  'pointer-events': 'auto',
}

let host = null
let generation = 0
let onPointerDown = null

export function menuIsOpen() {
  return Boolean(host)
}

export function closeMenu() {
  generation += 1
  try {
    host?.remove()
  } catch {
    // An orphaned content script can no longer change the page.
  }
  host = null
  if (onPointerDown) {
    try {
      window.removeEventListener('pointerdown', onPointerDown, true)
    } catch {
      // The listener is already gone with the extension context.
    }
    onPointerDown = null
  }
}

export function toggleMenu() {
  if (host) {
    closeMenu()
    return true
  }
  if (!document.documentElement) return false
  const mine = ++generation
  onPointerDown = (event) => {
    if (!host || event.composedPath().includes(host)) return
    closeMenu()
  }
  window.addEventListener('pointerdown', onPointerDown, true)
  openMenu(mine)
  return Boolean(host)
}

function openMenu(mine) {
  try {
    const parent = document.documentElement
    if (!parent) return
    const next = document.createElement('div')
    next.id = 'cornucopia-menu'
    for (const [key, value] of Object.entries(HOST_STYLES)) {
      next.style.setProperty(key, value, 'important')
    }
    const shadow = next.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = popupCss
    const { dropdown, popup } = buildShell()
    shadow.append(style, dropdown)
    parent.append(next)
    if (mine !== generation) {
      next.remove()
      return
    }
    host = next
    startPopup(popup, { onClose: closeMenu })
  } catch (error) {
    if (!invalidatedError(error)) console.error(error)
    if (mine === generation) closeMenu()
  }
}

function buildShell() {
  const dropdown = document.createElement('div')
  dropdown.className = 'dropdown'
  const caret = document.createElement('div')
  caret.className = 'caret'
  caret.setAttribute('aria-hidden', 'true')
  const popup = document.createElement('div')
  popup.className = 'popup'

  const header = document.createElement('header')
  header.className = 'top'
  const icon = document.createElement('img')
  icon.src = chrome.runtime.getURL('icons/icon32.png')
  icon.width = 22
  icon.height = 22
  icon.alt = ''
  const titles = document.createElement('div')
  const heading = document.createElement('h1')
  heading.textContent = 'Cornucopia'
  const subtitle = document.createElement('p')
  subtitle.textContent = 'Local developer tools'
  titles.append(heading, subtitle)
  header.append(icon, titles)

  const notice = document.createElement('p')
  notice.id = 'notice'
  notice.className = 'notice'
  notice.hidden = true
  const tools = document.createElement('div')
  tools.id = 'tools'
  tools.className = 'tools'
  const panel = document.createElement('div')
  panel.id = 'panel'
  const footer = document.createElement('footer')
  footer.id = 'footer'

  popup.append(header, notice, tools, panel, footer)
  dropdown.append(caret, popup)
  return { dropdown, popup }
}
