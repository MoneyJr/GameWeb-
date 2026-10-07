import {
  Building2,
  Droplets,
  Factory,
  Flame,
  House,
  Landmark,
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
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
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
  tools: ToolId[]
}

const CATEGORIES: Category[] = [
  { key: '1', label: 'Дороги', icon: Route, tools: [ToolId.ROAD] },
  { key: 'U', label: 'Ток и вода', icon: Droplets, tools: [ToolId.WIND, ToolId.SOLAR_PANEL, ToolId.WATER_PUMP, ToolId.COAL] },
  { key: 'H', label: 'Жильё', icon: House, tools: [ToolId.RESIDENTIAL] },
  { key: 'S', label: 'Торговля', icon: Store, tools: [ToolId.COMMERCIAL] },
  { key: 'I', label: 'Заводы', icon: Factory, tools: [ToolId.INDUSTRIAL] },
  { key: 'V', label: 'Службы', icon: Shield, tools: [ToolId.POLICE, ToolId.FIRE_STATION, ToolId.CITY_HALL] },
  { key: 'P', label: 'Парки', icon: TreePine, tools: [ToolId.PARK] },
  { key: 'X', label: 'Снос', icon: Trash2, tools: [ToolId.BULLDOZE] },
]

const TOOL_ICONS: Partial<Record<ToolId, LucideIcon>> = {
  [ToolId.ROAD]: Route,
  [ToolId.WIND]: Wind,
  [ToolId.SOLAR_PANEL]: Sun,
  [ToolId.WATER_PUMP]: Droplets,
  [ToolId.COAL]: Factory,
  [ToolId.RESIDENTIAL]: House,
  [ToolId.COMMERCIAL]: Store,
  [ToolId.INDUSTRIAL]: Building2,
  [ToolId.POLICE]: Shield,
  [ToolId.FIRE_STATION]: Flame,
  [ToolId.CITY_HALL]: Landmark,
  [ToolId.PARK]: TreePine,
  [ToolId.BULLDOZE]: Trash2,
}

const TOOL_LABELS: Partial<Record<ToolId, string>> = {
  [ToolId.WIND]: 'Ветряк',
  [ToolId.SOLAR_PANEL]: 'Солнечная панель',
  [ToolId.WATER_PUMP]: 'Водонапорная башня',
  [ToolId.COAL]: 'ТЭС',
  [ToolId.RESIDENTIAL]: 'Жилой дом',
  [ToolId.COMMERCIAL]: 'Магазин',
  [ToolId.INDUSTRIAL]: 'Завод',
  [ToolId.POLICE]: 'Полицейский участок',
  [ToolId.FIRE_STATION]: 'Пожарная часть',
  [ToolId.CITY_HALL]: 'Ратуша / Мэрия',
  [ToolId.PARK]: 'Парк',
  [ToolId.BULLDOZE]: 'Снос',
}

const RES_STYLES = [
  { id: 'EU', label: 'European', detail: 'Старая Европа' },
  { id: 'US', label: 'American', detail: 'Американский' },
  { id: 'EAST', label: 'Eastern', detail: 'Восточный' },
]

export function BottomDock({ activeTool, onSelect, resStyle = 'EU', onResStyleChange }: BottomDockProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const activeToolCategory = CATEGORIES.find((category) => category.tools.includes(activeTool))
  const activeCategoryKey = activeCategory ?? activeToolCategory?.key ?? null
  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategoryKey)

  const chooseCategory = (category: Category) => {
    setActiveCategory(category.key)
    if (!category.tools.includes(activeTool)) onSelect(category.tools[0])
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toUpperCase()
      if (key === 'Q') {
        event.preventDefault()
        setStyleOpen((open) => !open)
        return
      }
      const category = CATEGORIES.find((item) => item.key === key)
      if (category) {
        event.preventDefault()
        chooseCategory(category)
      } else if (event.key === 'Escape') {
        setStyleOpen(false)
        setActiveCategory(null)
        onSelect(ToolId.CURSOR)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, onSelect])

  return (
    <nav aria-label="Строительство" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-3 pb-4">
      <style>{`
        .ribbon-panel { border:1.5px solid #262626; border-radius:16px; background:rgba(251,249,244,.95); color:#262626; box-shadow:0 5px 0 rgba(38,38,38,.14),0 12px 28px rgba(20,16,12,.18); backdrop-filter:blur(12px); }
        .ribbon-main,.ribbon-tools { display:flex; align-items:center; gap:6px; max-width:calc(100vw - 24px); overflow-x:auto; padding:8px; }
        .ribbon-main { scrollbar-width:none; }
        .ribbon-main::-webkit-scrollbar,.ribbon-tools::-webkit-scrollbar { display:none; }
        .ribbon-style-button { display:flex; flex:0 0 92px; width:92px; height:62px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:12px; cursor:pointer; }
        .ribbon-category-button { position:relative; display:flex; flex:0 0 68px; width:68px; height:62px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:12px; padding:4px; cursor:pointer; }
        .ribbon-tool-button { display:flex; min-width:104px; max-width:180px; height:48px; flex:0 0 auto; align-items:center; gap:8px; border:1px solid transparent; border-radius:12px; padding:6px 10px; text-align:left; cursor:pointer; }
        .ribbon-category-button:hover,.ribbon-style-button:hover,.ribbon-tool-button:hover { border-color:rgba(38,38,38,.25); background:rgba(255,255,255,.8); }
        .ribbon-category-button[aria-pressed="true"],.ribbon-tool-button[aria-pressed="true"],.ribbon-style-button[aria-expanded="true"] { border-color:#262626; background:#edd9c0; box-shadow:0 1px 3px rgba(0,0,0,.12); }
        .ribbon-style-menu { position:absolute; z-index:20; bottom:calc(100% + 12px); left:0; width:192px; border:1.5px solid #262626; border-radius:16px; background:#fbf9f4; padding:8px; color:#262626; box-shadow:0 12px 28px rgba(20,16,12,.2); }
        .ribbon-separator { flex:0 0 1px; width:1px; height:40px; margin:0 4px; background:rgba(38,38,38,.2); }
        @media(max-width:700px) { .ribbon-main,.ribbon-tools { max-width:calc(100vw - 16px); } .ribbon-tool-button { min-width:94px; } }
      `}</style>

      {selectedCategory && (
        <div className="ribbon-tools ribbon-panel pointer-events-auto" aria-label={`Инструменты: ${selectedCategory.label}`}>
          {selectedCategory.tools.map((tool) => {
            const Icon = TOOL_ICONS[tool] ?? Building2
            const definition = TOOL_DEFINITIONS[tool]
            const label = TOOL_LABELS[tool] ?? definition.label
            return (
              <button
                key={tool}
                type="button"
                aria-pressed={activeTool === tool}
                onClick={() => onSelect(tool)}
                className="ribbon-tool-button transition"
                title={`${label} · $${definition.cost}`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.7} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-neutral-500">${definition.cost}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

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
        {CATEGORIES.map((category) => {
          const Icon = category.icon
          const selected = activeCategoryKey === category.key
          return (
            <button
              key={category.key}
              type="button"
              id={`category-${category.key.toLowerCase()}`}
              title={`${category.label} [${category.key}]`}
              aria-pressed={selected}
              onClick={() => chooseCategory(category)}
              className={cn('ribbon-category-button transition', selected && 'bg-[#edd9c0] shadow-sm')}
            >
              <kbd className="absolute right-1 top-0.5 rounded border border-stone-300 bg-neutral-100 px-1 font-mono text-[9px] leading-[14px] text-neutral-500">{category.key}</kbd>
              <Icon className="mt-1 size-5 text-[#292824]" strokeWidth={1.7} />
              <span className="whitespace-nowrap text-[11px] font-medium leading-none tracking-tight text-neutral-700">{category.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
