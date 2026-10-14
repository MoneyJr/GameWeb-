import { Coins, Droplets, Frown, Meh, Moon, Package, Pause, Play, Smile, Star, Sun, Sunrise, Sunset, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'
import type { SimSpeed } from '../../types/city'
import { useI18n } from '../../i18n/I18nProvider'

interface TopBarProps {
  demands: { residential: number; commercial: number; industrial: number }
  population: number
  budget: number
  lastNet: number
  happiness: number
  waterServed: number
  waterTotal: number
  waterProduced: number
  waterConsumed: number
  energyProduced: number
  energyConsumed: number
  prestige: number
  crimeRate: number
  policeCapacity: number
  fireCapacity: number
  minutes: number
  day: number
  paused: boolean
  speed: SimSpeed
  onTogglePause: () => void
  onSpeedChange: (speed: SimSpeed) => void
  materials: { bricks: number; concrete: number; steel: number }
  warehouseCapacity: number
  materialFlow: { bricks: number; concrete: number; steel: number }
  onExpandWarehouse: () => void
}

const SPEEDS: readonly SimSpeed[] = [1, 2, 3]

function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function Metric({ id, icon, children, className, label }: { id: string; icon: ReactNode; children: ReactNode; className?: string; label: string }) {
  return <div id={id} aria-label={label} className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-stone-700/10 bg-white/65 px-2.5 text-xs font-semibold text-stone-800', className)}>
    {icon}{children}
  </div>
}

export function TopBar({
  population, budget, lastNet, happiness, waterServed, waterTotal,
  waterProduced, waterConsumed, energyProduced, energyConsumed, prestige,
  crimeRate, policeCapacity, fireCapacity, minutes, day, demands, paused,
  speed, onTogglePause, onSpeedChange, materials, warehouseCapacity, materialFlow, onExpandWarehouse,
}: TopBarProps) {
  const { t } = useI18n()
  const [warehouseOpen, setWarehouseOpen] = useState(false)
  const warehouseButton = useRef<HTMLButtonElement>(null)
  const warehousePopover = useRef<HTMLDivElement>(null)
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 })
  const positive = lastNet >= 0
  const waterDeficit = waterConsumed > waterProduced
  const energyDeficit = energyConsumed > energyProduced
  const HappinessIcon = happiness >= 70 ? Smile : happiness >= 40 ? Meh : Frown
  const timeIcon = minutes >= 300 && minutes < 480
    ? <Sunrise className="size-3.5 text-amber-600" />
    : minutes >= 480 && minutes < 1080
      ? <Sun className="size-3.5 text-amber-500" />
      : minutes >= 1080 && minutes < 1260
        ? <Sunset className="size-3.5 text-orange-600" />
        : <Moon className="size-3.5 text-indigo-500" />
  const fairActive = day <= 14
  const totalMaterials = materials.bricks + materials.concrete + materials.steel
  const totalCapacity = warehouseCapacity * 3

  useEffect(() => {
    const openWarehouse = () => setWarehouseOpen(true)
    window.addEventListener('OPEN_WAREHOUSE', openWarehouse)
    return () => window.removeEventListener('OPEN_WAREHOUSE', openWarehouse)
  }, [])

  useEffect(() => {
    if (!warehouseOpen) return undefined
    const updatePosition = () => {
      const bounds = warehouseButton.current?.getBoundingClientRect()
      if (bounds) setPopoverPosition({ left: Math.min(bounds.left, window.innerWidth - 304), top: bounds.bottom + 8 })
    }
    const closeOutside = (event: PointerEvent) => {
      if (warehouseButton.current?.contains(event.target as Node) || warehousePopover.current?.contains(event.target as Node)) return
      setWarehouseOpen(false)
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', closeOutside)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', closeOutside)
    }
  }, [warehouseOpen])

  return <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-visible px-1.5 pt-[calc(env(safe-area-inset-top)+8px)] md:px-4">
    <div className="pointer-events-auto max-w-full overflow-visible rounded-2xl border border-stone-800/20 bg-[#F5F2EB]/90 shadow-lg backdrop-blur-md">
      <div className="flex h-11 max-w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap px-2 py-1 text-xs [scrollbar-width:none]">
        <h1 className="hidden shrink-0 px-2 text-sm font-black tracking-tight text-stone-800 lg:block">Ink<span className="text-[#a65336]">ville</span></h1>
        <Metric id="stat-population" icon={<Users className="size-3.5 text-emerald-700" />} label={t('hud.population')}>
          <span data-testid="stat-population-value" className="tabular-nums">{compactNumber(population)}</span>
        </Metric>
        <Metric id="stat-budget" icon={<Coins className="size-3.5 text-amber-600" />} label={t('hud.budget')}>
          <span data-testid="stat-budget-value" className="tabular-nums">${compactNumber(Math.round(budget))}</span>
          <span className={cn('flex items-center gap-0.5 text-[10px] tabular-nums', positive ? 'text-emerald-700' : 'text-rose-700')}>
            {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{positive ? '+' : '−'}${compactNumber(Math.abs(lastNet))}
          </span>
        </Metric>
        <button ref={warehouseButton} type="button" onClick={() => setWarehouseOpen((open) => !open)} aria-expanded={warehouseOpen} aria-label={t('warehouse.title')} className={cn('flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition-colors', materials.concrete < 15 ? 'border-orange-500/50 bg-orange-100 text-orange-800' : 'border-stone-700/10 bg-white/65 text-stone-800 hover:bg-white')}>
          <Package className="size-3.5 text-amber-800" /><span className="hidden sm:inline">{t('warehouse.button')}</span><span className="tabular-nums">{compactNumber(totalMaterials)}</span>
        </button>
        <Metric id="stat-energy" icon={<Zap className={cn('size-3.5', energyDeficit ? 'text-rose-600' : 'text-amber-600')} />} label={t('hud.energy', energyConsumed, energyProduced)} className={energyDeficit ? 'border-rose-500/40 bg-rose-100 text-rose-900' : undefined}>
          <span data-testid="stat-energy-value" className="tabular-nums">{energyConsumed}/{energyProduced}</span>
          {energyDeficit && <span className="text-[10px] font-bold">{t('hud.energyDeficit')}</span>}
        </Metric>
        <Metric id="stat-water" icon={<Droplets className={cn('size-3.5', waterDeficit ? 'text-rose-600' : 'text-sky-700')} />} label={t('hud.water', waterConsumed, waterProduced)} className={waterDeficit ? 'border-rose-500/40 bg-rose-100 text-rose-900' : undefined}>
          <span data-testid="stat-water-value" className="tabular-nums">{waterConsumed}/{waterProduced}</span>
        </Metric>
        <Metric id="stat-happiness" icon={<HappinessIcon className={cn('size-3.5', happiness >= 70 ? 'text-emerald-700' : happiness >= 40 ? 'text-amber-600' : 'text-rose-600')} />} label={`${t('hud.happiness')} ${happiness}%`}>
          <span data-testid="stat-happiness-value" className="tabular-nums">{happiness}%</span>
          <span className="sr-only">{t('hud.water')}: {waterServed}/{waterTotal}</span>
          <span className="sr-only">{t('hud.demands', demands.residential, demands.commercial, demands.industrial)}</span>
        </Metric>
        <Metric id="stat-prestige" icon={<Star className="size-3.5 fill-amber-400 text-amber-600" />} label={t('hud.prestige')}>
          <span data-testid="stat-prestige-value">{prestige.toFixed(1)}</span>
        </Metric>
        <Metric id="stat-time" icon={fairActive ? <span aria-hidden="true">🍂</span> : timeIcon} label={`${t('hud.day', day)}, ${formatClock(minutes)}`} className={fairActive ? 'border-amber-700/20 bg-[#fbf1d8]' : undefined}>
          <span title={fairActive ? t('hud.fairTooltip') : t('hud.time')}>{formatClock(minutes)}</span>
        </Metric>
        <div className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-stone-700/10 bg-white/65 px-1">
          <button id="btn-pause" type="button" aria-label={paused ? t('hud.resume') : t('hud.pause')} aria-pressed={paused} onClick={onTogglePause}
            className={cn('grid size-7 place-items-center rounded-full transition-colors', paused ? 'bg-[#a65336] text-white' : 'text-stone-800 hover:bg-stone-200')}>
            {paused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
          </button>
          {SPEEDS.map((value) => <button key={value} id={`btn-speed-${value}`} type="button" aria-label={t('hud.speed', value)} aria-pressed={speed === value} onClick={() => onSpeedChange(value)}
            className={cn('h-7 min-w-7 rounded-full px-1.5 text-[10px] font-bold transition-colors', speed === value ? 'bg-stone-800 text-white' : 'text-stone-700 hover:bg-stone-200')}>
            {value === 3 ? '⏩' : `${value}x`}
          </button>)}
        </div>
        <div className="sr-only" role="tooltip">{t('hud.crime', crimeRate, policeCapacity, fireCapacity)}</div>
      </div>
    </div>
    {warehouseOpen && createPortal(<div ref={warehousePopover} role="dialog" aria-label={t('warehouse.popoverTitle')} className="pointer-events-auto fixed z-[70] w-[min(292px,calc(100vw-24px))] rounded-2xl border-2 border-[#2C241D] bg-[#F4EEDD] p-3 text-[#342a20] shadow-[5px_5px_0px_#2C241D]" style={popoverPosition}>
      <h2 className="mb-2 text-sm font-black">{t('warehouse.popoverTitle')}</h2>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span>🧱 {t('warehouse.bricks')}</span><strong>{materials.bricks} <span className="font-medium text-emerald-700">({t('warehouse.inflow', materialFlow.bricks)})</span></strong></div>
        <div className="flex justify-between"><span>🪟 {t('warehouse.concrete')}</span><strong>{materials.concrete} <span className="font-medium text-emerald-700">({t('warehouse.inflow', materialFlow.concrete)})</span></strong></div>
        <div className="flex justify-between"><span>🏗️ {t('warehouse.steel')}</span><strong>{materials.steel} <span className="font-medium text-emerald-700">({t('warehouse.inflow', materialFlow.steel)})</span></strong></div>
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-semibold"><span>{t('warehouse.capacity')}</span><span>{totalMaterials} / {totalCapacity}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-300"><div className="h-full rounded-full bg-emerald-700 transition-[width]" style={{ width: `${Math.min(100, totalMaterials / Math.max(1, totalCapacity) * 100)}%` }} /></div>
      <button type="button" onClick={onExpandWarehouse} className="mt-3 w-full rounded-lg border border-[#2C241D]/30 bg-[#dfc48d] px-2 py-1.5 text-xs font-bold">{t('warehouse.upgrade')}</button>
    </div>, document.body)}
  </header>
}
