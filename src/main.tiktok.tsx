import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import VePlayerTest from './pages/user/VePlayerTest'
import './index.css'

/**
 * TikTok Minis 的独立入口。
 *
 * 不复用 `main.tsx`，避免在 TikTok WebView 注册 H5 PWA service worker；
 * 现有 H5 的启动、缓存与更新逻辑因此保持完全不变。
 */
const root = createRoot(document.getElementById('root')!)

root.render(
  import.meta.env.VITE_TIKTOK_VEPLAYER_TEST === '1'
    ? <VePlayerTest />
    : <App />,
)
