import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-only: Vercel serves api/ functions in production, but `vite dev`
    // knows nothing about them. Point /api at a local shim (or `vercel dev`)
    // on :8125 so endpoints like /api/refill are testable without deploying.
    // Nothing listening there just means those fetches fail — same as before.
    proxy: {
      '/api': 'http://localhost:8125',
    },
  },
})
