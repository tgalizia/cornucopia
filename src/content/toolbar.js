import { MSG } from '../shared/messages.js'
import { extensionContextAlive, invalidatedError } from '../shared/extension-context.js'
import { retire } from './lifetime.js'

export function mountToolbar(root, { title, actions = [], onExit }) {
  const bar = document.createElement('div')
  bar.className = 'toolbar'
  bar.addEventListener('pointerdown', (event) => event.stopPropagation())
  bar.addEventListener('click', (event) => event.stopPropagation())

  const name = document.createElement('span')
  name.className = 'toolbar-title'
  name.textContent = title
  bar.append(name)

  const buttons = actions.map((action) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    button.classList.toggle('is-active', Boolean(action.active))
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      action.onClick()
    })
    bar.append(button)
    return { id: action.id, button }
  })

  const exit = document.createElement('button')
  exit.type = 'button'
  exit.className = 'exit'
  exit.textContent = 'Exit'
  exit.addEventListener('click', (event) => {
    event.stopPropagation()
    onExit()
  })
  bar.append(exit)
  root.append(bar)

  return {
    element: bar,
    setActive(id) {
      for (const item of buttons) item.button.classList.toggle('is-active', item.id === id)
    },
  }
}

export function requestExit() {
  if (!extensionContextAlive()) {
    retire()
    return
  }
  try {
    chrome.runtime.sendMessage({ type: MSG.deactivate })
  } catch (error) {
    if (invalidatedError(error)) retire()
    else throw error
  }
}
