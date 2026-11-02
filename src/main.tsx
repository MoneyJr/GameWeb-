import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>,
)

// PWA: в продакшене регистрируем service worker (установка на главный экран, офлайн-запуск).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* Игра работает и без service worker. */ })
  })
}

// Запоминаем предложение установки (Android/Chrome), чтобы показать кнопку в настройках.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  ;(window as unknown as { __inkInstallPrompt?: Event }).__inkInstallPrompt = event
})
