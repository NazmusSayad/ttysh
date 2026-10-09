import { FitAddon } from '@xterm/addon-fit'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import {
  applyStyle,
  type Config,
  type Platform,
  terminalOptions,
} from './config'
import { updateFavicon } from './favicon'

type Tab = { id: number; customName: string | null }
type Group = {
  id: number
  name: string
  logo: string | null
  directory: string | null
  tabs: Tab[]
  activeTab: number | null
}
type Layout = { groups: Group[]; activeGroup: number | null; nextId: number }
type State = {
  status: 'connecting' | 'active' | 'paused'
  layout: Layout
  ctrl: boolean
  config: Config
  platform: Platform
  titles: Record<number, string>
}

type Request =
  | { type: 'hello'; clientId: string }
  | { type: 'resume'; clientId: string }
  | { type: 'createGroup' }
  | { type: 'createTab'; groupId: number }
  | { type: 'close'; id: number }
  | { type: 'rename'; id: number; name: string }
  | { type: 'setDirectory'; id: number; directory: string }
  | { type: 'select'; groupId: number; tabId: number | null }
  | { type: 'resize'; id: number; cols: number; rows: number }

type Message =
  | { type: 'active'; layout: Layout }
  | { type: 'layout'; layout: Layout }
  | { type: 'paused' }
  | { type: 'config'; config: Config }

type Session = {
  terminal: Terminal
  fit: FitAddon
  element: HTMLDivElement
  ligatures: LigaturesAddon | null
}

export const clientId =
  sessionStorage.getItem('clientId') ??
  Math.random().toString(36).slice(2) + Date.now().toString(36)
sessionStorage.setItem('clientId', clientId)

const encoder = new TextEncoder()
const sessions = new Map<number, Session>()
const listeners = new Set<() => void>()
let state: State
let socket: WebSocket
let hiddenAt = 0

export function start(config: Config, platform: Platform) {
  state = {
    status: 'connecting',
    layout: { groups: [], activeGroup: null, nextId: 0 },
    ctrl: false,
    config,
    platform,
    titles: {},
  }
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
  const group = state.layout.groups.find(
    (item) => item.id === state.layout.activeGroup
  )
  const tab = group?.tabs.find((item) => item.id === group.activeTab)
  document.title = tab ? tabTitle(tab) : 'ttysh'
  updateFavicon(group ? group.logo : null, state.config.colors)
  for (const listener of listeners) listener()
}

export function tabTitle(tab: Tab) {
  return (tab.customName ?? state.titles[tab.id]) || 'Terminal'
}

export async function uploadLogo(groupId: number, file: File) {
  const response = await fetch(`/api/groups/${groupId}/logo`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) throw new Error(await response.text())
}

export async function removeLogo(groupId: number) {
  const response = await fetch(`/api/groups/${groupId}/logo`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await response.text())
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
  if (message.type === 'config') {
    void applyConfig(message.config)
    return
  }
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
    ...terminalOptions(state.config),
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
  terminal.onTitleChange((title) =>
    setState({ titles: { ...state.titles, [id]: title } })
  )
  terminal.onResize((size) =>
    send({ type: 'resize', id, cols: size.cols, rows: size.rows })
  )
  const element = document.createElement('div')
  element.className = 'h-full'
  return { terminal, fit, element, ligatures: null }
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
    session.terminal.options = terminalOptions(state.config)
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    session.terminal.loadAddon(webgl)
    syncLigatures(session)
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

function syncLigatures(session: Session) {
  const enabled = state.config.font.ligatures
  if (enabled && !session.ligatures) {
    session.ligatures = new LigaturesAddon()
    session.terminal.loadAddon(session.ligatures)
  }
  if (!enabled && session.ligatures) {
    session.ligatures.dispose()
    session.ligatures = null
  }
}

export async function applyConfig(config: Config) {
  await applyStyle(config)
  setState({ config })
  for (const session of sessions.values()) {
    if (!session.terminal.element) continue
    session.terminal.options = terminalOptions(config)
    syncLigatures(session)
    if (session.element.isConnected) session.fit.fit()
  }
}
