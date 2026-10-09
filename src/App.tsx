import { useEffect, useMemo, useState } from 'react'
import { CityScene } from './components/3d/CityScene'
import { BottomDock } from './components/ui/BottomDock'
import { CityHallModal } from './components/ui/CityHallModal'
import { TopBar } from './components/ui/TopBar'
import { useCitySimulation } from './hooks/useCitySimulation'
import { TOOL_ORDER } from './lib/cityConfig'
import { TileType, type Grid } from './types/city'
import { TitleScreen } from './components/ui/TitleScreen'

function App() {
  const sim = useCitySimulation()
  const { setActiveTool, togglePause, notice } = sim
  const [visibleNoticeId, setVisibleNoticeId] = useState<number | null>(null)
  const [started, setStarted] = useState(new URLSearchParams(window.location.search).has('preview'))
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
    const handle = () => setCityHallOpen(true);
    window.addEventListener('OPEN_CITY_HALL', handle);
    return () => window.removeEventListener('OPEN_CITY_HALL', handle);
  }, []);
  const [cityHallOpen, setCityHallOpen] = useState(false)

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
      {titleVisible && <TitleScreen onStart={(mode) => { if (mode !== 'continue') sim.reset(); togglePause(); setStarted(true) }} />}
    </main>
  )
}

export default App
