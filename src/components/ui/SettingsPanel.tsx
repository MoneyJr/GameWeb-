import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n, type Language } from '../../i18n/I18nProvider'
import { getAudioSettings, playSound, setAudioSettings, subscribeAudioSettings, unlockAudio } from '../../lib/sound'
import { detectQuality, type QualityLevel } from '../../lib/quality'

type InstallPrompt = Event & { prompt: () => Promise<void> }

const LANGUAGES: Array<[Language, string]> = [['ru', 'Русский'], ['en', 'English'], ['de', 'Deutsch'], ['fr', 'Français']]
const isStandalone = () => window.matchMedia?.('(display-mode: fullscreen)').matches || window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Настройки: звук, качество графики, язык и установка игры на телефон. */
export function SettingsPanel({ quality, onQualityChange, onClose }: { quality: QualityLevel; onQualityChange: (level: QualityLevel) => void; onClose: () => void }) {
  const { t, language, setLanguage } = useI18n()
  const [audio, setAudio] = useState(getAudioSettings)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(() => (window as unknown as { __inkInstallPrompt?: InstallPrompt }).__inkInstallPrompt ?? null)
  useEffect(() => subscribeAudioSettings(setAudio), [])
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const qualityOptions: QualityLevel[] = ['auto', 'low', 'medium', 'high']
  const section = 'rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]'
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-bold ${active ? 'border-ink bg-ink text-white' : 'border-ink/25 bg-white hover:bg-stone-100'}`

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[calc(100dvh-32px)] w-full max-w-[440px] space-y-3 overflow-y-auto rounded-3xl border-[3px] border-ink bg-[#f0ede6] p-5 shadow-[0_12px_0_0_var(--color-ink)]" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between"><h2 className="text-2xl font-black">{t('settings.title')}</h2><button onClick={onClose} aria-label={t('modal.close')} className="rounded-full p-2 hover:bg-stone-200"><X className="size-6" /></button></div>

      <div className={section}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">🔊 {t('settings.sound')}</h3>
          <button type="button" className={chip(!audio.muted)} onClick={() => { unlockAudio(); setAudioSettings({ muted: !audio.muted }) }}>{audio.muted ? t('settings.off') : t('settings.on')}</button></div>
        {([['master', t('settings.master')], ['music', t('settings.music')], ['effects', t('settings.effects')]] as const).map(([key, label]) => <label key={key} className="mb-2 grid grid-cols-[90px_1fr_36px] items-center gap-2 text-xs font-bold last:mb-0">
          <span>{label}</span>
          <input type="range" min="0" max="100" value={Math.round(audio[key] * 100)} onChange={(event) => { unlockAudio(); setAudioSettings({ [key]: Number(event.target.value) / 100 }) }} onPointerUp={() => key === 'effects' && playSound('coin')} className="accent-ink" />
          <span className="text-right">{Math.round(audio[key] * 100)}</span>
        </label>)}
      </div>

      <div className={section}>
        <h3 className="mb-2 text-sm font-bold">🎨 {t('settings.graphics')}</h3>
        <div className="flex flex-wrap gap-2">{qualityOptions.map((level) => <button key={level} type="button" className={chip(quality === level)} onClick={() => onQualityChange(level)}>
          {t(`settings.quality.${level}`)}{level === 'auto' ? ` (${t(`settings.quality.${detectQuality()}`)})` : ''}
        </button>)}</div>
        <p className="mt-2 text-[11px] font-semibold text-stone-500">{t('settings.graphicsHint')}</p>
      </div>

      <div className={section}>
        <h3 className="mb-2 text-sm font-bold">🌍 {t('language.label')}</h3>
        <div className="flex flex-wrap gap-2">{LANGUAGES.map(([code, name]) => <button key={code} type="button" className={chip(language === code)} onClick={() => setLanguage(code)}>{name}</button>)}</div>
      </div>

      <div className={section}>
        <h3 className="mb-2 text-sm font-bold">📱 {t('settings.install')}</h3>
        {isStandalone() ? <p className="text-xs font-semibold">{t('settings.installed')}</p>
          : installPrompt ? <button type="button" className="rounded-full bg-[#a65336] px-4 py-2 text-xs font-black text-white" onClick={() => { void installPrompt.prompt(); setInstallPrompt(null) }}>{t('settings.installButton')}</button>
            : <p className="text-xs font-semibold leading-relaxed">{isIos() ? t('settings.installIos') : t('settings.installOther')}</p>}
      </div>
    </div>
  </div>
}
