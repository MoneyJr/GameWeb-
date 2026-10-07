import { Coins, Droplets, Frown, Meh, Moon, Smile, Pause, Play, Sun, Sunrise, Sunset, TrendingDown, TrendingUp, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import type { SimSpeed } from '../../types/city'

interface TopBarProps {
  
  demands: { residential: number; commercial: number; industrial: number }

  population: number
  budget: number
  lastNet: number
  happiness: number
  waterServed: number
  waterTotal: number
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

function describeTime(minutes: number): { label: string; icon: ReactNode } {
  const hour = Math.floor(minutes / 60)
  if (hour >= 5 && hour < 8) return { label: 'Рассвет', icon: <Sunrise className="size-5 text-orange-500" /> }
  if (hour >= 8 && hour < 18) return { label: 'День', icon: <Sun className="size-5 text-amber-500" /> }
  if (hour >= 18 && hour < 21) return { label: 'Вечер', icon: <Sunset className="size-5 text-rose-500" /> }
  return { label: 'Ночь', icon: <Moon className="size-5 text-indigo-500" /> }
}

function formatClock(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

interface StatProps {
  id: string
  icon: ReactNode
  label: string
  value: string
  hint?: ReactNode
  /** Меняется при каждом новом значении и перезапускает анимацию. */
  bumpKey?: string | number
  valueColor?: string
}

function Stat({ id, icon, label, value, hint, bumpKey, valueColor }: StatProps) {
  return (
    <div id={id} className="flex items-center gap-3 px-4 py-2">
      <span className="grid size-9 place-items-center rounded-xl border-2 border-ink bg-white">{icon}</span>
      <div className="leading-tight">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">{label}</div>
        <div className="flex items-baseline gap-2">
          <span
            key={bumpKey}
            data-testid={`${id}-value`}
            className={cn("animate-[stat-bump_380ms_ease-out] text-xl font-extrabold tabular-nums", valueColor)}
          >
            {value}
          </span>
          {hint}
        </div>
      </div>
    </div>
  )
}

export function TopBar({
  
  population,
  budget,
  lastNet,
  happiness,
  waterServed,
  waterTotal,
  crimeRate,
  policeCapacity,
  fireCapacity,
  minutes,
  day,
  demands,
  paused,
  speed,
  onTogglePause,
  onSpeedChange,
}: TopBarProps) {
  const time = describeTime(minutes)
  const positive = lastNet >= 0
  const dryCount = waterTotal - waterServed
  const HappinessIcon = happiness >= 70 ? Smile : happiness >= 40 ? Meh : Frown

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-4">
      <div className="ink-panel pointer-events-auto flex items-stretch divide-x-2 divide-ink/15 rounded-2xl">

        
        <div className="flex items-center gap-2 px-4">
          <h1 className="text-xl font-black tracking-tight">
            Ink<span className="text-accent-deep">ville</span>
          </h1>
        </div>

        <Stat
          id="stat-population"
          icon={<Users className="size-5 text-leaf" />}
          label="Население"
          value={population.toLocaleString('en-US')}
          bumpKey={population}
        />

        <Stat
          id="stat-budget"
          icon={<Coins className="size-5 text-amber-500" />}
          label="Бюджет"
          value={`$ ${Math.round(budget).toLocaleString('en-US')}`}
          bumpKey={budget}
          valueColor={budget < 0 ? "text-rose-600" : undefined}
          hint={
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-extrabold tabular-nums',
                positive ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {positive ? '+$' : '-$'}
              {Math.abs(lastNet)}
            </span>
          }
        />

        <Stat
          id="stat-time"
          icon={time.icon}
          label={`День ${day} · ${time.label}`}
          value={formatClock(minutes)}
        />


        
        <div className="flex items-center gap-2 px-4">
          <button
            id="btn-pause"
            type="button"
            aria-label={paused ? 'Продолжить' : 'Пауза'}
            aria-pressed={paused}
            onClick={onTogglePause}
            className={cn(
              'grid size-10 cursor-pointer place-items-center rounded-xl border-2 border-ink transition-transform',
              'hover:-translate-y-0.5 active:translate-y-0.5',
              paused ? 'bg-accent text-white' : 'bg-white text-ink',
            )}
          >
            {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
          </button>

          <div className="flex overflow-hidden rounded-xl border-2 border-ink bg-white">
            {SPEEDS.map((value) => (
              <button
                key={value}
                id={`btn-speed-${value}`}
                type="button"
                aria-pressed={speed === value}
                onClick={() => onSpeedChange(value)}
                className={cn(
                  'h-9 w-10 cursor-pointer text-sm font-extrabold transition-colors',
                  speed === value ? 'bg-ink text-cream' : 'hover:bg-ink/10',
                )}
              >
                {value}x
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        id="stat-city-health"
        className="ink-panel pointer-events-auto flex items-center divide-x-2 divide-ink/15 rounded-full text-sm font-extrabold"
      >
        
        <div id="stat-rci" className="flex items-center gap-1.5 px-4 py-1.5 h-[34px]">
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-leaf transition-all duration-300" style={{ height: `${demands.residential}%` }} />
          </div>
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-sky transition-all duration-300" style={{ height: `${demands.commercial}%` }} />
          </div>
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-amber-500 transition-all duration-300" style={{ height: `${demands.industrial}%` }} />
          </div>
        </div>

        <div id="stat-water" className="flex items-center gap-2 px-4 py-1.5">
          <Droplets className={cn('size-4', dryCount > 0 ? 'text-rose-500' : 'text-sky')} />
          <span className="text-ink-soft">Вода</span>
          <span data-testid="stat-water-value" className="tabular-nums">
            {waterServed}/{waterTotal}
          </span>
        </div>
        <div id="stat-happiness" tabIndex={0} aria-describedby="happiness-details" className="group relative flex items-center gap-2 px-4 py-1.5 outline-none">
          <HappinessIcon className={cn('size-4', happiness >= 70 ? 'text-leaf' : happiness >= 40 ? 'text-amber-500' : 'text-rose-500')} />
          <span className="text-ink-soft">Счастье</span>
          <span data-testid="stat-happiness-value" className="tabular-nums">
            {happiness}%
          </span>
          <div id="happiness-details" role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-64 rounded-xl border border-ink/20 bg-[#fbf9f4] p-3 text-left text-xs font-medium leading-relaxed text-ink shadow-lg group-hover:block group-focus:block">
            <div className={cn('font-bold', crimeRate > 0 ? 'text-rose-700' : 'text-emerald-800')}>
              Преступность: {crimeRate}% ({crimeRate > 0 ? 'Нехватка участков' : 'Полиция в норме'})
            </div>
            <div className="mt-1 text-ink-soft">Полиция: {policeCapacity.toLocaleString('ru-RU')} жителей · Пожарные: {fireCapacity.toLocaleString('ru-RU')} жителей</div>
            <div className="mt-1 text-[10px] text-ink-soft">Норма на участок: 800 жителей</div>
          </div>
        </div>
      </div>
    </header>
  )
}
