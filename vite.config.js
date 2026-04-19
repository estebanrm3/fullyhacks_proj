// Vite config for the Deep Dive app.
// Locks dev + preview to port 3000 so the URL never shifts, and opens
// a browser automatically on `npm run dev`.

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleGeminiHttp, handleLiveTokenHttp } from './api/_gemini.js'

function localApiPlugin() {
  const route = (req, res, next) => {
    const pathname = req.url?.split('?')[0]

    if (pathname === '/api/gemini') {
      handleGeminiHttp(req, res)
      return
    }

    if (pathname === '/api/live-token') {
      handleLiveTokenHttp(req, res)
      return
    }

    next()
  }

  return {
    name: 'local-gemini-api',
    configureServer(server) {
      server.middlewares.use(route)
    },
    configurePreviewServer(server) {
      server.middlewares.use(route)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY ||= env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY

  return {
    plugins: [react(), localApiPlugin()],
    // Don't let Vite pre-bundle MediaPipe's WASM loader — it ships its own
    // dynamic loader path that breaks when bundled.
    optimizeDeps: {
      exclude: ['@mediapipe/tasks-vision'],
    },
    server: {
      port: 3000,
      strictPort: true, // fail fast instead of silently picking another port
      host: true,       // expose on the LAN too (phones, other devices)
      open: true,       // auto-open the default browser on start
    },
    preview: {
      // `npm run preview` serves the built /dist on the same port.
      port: 3000,
      strictPort: true,
    },
  }
})
