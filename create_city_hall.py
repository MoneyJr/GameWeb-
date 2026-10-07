content = """import React from 'react'
import { Building2, X } from 'lucide-react'

interface CityHallModalProps {
  onClose: () => void
  taxRate: number
  onTaxChange: (rate: number) => void
  population: number
  happiness: number
  lastNet: number
  waterServed: number
  waterTotal: number
}

export function CityHallModal({ onClose, taxRate, onTaxChange, population, happiness, lastNet, waterServed, waterTotal }: CityHallModalProps) {
  const needsJobs = population > 0 && lastNet < 0 // Basic heuristic
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="w-[400px] rounded-3xl bg-[#f0ede6] p-6 shadow-[0_12px_0_0_var(--color-ink)] border-4 border-ink">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-200 border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)]">
              <Building2 className="size-6 text-ink" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black">Мэрия</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="size-6" strokeWidth={3} />
          </button>
        </div>
        
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
            <h3 className="mb-2 text-sm font-bold text-ink/70">Налоговая ставка</h3>
            <div className="flex items-center gap-4">
              <input 
                type="range" min="5" max="20" value={taxRate} 
                onChange={(e) => onTaxChange(parseInt(e.target.value))}
                className="w-full accent-ink" 
              />
              <span className="w-12 text-right text-xl font-black">{taxRate}%</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink-soft">
              Высокие налоги замедляют приток горожан, но увеличивают доход.
            </p>
          </div>
          
          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
            <h3 className="mb-3 text-sm font-bold text-ink/70">Статусы города</h3>
            <ul className="space-y-2 text-sm font-bold">
              <li className="flex items-center gap-2">
                <span className={`size-3 rounded-full border-2 border-ink ${waterServed >= waterTotal && waterTotal > 0 ? 'bg-green-400' : 'bg-rose-400'}`} />
                {waterTotal === 0 ? 'Нет зданий' : waterServed >= waterTotal ? 'Водоснабжение в норме' : 'Нехватка воды!'}
              </li>
              <li className="flex items-center gap-2">
                <span className={`size-3 rounded-full border-2 border-ink ${happiness >= 80 ? 'bg-green-400' : 'bg-rose-400'}`} />
                Уровень счастья: {happiness}%
              </li>
              <li className="flex items-center gap-2">
                <span className={`size-3 rounded-full border-2 border-ink ${!needsJobs ? 'bg-green-400' : 'bg-amber-400'}`} />
                {needsJobs ? 'Требуются рабочие места' : 'Экономика стабильна'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
"""
with open('src/components/ui/CityHallModal.tsx', 'w') as f:
    f.write(content)

with open('src/App.tsx', 'r') as f:
    app = f.read()

if 'CityHallModal' not in app:
    app = app.replace("import { BottomDock } from './components/ui/BottomDock'", "import { BottomDock } from './components/ui/BottomDock'\nimport { CityHallModal } from './components/ui/CityHallModal'")
    app = app.replace("const [resStyle, setResStyle] = useState<string>(\"EU\")", "const [resStyle, setResStyle] = useState<string>(\"EU\")\n  const [cityHallOpen, setCityHallOpen] = useState(false)")
    
    # Render modal
    app = app.replace("</main>", """</main>
      {cityHallOpen && (
        <CityHallModal
          onClose={() => setCityHallOpen(false)}
          taxRate={sim.taxRate}
          onTaxChange={(rate) => (window as any).__SIM_DISPATCH({ type: 'SET_TAX', rate })}
          population={sim.population}
          happiness={sim.happiness}
          lastNet={sim.lastNet}
          waterServed={sim.waterServed}
          waterTotal={sim.waterTotal}
        />
      )}""")
    
    with open('src/App.tsx', 'w') as f:
        f.write(app)

with open('src/components/ui/TopBar.tsx', 'r') as f:
    tb = f.read()

if 'onCityHallClick' not in tb:
    tb = tb.replace("export function TopBar({", "export function TopBar({\n  onCityHallClick,")
    tb = tb.replace("interface TopBarProps {", "interface TopBarProps {\n  onCityHallClick?: () => void")
    tb = tb.replace('        <div className="flex items-center gap-2 px-4">', """
        <button onClick={onCityHallClick} className="ml-2 flex items-center gap-2 rounded-full border-2 border-ink bg-amber-200 px-4 py-1.5 font-bold hover:bg-amber-300 transition-colors">
          Мэрия
        </button>
        <div className="flex items-center gap-2 px-4">""")

    with open('src/components/ui/TopBar.tsx', 'w') as f:
        f.write(tb)
        
with open('src/App.tsx', 'r') as f:
    app = f.read()
    app = app.replace("<TopBar\n          budget={sim.budget}", "<TopBar\n          onCityHallClick={() => setCityHallOpen(true)}\n          budget={sim.budget}")
    with open('src/App.tsx', 'w') as f:
        f.write(app)
