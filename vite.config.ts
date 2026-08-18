import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 5190,
    strictPort: true,
    // Lets the app be reached through a Cloudflare quick tunnel (see
    // `npx cloudflared tunnel --url http://localhost:5190`) for sharing a
    // trial link with people off this machine — Vite otherwise rejects any
    // request whose Host header it doesn't recognize (DNS-rebinding guard).
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    port: 4190,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TodaRide — SaaS Model',
        short_name: 'TodaRide SaaS',
        description:
          'Safe Ride, Safe Arrival — on-demand tricycle booking with student safety tracking (TaaS/SaaS model — each TODA, Operator, and Franchise subscribes as its own licensed partner)',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
