import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/reelshort.scss'
import './styles/home-reelshort.scss'
import './styles/profile-reelshort.scss'
import './styles/login-reelshort.scss'
import './styles/shelf-reelshort.scss'
import './styles/shopping-reelshort.scss'
import './styles/reelshort-basics-spin.scss'
import './styles/search-reelshort.scss'
import './styles/my-list-reelshort.scss'
import './styles/episodes-reelshort.scss'
import './styles/pwa-install.scss'
import './styles/ios-pwa-add.scss'
import './styles/feedback-reelshort.scss'
import './styles/membership-reelshort.scss'
import './styles/checkout-reelshort.scss'
import './styles/video-vertical.scss'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

/** 新版本 SW 已下载但处于 waiting 时触发；`true` 会 skipWaiting 并刷新页面以加载最新资源 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <App />,
)
