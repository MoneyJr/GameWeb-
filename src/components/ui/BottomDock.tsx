import {
  Building2,
  Grape,
  Church,
  Droplets,
  Factory,
  Flame,
  Film,
  House,
  Landmark,
  Route,
  Shield,
  ShoppingBag,
  Store,
  Sun,
  TreePine,
  Trophy,
  Trash2,
  Warehouse,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
import { ToolId } from '../../types/city'
import { BUILDING_CATALOG, type BuildingCategoryId } from '../../store/buildingCatalog'
import { useI18n } from '../../i18n/I18nProvider'

interface BottomDockProps {
  activeTool: ToolId
  onSelect: (tool: ToolId) => void
  selectedCatalogId?: string
  onCatalogSelect?: (id: string | undefined) => void
}

interface DockOption {
  id: string
  catalogId?: string
  labelKey: string
  icon: LucideIcon
  tool: ToolId
  cost: number
  footprint?: [number, number]
}

interface Category {
  key: string
  labelKey: string
  icon: LucideIcon
  options: DockOption[]
}

const option = (tool: ToolId, labelKey: string, icon: LucideIcon): DockOption => ({
  id: tool,
  labelKey,
  icon,
  tool,
  cost: TOOL_DEFINITIONS[tool].cost,
})

const catalogIcons: Record<string, LucideIcon> = {
  res_cottage: House, res_townhouse: House, res_apartment: Building2, res_panel_block: Building2, res_modern_glass_tower: Building2, res_half_timbered: House, res_cozy_estate: House,
  com_bakery: Store, com_grocery: ShoppingBag, com_mall: Building2, com_cinema_cosmos: Film, com_wine_tavern: Grape,
  ind_workshop: Factory, ind_factory: Factory, ind_warehouse: Warehouse,
  civ_fire: Flame, civ_school: Building2, civ_hospital: Building2, civ_stadium: Trophy, lnd_townhall: Landmark,
  lnd_park: TreePine, lnd_church: Church, lnd_cathedral: Church,
  utl_wind: Wind, utl_solar: Sun, utl_water: Droplets,
  field_wheat: TreePine, field_plow: Route,
}

const catalogOptions = (category: BuildingCategoryId): DockOption[] => BUILDING_CATALOG
  .filter((entry) => entry.category === category)
  .map((entry) => ({
    id: entry.id,
    catalogId: entry.id,
    labelKey: `building.${entry.id}`,
    icon: catalogIcons[entry.id] ?? Store,
    tool: entry.tool,
    cost: entry.cost,
    footprint: entry.footprint,
  }))

const CATEGORIES: Category[] = [
  { key: '1', labelKey: 'category.roads', icon: Route, options: [option(ToolId.ROAD, 'item.road', Route)] },
  { key: 'U', labelKey: 'category.utilities', icon: Droplets, options: catalogOptions('utilities') },
  { key: 'H', labelKey: 'category.residential', icon: House, options: catalogOptions('residential') },
  { key: 'S', labelKey: 'category.commercial', icon: Store, options: catalogOptions('commercial') },
  { key: 'I', labelKey: 'category.industrial', icon: Factory, options: catalogOptions('industrial') },
  { key: 'V', labelKey: 'category.services', icon: Shield, options: [
    ...catalogOptions('civic'),
    option(ToolId.POLICE, 'item.police', Shield),
  ] },
  { key: 'P', labelKey: 'category.parks', icon: TreePine, options: [...catalogOptions('parks'), ...catalogOptions('landmarks')] },
  { key: 'X', labelKey: 'category.demolish', icon: Trash2, options: [option(ToolId.BULLDOZE, 'item.demolish', Trash2)] },
]

export function BottomDock({ activeTool, onSelect, selectedCatalogId, onCatalogSelect }: BottomDockProps) {
  const { t } = useI18n()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategory)

  const chooseOption = (category: Category, item: DockOption) => {
    setActiveCategory(category.key)
    onSelect(item.tool)
    onCatalogSelect?.(item.catalogId)
  }

  const chooseCategory = (category: Category) => {
    if (activeCategory === category.key) {
      setActiveCategory(null)
      onSelect(ToolId.CURSOR)
      onCatalogSelect?.(undefined)
      return
    }
    setActiveCategory(category.key)
    const first = category.options[0]
    onSelect(first?.tool ?? ToolId.CURSOR)
    onCatalogSelect?.(first?.catalogId)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Escape') {
        setActiveCategory(null)
        onSelect(ToolId.CURSOR)
        onCatalogSelect?.(undefined)
        return
      }
      const category = CATEGORIES.find((item) => item.key === event.key.toUpperCase())
      if (category) {
        event.preventDefault()
        chooseCategory(category)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeCategory, onSelect, onCatalogSelect])

  return (
    <nav aria-label={t('category.construction')} className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 flex max-w-[calc(100vw-12px)] justify-center">
      <style>{`
        .dock-category-bar { display:flex; width:min(672px,calc(100vw - 12px)); align-items:center; justify-content:space-around; gap:3px; overflow-x:auto; scrollbar-width:none; border:1px solid rgba(43,43,43,.2); border-radius:16px; background:rgba(244,241,234,.95); padding:8px 16px; color:#262626; box-shadow:0 20px 32px rgba(20,16,12,.2); backdrop-filter:blur(12px); }
        .dock-category-bar::-webkit-scrollbar { display:none; }
        .dock-category-button { display:flex; min-width:72px; flex:1 0 72px; height:58px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:11px; padding:4px 3px; transition:background .16s,border-color .16s; }
        .dock-category-button[aria-pressed="true"] { border-color:#29251f; border-bottom:2px solid #29251f; background:#e5dfd3; }
        .dock-item-button[aria-pressed="true"] { border-color:#6c5847; background:#edd9c0; }
        .dock-category-button:hover,.dock-item-button:hover { background:#eee5d7; }
        .dock-category-button span { white-space:nowrap; font-size:11px; font-weight:600; }
        .dock-submenu { position:absolute; bottom:calc(100% + 12px); left:50%; display:flex; width:max-content; max-width:95vw; transform:translateX(-50%); gap:12px; overflow-x:auto; overflow-y:visible; overscroll-behavior-x:contain; touch-action:pan-x; scrollbar-width:thin; scrollbar-color:#a99b88 transparent; border:1px solid #d6d3d1; border-radius:16px; background:rgba(250,248,245,.98); padding:8px 16px; box-shadow:0 10px 26px rgba(20,16,12,.2); backdrop-filter:blur(12px); animation:dock-menu-in .18s ease-out; }
        .dock-submenu::-webkit-scrollbar { height:6px; }
        .dock-submenu::-webkit-scrollbar-thumb { border-radius:6px; background:#a99b88; }
        .dock-item-button { display:flex; width:158px; min-width:158px; height:66px; align-items:center; gap:9px; border:1px solid #d6d3d1; border-radius:12px; background:#faf8f5; padding:8px; text-align:left; }
        @keyframes dock-menu-in { from { opacity:0; transform:translate(-50%,6px) } to { opacity:1; transform:translate(-50%,0) } }
        @media(max-width:767px) { .dock-category-bar { justify-content:flex-start; padding:5px 6px; } .dock-category-button { min-width:64px; flex-basis:64px; height:52px; gap:2px; } .dock-category-button svg { width:20px; height:20px; } .dock-category-button span { font-size:9px; } .dock-submenu { max-width:calc(100vw - 16px); } .dock-item-button { width:145px; min-width:145px; height:62px; } }
      `}</style>
      <div className="pointer-events-auto relative flex flex-col items-center">
        {selectedCategory && <div className="dock-submenu" aria-label={`${t('category.construction')}: ${t(selectedCategory.labelKey)}`} onWheel={(event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.currentTarget.scrollLeft += event.deltaY
            event.preventDefault()
          }
        }}>
          {selectedCategory.options.map((item) => {
            const Icon = item.icon
            const selected = item.catalogId ? selectedCatalogId === item.catalogId : activeTool === item.tool
            const label = t(item.labelKey)
            const description = item.catalogId ? t(`description.${item.catalogId}`) : ''
            return <button key={item.id} type="button" aria-pressed={selected} title={`${label} · $${item.cost}${item.footprint ? ` · ${item.footprint[0]}x${item.footprint[1]}` : ''}`} onClick={() => chooseOption(selectedCategory, item)} className="dock-item-button">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eee9df] text-[#332c24]"><Icon size={23} strokeWidth={1.7} /></span>
              <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-xs font-semibold leading-tight">{label}</span>{description && <span className="truncate text-[9px] text-stone-500">{description}</span>}<span className="flex items-center gap-1"><span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">${item.cost}</span>{item.footprint && <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-bold text-stone-600">{item.footprint[0]}x{item.footprint[1]}</span>}</span></span>
            </button>
          })}
        </div>}
        <div className="dock-category-bar" aria-label={t('category.construction')}>
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            const label = t(category.labelKey)
            return <button key={category.key} type="button" title={`${label} [${category.key}]`} aria-pressed={activeCategory === category.key} onClick={() => chooseCategory(category)} className="dock-category-button shrink-0">
              <Icon className="size-6 text-[#292824]" strokeWidth={1.7} /><span>{label}</span>
            </button>
          })}
        </div>
      </div>
    </nav>
  )
}
