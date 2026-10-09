import {
  Building2,
  Church,
  Droplets,
  Factory,
  Flame,
  House,
  Landmark,
  Route,
  Shield,
  ShoppingBag,
  Store,
  Sun,
  TreePine,
  Trash2,
  Warehouse,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
import { ToolId } from '../../types/city'
import { BUILDING_CATALOG, type BuildingCategoryId } from '../../store/buildingCatalog'

interface BottomDockProps {
  activeTool: ToolId
  onSelect: (tool: ToolId) => void
  selectedCatalogId?: string
  onCatalogSelect?: (id: string | undefined) => void
}

interface DockOption {
  id: string
  catalogId?: string
  label: string
  icon: LucideIcon
  tool: ToolId
  cost: number
}

interface Category {
  key: string
  label: string
  icon: LucideIcon
  options: DockOption[]
}

const option = (tool: ToolId, label: string, icon: LucideIcon): DockOption => ({
  id: tool,
  label,
  icon,
  tool,
  cost: TOOL_DEFINITIONS[tool].cost,
})

const catalogIcons: Record<string, LucideIcon> = {
  cottage: House, townhouse: House, apartment: Building2,
  bakery: Store, grocer: ShoppingBag, mall: Building2,
  workshop: Factory, manufactory: Factory, warehouse: Warehouse,
  'fire-depot': Flame, school: Building2, hospital: Building2,
  'fountain-square': TreePine, church: Church, 'triumphal-arch': Landmark,
  'wind-generator': Wind, 'solar-station': Sun, 'water-tower': Droplets,
}

const catalogOptions = (category: BuildingCategoryId): DockOption[] => BUILDING_CATALOG
  .filter((entry) => entry.category === category)
  .map((entry) => ({
    id: entry.id,
    catalogId: entry.id,
    label: entry.name,
    icon: catalogIcons[entry.id] ?? Store,
    tool: entry.tool,
    cost: entry.cost,
  }))

const CATEGORIES: Category[] = [
  { key: '1', label: 'Дороги', icon: Route, options: [option(ToolId.ROAD, 'Асфальтовая дорога', Route)] },
  { key: 'U', label: 'Сети', icon: Droplets, options: catalogOptions('utilities') },
  { key: 'H', label: 'Жильё', icon: House, options: catalogOptions('residential') },
  { key: 'S', label: 'Коммерция', icon: Store, options: catalogOptions('commercial') },
  { key: 'I', label: 'Промзона', icon: Factory, options: catalogOptions('industrial') },
  { key: 'V', label: 'Службы', icon: Shield, options: [
    ...catalogOptions('civic'),
    option(ToolId.POLICE, 'Полицейский участок', Shield),
    option(ToolId.CITY_HALL, 'Мэрия / Ратуша', Landmark),
  ] },
  { key: 'P', label: 'Парки', icon: TreePine, options: catalogOptions('parks') },
  { key: 'X', label: 'Снос', icon: Trash2, options: [option(ToolId.BULLDOZE, 'Снести объект', Trash2)] },
]

export function BottomDock({ activeTool, onSelect, selectedCatalogId, onCatalogSelect }: BottomDockProps) {
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
    <nav aria-label="Строительство" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-2 pb-3 md:pb-4">
      <style>{`
        .dock-category-bar { display:flex; width:min(672px,calc(100vw - 16px)); align-items:center; justify-content:space-around; gap:3px; overflow-x:auto; scrollbar-width:none; border:1px solid rgba(41,37,36,.2); border-radius:16px; background:rgba(245,242,235,.95); padding:8px 12px; color:#262626; box-shadow:0 10px 28px rgba(20,16,12,.2); backdrop-filter:blur(12px); }
        .dock-category-bar::-webkit-scrollbar,.dock-submenu::-webkit-scrollbar { display:none; }
        .dock-category-button { display:flex; min-width:72px; flex:1 0 72px; height:58px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border:1px solid transparent; border-radius:11px; padding:4px 3px; transition:background .16s,border-color .16s; }
        .dock-category-button[aria-pressed="true"],.dock-item-button[aria-pressed="true"] { border-color:#6c5847; background:#edd9c0; }
        .dock-category-button:hover,.dock-item-button:hover { background:#eee5d7; }
        .dock-category-button span { white-space:nowrap; font-size:11px; font-weight:600; }
        .dock-submenu { position:absolute; bottom:calc(100% + 12px); left:50%; display:flex; max-width:min(92vw,760px); transform:translateX(-50%); gap:8px; overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:none; border:1px solid #d6d3d1; border-radius:16px; background:rgba(250,248,245,.97); padding:8px; box-shadow:0 10px 26px rgba(20,16,12,.2); backdrop-filter:blur(12px); animation:dock-menu-in .18s ease-out; }
        .dock-item-button { display:flex; width:158px; min-width:158px; height:66px; align-items:center; gap:9px; border:1px solid #d6d3d1; border-radius:12px; background:#faf8f5; padding:8px; text-align:left; }
        @keyframes dock-menu-in { from { opacity:0; transform:translate(-50%,6px) } to { opacity:1; transform:translate(-50%,0) } }
        @media(max-width:767px) { .dock-category-bar { justify-content:flex-start; padding:5px 6px; } .dock-category-button { min-width:64px; flex-basis:64px; height:52px; gap:2px; } .dock-category-button svg { width:20px; height:20px; } .dock-category-button span { font-size:9px; } .dock-submenu { max-width:calc(100vw - 16px); } .dock-item-button { width:145px; min-width:145px; height:62px; } }
      `}</style>
      <div className="pointer-events-auto relative flex flex-col items-center">
        {selectedCategory && <div className="dock-submenu" aria-label={`Предметы категории ${selectedCategory.label}`}>
          {selectedCategory.options.map((item) => {
            const Icon = item.icon
            const selected = item.catalogId ? selectedCatalogId === item.catalogId : activeTool === item.tool
            return <button key={item.id} type="button" aria-pressed={selected} title={`${item.label} · $${item.cost}`} onClick={() => chooseOption(selectedCategory, item)} className="dock-item-button">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eee9df] text-[#332c24]"><Icon size={23} strokeWidth={1.7} /></span>
              <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-[11px] font-semibold leading-tight">{item.label}</span><span className="text-xs font-bold text-[#8b4d32]">${item.cost}</span></span>
            </button>
          })}
        </div>}
        <div className="dock-category-bar" aria-label="Категории строительства">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            return <button key={category.key} type="button" title={`${category.label} [${category.key}]`} aria-pressed={activeCategory === category.key} onClick={() => chooseCategory(category)} className="dock-category-button shrink-0">
              <Icon className="size-6 text-[#292824]" strokeWidth={1.7} /><span>{category.label}</span>
            </button>
          })}
        </div>
      </div>
    </nav>
  )
}
