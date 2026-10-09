import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.join(import.meta.dirname, 'src') },
  },
  server: {
    host: true,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:47831', ws: true },
      '/api': { target: 'http://127.0.0.1:47831' },
    },
  },
})
