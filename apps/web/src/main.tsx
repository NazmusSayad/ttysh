import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { applyStyle, loadConfig, loadPlatform } from './config'
import { start } from './session'
import { SettingsPage } from './settings-page'
import { startShortcuts } from './shortcuts'
import { loadThemes } from './themes'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

async function main(container: HTMLElement) {
  try {
    const [config, platform] = await Promise.all([
      loadConfig(),
      loadPlatform(),
      loadThemes(),
    ])
    await applyStyle(config)
    if (location.pathname === '/settings') {
      document.title = 'Settings'
      createRoot(container).render(
        <StrictMode>
          <SettingsPage config={config} platform={platform} />
        </StrictMode>
      )
      return
    }
    start(config, platform)
    startShortcuts()
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  } catch (error) {
    container.className = 'p-4 whitespace-pre-wrap text-red-400'
    container.textContent = String(error)
  }
}

void main(root)
