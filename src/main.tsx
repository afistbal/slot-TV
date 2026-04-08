import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/reelshort.scss'
import './styles/home-reelshort.scss'
import './styles/shelf-reelshort.scss'
import './styles/episodes-reelshort.scss'
import './styles/pwa-install.scss'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <App />,
)
