import { useEffect, useMemo, useState } from 'react'
import { CityScene } from './components/3d/CityScene'
import { BottomDock } from './components/ui/BottomDock'
import { CityHallModal } from './components/ui/CityHallModal'
import { TopBar } from './components/ui/TopBar'
import { useCitySimulation } from './hooks/useCitySimulation'
import { TOOL_ORDER } from './lib/cityConfig'
import { TileType, type Grid } from './types/city'
import { TitleScreen } from './components/ui/TitleScreen'
import type { CityProfile } from './components/ui/TitleScreen'
import { useI18n } from './i18n/I18nProvider'
import { addPlaySeconds } from './lib/cityProfile'

function App() {
  const sim = useCitySimulation()
  const { t } = useI18n()
  const { setActiveTool, togglePause, notice } = sim
  const [visibleNoticeId, setVisibleNoticeId] = useState<number | null>(null)
  const [started, setStarted] = useState(new URLSearchParams(window.location.search).has('preview'))
  const [welcome, setWelcome] = useState<{ cityName: string; returning: boolean; nonce: number; messageKey: string } | null>(null)
  const [dismissedWelcomeNonce, setDismissedWelcomeNonce] = useState<number | null>(null)
  const [cityHallOpen, setCityHallOpen] = useState(false)
  const titleVisible = !started
  const resStyle = "EU"
  const [catalogId, setCatalogId] = useState<string | undefined>(undefined)
  // A shareable visual fixture, enabled with ?preview=cityrt, keeps the simulation's normal empty start intact.
  const displayGrid = useMemo<Grid>(() => {
    if (new URLSearchParams(window.location.search).get('preview') !== 'cityrt') return sim.grid
    const grid: Grid = sim.grid.map((row) => row.map((cell) => ({ ...cell, type: TileType.EMPTY, style: undefined })))
    const put = (x: number, y: number, type: TileType, style?: string) => {
      grid[y][x] = { ...grid[y][x], type, style, hasWater: true, hasPower: true }
    }
    // A compact CityRT showcase, centered on the expanded 64 x 64 grid.
    for (let x = 25; x <= 38; x += 1) put(x, 32, TileType.ROAD)
    for (let y = 24; y <= 32; y += 1) put(38, y, TileType.ROAD)
    ;[[26, 31], [27, 31], [28, 31], [29, 31], [30, 31], [31, 31]].forEach(([x, y]) => put(x, y, TileType.RESIDENTIAL, 'EU'))
    // Clock tower, park square, and a small green verge complete the showcase block.
    put(36, 28, TileType.CITY_HALL)
    put(34, 31, TileType.PARK)
    put(35, 31, TileType.PARK)
    return grid
  }, [sim.grid])

  useEffect(() => {
    const handle = () => setCityHallOpen(true)
    window.addEventListener('OPEN_CITY_HALL', handle)
    return () => window.removeEventListener('OPEN_CITY_HALL', handle)
  }, [])

  useEffect(() => {
    if (!welcome) return undefined
    const timer = window.setTimeout(() => setDismissedWelcomeNonce(welcome.nonce), 7600)
    return () => window.clearTimeout(timer)
  }, [welcome])

  useEffect(() => {
    if (!started) return undefined
    let lastSavedAt = Date.now()
    const persistElapsedTime = () => {
      const now = Date.now()
      addPlaySeconds((now - lastSavedAt) / 1000)
      lastSavedAt = now
    }
    const timer = window.setInterval(persistElapsedTime, 30_000)
    window.addEventListener('pagehide', persistElapsedTime)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', persistElapsedTime)
      persistElapsedTime()
    }
  }, [started])

  const handleStart = (mode: 'new' | 'continue' | 'sandbox', profile?: CityProfile) => {
    if (mode !== 'continue') sim.reset()
    let savedProfile = profile
    if (mode === 'continue' && !savedProfile) {
      try { savedProfile = JSON.parse(localStorage.getItem('inkville-city-profile') ?? 'null') as CityProfile | undefined } catch { savedProfile = undefined }
    }
    savedProfile ??= { cityName: 'Inkville', mayorName: 'Mayor', createdAt: new Date().toISOString() }
    try { localStorage.setItem('inkville-city-profile', JSON.stringify(savedProfile)) } catch { /* City metadata is optional when storage is unavailable. */ }
    const returning = mode === 'continue'
    const greetingKeys = returning ? ['welcome.back1', 'welcome.back2', 'welcome.back3'] : ['welcome.new1', 'welcome.new2']
    setWelcome({ cityName: savedProfile.cityName, returning, nonce: Date.now(), messageKey: greetingKeys[Math.floor(Math.random() * greetingKeys.length)] })
    togglePause()
    setStarted(true)
  }

  const resetProgress = () => sim.reset()

  // Горячие клавиши: 1–7 — инструменты, Пробел — пауза.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const index = Number(event.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < TOOL_ORDER.length) {
        setActiveTool(TOOL_ORDER[index])
      } else if (event.code === 'Space') {
        event.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveTool, togglePause])

  // Уведомление исчезает через 2.5 секунды.
  useEffect(() => {
    if (notice === null) return undefined
    setVisibleNoticeId(notice.id)
    const timer = window.setTimeout(() => setVisibleNoticeId(null), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <main className="relative h-full w-full overflow-hidden bg-paper">
      {!titleVisible && <>
      <CityScene
        grid={displayGrid}
        activeTool={sim.activeTool}
        catalogId={catalogId}
        onPlace={(x,y,id) => sim.placeTile(x, y, resStyle, id)}
        onRemove={sim.removeTile}
        minutes={sim.minutes}
        budget={sim.budget}
        placementStyle={resStyle}
      />

      <TopBar
        population={sim.population}
        budget={sim.budget}
        lastNet={sim.lastNet}
        happiness={sim.happiness}
        waterServed={sim.waterStats.served}
        waterTotal={sim.waterStats.total}
        waterProduced={sim.waterStats.produced}
        waterConsumed={sim.waterStats.consumed}
        energyProduced={sim.energyStats.produced}
        energyConsumed={sim.energyStats.consumed}
        prestige={sim.prestige}
        crimeRate={sim.capacityStats.crimeRate}
        policeCapacity={sim.capacityStats.policeCapacity}
        fireCapacity={sim.capacityStats.fireCapacity}
        minutes={sim.minutes}
        day={sim.day}
        demands={sim.demands}
        paused={sim.paused}
        speed={sim.speed}
        onTogglePause={sim.togglePause}
        onSpeedChange={sim.setSpeed}
      />

      {notice !== null && visibleNoticeId === notice.id && (
        <div
          key={notice.id}
          role="status"
          className="ink-panel toast-in pointer-events-none absolute left-1/2 top-24 z-20 rounded-xl px-4 py-2 text-sm font-extrabold text-rose-700"
        >
          {notice.text}
        </div>
      )}

      <BottomDock activeTool={sim.activeTool} onSelect={sim.setActiveTool} selectedCatalogId={catalogId} onCatalogSelect={setCatalogId} />
      {welcome && <div key={welcome.nonce} className={`fixed bottom-24 left-4 z-40 max-w-[min(360px,calc(100vw-32px))] transition-all duration-500 sm:left-6 ${dismissedWelcomeNonce !== welcome.nonce ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
        <div className="relative rounded-2xl border-2 border-[#2C241D] bg-[#F4EEDD]/95 p-4 pl-14 text-sm font-semibold leading-relaxed text-[#342a20] shadow-[4px_4px_0px_#2C241D] backdrop-blur-md">
          <span aria-hidden="true" className="absolute left-3 top-3 grid size-9 place-items-center rounded-full border border-[#2C241D]/25 bg-[#e6d5b7] text-xl">{welcome.returning ? '🐱' : '🧑‍🎨'}</span>
          {t(welcome.messageKey, welcome.cityName)}
          <button aria-label={t('title.cancel')} onClick={() => setDismissedWelcomeNonce(welcome.nonce)} className="absolute right-2 top-1 rounded-full px-2 text-lg leading-6 text-stone-500 hover:bg-black/5">×</button>
        </div>
      </div>}
      {cityHallOpen && (
        <CityHallModal
          onClose={() => setCityHallOpen(false)}
          taxRates={sim.taxRates}
          onTaxChange={(category, rate) => (window as any).__SIM_DISPATCH({ type: 'SET_TAX', category, rate })}
          debt={sim.debt}
          onLoan={(amount) => (window as any).__SIM_DISPATCH({ type: 'TAKE_LOAN', amount })}
          onRepay={() => (window as any).__SIM_DISPATCH({ type: 'REPAY_LOAN' })}
          population={sim.population}
          happiness={sim.happiness}
          lastNet={sim.lastNet}
          waterServed={sim.waterStats.served}
          waterTotal={sim.waterStats.total}
        />
      )}
      </>}
      {titleVisible && <TitleScreen onStart={handleStart} onResetProgress={resetProgress} />}
    </main>
  )
}

export default App
