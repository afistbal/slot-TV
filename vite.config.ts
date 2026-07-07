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
  legalSiteUrl: string
  assetBase: string
  faviconSrc: string
  logoSrc: string
  topnavWordmarkSrc: string
  icon192Src: string
  icon512Src: string
}

function normalizePublicBase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (/^(?:https?:)?\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }
  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

function joinPublicAsset(base: string, file: string): string {
  const normalizedBase = normalizePublicBase(base)
  const normalizedFile = file.replace(/^\/+/, '')
  if (!normalizedBase) {
    return `/${normalizedFile}`
  }
  return `${normalizedBase}/${normalizedFile}`
}

function withAssetVersion(src: string, version: string): string {
  const sep = src.includes('?') ? '&' : '?'
  return `${src}${sep}v=${encodeURIComponent(version)}`
}

function legalSiteUrlFromDomainDisplay(domainDisplay: string): string {
  const domain = domainDisplay.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
  if (!domain) {
    return 'https://www.yogoshort.com'
  }
  return `https://${domain.startsWith('www.') ? domain : `www.${domain}`}`
}

function brandConfigFromEnv(env: Record<string, string>): BrandConfig {
  const displayName = (env.VITE_BRAND_DISPLAY_NAME || 'YogoShort').trim()
  const domainDisplay = (env.VITE_BRAND_DOMAIN_DISPLAY || `${displayName}.com`).trim()
  const assetBase = normalizePublicBase(env.VITE_BRAND_ASSET_BASE || '/brands/yogoshort')
  return {
    displayName,
    domainDisplay,
    description: (env.VITE_BRAND_DESCRIPTION || `Watch short dramas on ${displayName}.`).trim(),
    shareOrigin: (env.VITE_SHARE_ORIGIN || '').trim().replace(/\/+$/, ''),
    apiBaseURL: (env.VITE_API_BASE_URL || 'https://test.yogoshort.com/api').trim(),
    legalSiteUrl: (env.VITE_BRAND_LEGAL_SITE_URL || legalSiteUrlFromDomainDisplay(domainDisplay)).trim().replace(/\/+$/, ''),
    assetBase,
    faviconSrc: joinPublicAsset(assetBase, 'favorite.png'),
    logoSrc: joinPublicAsset(assetBase, 'new-logo.png'),
    topnavWordmarkSrc: joinPublicAsset(assetBase, 'web_logo.webp'),
    icon192Src: joinPublicAsset(assetBase, 'icons/new-192.png'),
    icon512Src: joinPublicAsset(assetBase, 'icons/new-512.png'),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceMetaContent(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+[^>]*${attr}="${escapeRegExp(key)}"[^>]*content=")[^"]*(")`, 'i')
  return html.replace(pattern, (_m, before, after) => `${before}${value}${after}`)
}

function patchHtmlBrand(html: string, brand: BrandConfig, version?: string): string {
  const logoSrc = version ? withAssetVersion(brand.logoSrc, version) : brand.logoSrc
  let next = html
  next = replaceMetaContent(next, 'name', 'mobile-web-app-title', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:title', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:description', brand.description)
  next = replaceMetaContent(next, 'property', 'og:site_name', brand.displayName)
  next = replaceMetaContent(next, 'property', 'og:url', brand.shareOrigin || '/')
  next = replaceMetaContent(next, 'property', 'og:image', logoSrc)
  next = replaceMetaContent(next, 'name', 'twitter:title', brand.displayName)
  next = replaceMetaContent(next, 'name', 'twitter:description', brand.description)
  next = replaceMetaContent(next, 'name', 'twitter:image', logoSrc)
  return next.replace(/<title>[^<]*<\/title>/i, `<title>${brand.displayName}</title>`)
}

function patchManifestBrand(raw: string, brand: BrandConfig): string {
  const manifest = JSON.parse(raw) as Record<string, unknown>
  manifest.name = brand.displayName
  manifest.short_name = brand.displayName
  manifest.icons = [
    {
      src: brand.icon192Src,
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: brand.icon512Src,
      sizes: '512x512',
      type: 'image/png',
    },
  ]
  return `${JSON.stringify(manifest, null, 4)}\n`
}

function patchOpNewShareBrand(raw: string, brand: BrandConfig, version?: string): string {
  const faviconSrc = version ? withAssetVersion(brand.faviconSrc, version) : brand.faviconSrc
  const logoSrc = version ? withAssetVersion(brand.logoSrc, version) : brand.logoSrc
  let next = patchHtmlBrand(raw, brand, version).replaceAll('YogoShort', brand.displayName)
  next = next.replace(
    /(<link\s+rel="icon"[^>]*href=")[^"]*(")/i,
    (_m, before, after) => `${before}${faviconSrc}${after}`,
  )
  next = next.replace(
    /(<img\s+class="topbar__logo"\s+src=")[^"]*(")/i,
    (_m, before, after) => `${before}${logoSrc}${after}`,
  )
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

function patchLegalSiteUrl(raw: string, brand: BrandConfig): string {
  return raw
    .replace(/https:\/\/(?:www\.)?yogoshort\.com/gi, brand.legalSiteUrl)
    .replace(/\bYogoShort\b/g, brand.displayName)
}

/** 与 `scripts/sync-public-html-assets.mjs` 规则一致：为 HTML 内引用的本地图标/清单加 `?v=package.version`。 */
function patchHtmlAssetRefs(html: string, version: string, brand: BrandConfig): string {
  const assetByPath: Record<string, string> = {
    '/favorite.png': brand.faviconSrc,
    '/favorite.svg': brand.faviconSrc,
    '/new-logo.png': brand.logoSrc,
    '/web_logo.webp': brand.topnavWordmarkSrc,
    '/icons/new-192.png': brand.icon192Src,
    '/icons/new-512.png': brand.icon512Src,
    '/manifest.json': '/manifest.json',
  }
  return html
    .replace(
      /(href|src)="(\/(?:favorite\.(?:png|svg)|new-logo\.png|web_logo\.webp|icons\/new-192\.png|icons\/new-512\.png|manifest\.json))(?:\?[^"#]*)?"/g,
      (_m, attr, p) => `${attr}="${withAssetVersion(assetByPath[p] ?? p, version)}"`,
    )
    .replace(/(<link\s+rel="icon"\s+)type="image\/svg\+xml"/g, '$1type="image/png"')
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

function createOpNewStaticHandler(brand: BrandConfig, version: string) {
  return function serveOpNewStatic(req: IncomingMessage, res: ServerResponse, next: () => void) {
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
      const disk = readFileSync(fp)
      res.end(ext === '.html' ? patchOpNewShareBrand(disk.toString('utf-8'), brand, version) : disk)
    } catch {
      next()
    }
  }
}

/** 打包时复制 op_new/（App 分享落地页）到 outDir；dev/preview 可直接访问 /op_new/ */
function opNewStatic(outDir: string, brand: BrandConfig, version: string): Plugin {
  const serveOpNewStatic = createOpNewStaticHandler(brand, version)
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
      return patchHtmlBrand(patchHtmlAssetRefs(html, version, brand), brand, version)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        const name = raw.startsWith('/') ? raw.slice(1) : raw
        if (name === 'manifest.json') {
          const fp = path.join(process.cwd(), 'public', name)
          try {
            const disk = readFileSync(fp, 'utf-8')
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
            res.end(patchManifestBrand(disk, brand))
          } catch {
            next()
          }
          return
        }
        if (!publicHtmlNames.has(name)) {
          next()
          return
        }
        const fp = path.join(process.cwd(), 'public', name)
        try {
          const disk = readFileSync(fp, 'utf-8')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(patchLegalSiteUrl(patchHtmlBrand(patchHtmlAssetRefs(disk, version, brand), brand, version), brand))
        } catch {
          next()
        }
      })
    },
  }
}

function patchStaticBrandFiles(outDir: string, brand: BrandConfig, version: string): Plugin {
  return {
    name: 'patch-static-brand-files',
    closeBundle() {
      const manifestPath = path.join(outDir, 'manifest.json')
      if (existsSync(manifestPath)) {
        writeFileSync(manifestPath, patchManifestBrand(readFileSync(manifestPath, 'utf-8'), brand), 'utf-8')
      }

      const opNewSharePath = path.join(outDir, 'op_new', 'app-google-share.html')
      if (existsSync(opNewSharePath)) {
        writeFileSync(opNewSharePath, patchOpNewShareBrand(readFileSync(opNewSharePath, 'utf-8'), brand, version), 'utf-8')
      }

      for (const name of ['airwallex.html', 'reelshort-privacy-policy.html']) {
        const publicHtmlPath = path.join(outDir, name)
        if (existsSync(publicHtmlPath)) {
          const next = patchHtmlBrand(
            patchHtmlAssetRefs(readFileSync(publicHtmlPath, 'utf-8'), version, brand),
            brand,
            version,
          )
          writeFileSync(publicHtmlPath, patchLegalSiteUrl(next, brand), 'utf-8')
        }
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
      opNewStatic(outDir, brand, appVersion),
      patchStaticBrandFiles(outDir, brand, appVersion),
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
