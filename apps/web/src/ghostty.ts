import type { ITheme } from '@xterm/xterm'

export type GhosttyConfig = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  fontFeatureSettings: string
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  boldIsBright: boolean
  padding: { top: number; bottom: number; left: number; right: number }
  theme: ITheme & { background: string; foreground: string }
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

function parsePadding(key: string, value: string) {
  const parts = value.split(',').map((part) => Number(part.trim()))
  if (parts.some((part) => !Number.isFinite(part) || part < 0))
    throw new Error(`Invalid ${key}: ${value}`)
  if (parts.length === 1) return [parts[0], parts[0]]
  if (parts.length === 2) return parts
  throw new Error(`Invalid ${key}: ${value}`)
}

function parseFeature(feature: string) {
  const match = feature.match(/^([+-]?)([A-Za-z0-9]{4})(?:=(\d+))?$/)
  if (!match) throw new Error(`Unsupported font-feature: ${feature}`)
  if (match[1] === '-') return `"${match[2]}" 0`
  if (match[3] !== undefined) return `"${match[2]}" ${match[3]}`
  return `"${match[2]}" 1`
}

function parseColor(key: string, value: string) {
  const match = value.match(/^#?([0-9a-f]{6})$/i)
  if (!match)
    throw new Error(
      `Unsupported ${key}: ${value} (only hex colors are supported)`
    )
  return `#${match[1]}`
}

function parseBoolean(key: string, value: string) {
  if (value === '' || value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Invalid ${key}: ${value}`)
}

export function parseGhosttyConfig(text: string): GhosttyConfig {
  const families: string[] = []
  const features: string[] = []
  const extendedAnsi: string[] = []
  const theme: GhosttyConfig['theme'] = {
    background: '#282c34',
    foreground: '#ffffff',
  }
  let fontSize = 13
  let lineHeight = 1
  let cursorStyle: GhosttyConfig['cursorStyle'] = 'block'
  let cursorBlink = true
  let boldIsBright = false
  let paddingX = [2, 2]
  let paddingY = [2, 2]

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')

    if (key === 'font-family') {
      if (value === '') families.length = 0
      else families.push(value)
    }
    if (key === 'font-size') {
      fontSize = Number(value)
      if (!Number.isFinite(fontSize) || fontSize <= 0)
        throw new Error(`Invalid font-size: ${value}`)
    }
    if (key === 'adjust-cell-height') {
      const match = value.match(/^(-?\d+(?:\.\d+)?)%$/)
      if (!match)
        throw new Error(
          `Unsupported adjust-cell-height: ${value} (only percentages are supported)`
        )
      lineHeight = 1 + Number(match[1]) / 100
    }
    if (key === 'font-feature') {
      if (value === '') features.length = 0
      else
        features.push(
          ...value.split(',').map((feature) => parseFeature(feature.trim()))
        )
    }
    if (key === 'cursor-style') {
      if (value !== 'block' && value !== 'bar' && value !== 'underline') {
        throw new Error(`Unsupported cursor-style: ${value}`)
      }
      cursorStyle = value
    }
    if (key === 'cursor-style-blink') cursorBlink = parseBoolean(key, value)
    if (key === 'bold-is-bright') boldIsBright = parseBoolean(key, value)
    if (key === 'window-padding-x') paddingX = parsePadding(key, value)
    if (key === 'window-padding-y') paddingY = parsePadding(key, value)
    if (key === 'background') theme.background = parseColor(key, value)
    if (key === 'foreground') theme.foreground = parseColor(key, value)
    if (key === 'cursor-color') theme.cursor = parseColor(key, value)
    if (key === 'cursor-text') theme.cursorAccent = parseColor(key, value)
    if (key === 'selection-background')
      theme.selectionBackground = parseColor(key, value)
    if (key === 'selection-foreground')
      theme.selectionForeground = parseColor(key, value)
    if (key === 'palette') {
      const match = value.match(/^(\d+)\s*=\s*(.+)$/)
      if (!match || Number(match[1]) > 255)
        throw new Error(`Invalid palette: ${value}`)
      const index = Number(match[1])
      const color = parseColor(key, match[2].trim())
      if (index < 16) theme[paletteKeys[index]] = color
      else extendedAnsi[index - 16] = color
    }
  }

  return {
    fontFamily: [...families.map((family) => `"${family}"`), 'monospace'].join(
      ', '
    ),
    fontSize,
    lineHeight,
    fontFeatureSettings: features.length === 0 ? 'normal' : features.join(', '),
    cursorStyle,
    cursorBlink,
    boldIsBright,
    padding: {
      left: paddingX[0],
      right: paddingX[1],
      top: paddingY[0],
      bottom: paddingY[1],
    },
    theme: { ...theme, extendedAnsi },
  }
}
