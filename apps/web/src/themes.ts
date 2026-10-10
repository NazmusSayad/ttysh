import type { Config, ThemeColors } from './config'

export type BuiltinTheme = { id: string; name: string; colors: ThemeColors }

export const customTheme = 'custom'

let builtinThemes: BuiltinTheme[] = []

export async function loadThemes() {
  const response = await fetch('/api/themes')
  if (!response.ok) throw new Error(await response.text())
  builtinThemes = (await response.json()) as BuiltinTheme[]
}

export function getThemes() {
  return builtinThemes
}

export function themeColors(theme: Config['theme']) {
  if (theme.name === customTheme) {
    if (!theme.colors) throw new Error('the custom theme has no colors')
    return theme.colors
  }
  const builtin = builtinThemes.find((item) => item.id === theme.name)
  if (!builtin) throw new Error(`unknown theme ${theme.name}`)
  return builtin.colors
}
