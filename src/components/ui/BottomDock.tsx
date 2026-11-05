import {
  Building2,
  Clock,
  Grape,
  GraduationCap,
  Church,
  Droplets,
  Factory,
  Flame,
  Film,
  House,
  Landmark,
  Lock,
  Trees,
  Route,
  Shield,
  ShoppingBag,
  Store,
  Sun,
  TrainFront,
  TrainTrack,
  TreePine,
  Trophy,
  Trash2,
  Warehouse,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
import { ToolId } from '../../types/city'
import { BUILDING_CATALOG, type BuildingCategoryId } from '../../store/buildingCatalog'
import { useI18n } from '../../i18n/I18nProvider'
import { RANKS, unlockRankOf } from '../../lib/progression'

interface BottomDockProps {
  activeTool: ToolId
  onSelect: (tool: ToolId) => void
  selectedCatalogId?: string
  onCatalogSelect?: (id: string | undefined) => void
  /** Текущий ранг города: более поздние здания показываются в сером цвете с замком и открываются по мере роста уровня. */
  rank?: number
  sandbox?: boolean
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

const requiredRankForOption = (item: DockOption): number =>
  Math.max(unlockRankOf(item.catalogId), unlockRankOf(item.tool))

const sortByUnlockAndCost = (options: DockOption[]): DockOption[] =>
  [...options].sort((a, b) => {
    const rankDiff = requiredRankForOption(a) - requiredRankForOption(b)
    return rankDiff !== 0 ? rankDiff : a.cost - b.cost
  })

const catalogIcons: Record<string, LucideIcon> = {
  res_cottage: House, res_townhouse: House, res_apartment: Building2, res_panel_block: Building2, res_modern_glass_tower: Building2, res_half_timbered: House, res_cozy_estate: House, res_modern_block: Building2, res_brick_loft: Building2,
  res_villa_conservatory: House, res_balcony_block: Building2, res_brick_walkup: Building2, res_stalinka_pink: Landmark, res_streamline_curve: Building2, res_color_block: Building2, res_highrise_slab: Building2, res_bay_towers: Building2, res_megapolis_complex: Building2,
  com_bakery: Store, com_grocery: ShoppingBag, com_mall: Building2, com_cinema_cosmos: Film, com_wine_tavern: Grape, com_market_hall: Store, com_office_tower: Building2, com_glass_skyscraper: Building2,
  com_dept_store: ShoppingBag, com_grid_tower: Building2, com_glass_podium_tower: Building2, com_diagrid_skyscraper: Building2,
  ind_workshop: Factory, ind_factory: Factory, ind_warehouse: Warehouse, ind_winery: Grape, ind_brickworks: Factory, ind_concrete_plant: Warehouse, ind_steel_foundry: Factory,
  civ_fire: Flame, civ_school: Building2, civ_hospital: Building2, civ_stadium: Trophy, civ_diamond_arena: Trophy, civ_college_hall: GraduationCap, lnd_townhall: Landmark,
  lnd_park: TreePine, park_winter_tree: TreePine, park_plaza: Trees, park_town_square: Trees, park_waterfront: Waves, lnd_parking: Route, civ_university: Landmark, lnd_church: Church, lnd_cathedral: Church, lnd_clock_tower: Clock, park_rose_garden: Trees,
  utl_wind: Wind, utl_solar: Sun, utl_water: Droplets, utl_water_intake: Waves,
  civ_train_station: TrainFront, ind_freight_station: Warehouse,
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
  {
    key: '1',
    labelKey: 'category.roads',
    icon: Route,
    options: sortByUnlockAndCost([
      option(ToolId.ROAD, 'item.road', Route),
      { id: 'bridge_stone', catalogId: 'bridge_stone', labelKey: 'item.bridge_stone', icon: Route, tool: ToolId.BRIDGE, cost: TOOL_DEFINITIONS[ToolId.BRIDGE].cost },
      { id: 'bridge_suspension', catalogId: 'bridge_suspension', labelKey: 'item.bridge_suspension', icon: Landmark, tool: ToolId.BRIDGE, cost: 85 },
      option(ToolId.WATER, 'item.water', Waves),
    ]),
  },
  {
    key: 'T',
    labelKey: 'category.rail',
    icon: TrainFront,
    options: sortByUnlockAndCost([
      option(ToolId.RAIL, 'item.rail', TrainTrack),
      ...catalogOptions('rail'),
    ]),
  },
  { key: 'U', labelKey: 'category.utilities', icon: Droplets, options: sortByUnlockAndCost(catalogOptions('utilities')) },
  { key: 'H', labelKey: 'category.residential', icon: House, options: sortByUnlockAndCost(catalogOptions('residential')) },
  { key: 'S', labelKey: 'category.commercial', icon: Store, options: sortByUnlockAndCost(catalogOptions('commercial')) },
  { key: 'I', labelKey: 'category.industrial', icon: Factory, options: sortByUnlockAndCost(catalogOptions('industrial')) },
  { key: 'V', labelKey: 'category.services', icon: Shield, options: sortByUnlockAndCost([
    ...catalogOptions('civic'),
    option(ToolId.POLICE, 'item.police', Shield),
  ]) },
  { key: 'P', labelKey: 'category.parks', icon: TreePine, options: sortByUnlockAndCost([...catalogOptions('parks'), ...catalogOptions('landmarks')]) },
  { key: 'X', labelKey: 'category.demolish', icon: Trash2, options: [option(ToolId.BULLDOZE, 'item.demolish', Trash2)] },
]

export function BottomDock({ activeTool, onSelect, selectedCatalogId, onCatalogSelect, rank = 0, sandbox = false }: BottomDockProps) {
  const { t, language } = useI18n()
  const lockRank = (item: DockOption): number | null => {
    const required = requiredRankForOption(item)
    return !sandbox && rank < required ? required : null
  }
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategory)

  const chooseOption = (category: Category, item: DockOption) => {
    if (lockRank(item) !== null) return
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
    const firstUnlocked = category.options.find((item) => lockRank(item) === null)
    if (firstUnlocked) {
      onSelect(firstUnlocked.tool)
      onCatalogSelect?.(firstUnlocked.catalogId)
    } else {
      onSelect(ToolId.CURSOR)
      onCatalogSelect?.(undefined)
    }
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
  }, [activeCategory, onSelect, onCatalogSelect, rank, sandbox])

  return (
    <nav aria-label={t('category.construction')} className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] left-1/2 z-40 -translate-x-1/2 flex max-w-[calc(100vw-12px)] justify-center">
      <style>{`
        .dock-category-bar { display:flex; width:min(672px,calc(100vw - 12px)); align-items:center; justify-content:space-around; gap:3px; overflow-x:auto; scrollbar-width:none; border:1px solid rgba(43,43,43,.2); border-radius:16px; background:rgba(244,241,234,.95); padding:8px 16px; color:#262626; box-shadow:0 20px 32px rgba(20,16,12,.2); backdrop-filter:blur(12px); }
        .dock-category-bar::-webkit-scrollbar { display:none; }
        .dock-category-button { position:relative; display:flex; min-width:72px; flex:1 0 72px; height:58px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:11px; padding:4px 3px; transition:background .16s,border-color .16s,color .16s; }
        .dock-category-button[aria-pressed="true"] { border-color:#29251f; border-bottom:2px solid #29251f; background:#e5dfd3; }
        .dock-category-button.dock-category-locked { background:#e2dfd9; color:#78736a; }
        .dock-category-button.dock-category-locked[aria-pressed="true"] { border-color:#57534e; border-bottom:2px solid #57534e; background:#d6d3cd; color:#44403c; }
        .dock-item-button[aria-pressed="true"] { border-color:#6c5847; background:#edd9c0; }
        .dock-category-button:hover,.dock-item-button:not(:disabled):hover { background:#eee5d7; }
        .dock-category-button span { white-space:nowrap; font-size:11px; font-weight:600; }
        .dock-submenu { position:absolute; bottom:calc(100% + 12px); left:50%; display:flex; width:max-content; max-width:95vw; transform:translateX(-50%); gap:12px; overflow-x:auto; overflow-y:visible; overscroll-behavior-x:contain; touch-action:pan-x; scrollbar-width:thin; scrollbar-color:#a99b88 transparent; border:1px solid #d6d3d1; border-radius:16px; background:rgba(250,248,245,.98); padding:8px 16px; box-shadow:0 10px 26px rgba(20,16,12,.2); backdrop-filter:blur(12px); animation:dock-menu-in .18s ease-out; }
        .dock-submenu::-webkit-scrollbar { height:6px; }
        .dock-submenu::-webkit-scrollbar-thumb { border-radius:6px; background:#a99b88; }
        .dock-item-button { display:flex; width:164px; min-width:164px; height:68px; align-items:center; gap:9px; border:1px solid #d6d3d1; border-radius:12px; background:#faf8f5; padding:8px; text-align:left; transition:background .15s,border-color .15s; }
        .dock-item-button.dock-item-locked { border-color:#c4c0b8; background:#dedbd4; color:#6b665e; filter:grayscale(1); cursor:not-allowed; }
        @keyframes dock-menu-in { from { opacity:0; transform:translate(-50%,6px) } to { opacity:1; transform:translate(-50%,0) } }
        @media(max-width:767px) { .dock-category-bar { justify-content:flex-start; padding:5px 6px; } .dock-category-button { min-width:64px; flex-basis:64px; height:52px; gap:2px; } .dock-category-button svg { width:20px; height:20px; } .dock-category-button span { font-size:9px; } .dock-submenu { max-width:calc(100vw - 16px); } .dock-item-button { width:150px; min-width:150px; height:64px; } }
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
            const locked = lockRank(item)
            const isLocked = locked !== null
            const selected = !isLocked && (item.catalogId ? activeTool === item.tool && selectedCatalogId === item.catalogId : activeTool === item.tool && !selectedCatalogId)
            const label = t(item.labelKey)
            const rankInfo = locked !== null ? RANKS[locked] : null
            const description = locked !== null && rankInfo
              ? t('dock.lockedHint', locked + 1, rankInfo.name[language], rankInfo.population)
              : item.catalogId ? t(`description.${item.catalogId}`) : ''
            return <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              disabled={isLocked}
              title={locked !== null && rankInfo ? `${label} · 🔒 ${t('dock.lockedHint', locked + 1, rankInfo.name[language], rankInfo.population)}` : `${label} · $${item.cost}${item.footprint ? ` · ${item.footprint[0]}x${item.footprint[1]}` : ''}`}
              onClick={() => chooseOption(selectedCategory, item)}
              className={`dock-item-button ${isLocked ? 'dock-item-locked' : ''}`}
            >
              <span className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg ${isLocked ? 'bg-[#cbc7be] text-[#666159]' : 'bg-[#eee9df] text-[#332c24]'}`}>
                <Icon size={23} strokeWidth={1.7} />
                {isLocked && <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-stone-600 text-white shadow-xs"><Lock size={10} strokeWidth={2.4} /></span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`truncate text-xs font-semibold leading-tight ${isLocked ? 'text-stone-600' : 'text-[#262626]'}`}>{label}</span>
                {description && <span className={`truncate text-[9px] font-medium ${isLocked ? 'text-stone-600' : 'text-stone-500'}`}>{description}</span>}
                <span className="flex items-center gap-1">
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${isLocked ? 'bg-stone-300/90 text-stone-600' : 'bg-emerald-50 text-emerald-700'}`}>${item.cost}</span>
                  {item.footprint && <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-bold text-stone-600">{item.footprint[0]}x{item.footprint[1]}</span>}
                </span>
              </span>
            </button>
          })}
        </div>}
        <div className="dock-category-bar" aria-label={t('category.construction')}>
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            const label = t(category.labelKey)
            const allCategoryLocked = category.options.every((item) => lockRank(item) !== null)
            return <button
              key={category.key}
              type="button"
              title={`${label} [${category.key}]`}
              aria-pressed={activeCategory === category.key}
              onClick={() => chooseCategory(category)}
              className={`dock-category-button shrink-0 ${allCategoryLocked ? 'dock-category-locked' : ''}`}
            >
              {allCategoryLocked && <span className="absolute right-1.5 top-1 flex size-3.5 items-center justify-center rounded-full bg-stone-500/85 text-white"><Lock size={8} strokeWidth={2.5} /></span>}
              <Icon className={`size-6 ${allCategoryLocked ? 'text-stone-500' : 'text-[#292824]'}`} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          })}
        </div>
      </div>
    </nav>
  )
}
