import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib'
import { Boxes, PencilLine, Play, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { useI18n, type Language } from '../../i18n/I18nProvider'
import { ToonShadingSetup } from '../3d/InkOutlinePass'
import { currentSeason, SEASON_PALETTES } from '../../lib/season'
import { Snowfall } from '../3d/Snowfall'
import { getAudioSettings, setAudioSettings, unlockAudio } from '../../lib/sound'
import { applyNightLevel, setSnowLevel } from '../3d/primitives'
import { GroundSlab, NaturalHorizon, World } from '../3d/CityScene'
import { Greenery } from '../3d/Greenery'
import { Pedestrians } from '../3d/Pedestrians'
import { TrafficSystem } from '../3d/TrafficSystem'
import { LivingCityParticles } from '../3d/LivingCityParticles'
import { buildShowcaseGrid } from '../../lib/showcaseCity'
import { CITY_PROFILE_KEY, MAYOR_NAME_KEY, readCityStats, registerFoundedCity } from '../../lib/cityProfile'

/** Сезонная палитра стартового экрана (зимой — снег, весной — цветение). */
const TITLE_PALETTE = SEASON_PALETTES[currentSeason()]

type MenuControls = ThreeOrbitControls

function MenuCameraFlight({ active, controlsRef, onComplete }: { active: boolean; controlsRef: React.MutableRefObject<MenuControls | null>; onComplete: () => void }) {
  const { camera } = useThree()
  const startPosition = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const startTime = useRef(0)
  const completed = useRef(false)
  useEffect(() => {
    if (!active) return
    startPosition.current.copy(camera.position)
    startTarget.current.copy(controlsRef.current?.target ?? new THREE.Vector3(5, 0.9, -1))
    startTime.current = performance.now()
    completed.current = false
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [active, camera, controlsRef])
  useFrame(() => {
    if (!active || completed.current) return
    const t = Math.min(1, (performance.now() - startTime.current) / 2000)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    camera.position.lerpVectors(startPosition.current, new THREE.Vector3(12, 16, 16), eased)
    const target = controlsRef.current?.target
    if (target) {
      target.copy(startTarget.current).lerp(new THREE.Vector3(0, 0, 0), eased)
      controlsRef.current?.update()
    }
    camera.lookAt(0, 0, 0)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(24, 30, eased)
      camera.updateProjectionMatrix()
    }
    if (t >= 1) {
      completed.current = true
      if (controlsRef.current) controlsRef.current.enabled = true
      onComplete()
    }
  })
  return null
}

/** Фон меню — настоящий город из игровых моделей (уютный квартал, современный центр, кампус). */
function IllustratedShowcase({ transitioning, onFlightComplete }: { transitioning: boolean; onFlightComplete: () => void }) {
  const controlsRef = useRef<MenuControls | null>(null)
  const grid = useMemo(() => buildShowcaseGrid(), [])
  useEffect(() => {
    setSnowLevel(TITLE_PALETTE.snow)
    applyNightLevel(0)
  }, [])
  return (
    <>
      <color attach="background" args={[TITLE_PALETTE.sky]} />
      <fogExp2 attach="fog" args={[TITLE_PALETTE.sky, 0.004]} />
      <ambientLight intensity={0.62} color="#ede0d4" />
      <directionalLight position={[30, 57, 12]} intensity={1.8} color="#fff0dd" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={0.5} shadow-camera-far={120} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-bias={-0.0004} shadow-normalBias={0.015} />
      <OrbitControls ref={controlsRef} autoRotate={!transitioning} autoRotateSpeed={0.35} enablePan={false} enableZoom={false} target={[1.5, 0.6, 0.5]} />
      <MenuCameraFlight active={transitioning} controlsRef={controlsRef} onComplete={onFlightComplete} />
      <GroundSlab minutes={720} palette={TITLE_PALETTE} />
      <NaturalHorizon palette={TITLE_PALETTE} />
      <World grid={grid} />
      <Greenery grid={grid} foliage={TITLE_PALETTE.foliage} />
      <Pedestrians grid={grid} />
      <TrafficSystem grid={grid} minutes={720} />
      <LivingCityParticles grid={grid} />
      {TITLE_PALETTE.snow > 0 && <Snowfall count={1400} />}
      <ToonShadingSetup />
    </>
  )
}

function ShowcaseSceneReady({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let active = true
    void gl.compileAsync(scene, camera).catch(() => undefined).finally(() => { if (active) onReady() })
    return () => { active = false }
  }, [camera, gl, onReady, scene])
  return null
}

export interface CityProfile { cityName: string; mayorName: string; createdAt: string }
interface TitleScreenProps { onStart: (mode: 'new' | 'continue' | 'sandbox', profile?: CityProfile) => void; onResetProgress: () => void }

const CITY_NAMES: Record<Language, string[]> = {
  ru: ['Осенний Дол', 'Медовый Холм', 'Тихий Плёс', 'Дубовая Роща'],
  en: ['Amber Falls', 'Oak Hollow', 'Autumn Vale', 'Willowbrook'],
  de: ['Herbsttal', 'Eichenhain', 'Honighügel', 'Abendruh'],
  fr: ['Val d’Automne', 'Bois de Chêne', 'Colline Dorée', 'Rivière Paisible'],
}
const PROFILE_KEY = CITY_PROFILE_KEY

function readCityProfile(): CityProfile | undefined {
  try {
    const value = localStorage.getItem(PROFILE_KEY)
    if (!value) return undefined
    const profile = JSON.parse(value) as CityProfile
    return typeof profile.cityName === 'string' ? profile : undefined
  } catch { return undefined }
}

export function TitleScreen({ onStart, onResetProgress }: TitleScreenProps) {
  const { t, language, setLanguage } = useI18n()
  const [ready, setReady] = useState(false)
  const [assetsReady, setAssetsReady] = useState(false)
  const [progressComplete, setProgressComplete] = useState(false)
  const [showProgress, setShowProgress] = useState(true)
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const pendingStart = useRef<{ mode: 'new' | 'continue' | 'sandbox'; profile?: CityProfile } | null>(null)
  const [hasSave, setHasSave] = useState(() => {
    try { return Boolean(localStorage.getItem('inkville-save-v2')) } catch { return false }
  })
  const [showNaming, setShowNaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cityName, setCityName] = useState('')
  const [mayorName, setMayorName] = useState(() => {
    try { return localStorage.getItem(MAYOR_NAME_KEY) || t('title.mayorPlaceholder') } catch { return t('title.mayorPlaceholder') }
  })
  // Эти ползунки управляют общим звуковым модулем игры (src/lib/sound.ts).
  const [audio, setAudio] = useState(() => {
    const saved = getAudioSettings()
    return { master: Math.round(saved.master * 100), music: Math.round(saved.music * 100), sfx: Math.round(saved.effects * 100), musicMuted: saved.muted }
  })
  const [profileName, setProfileName] = useState(mayorName)
  const [cityStats, setCityStats] = useState(readCityStats)
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => {
    if (assetsReady) return undefined
    const started = performance.now()
    const timer = window.setInterval(() => {
      const next = Math.min(95, ((performance.now() - started) / 1900) * 95)
      setProgress(next)
    }, 40)
    return () => window.clearInterval(timer)
  }, [assetsReady])
  useEffect(() => {
    if (!assetsReady) return undefined
    const finishFill = window.setTimeout(() => {
      setProgressComplete(true)
      setReady(true)
    }, 500)
    const removeBar = window.setTimeout(() => setShowProgress(false), 1000)
    return () => { window.clearTimeout(finishFill); window.clearTimeout(removeBar) }
  }, [assetsReady])
  const markAssetsReady = useCallback(() => {
    setProgress(100)
    setAssetsReady(true)
  }, [])
  const begin = (mode: 'new' | 'continue' | 'sandbox', profile?: CityProfile) => {
    if (!ready || leaving || transitioning) return
    pendingStart.current = { mode, profile }
    setTransitioning(true)
  }
  const finishFlight = useCallback(() => {
    setLeaving(true)
    const start = pendingStart.current
    pendingStart.current = null
    if (start) window.setTimeout(() => onStart(start.mode, start.profile), 250)
  }, [onStart])
  useEffect(() => () => {
    // If this screen is dismissed during a transition, do not leave its callback pending.
    pendingStart.current = null
  }, [])
  const createCity = () => {
    const profile = { cityName: cityName.trim(), mayorName: mayorName.trim() || t('title.mayorPlaceholder'), createdAt: new Date().toISOString() }
    if (!profile.cityName) return
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) } catch { /* City profile is optional when storage is unavailable. */ }
    try { localStorage.setItem(MAYOR_NAME_KEY, profile.mayorName) } catch { /* Mayor preference is optional when storage is unavailable. */ }
    registerFoundedCity()
    setShowNaming(false)
    begin('new', profile)
  }
  const updateAudio = (next: typeof audio) => {
    setAudio(next)
    unlockAudio()
    setAudioSettings({ master: next.master / 100, music: next.music / 100, effects: next.sfx / 100, muted: next.musicMuted })
    document.documentElement.dataset.soundEnabled = String(next.master > 0 && !next.musicMuted)
    window.dispatchEvent(new CustomEvent('INKVILLE_AUDIO_SETTINGS_CHANGED', { detail: next }))
  }
  const saveMayorName = () => {
    const nextName = profileName.trim() || t('title.mayorPlaceholder')
    setProfileName(nextName)
    setMayorName(nextName)
    try {
      localStorage.setItem(MAYOR_NAME_KEY, nextName)
      const profile = readCityProfile()
      if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, mayorName: nextName }))
    } catch { /* Profile metadata is optional when storage is unavailable. */ }
  }
  const resetProgress = () => {
    try { localStorage.removeItem('inkville-save-v2'); localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(MAYOR_NAME_KEY) } catch { /* Storage may be disabled. */ }
    onResetProgress()
    setMayorName(t('title.mayorPlaceholder'))
    setProfileName(t('title.mayorPlaceholder'))
    setHasSave(false)
    setShowSettings(false)
  }
  const menuItems: Array<{ key: string; hotkey: string; icon: LucideIcon; primary?: boolean; disabled?: boolean; hint?: string; onClick: () => void }> = [
    { key: 'title.newCity', hotkey: 'N', icon: PencilLine, primary: true, onClick: () => setShowNaming(true) },
    { key: 'title.continue', hotkey: 'C', icon: Play, disabled: !hasSave, hint: hasSave ? readCityProfile()?.cityName : undefined, onClick: () => begin('continue', readCityProfile()) },
    { key: 'title.sandbox', hotkey: 'S', icon: Boxes, onClick: () => begin('sandbox', readCityProfile() ?? { cityName: CITY_NAMES[language][0], mayorName: t('title.mayorPlaceholder'), createdAt: new Date().toISOString() }) },
    { key: 'title.settings', hotkey: 'O', icon: SettingsIcon, onClick: () => { setProfileName(mayorName); setCityStats(readCityStats()); setConfirmReset(false); setShowSettings(true) } },
  ]
  const menuRef = useRef(menuItems)
  menuRef.current = menuItems
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!ready || showNaming || showSettings || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return
      const item = menuRef.current.find((entry) => entry.hotkey === event.key.toUpperCase())
      if (item && !item.disabled) { event.preventDefault(); item.onClick() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, showNaming, showSettings])
  return (
    <div className={`absolute inset-0 z-40 overflow-hidden bg-[#e9e3d3] transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [28, 42, 38], fov: 24 }} gl={{ antialias: true }} onCreated={({ gl }) => {
        gl.autoClear = true
        gl.setClearColor(new THREE.Color(TITLE_PALETTE.sky), 1)
        gl.toneMapping = THREE.NoToneMapping
      }}>
        <IllustratedShowcase transitioning={transitioning} onFlightComplete={finishFlight} />
        <ShowcaseSceneReady onReady={markAssetsReady} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(23,28,34,0.3)_100%)]" />

      {/* Язык */}
      <div className={`absolute right-[calc(env(safe-area-inset-right)+14px)] top-[calc(env(safe-area-inset-top)+14px)] z-40 transition-opacity duration-300 ${transitioning ? 'opacity-0' : ''}`}>
        <select aria-label={t('language.label')} value={language} onChange={event => setLanguage(event.target.value as Language)} className="h-9 rounded-xl border-2 border-[#1b1a17] bg-[#f6f1e6] px-2 text-xs font-extrabold text-[#2c241d] shadow-[3px_3px_0_#1b1a17]">
          <option value="ru">🇷🇺 RU</option><option value="en">🇬🇧 EN</option><option value="de">🇩🇪 DE</option><option value="fr">🇫🇷 FR</option>
        </select>
      </div>

      {/* Рукописный логотип поверх города */}
      <header className={`pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+8vh)] z-40 px-4 text-center transition-all duration-500 ${transitioning ? '-translate-y-10 opacity-0' : ''}`}>
        <h1 className="ink-logo text-[clamp(72px,17vw,148px)] leading-[0.9]">Inkville</h1>
        <p className="mx-auto mt-3 w-fit max-w-full rounded-full border-2 border-[#1b1a17] bg-[#f6f1e6]/95 px-4 py-1.5 text-[11px] font-extrabold tracking-wide text-[#2c241d] shadow-[3px_3px_0_#1b1a17] sm:text-xs">{t('title.tagline')}</p>
      </header>

      {/* Панель меню в стиле нижней панели игры */}
      <nav aria-label="Inkville" className={`absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-40 flex justify-center px-3 transition-all duration-500 ${transitioning ? 'translate-y-12 opacity-0' : ''}`}>
        <div className="w-full max-w-[760px] rounded-[22px] border-[2.5px] border-[#1b1a17] bg-[#f6f1e6]/97 p-2 shadow-[5px_5px_0_#1b1a17] backdrop-blur">
          {!ready ? <div className="px-3 py-3">
            {showProgress && <div className={`h-2.5 overflow-hidden rounded-full border-2 border-[#1b1a17] bg-[#e4dccb] transition-all duration-500 ${progressComplete ? 'opacity-0' : 'opacity-100'}`}>
              <div className="h-full bg-[repeating-linear-gradient(135deg,#e07a4f_0px,#e07a4f_5px,#f0a36e_5px,#f0a36e_9px)] transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>}
            <p className="mt-2 text-center text-xs font-bold text-[#5b4d3d]">{t(`title.loading${Math.min(3, Math.floor(progress / 34) + 1)}`)}</p>
          </div> : <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {menuItems.map((item) => {
              const Icon = item.icon
              return <button key={item.key} type="button" disabled={item.disabled} onClick={item.onClick}
                className={`group relative flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition sm:flex-col sm:gap-1.5 sm:px-2 sm:py-3 sm:text-center ${item.primary ? 'border-[#1b1a17] bg-[#e07a4f] text-white shadow-[2px_2px_0_#1b1a17] hover:bg-[#e88b62]' : 'border-transparent text-[#2c241d] hover:border-[#1b1a17]/25 hover:bg-[#ebe3d3]'} disabled:cursor-not-allowed disabled:opacity-40`}>
                <Icon className="size-7 shrink-0 sm:size-8" strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{t(item.key)}</span>
                  {item.hint && <span className="block truncate text-[10px] font-semibold opacity-75">{item.hint}</span>}
                </span>
                <span className={`absolute right-1.5 top-1.5 hidden size-5 place-items-center rounded-md border text-[10px] font-black sm:grid ${item.primary ? 'border-white/60 text-white' : 'border-[#1b1a17]/30 text-[#5b4d3d]'}`}>{item.hotkey}</span>
              </button>
            })}
          </div>}
        </div>
      </nav>
      <p className={`pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+2px)] z-40 text-center text-[9px] font-bold uppercase tracking-[.18em] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.5)] ${transitioning ? 'opacity-0' : ''}`}>{t('title.footer')}</p>

      {showNaming && <div className="fixed inset-0 z-50 grid place-items-center bg-[#201a15]/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowNaming(false) }}>
        <form onSubmit={event => { event.preventDefault(); createCity() }} className="w-full max-w-md rounded-3xl border-2 border-[#2C241D] bg-[#F4EEDD] p-6 text-[#2c241d] shadow-[7px_7px_0px_#2C241D] sm:p-8">
          <h2 className="font-serif text-2xl font-black">{t('title.cityModal')}</h2>
          <label className="mt-5 block text-xs font-bold">{t('title.cityName')}
            <input autoFocus required maxLength={40} value={cityName} onChange={event => setCityName(event.target.value)} placeholder={t('title.cityPlaceholder')} className="mt-1.5 h-11 w-full rounded-xl border border-[#655340]/45 bg-[#fffaf0] px-3 text-base sm:text-sm outline-none focus:border-[#9b6237]" />
          </label>
          <label className="mt-4 block text-xs font-bold">{t('title.mayorName')}
            <input maxLength={32} value={mayorName} onChange={event => setMayorName(event.target.value)} placeholder={t('title.mayorPlaceholder')} className="mt-1.5 h-11 w-full rounded-xl border border-[#655340]/45 bg-[#fffaf0] px-3 text-base sm:text-sm outline-none focus:border-[#9b6237]" />
          </label>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => { const names = CITY_NAMES[language]; setCityName(names[Math.floor(Math.random() * names.length)]) }} className="rounded-lg border border-[#655340]/35 bg-white/50 px-3 py-2 text-xs font-bold">{t('title.randomName')}</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNaming(false)} className="rounded-lg border border-[#655340]/35 px-3 py-2 text-xs font-bold">{t('title.cancel')}</button>
              <button type="submit" className="rounded-lg border-2 border-[#292720] bg-[#d6a15f] px-4 py-2 text-xs font-black shadow-[2px_2px_0_#292720]">{t('title.startBuilding')}</button>
            </div>
          </div>
        </form>
      </div>}

      {showSettings && <div className="fixed inset-0 z-50 grid place-items-center bg-[#201a15]/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowSettings(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="settings-heading" className="max-h-[min(90vh,760px)] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-[#2C241D] bg-[#F4EEDD] p-5 text-[#2c241d] shadow-[7px_7px_0px_#2C241D] sm:p-7">
          <header className="flex items-start justify-between gap-4 border-b border-[#655340]/25 pb-4">
            <div><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#8b6748]">Inkville</span><h2 id="settings-heading" className="font-serif text-2xl font-black">{t('settings.title')}</h2></div>
            <button aria-label={t('settings.close')} onClick={() => setShowSettings(false)} className="grid size-9 shrink-0 place-items-center rounded-full border border-[#655340]/35 text-xl hover:bg-white/60">×</button>
          </header>
          <div className="mt-5 rounded-2xl border border-[#655340]/25 bg-[#fffaf0]/55 p-4">
            <h3 className="mb-3 text-sm font-black">{t('settings.audio')}</h3>
            {([
              ['master', 'settings.master'], ['music', 'settings.music'], ['sfx', 'settings.sfx'],
            ] as const).map(([key, label]) => <label key={key} className="mb-3 block last:mb-0">
              <span className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold"><span>{t(label)}</span><span className="tabular-nums text-stone-600">{audio[key]}%</span></span>
              <input aria-label={t(label)} type="range" min="0" max="100" value={audio[key]} onChange={event => updateAudio({ ...audio, [key]: Number(event.target.value) })} className="h-2 w-full cursor-pointer accent-[#a6653d]" />
            </label>)}
            <button onClick={() => updateAudio({ ...audio, musicMuted: !audio.musicMuted })} className="mt-3 rounded-lg border border-[#655340]/30 bg-white/60 px-3 py-1.5 text-xs font-bold">
              {audio.musicMuted ? `🔇 ${t('settings.unmute')}` : `🔊 ${t('settings.mute')}`}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-[#655340]/25 bg-[#fffaf0]/55 p-4">
            <h3 className="text-sm font-black">{t('settings.account')}</h3>
            <label className="mt-3 block text-xs font-semibold">{t('settings.mayor')}
              <input maxLength={32} value={profileName} onChange={event => setProfileName(event.target.value)} onBlur={saveMayorName} className="mt-1.5 h-10 w-full rounded-xl border border-[#655340]/35 bg-[#fffaf0] px-3 text-base sm:text-sm outline-none focus:border-[#9b6237]" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/60 p-3"><span className="block text-stone-600">{t('settings.founded')}</span><strong className="mt-1 block text-base">{cityStats.foundedCities}</strong></div>
              <div className="rounded-xl bg-white/60 p-3"><span className="block text-stone-600">{t('settings.playtime')}</span><strong className="mt-1 block text-base">{(cityStats.totalPlaySeconds / 3600).toFixed(1)} {t('settings.hours')}</strong></div>
            </div>
            {!confirmReset ? <button onClick={() => setConfirmReset(true)} className="mt-3 w-full rounded-xl border border-rose-800/45 bg-rose-50/70 px-3 py-2.5 text-left text-xs font-bold text-rose-800">{t('settings.reset')}</button> : <div className="mt-3 rounded-xl border border-rose-800/35 bg-rose-50 p-3">
              <p className="text-xs font-bold text-rose-900">{t('title.resetConfirm')}</p>
              <div className="mt-2 flex justify-end gap-2"><button onClick={() => setConfirmReset(false)} className="rounded-lg border border-stone-400 px-3 py-1.5 text-xs font-bold">{t('title.cancel')}</button><button onClick={resetProgress} className="rounded-lg border border-rose-900 bg-rose-800 px-3 py-1.5 text-xs font-bold text-white">{t('settings.confirm')}</button></div>
            </div>}
          </div>
          <button onClick={() => { saveMayorName(); setShowSettings(false) }} className="mt-5 w-full rounded-xl border-2 border-[#292720] bg-[#d6a15f] px-4 py-3 text-sm font-black shadow-[3px_3px_0_#292720] hover:bg-[#e0b273]">{t('settings.saveClose')}</button>
        </section>
      </div>}
    </div>
  )
}
