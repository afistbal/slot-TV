import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

/** 发版不自动 reload；F5 或关掉再开时新 SW 激活进新版 */
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <App />,
)
