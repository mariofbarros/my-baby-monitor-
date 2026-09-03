import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// O app é publicado no GitHub Pages em https://<usuario>.github.io/my-baby-monitor-/,
// então os assets precisam ser servidos a partir desse subdiretório.
const base = '/my-baby-monitor-/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Diário do Bebê',
        short_name: 'Diário do Bebê',
        lang: 'pt-BR',
        description: 'Acompanhe mamadas, fraldas e crescimento do seu bebê',
        theme_color: '#8a5cf6',
        background_color: '#f7f5fb',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
      },
    }),
  ],
})
