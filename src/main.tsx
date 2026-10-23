import { SharePosterDialog } from '@/components/SharePosterDialog';
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { RootErrorBoundary } from './App.tsx'
import './lib/documentNavigation'
import { installChunkLoadRecovery } from './lib/pwaChunkRecovery'
import { captureAffiliateReferralFromLocation } from './lib/affiliateReferralStorage'

const PWA_UPDATE_CHECK_MIN_INTERVAL_MS = 3 * 60 * 1000
const PWA_UPDATE_CHECK_MAX_INTERVAL_MS = 5 * 60 * 1000
const PWA_SERVICE_WORKER_URL = '/sw.js'
const PWA_FORCE_RELOAD_MESSAGE = 'PWA_FORCE_RELOAD'
const PWA_FORCE_RELOAD_ACK_MESSAGE = 'PWA_FORCE_RELOAD_ACK'
const PWA_DEFERRED_RELOAD_STORAGE_KEY = 'slot:pwa-deferred-reload'
const PWA_LAST_RELOAD_STORAGE_KEY = 'slot:pwa-last-reload'
const PWA_UPDATE_QUERY_KEY = '_pwa_update'
const PWA_SAFE_RELOAD_ROUTES = new Set([
  '',
  'categories',
  'search',
  'tagSearch',
  'shelf',
  'drama',
  'share',
  'my-list',
])
const PWA_SAFE_RELOAD_PAGE_ROUTES = new Set([
  '',
  'about',
  'text',
  'ios-add-home',
  'search',
])
let reloadingForPwaUpdate = false
let pendingPwaReloadId: string | null = null
let deferredPwaReloadWatcherInstalled = false
const hadServiceWorkerController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)

installChunkLoadRecovery()
captureAffiliateReferralFromLocation()

function clearPwaUpdateQuery(): void {
  const currentUrl = new URL(window.location.href)
  if (!currentUrl.searchParams.has(PWA_UPDATE_QUERY_KEY)) return
  currentUrl.searchParams.delete(PWA_UPDATE_QUERY_KEY)
  window.history.replaceState(window.history.state, '', currentUrl.toString())
}

function normalizePwaUpdateId(value: unknown): string {
  if (typeof value === 'string' && /^[a-z0-9._-]{1,80}$/i.test(value)) return value
  return `v-${__APP_VERSION__}`
}

function isPwaReloadDeferredPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0] ?? ''
  const isLocalePrefix = /^[a-z]{2}(?:-[a-z]{2,4})?$/i.test(first)
  const offset = isLocalePrefix ? 1 : 0
  const route = segments[offset] ?? ''
  const childRoute = segments[offset + 1] ?? ''

  if (PWA_SAFE_RELOAD_ROUTES.has(route)) return false
  if (route === 'page' && PWA_SAFE_RELOAD_PAGE_ROUTES.has(childRoute)) return false

  // Unknown and stateful routes are deliberately conservative. The old asset
  // graph remains available for seven days, so there is no need to interrupt
  // a future checkout, form or playback route merely because it is new to us.
  return true
}

function getDeferredPwaReloadId(): string | null {
  if (pendingPwaReloadId) return pendingPwaReloadId
  try {
    const stored = window.sessionStorage.getItem(PWA_DEFERRED_RELOAD_STORAGE_KEY)
    if (stored === '1') return `legacy-${__APP_VERSION__}`
    return stored
  } catch {
    return null
  }
}

function clearDeferredPwaReload(): void {
  pendingPwaReloadId = null
  try {
    window.sessionStorage.removeItem(PWA_DEFERRED_RELOAD_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function rememberPendingPwaReload(updateId: string): void {
  pendingPwaReloadId = updateId
  try {
    window.sessionStorage.setItem(PWA_DEFERRED_RELOAD_STORAGE_KEY, updateId)
  } catch {
    // The in-memory value keeps this document reliable when storage is blocked.
  }
}

function reloadForPwaUpdate(updateId: string): void {
  if (reloadingForPwaUpdate) return

  try {
    if (window.sessionStorage.getItem(PWA_LAST_RELOAD_STORAGE_KEY) === updateId) {
      clearDeferredPwaReload()
      return
    }
    window.sessionStorage.setItem(PWA_LAST_RELOAD_STORAGE_KEY, updateId)
  } catch {
    // The in-memory guard still prevents duplicate reloads for this document.
  }

  reloadingForPwaUpdate = true
  clearDeferredPwaReload()
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set(PWA_UPDATE_QUERY_KEY, updateId)
  window.location.replace(nextUrl.toString())
}

function maybeReloadDeferredPwaUpdate(): void {
  const updateId = getDeferredPwaReloadId()
  if (!updateId || isPwaReloadDeferredPath(window.location.pathname)) return
  reloadForPwaUpdate(updateId)
}

function installDeferredPwaReloadWatcher(): void {
  if (deferredPwaReloadWatcherInstalled) return
  deferredPwaReloadWatcherInstalled = true

  const scheduleCheck = () => window.setTimeout(maybeReloadDeferredPwaUpdate, 0)
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

function deferPwaReloadUntilSafePage(updateId: string): void {
  rememberPendingPwaReload(updateId)
  installDeferredPwaReloadWatcher()
}

function reloadOrDeferForPwaUpdate(updateId: string): void {
  if (isPwaReloadDeferredPath(window.location.pathname)) {
    deferPwaReloadUntilSafePage(updateId)
    return
  }
  rememberPendingPwaReload(updateId)
  window.setTimeout(() => reloadForPwaUpdate(updateId), 0)
}

clearPwaUpdateQuery()

if (getDeferredPwaReloadId()) {
  installDeferredPwaReloadWatcher()
  maybeReloadDeferredPwaUpdate()
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== PWA_FORCE_RELOAD_MESSAGE) return
    const updateId = normalizePwaUpdateId(event.data.updateId)
    reloadOrDeferForPwaUpdate(updateId)
    const replyPort = event.ports[0]
    replyPort?.postMessage({ type: PWA_FORCE_RELOAD_ACK_MESSAGE })
    replyPort?.close()
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || reloadingForPwaUpdate) return
    reloadOrDeferForPwaUpdate(`controller-${__APP_VERSION__}`)
  })
}

/** Check on meaningful foreground events and periodically without polling every few seconds. */
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register(PWA_SERVICE_WORKER_URL, {
    scope: '/',
    updateViaCache: 'none',
  })
    .then((registration) => {
      let updateCheckInFlight: Promise<void> | null = null

      const checkForUpdate = (): Promise<void> => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) {
          return Promise.resolve()
        }
        if (registration.installing || registration.waiting) return Promise.resolve()
        if (updateCheckInFlight) return updateCheckInFlight

        updateCheckInFlight = registration.update()
          .then(() => undefined)
          .catch(() => undefined)
          .finally(() => {
            updateCheckInFlight = null
          })
        return updateCheckInFlight
      }

      const schedulePeriodicUpdateCheck = () => {
        const jitter = Math.random() * (
          PWA_UPDATE_CHECK_MAX_INTERVAL_MS - PWA_UPDATE_CHECK_MIN_INTERVAL_MS
        )
        window.setTimeout(() => {
          void checkForUpdate().finally(schedulePeriodicUpdateCheck)
        }, PWA_UPDATE_CHECK_MIN_INTERVAL_MS + jitter)
      }

      void checkForUpdate()
      schedulePeriodicUpdateCheck()
      window.addEventListener('focus', () => void checkForUpdate())
      window.addEventListener('online', () => void checkForUpdate())
      document.addEventListener('visibilitychange', () => void checkForUpdate())
    })
    .catch(() => undefined)
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
    <SharePosterDialog />
  </RootErrorBoundary>,
)
