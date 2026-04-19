// Vite config for the Deep Dive app.
// Locks dev + preview to port 3000 so the URL never shifts, and opens
// a browser automatically on `npm run dev`.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
})
