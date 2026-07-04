import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installChunkLoadRecovery } from './lib/pwaChunkRecovery'

const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 1000
const PWA_SERVICE_WORKER_URL = '/sw.js'
const PWA_FORCE_RELOAD_MESSAGE = 'PWA_FORCE_RELOAD'
const PWA_FORCE_RELOAD_ACK_MESSAGE = 'PWA_FORCE_RELOAD_ACK'
const PWA_DEFERRED_RELOAD_STORAGE_KEY = 'slot:pwa-deferred-reload'
let reloadingForPwaUpdate = false
const hadServiceWorkerController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)

installChunkLoadRecovery()

function isPwaReloadDeferredPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0] ?? ''
  const second = segments[1] ?? ''
  const isLocalePrefix = /^[a-z]{2}(?:-[a-z]{2,4})?$/i.test(first)
  const route = isLocalePrefix ? second : first

  return route === 'video' ||
    route === 'v-demo' ||
    route === 'foryou' ||
    route === 'for-you' ||
    route === 'for-demo' ||
    route === 'episodes'
}

function hasDeferredPwaReload(): boolean {
  try {
    return window.sessionStorage.getItem(PWA_DEFERRED_RELOAD_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function clearDeferredPwaReload(): void {
  try {
    window.sessionStorage.removeItem(PWA_DEFERRED_RELOAD_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function reloadForPwaUpdate(): void {
  if (reloadingForPwaUpdate) return

  reloadingForPwaUpdate = true
  clearDeferredPwaReload()
  window.location.reload()
}

function maybeReloadDeferredPwaUpdate(): void {
  if (!hasDeferredPwaReload()) return
  if (isPwaReloadDeferredPath(window.location.pathname)) return

  reloadForPwaUpdate()
}

let deferredPwaReloadWatcherInstalled = false

function installDeferredPwaReloadWatcher(): void {
  if (deferredPwaReloadWatcherInstalled) return
  deferredPwaReloadWatcherInstalled = true

  const scheduleCheck = () => {
    window.setTimeout(maybeReloadDeferredPwaUpdate, 0)
  }

  const patchHistoryMethod = (method: 'pushState' | 'replaceState') => {
    const original = window.history[method]
    window.history[method] = function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      const result = original.call(this, data, unused, url)
      scheduleCheck()
      return result
    } as typeof original
  }

  patchHistoryMethod('pushState')
  patchHistoryMethod('replaceState')

  window.addEventListener('popstate', scheduleCheck)
  window.addEventListener('hashchange', scheduleCheck)
  window.addEventListener('focus', scheduleCheck)
  window.addEventListener('pageshow', scheduleCheck)
  document.addEventListener('visibilitychange', scheduleCheck)
  window.setInterval(maybeReloadDeferredPwaUpdate, 1000)
}

function deferPwaReloadUntilNonVideoPage(): void {
  try {
    window.sessionStorage.setItem(PWA_DEFERRED_RELOAD_STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures; the current page still stays alive.
  }
  installDeferredPwaReloadWatcher()
}

function reloadOrDeferForPwaUpdate(): void {
  if (isPwaReloadDeferredPath(window.location.pathname)) {
    deferPwaReloadUntilNonVideoPage()
    return
  }

  reloadForPwaUpdate()
}

if (hasDeferredPwaReload()) {
  installDeferredPwaReloadWatcher()
  maybeReloadDeferredPwaUpdate()
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== PWA_FORCE_RELOAD_MESSAGE) return

    event.ports[0]?.postMessage({ type: PWA_FORCE_RELOAD_ACK_MESSAGE })
    reloadOrDeferForPwaUpdate()
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || reloadingForPwaUpdate) return
    reloadOrDeferForPwaUpdate()
  })
}

/** 检测到新 SW 接管后强制刷新；前台运行时主动检查更新，避免长期停在旧版本。 */
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register(PWA_SERVICE_WORKER_URL, { scope: '/' })
    .then((registration) => {
      const checkForUpdate = () => {
        if (document.visibilityState !== 'visible') return
        registration.update().catch(() => undefined)
      }

      checkForUpdate()
      window.setInterval(checkForUpdate, PWA_UPDATE_CHECK_INTERVAL_MS)
      window.addEventListener('focus', checkForUpdate)
      window.addEventListener('online', checkForUpdate)
      document.addEventListener('visibilitychange', checkForUpdate)
    })
    .catch(() => undefined)
}

createRoot(document.getElementById('root')!).render(
  <App />,
)
