import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'vite.svg'],
      manifest: {
        name: 'WACR - Web Antigravity Comic Reader',
        short_name: 'WACR',
        description: 'Premium Web Reader for Komga',
        theme_color: '#1C1C1E',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        navigateFallbackDenylist: [/^\/komga-proxy/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB
      }
    }),
  ],
  base: '/WACR/', // Restored per user request
  server: {
    host: true, // Allow external access (iPad)
    proxy: {
      // Proxying /komga-proxy requests to the real server
      '/komga-proxy': {
        target: 'https://phnx-komga-mi.duckdns.org:8843',
        changeOrigin: true,
        secure: false, // Ignore self-signed certs if any
        rewrite: (path) => path.replace(/^\/komga-proxy(:\d+)?/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})
