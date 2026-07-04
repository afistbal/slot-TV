import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from "path"

const OP_NEW_DIR = path.join(process.cwd(), 'op_new')

const OP_NEW_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string }
const appVersion = packageJson.version ?? '0.0.0'

type BrandConfig = {
  displayName: string
  domainDisplay: string
  description: string
  shareOrigin: string
  apiBaseURL: string
}

function brandConfigFromEnv(env: Record<string, string>): BrandConfig {
  const displayName = (env.VITE_BRAND_DISPLAY_NAME || 'YogoShort').trim()
  return {
    displayName,
    domainDisplay: (env.VITE_BRAND_DOMAIN_DISPLAY || `${displayName}.com`).trim(),
    description: (env.VITE_BRAND_DESCRIPTION || `Watch short dramas on ${displayName}.`).trim(),
    shareOrigin: (env.VITE_SHARE_ORIGIN || '').trim().replace(/\/+$/, ''),
    apiBaseURL: (env.VITE_API_BASE_URL || 'https://test.yogoshort.com/api').trim(),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceMetaContent(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+[^>]*${attr}="${escapeRegExp(key)}"[^>]*content=")[^"]*(")`, 'i')
  return html.replace(pattern, (_m, before, after) => `${before}${value}${after}`)
}

function patchHtmlBrand(html: string, brand: BrandConfig): string {
  let next = html
  next = replaceMetaContent(next, 'name', 'mobile-web-app-title', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:title', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:description', brand.description)
  next = replaceMetaContent(next, 'property', 'og:site_name', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:url', brand.shareOrigin || '/')
  next = replaceMetaContent(next, 'name', 'twitter:title', brand.displayName)
  next = replaceMetaContent(next, 'name', 'twitter:description', brand.description)
  return next.replace(/<title>[^<]*<\/title>/i, `<title>${brand.displayName}</title>`)
}

function patchManifestBrand(raw: string, brand: BrandConfig): string {
  const manifest = JSON.parse(raw) as Record<string, unknown>
  manifest.name = brand.displayName
  manifest.short_name = brand.displayName
  return `${JSON.stringify(manifest, null, 4)}\n`
}

function patchOpNewShareBrand(raw: string, brand: BrandConfig): string {
  let next = patchHtmlBrand(raw, brand).replaceAll('YogoShort', brand.displayName)
  next = next.replace(
    "return isTest ? 'https://test.yogoshort.com/api' : 'https://i.yogoshort.com/api';",
    `return '${brand.apiBaseURL}';`,
  )
  if (brand.shareOrigin) {
    next = next.replace(
      "return isTest ? 'https://testwww.yogoshort.com' : 'https://yogoshort.com';",
      `return '${brand.shareOrigin}';`,
    )
  }
  return next
}

function patchShareBladeSiteName(raw: string, brand: BrandConfig): string {
  return replaceMetaContent(raw, 'property', 'og:site_name', brand.displayName)
}

/** 与 `scripts/sync-public-html-assets.mjs` 规则一致：为 HTML 内引用的本地图标/清单加 `?v=package.version`。 */
function patchHtmlAssetRefs(html: string, version: string): string {
  const q = `?v=${encodeURIComponent(version)}`
  return html
    .replace(
      /(href|src)="(\/(?:favorite\.svg|new-logo\.png|web_logo\.webp|icons\/new-192\.png|icons\/new-512\.png|manifest\.json))(?:\?[^"#]*)?"/g,
      (_m, attr, p) => `${attr}="${p}${q}"`,
    )
    .replace(
      /(<meta\s+name="app-version"\s+content=")[^"]*("\s*\/?>)/g,
      (_m, before, after) => `${before}${version}${after}`,
    )
}

/** 从环境变量推断 API 源站 origin，供 `<link rel=preconnect>` 提前建连（弱网略减首包后首请求的 RTT） */
function inferApiOriginForPreconnect(env: Record<string, string>): string {
  const base = env.VITE_API_BASE_URL?.trim() ?? ''
  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      return new URL(base).origin
    } catch {
      /* fall through */
    }
  }
  const proxy = (env.VITE_API_PROXY_TARGET || 'https://test.yogoshort.com').trim()
  try {
    const p = proxy.startsWith('http://') || proxy.startsWith('https://') ? proxy : `https://${proxy}`
    return new URL(p).origin
  } catch {
    return 'https://test.yogoshort.com'
  }
}

function injectApiOriginPreconnect(apiOrigin: string): Plugin {
  return {
    name: 'inject-api-origin-preconnect',
    enforce: 'pre',
    transformIndexHtml(html) {
      if (html.includes('id="slot-api-origin-preconnect"')) {
        return html
      }
      const hints =
        `    <link id="slot-api-origin-preconnect" rel="dns-prefetch" href="${apiOrigin}" />\n` +
        `    <link rel="preconnect" href="${apiOrigin}" crossorigin />\n`
      return html.replace('<head>', `<head>\n${hints}`)
    },
  }
}

function serveOpNewStatic(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const raw = req.url?.split('?')[0] ?? ''
  if (!raw.startsWith('/op_new')) {
    next()
    return
  }
  let rel = decodeURIComponent(raw.replace(/^\/op_new\/?/, '') || 'app-google-share.html')
  if (rel === '' || rel.endsWith('/')) {
    rel = 'app-google-share.html'
  }
  const fp = path.normalize(path.join(OP_NEW_DIR, rel))
  if (!fp.startsWith(OP_NEW_DIR)) {
    next()
    return
  }
  try {
    const st = statSync(fp)
    if (!st.isFile()) {
      next()
      return
    }
    const ext = path.extname(fp).toLowerCase()
    res.setHeader('Content-Type', OP_NEW_MIME[ext] ?? 'application/octet-stream')
    res.end(readFileSync(fp))
  } catch {
    next()
  }
}

/** 打包时复制 op_new/（App 分享落地页）到 outDir；dev/preview 可直接访问 /op_new/ */
function opNewStatic(outDir: string): Plugin {
  const attachMiddleware = (server: { middlewares: { use: (fn: typeof serveOpNewStatic) => void } }) => {
    server.middlewares.use(serveOpNewStatic)
  }
  return {
    name: 'op-new-static',
    closeBundle() {
      if (!existsSync(OP_NEW_DIR)) {
        return
      }
      const dest = path.join(outDir, 'op_new')
      cpSync(OP_NEW_DIR, dest, { recursive: true })
      console.log(`[op-new-static] copied op_new -> ${dest}`)
    },
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

/** 打包时把根目录分享相关静态文件复制到 outDir，与 index.html 同级 */
function copyShareHtmlFiles(outDir: string): Plugin {
  const names = ['share.template.html', 'share.blade.php', 'share-test.html', 'og-share.html']
  return {
    name: 'copy-share-html-files',
    closeBundle() {
      for (const name of names) {
        const src = path.join(process.cwd(), name)
        if (existsSync(src)) {
          copyFileSync(src, path.join(outDir, name))
        }
      }
    },
  }
}

function htmlAssetCacheBust(version: string, brand: BrandConfig): Plugin {
  const publicHtmlNames = new Set(['reelshort-privacy-policy.html', 'airwallex.html'])
  return {
    name: 'html-asset-cache-bust',
    enforce: 'pre',
    transformIndexHtml(html) {
      return patchHtmlBrand(patchHtmlAssetRefs(html, version), brand)
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
          res.end(patchHtmlBrand(patchHtmlAssetRefs(disk, version), brand))
        } catch {
          next()
        }
      })
    },
  }
}

function patchStaticBrandFiles(outDir: string, brand: BrandConfig): Plugin {
  return {
    name: 'patch-static-brand-files',
    closeBundle() {
      const manifestPath = path.join(outDir, 'manifest.json')
      if (existsSync(manifestPath)) {
        writeFileSync(manifestPath, patchManifestBrand(readFileSync(manifestPath, 'utf-8'), brand), 'utf-8')
      }

      const opNewSharePath = path.join(outDir, 'op_new', 'app-google-share.html')
      if (existsSync(opNewSharePath)) {
        writeFileSync(opNewSharePath, patchOpNewShareBrand(readFileSync(opNewSharePath, 'utf-8'), brand), 'utf-8')
      }

      const airwallexPath = path.join(outDir, 'airwallex.html')
      if (existsSync(airwallexPath)) {
        writeFileSync(airwallexPath, patchHtmlBrand(readFileSync(airwallexPath, 'utf-8'), brand), 'utf-8')
      }

      const shareBladePath = path.join(outDir, 'share.blade.php')
      if (existsSync(shareBladePath)) {
        writeFileSync(shareBladePath, patchShareBladeSiteName(readFileSync(shareBladePath, 'utf-8'), brand), 'utf-8')
      }
    },
  }
}

// https://vite.dev/config/
export default ({ mode, command }: { mode: string; command: string }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const numberedProdMatch = /^prod\d+$/.exec(mode)
  const isProdBuild = mode === 'prod' || mode === 'production'
  const isDevServer = command === 'serve'
  const outDir = numberedProdMatch ? `D:/JJ-TV/movie-www-${mode}` : isProdBuild ? 'D:/JJ-TV/movie-www-prod' : 'D:/JJ-TV/movie-www'
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://test.yogoshort.com'
  const apiOriginForHints = inferApiOriginForPreconnect(env)
  const brand = brandConfigFromEnv(env)

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      htmlAssetCacheBust(appVersion, brand),
      copyShareHtmlFiles(outDir),
      opNewStatic(outDir),
      patchStaticBrandFiles(outDir, brand),
      injectApiOriginPreconnect(apiOriginForHints),
      react(),
      tailwindcss(),
      // legacy({
      //   targets: ['defaults', 'not IE 11'],
      // }),
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: !isDevServer,
        },
        manifest: false,
        injectRegister: false,
        workbox: {
          /** 默认 2 MiB；主 chunk 超限时 build 会失败，见 vite-plugin-pwa / workbox FAQ */
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // injectRegister 为 false 时插件不会自动合并这两项；手动注册仍依赖 SW 主动跳过 waiting 并接管页面。
          skipWaiting: true,
          clientsClaim: true,
          importScripts: [`/pwa-force-reload.js?v=${appVersion}`],
          // 控制 SW 安装体积和请求数量；懒加载路由、语言包、页面级 CSS 由 CDN 按需加载。
          globPatterns: [
            'assets/index-*.js',
            'assets/index-*.css',
            'assets/brand-*.js',
          ],
          // 不再用缓存里的 index.html 兜底所有 SPA 导航，避免旧 app shell 长时间滞留。
          navigateFallback: null,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/op_new\//,
            /^\/[\w-]+\.html/
          ],
          globIgnores: ['**/share*', '**/op_new/**', 'airwallex.html'],
        },
      })
    ],
    build: {
      outDir,
      // 由 `npm run build` 前置脚本清理 outDir，保留 `.git` / `.well-known` / Google 验证 html 等
      emptyOutDir: false,
      rollupOptions: {
        input: {
          index: 'index.html',
          share: 'share.html',
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
      port: 5188,
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
      port: 5188,
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
