import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { applyStyle, loadConfig } from './config'
import { start } from './session'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

async function main(container: HTMLElement) {
  try {
    const config = await loadConfig()
    await applyStyle(config)
    start(config)
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
