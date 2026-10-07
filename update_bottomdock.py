content = """import { Droplets, Factory, Hammer, House, MousePointer2, Route, Store, TreePine, Wind, Zap, type LucideIcon } from 'lucide-react'
import { TOOL_DEFINITIONS, TOOL_ORDER } from '../../lib/cityConfig'
import { cn } from '../../lib/utils'
import { ToolId } from '../../types/city'

interface BottomDockProps {
  activeTool: ToolId
  onSelect: (tool: ToolId) => void
  resStyle?: string
  onResStyleChange?: (style: string) => void
}

interface ToolVisual {
  icon: LucideIcon
  tint: string
}

const TOOL_VISUALS: Record<ToolId, ToolVisual> = {
  [ToolId.CURSOR]: { icon: MousePointer2, tint: 'bg-stone-200' },
  [ToolId.ROAD]: { icon: Route, tint: 'bg-slate-300' },
  [ToolId.RESIDENTIAL]: { icon: House, tint: 'bg-rose-200' },
  [ToolId.COMMERCIAL]: { icon: Store, tint: 'bg-sky-200' },
  [ToolId.INDUSTRIAL]: { icon: Factory, tint: 'bg-orange-200' },
  [ToolId.WATER_PUMP]: { icon: Droplets, tint: 'bg-cyan-200' },
  [ToolId.PARK]: { icon: TreePine, tint: 'bg-green-200' },
  [ToolId.WIND]: { icon: Wind, tint: 'bg-teal-200' },
  [ToolId.COAL]: { icon: Zap, tint: 'bg-stone-400' },
  [ToolId.BULLDOZE]: { icon: Hammer, tint: 'bg-red-300' },
}

const RES_STYLES = [
  { id: 'EU', label: 'Европа' },
  { id: 'US', label: 'США' },
  { id: 'JP', label: 'Япония' }
]

export function BottomDock({ activeTool, onSelect, resStyle = 'EU', onResStyleChange }: BottomDockProps) {
  return (
    <nav
      aria-label="Инструменты строительства"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center p-4"
    >
      <style>{`
        .spring-btn {
          width: 76px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.15s, background-color 0.15s;
        }
        .spring-btn-active {
          transform: translateY(-8px) scale(1.05);
          box-shadow: 0 10px 0 0 rgba(0, 0, 0, 0.9);
          border-color: var(--color-ink);
          background-color: white;
        }
        .spring-btn:not(.spring-btn-active):hover {
          transform: translateY(-3px);
          border-color: rgba(0,0,0,0.4);
          background-color: rgba(255,255,255,0.7);
        }
        .spring-btn:active {
          transform: translateY(0px) scale(0.97) !important;
          box-shadow: 0 0 0 0 rgba(0, 0, 0, 0) !important;
        }
      `}</style>

      {/* Sub-menu for Residential styles */}
      <div className={cn(
        "pointer-events-auto flex gap-2 mb-2 transition-all duration-300",
        activeTool === ToolId.RESIDENTIAL ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {RES_STYLES.map(style => (
          <button
            key={style.id}
            onClick={() => onResStyleChange && onResStyleChange(style.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-extrabold border-2 transition-colors",
              resStyle === style.id ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/20 hover:border-ink/50"
            )}
          >
            {style.label}
          </button>
        ))}
      </div>

      <div className="ink-panel pointer-events-auto flex items-center gap-2 rounded-3xl p-2.5 h-[100px]">
        {TOOL_ORDER.map((toolId) => {
          const definition = TOOL_DEFINITIONS[toolId]
          const { icon: Icon, tint } = TOOL_VISUALS[toolId]
          const active = toolId === activeTool
          return (
            <div key={toolId} className="relative h-full flex items-center">
              <button
                id={`tool-${toolId.toLowerCase().replace('_', '-')}`}
                type="button"
                title={`${definition.label} [${definition.hotkey}]`}
                aria-pressed={active}
                onClick={() => onSelect(toolId)}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-2xl border-2 border-transparent px-1 pb-1.5 pt-2 cursor-pointer',
                  'spring-btn',
                  active && 'spring-btn-active'
                )}
              >
                <span className="absolute left-1.5 top-1 text-[10px] font-extrabold text-ink-soft/70">
                  {definition.hotkey}
                </span>
                <span
                  className={cn(
                    'grid size-11 place-items-center rounded-xl border-2 border-ink transition-transform',
                    tint,
                    'group-hover:scale-105',
                    active && 'scale-105',
                  )}
                >
                  <Icon className="size-6" strokeWidth={2.25} />
                </span>
                <span className="text-[12px] font-extrabold leading-none">{definition.label}</span>
                <span className="text-[10px] font-bold leading-none text-ink-soft">
                  {definition.cost > 0 ? `$${definition.cost}` : '—'}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
"""
with open('src/components/ui/BottomDock.tsx', 'w') as f:
    f.write(content)
