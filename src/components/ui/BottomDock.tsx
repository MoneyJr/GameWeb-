import {
  Building2,
  Droplets,
  Factory,
  Flame,
  Fence,
  House,
  Landmark,
  Map,
  PenLine,
  Route,
  Shield,
  Sun,
  Store,
  TreePine,
  Trash2,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import { ToolId } from '../../types/city'

interface BottomDockProps {
  activeTool: ToolId
  onSelect: (tool: ToolId) => void
  resStyle?: string
  onResStyleChange?: (style: string) => void
}

interface Category {
  key: string
  label: string
  icon: LucideIcon
  tool: ToolId
  hint?: string
}

const CATEGORIES: Category[] = [
  { key: '1', label: 'Дороги', icon: Route, tool: ToolId.ROAD },
  { key: 'U', label: 'Ток и вода', icon: Droplets, tool: ToolId.WATER_PUMP },
  { key: 'Z', label: 'Зоны', icon: Map, tool: ToolId.RESIDENTIAL },
  { key: 'H', label: 'Жильё', icon: House, tool: ToolId.RESIDENTIAL },
  { key: 'S', label: 'Торговля', icon: Store, tool: ToolId.COMMERCIAL },
  { key: 'O', label: 'Офисы', icon: Building2, tool: ToolId.COMMERCIAL, hint: 'Торговый инструмент' },
  { key: 'I', label: 'Заводы', icon: Factory, tool: ToolId.INDUSTRIAL },
  { key: 'V', label: 'Службы', icon: Wind, tool: ToolId.WIND },
  { key: 'P', label: 'Парки', icon: TreePine, tool: ToolId.PARK },
  { key: 'Y', label: 'Двор', icon: Fence, tool: ToolId.PARK, hint: 'Парк' },
  { key: 'L', label: 'Достоприм.', icon: Landmark, tool: ToolId.CITY_HALL },
  { key: 'X', label: 'Снос', icon: Trash2, tool: ToolId.BULLDOZE },
]

const RES_STYLES = [
  { id: 'EU', label: 'European', detail: 'Старая Европа' },
  { id: 'US', label: 'American', detail: 'Американский' },
  { id: 'EAST', label: 'Eastern', detail: 'Восточный' },
]

export function BottomDock({ activeTool, onSelect, resStyle = 'EU', onResStyleChange }: BottomDockProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const hasActiveTool = activeTool !== ToolId.CURSOR
  const showServices = activeTool === ToolId.WIND || activeTool === ToolId.SOLAR_PANEL || activeTool === ToolId.POLICE || activeTool === ToolId.FIRE_STATION

  const chooseCategory = (category: Category) => {
    setActiveCategory(category.key)
    onSelect(category.tool)
  }

  const finishTool = () => {
    setActiveCategory(null)
    onSelect(ToolId.CURSOR)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toUpperCase()
      if (key === 'Q') {
        event.preventDefault()
        event.stopPropagation()
        setStyleOpen((open) => !open)
        return
      }
      const category = CATEGORIES.find((item) => item.key === key)
      if (category) {
        event.preventDefault()
        event.stopPropagation()
        chooseCategory(category)
        return
      }
      if (event.key === 'Enter' && hasActiveTool) {
        event.preventDefault()
        event.stopPropagation()
        finishTool()
      } else if (event.key === 'Escape') {
        if (styleOpen) setStyleOpen(false)
        else if (hasActiveTool) finishTool()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activeTool, hasActiveTool, styleOpen])

  const activeCategoryKey = activeCategory ?? CATEGORIES.find((category) => category.tool === activeTool)?.key

  return (
    <nav aria-label="Строительство" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-3 pb-4">
      <style>{`
        .ribbon-panel { border: 1.5px solid #262626; border-radius: 16px; background: rgba(251,249,244,.95); color: #262626; box-shadow: 0 5px 0 rgba(38,38,38,.14), 0 12px 28px rgba(20,16,12,.18); backdrop-filter: blur(12px); }
        .ribbon-main { display:flex; align-items:center; gap:6px; max-width:calc(100vw - 24px); overflow-x:auto; padding:8px; }
        .ribbon-style-button { display:flex; flex:0 0 92px; width:92px; height:62px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:12px; cursor:pointer; }
        .ribbon-category-button { position:relative; display:flex; flex:0 0 68px; width:68px; height:62px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:12px; padding:4px; cursor:pointer; }
        .ribbon-category-button:hover,.ribbon-style-button:hover { border-color:rgba(38,38,38,.25); background:rgba(255,255,255,.8); }
        .ribbon-category-button[aria-pressed="true"],.ribbon-style-button[aria-expanded="true"] { border-color:#262626; background:#edd9c0; box-shadow:0 1px 3px rgba(0,0,0,.12); }
        .ribbon-style-menu { position:absolute; z-index:20; bottom:calc(100% + 12px); left:0; width:192px; border:1.5px solid #262626; border-radius:16px; background:#fbf9f4; padding:8px; color:#262626; box-shadow:0 12px 28px rgba(20,16,12,.2); }
        .ribbon-separator { flex:0 0 1px; width:1px; height:40px; margin:0 4px; background:rgba(38,38,38,.2); }
        .ribbon-group-separator { flex:0 0 1px; width:1px; height:36px; margin:0 2px; background:rgba(38,38,38,.15); }
        @media(max-width:700px) { .ribbon-main { max-width:calc(100vw - 16px); } }
      `}</style>

      <div className="ribbon-main ribbon-panel pointer-events-auto">
        <div className="relative shrink-0">
          <button type="button" aria-expanded={styleOpen} onClick={() => setStyleOpen((open) => !open)} className={cn('ribbon-style-button transition hover:bg-[#f1e9dc]', styleOpen && 'bg-[#edd9c0]')}>
            <span className="relative flex items-center gap-1.5">
              <PenLine className="size-5" strokeWidth={1.7} />
              <kbd className="absolute -right-3 -top-2 rounded border border-stone-300 bg-neutral-100 px-1 font-mono text-[9px] text-neutral-500">Q</kbd>
            </span>
            <span className="text-[11px] font-medium tracking-tight text-neutral-700">Style Pen</span>
            <span className="text-[9px] leading-none text-neutral-500">{RES_STYLES.find((item) => item.id === resStyle)?.label ?? 'European'}</span>
          </button>
          {styleOpen && (
            <div role="dialog" aria-label="Выбор архитектурного стиля" className="ribbon-style-menu">
              <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Стиль застройки</div>
              {RES_STYLES.map((style) => (
                <button key={style.id} type="button" onClick={() => { onResStyleChange?.(style.id); setStyleOpen(false) }} className={cn('flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition hover:bg-stone-100', resStyle === style.id && 'bg-[#edd9c0]')}>
                  <span className="text-xs font-semibold">{style.label}</span><span className="text-[10px] text-neutral-500">{style.detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ribbon-separator" />

        {CATEGORIES.map((category, index) => {
          const Icon = category.icon
          const selected = activeCategoryKey === category.key
          const showDivider = index === 2 || index === 6 || index === 10
          return (
            <div key={category.key} className="flex shrink-0 items-center gap-1">
              {showDivider && <div className="ribbon-group-separator" />}
              <button
                type="button"
                id={`category-${category.key.toLowerCase()}`}
                title={`${category.label} [${category.key}]${category.hint ? ` · ${category.hint}` : ''}`}
                aria-pressed={selected}
                onClick={() => chooseCategory(category)}
                className={cn('ribbon-category-button transition', selected && 'bg-[#edd9c0] shadow-sm')}
              >
                <kbd className="absolute right-1 top-0.5 rounded border border-stone-300 bg-neutral-100 px-1 font-mono text-[9px] leading-[14px] text-neutral-500">{category.key}</kbd>
                <Icon className="mt-1 size-5 text-[#292824]" strokeWidth={1.7} />
                <span className="whitespace-nowrap text-[11px] font-medium leading-none tracking-tight text-neutral-700">{category.label}</span>
              </button>
            </div>
          )
        })}
        {showServices && <>
          <div className="ribbon-separator" />
          {[
            { tool: ToolId.WIND, label: 'Ветряк', cost: '$250', capacity: 'Энергия', icon: Wind },
            { tool: ToolId.SOLAR_PANEL, label: 'Солн. панели', cost: '$300', capacity: 'Энергия', icon: Sun },
            { tool: ToolId.POLICE, label: 'Полиция', cost: '$400', capacity: '800 жителей', icon: Shield },
            { tool: ToolId.FIRE_STATION, label: 'Пожарные', cost: '$350', capacity: '800 жителей', icon: Flame },
          ].map((service) => {
            const Icon = service.icon
            const selected = activeTool === service.tool
            return <button key={service.tool} type="button" aria-pressed={selected} onClick={() => { setActiveCategory('V'); onSelect(service.tool) }} className="flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-2.5 py-1.5 text-left transition hover:border-[#262626]/25 hover:bg-white/80" style={selected ? { background: '#edd9c0', borderColor: '#262626' } : undefined}>
              <Icon className="size-5 shrink-0" strokeWidth={1.7} />
              <span className="flex flex-col leading-tight"><span className="text-xs font-semibold">{service.label}</span><span className="text-[10px] text-neutral-500">{service.cost} · {service.capacity}</span></span>
            </button>
          })}
        </>}
      </div>
    </nav>
  )
}
