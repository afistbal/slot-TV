import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import path from "path"

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string }
const appVersion = packageJson.version ?? '0.0.0'

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProdBuild = mode === 'prod' || mode === 'production'
  const outDir = isProdBuild ? 'D:/JJ-TV/movie-www-prod' : 'D:/JJ-TV/movie-www'
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://test.yogoshort.com'

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
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
          // injectRegister 为 false 时插件不会自动合并这两项；autoUpdate 依赖 SW 内 skipWaiting，否则新版本会一直 waiting
          skipWaiting: true,
          clientsClaim: true,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/[\w-]+\.html/
          ],
          globIgnores: ['**/share*', 'airwallex.html'],
        },
      })
    ],
    build: {
      outDir,
      // 由 `npm run build` 前置脚本清理 outDir，保留 `.git` / `.well-known`（Apple 域名验证等）
      emptyOutDir: false,
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
          target: apiProxyTarget,
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
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  })
}
