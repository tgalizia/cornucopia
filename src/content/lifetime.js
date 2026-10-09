import { extensionContextAlive } from '../shared/extension-context.js'

const RETIRE_EVENT = 'cornucopia-retire'
const session = Math.random().toString(36).slice(2)

let retired = false
const cleanups = []

export function onRetire(cleanup) {
  if (retired) {
    try {
      cleanup()
    } catch {
      // The bindings may already be gone.
    }
    return
  }
  cleanups.push(cleanup)
}

export function retire() {
  if (retired) return
  retired = true
  for (const cleanup of cleanups) {
    try {
      cleanup()
    } catch {
      // The bindings may already be gone.
    }
  }
  cleanups.length = 0
}

export function watchExtensionLifetime() {
  const onEvent = (event) => {
    if (event.detail !== session) retire()
  }
  document.addEventListener(RETIRE_EVENT, onEvent)
  onRetire(() => document.removeEventListener(RETIRE_EVENT, onEvent))
  document.dispatchEvent(new CustomEvent(RETIRE_EVENT, { detail: session }))

  const timer = setInterval(() => {
    if (extensionContextAlive()) return
    clearInterval(timer)
    retire()
  }, 1000)
  onRetire(() => clearInterval(timer))
}
