import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA layer — this is what makes Curio installable: Android Chrome
    // offers "Install app" (and packages it as a WebAPK), iOS gets
    // add-to-home-screen with the right icon, and the TWA/APK wrapper
    // (Bubblewrap) requires this manifest to exist. The service worker
    // auto-updates, so an installed Curio still ships from Vercel on
    // every deploy — no rebuild, no store.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Curio — knowledge that sticks',
        short_name: 'Curio',
        description:
          'Swipe through 2-minute, fact-checked knowledge cards. Guess first, keep what sticks.',
        id: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07231a',
        theme_color: '#07231a',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          // Full-bleed ground with the glyph in the safe zone — same file
          // doubles as maskable.
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell precached; everything data-ish stays network-first.
        // Cards, auth and analytics must never be served stale from a
        // service worker — the feed's freshness IS the product (R2/R10).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /metrics\.html/],
        runtimeCaching: [
          {
            urlPattern: /supabase\.co|posthog\.com|\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
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
