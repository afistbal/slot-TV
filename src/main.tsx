import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/reelshort.scss'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <App />,
)
