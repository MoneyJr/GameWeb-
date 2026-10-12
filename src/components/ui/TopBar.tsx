import { Coins, Droplets, Frown, Meh, Moon, Pause, Play, Smile, Star, Sun, Sunrise, Sunset, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import type { SimSpeed } from '../../types/city'
import { useI18n, type Language } from '../../i18n/I18nProvider'

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
}

const SPEEDS: readonly SimSpeed[] = [1, 2, 3]

function formatClock(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
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
  speed, onTogglePause, onSpeedChange,
}: TopBarProps) {
  const { t, language, setLanguage } = useI18n()
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
      : minutes >= 1260 || minutes < 300
        ? <Moon className="size-3.5 text-indigo-500" />
        : <Sun className="size-3.5 text-amber-500" />
  const fairActive = day <= 14

  return <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-1.5 pt-[calc(env(safe-area-inset-top)+8px)] md:px-4">
    <div className="pointer-events-auto flex h-11 max-w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded-2xl border border-stone-800/20 bg-[#F5F2EB]/90 px-2 py-1 text-xs shadow-lg backdrop-blur-md [scrollbar-width:none]">
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
        <span data-testid="stat-prestige-value">{t('hud.prestigeValue', prestige.toFixed(1))}</span>
      </Metric>
      <Metric id="stat-time" icon={timeIcon} label={`${t('hud.day', day)}, ${formatClock(minutes)}`} className={fairActive ? 'border-amber-700/20 bg-[#fbf1d8]' : undefined}>
        <span>{fairActive ? t('hud.fair') : t('hud.time')}</span><span className="tabular-nums">{formatClock(minutes)}</span>
      </Metric>
      <select aria-label={t('language.label')} value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-8 shrink-0 rounded-full border border-stone-700/15 bg-white/70 px-2 text-[10px] font-bold text-stone-700 outline-none">
        <option value="en">🇬🇧 EN</option><option value="ru">🇷🇺 RU</option><option value="de">🇩🇪 DE</option><option value="fr">🇫🇷 FR</option>
      </select>
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
  </header>
}
