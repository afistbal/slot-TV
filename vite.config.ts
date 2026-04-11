import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // legacy({
    //   targets: ['defaults', 'not IE 11'],
    // }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: false,
      injectRegister: false,
      workbox: {
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/[\w-]+\.html/
        ],
        globIgnores: ['**/share*', 'airwallex.html'],
      },
    })
  ],
  build: {
    outDir: 'D:/JJ-TV/movie-www',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'index': 'index.html',
        'share': 'share.html',
      },
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },

  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://test.yogoshort.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://test.yogoshort.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
