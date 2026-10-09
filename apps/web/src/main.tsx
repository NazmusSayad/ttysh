import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { parseGhosttyConfig } from './ghostty'
import { start } from './session'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

async function main(container: HTMLElement) {
  try {
    const response = await fetch('/api/ghostty')
    if (!response.ok)
      throw new Error(`Cannot load Ghostty config: ${await response.text()}`)
    const config = parseGhosttyConfig(await response.text())
    await document.fonts.load(`${config.fontSize}px ${config.fontFamily}`)
    const style = document.documentElement.style
    style.setProperty('--bg', config.theme.background)
    style.setProperty('--text', config.theme.foreground)
    style.setProperty('--accent', config.theme.blue ?? '#61afef')
    style.setProperty('--pad-top', `${config.padding.top}px`)
    style.setProperty('--pad-bottom', `${config.padding.bottom}px`)
    style.setProperty('--pad-left', `${config.padding.left}px`)
    style.setProperty('--pad-right', `${config.padding.right}px`)
    start(config)
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  } catch (error) {
    container.className = 'failure'
    container.textContent = String(error)
  }
}

void main(root)
