import type { ITerminalOptions } from '@xterm/xterm'

export type Platform = 'macos' | 'linux' | 'windows'

export type Shell = { command: string | null; cwd: string }

export type Config = {
  shell: Record<Platform, Shell>
  font: { family: string; size: number; lineHeight: number; ligatures: boolean }
  cursor: { style: 'block' | 'bar' | 'underline'; blink: boolean }
  padding: { top: number; right: number; bottom: number; left: number }
  scrollback: number
  colors: {
    background: string
    foreground: string
    cursor: string
    cursorText: string
    selectionBackground: string
    selectionForeground: string
    boldIsBright: boolean
    palette: string[]
  }
}

const paletteKeys = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const

export const paletteNames = paletteKeys.map((key) => {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words[0].toUpperCase() + words.slice(1)
})

export const builtinFonts = [
  { family: 'FiraCode Nerd Font', label: 'Fira Code' },
  { family: 'JetBrainsMono Nerd Font', label: 'JetBrains Mono' },
  { family: 'CaskaydiaCove Nerd Font', label: 'Cascadia Code' },
  { family: 'Hack Nerd Font', label: 'Hack' },
]

export async function loadConfig() {
  const response = await fetch('/api/config')
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as Config
}

export async function loadDefaults() {
  const response = await fetch('/api/config/defaults')
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as Config
}

export const platforms: { value: Platform; label: string }[] = [
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'windows', label: 'Windows' },
]

export async function loadPlatform() {
  const response = await fetch('/api/platform')
  if (!response.ok) throw new Error(await response.text())
  const platform = (await response.json()) as string
  const known = platforms.find((item) => item.value === platform)
  if (!known) throw new Error(`unsupported platform ${platform}`)
  return known.value
}

export async function saveConfig(config: Config) {
  const response = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as Config
}

export async function applyStyle(config: Config) {
  const font = `${config.font.size}px ${config.font.family}`
  await Promise.all([
    document.fonts.load(font),
    document.fonts.load(`bold ${font}`),
  ])
  const style = document.documentElement.style
  style.setProperty('--bg', config.colors.background)
  style.setProperty('--text', config.colors.foreground)
  style.setProperty('--brand', config.colors.palette[4])
  style.setProperty('--danger', config.colors.palette[1])
  style.setProperty('--pad-top', `${config.padding.top}px`)
  style.setProperty('--pad-right', `${config.padding.right}px`)
  style.setProperty('--pad-bottom', `${config.padding.bottom}px`)
  style.setProperty('--pad-left', `${config.padding.left}px`)
}

export function terminalOptions(config: Config): ITerminalOptions {
  const colors = config.colors
  return {
    fontFamily: config.font.family,
    fontSize: config.font.size,
    lineHeight: config.font.lineHeight,
    cursorStyle: config.cursor.style,
    cursorBlink: config.cursor.blink,
    scrollback: config.scrollback,
    drawBoldTextInBrightColors: colors.boldIsBright,
    theme: {
      background: colors.background,
      foreground: colors.foreground,
      cursor: colors.cursor,
      cursorAccent: colors.cursorText,
      selectionBackground: colors.selectionBackground,
      selectionForeground: colors.selectionForeground,
      ...Object.fromEntries(
        paletteKeys.map((key, index) => [key, colors.palette[index]])
      ),
    },
  }
}
