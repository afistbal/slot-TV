import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { installChunkLoadRecovery } from './lib/pwaChunkRecovery'

const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 1000
const PWA_FORCE_RELOAD_MESSAGE = 'PWA_FORCE_RELOAD'
const PWA_FORCE_RELOAD_ACK_MESSAGE = 'PWA_FORCE_RELOAD_ACK'
let reloadingForPwaUpdate = false
const hadServiceWorkerController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)

installChunkLoadRecovery()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== PWA_FORCE_RELOAD_MESSAGE) return

    event.ports[0]?.postMessage({ type: PWA_FORCE_RELOAD_ACK_MESSAGE })
    if (reloadingForPwaUpdate) return

    reloadingForPwaUpdate = true
    window.location.reload()
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || reloadingForPwaUpdate) return
    reloadingForPwaUpdate = true
    window.location.reload()
  })
}

/** 检测到新 SW 接管后强制刷新；前台运行时主动检查更新，避免长期停在旧版本。 */
registerSW({
  immediate: true,
  onRegisteredSW(_swScriptUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return
      registration.update().catch(() => undefined)
    }

    checkForUpdate()
    window.setInterval(checkForUpdate, PWA_UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    document.addEventListener('visibilitychange', checkForUpdate)
  },
})

createRoot(document.getElementById('root')!).render(
  <App />,
)
