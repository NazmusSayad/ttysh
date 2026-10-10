import { getState, send } from './session'

const capturedKeys = ['KeyT', 'KeyN', 'KeyW', 'Tab', 'Escape']
const isMac = navigator.userAgent.includes('Mac')

export function startShortcuts() {
  window.addEventListener('keydown', handleShortcut, true)
}

export async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await document.documentElement.requestFullscreen()
  const { keyboard } = navigator as Navigator & {
    keyboard?: { lock: (keys: string[]) => Promise<void> }
  }
  if (!keyboard) {
    console.warn('this browser cannot capture shortcuts, use Chrome or Edge')
    return
  }
  await keyboard.lock(capturedKeys)
}

function shortcutName(event: KeyboardEvent) {
  if (event.code === 'Tab' && event.ctrlKey && !event.altKey && !event.metaKey)
    return event.shiftKey ? 'previousTab' : 'nextTab'
  const command = isMac
    ? event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
    : event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey
  if (!command) return null
  if (event.code === 'KeyT') return 'newTab'
  if (event.code === 'KeyN') return 'newGroup'
  if (event.code === 'KeyW') return 'closeTab'
  return null
}

function handleShortcut(event: KeyboardEvent) {
  const state = getState()
  if (!state.config.behavior.captureShortcuts) return
  if (!document.fullscreenElement) return
  const shortcut = shortcutName(event)
  if (shortcut === null) return
  event.preventDefault()
  event.stopPropagation()
  if (shortcut === 'newGroup') {
    send({ type: 'createGroup' })
    return
  }
  const group = state.layout.groups.find(
    (item) => item.id === state.layout.activeGroup
  )
  if (!group) return
  if (shortcut === 'newTab') {
    send({ type: 'createTab', groupId: group.id })
    return
  }
  if (group.activeTab === null) return
  if (shortcut === 'closeTab') {
    send({ type: 'close', id: group.activeTab })
    return
  }
  const index = group.tabs.findIndex((tab) => tab.id === group.activeTab)
  const step = shortcut === 'nextTab' ? 1 : -1
  const next =
    group.tabs[(index + step + group.tabs.length) % group.tabs.length]
  if (next) send({ type: 'select', groupId: group.id, tabId: next.id })
}
