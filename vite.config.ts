import { defineConfig, loadEnv, type Plugin } from 'vite'
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

/** 与 `scripts/sync-public-html-assets.mjs` 规则一致：为 HTML 内引用的本地图标/清单加 `?v=package.version`。 */
function patchHtmlAssetRefs(html: string, version: string): string {
  const q = `?v=${encodeURIComponent(version)}`
  return html.replace(
    /(href|src)="(\/(?:favorite\.svg|logo\.png|icons\/192\.png|icons\/512\.png|manifest\.json))(?:\?[^"#]*)?"/g,
    (_m, attr, p) => `${attr}="${p}${q}"`,
  )
}

function htmlAssetCacheBust(version: string): Plugin {
  const publicHtmlNames = new Set(['reelshort-privacy-policy.html', 'airwallex.html'])
  return {
    name: 'html-asset-cache-bust',
    enforce: 'pre',
    transformIndexHtml(html) {
      return patchHtmlAssetRefs(html, version)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        const name = raw.startsWith('/') ? raw.slice(1) : raw
        if (!publicHtmlNames.has(name)) {
          next()
          return
        }
        const fp = path.join(process.cwd(), 'public', name)
        try {
          const disk = readFileSync(fp, 'utf-8')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(patchHtmlAssetRefs(disk, version))
        } catch {
          next()
        }
      })
    },
  }
}

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
      htmlAssetCacheBust(appVersion),
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
