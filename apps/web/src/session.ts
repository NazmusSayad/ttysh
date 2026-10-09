import { FitAddon } from '@xterm/addon-fit'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import type { GhosttyConfig } from './ghostty'

type Tab = { id: number; name: string }
type Group = { id: number; name: string; tabs: Tab[]; activeTab: number | null }
type Layout = { groups: Group[]; activeGroup: number | null; nextId: number }
type State = {
  status: 'connecting' | 'active' | 'paused'
  layout: Layout
  ctrl: boolean
}

type Request =
  | { type: 'hello'; clientId: string }
  | { type: 'resume'; clientId: string }
  | { type: 'createGroup' }
  | { type: 'createTab'; groupId: number }
  | { type: 'close'; id: number }
  | { type: 'rename'; id: number; name: string }
  | { type: 'select'; groupId: number; tabId: number | null }
  | { type: 'resize'; id: number; cols: number; rows: number }

type Message =
  | { type: 'active'; layout: Layout }
  | { type: 'layout'; layout: Layout }
  | { type: 'paused' }

type Session = { terminal: Terminal; fit: FitAddon; element: HTMLDivElement }

export const clientId =
  sessionStorage.getItem('clientId') ??
  Math.random().toString(36).slice(2) + Date.now().toString(36)
sessionStorage.setItem('clientId', clientId)

const encoder = new TextEncoder()
const sessions = new Map<number, Session>()
const listeners = new Set<() => void>()
let state: State = {
  status: 'connecting',
  layout: { groups: [], activeGroup: null, nextId: 0 },
  ctrl: false,
}
let config: GhosttyConfig
let socket: WebSocket
let hiddenAt = 0

export function start(loaded: GhosttyConfig) {
  config = loaded
  socket = connect()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now()
      return
    }
    if (Date.now() - hiddenAt > 10_000) {
      socket.onclose = null
      socket.close()
      socket = connect()
    }
  })
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getState() {
  return state
}

function setState(next: Partial<State>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

export function send(request: Request) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(request))
}

export function sendInput(id: number, data: string | Uint8Array) {
  if (socket.readyState !== WebSocket.OPEN) return
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const message = new Uint8Array(8 + bytes.length)
  new DataView(message.buffer).setBigUint64(0, BigInt(id))
  message.set(bytes, 8)
  socket.send(message)
}

export function toggleCtrl() {
  setState({ ctrl: !state.ctrl })
}

function connect() {
  const next = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
  )
  next.binaryType = 'arraybuffer'
  next.onopen = () => send({ type: 'hello', clientId })
  next.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const id = Number(new DataView(event.data).getBigUint64(0))
      sessions.get(id)?.terminal.write(new Uint8Array(event.data, 8))
      return
    }
    handle(JSON.parse(event.data))
  }
  next.onclose = () => {
    setState({ status: 'connecting' })
    setTimeout(() => {
      socket = connect()
    }, 1000)
  }
  return next
}

function handle(message: Message) {
  if (message.type === 'paused') {
    setState({ status: 'paused' })
    return
  }
  if (message.type === 'active') {
    for (const session of sessions.values()) session.terminal.reset()
  }
  sync(message.layout)
  if (message.type === 'active') {
    sessions.forEach((session, id) => {
      if (session.terminal.element) reportSize(id, session.terminal)
    })
  }
  setState({ status: 'active', layout: message.layout })
}

function sync(layout: Layout) {
  const ids = new Set(
    layout.groups.flatMap((group) => group.tabs.map((tab) => tab.id))
  )
  sessions.forEach((session, id) => {
    if (ids.has(id)) return
    session.terminal.dispose()
    sessions.delete(id)
  })
  for (const id of ids) {
    if (!sessions.has(id)) sessions.set(id, createSession(id))
  }
}

function createSession(id: number) {
  const terminal = new Terminal({
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    lineHeight: config.lineHeight,
    cursorStyle: config.cursorStyle,
    cursorBlink: config.cursorBlink,
    drawBoldTextInBrightColors: config.boldIsBright,
    theme: config.theme,
    scrollback: 100_000,
    allowProposedApi: true,
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.onData((data) => sendInput(id, applyCtrl(data)))
  terminal.onBinary((data) =>
    sendInput(
      id,
      Uint8Array.from(data, (character) => character.charCodeAt(0))
    )
  )
  terminal.onResize((size) =>
    send({ type: 'resize', id, cols: size.cols, rows: size.rows })
  )
  const element = document.createElement('div')
  element.className = 'screen'
  return { terminal, fit, element }
}

function applyCtrl(data: string) {
  if (!state.ctrl) return data
  setState({ ctrl: false })
  if (data.length !== 1) return data
  const code = data.toUpperCase().charCodeAt(0)
  if (code >= 64 && code <= 95) return String.fromCharCode(code - 64)
  return data
}

function reportSize(id: number, terminal: Terminal) {
  send({ type: 'resize', id, cols: terminal.cols, rows: terminal.rows })
}

export function mount(id: number, container: HTMLElement) {
  const session = sessions.get(id)
  if (!session) throw new Error(`terminal ${id} does not exist`)
  container.appendChild(session.element)
  if (!session.terminal.element) {
    session.terminal.open(session.element)
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    session.terminal.loadAddon(webgl)
    session.terminal.loadAddon(
      new LigaturesAddon({ fontFeatureSettings: config.fontFeatureSettings })
    )
  }
  session.fit.fit()
  reportSize(id, session.terminal)
  session.terminal.focus()
  const observer = new ResizeObserver(() => session.fit.fit())
  observer.observe(container)
  return () => {
    observer.disconnect()
    session.element.remove()
  }
}
