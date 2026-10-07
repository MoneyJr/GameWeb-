import { Building2, X, Landmark } from 'lucide-react'

type TaxRates = { residential: number; commercial: number; industrial: number }
interface CityHallModalProps {
  onClose: () => void
  taxRates: TaxRates
  onTaxChange: (category: keyof TaxRates, rate: number) => void
  debt: number
  onLoan: (amount: number) => void
  onRepay: () => void
  population: number
  happiness: number
  lastNet: number
  waterServed: number
  waterTotal: number
}

export function CityHallModal({ onClose, taxRates, onTaxChange, debt, onLoan, onRepay, population, happiness, lastNet, waterServed, waterTotal }: CityHallModalProps) {
  const controls: [keyof TaxRates, string][] = [['residential', 'Жители'], ['commercial', 'Торговля'], ['industrial', 'Заводы']]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-3xl border-[3px] border-ink bg-[#f0ede6] p-6 shadow-[0_12px_0_0_var(--color-ink)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl border-2 border-ink bg-amber-200 shadow-[2px_2px_0_0_var(--color-ink)]"><Building2 className="size-6" /></div><div><h2 className="text-2xl font-black">Мэрия</h2><p className="text-xs font-semibold text-ink-soft">Налоги и городская казна</p></div></div>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-2 hover:bg-stone-200"><X className="size-6" /></button>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
            <h3 className="mb-3 text-sm font-bold">Раздельные налоговые ставки</h3>
            {controls.map(([key, label]) => <label key={key} className="mb-3 grid grid-cols-[88px_1fr_42px] items-center gap-2 text-xs font-bold last:mb-0"><span>{label}</span><input type="range" min="1" max="20" value={taxRates[key]} onChange={e => onTaxChange(key, Number(e.target.value))} className="accent-ink" /><span className="text-right text-sm">{taxRates[key]}%</span></label>)}
          </div>
          <div className="rounded-2xl border-2 border-ink bg-[#e8dfcf] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><Landmark className="size-6 shrink-0" /><div><div className="text-sm font-black">Городской банк</div><div className="text-xs font-semibold">Жители: {population}</div></div></div>
              {debt > 0 && <button onClick={onRepay} className="shrink-0 rounded-lg border-2 border-ink bg-[#d6a15f] px-3 py-2 text-xs font-black">Погасить досрочно (${debt.toLocaleString()})</button>}
            </div>
            {debt > 0 ? <p className="mt-3 rounded-lg bg-white/55 px-3 py-2 text-xs font-bold">Стартовый заём: $1,000 · Выплата: $10/день</p> : <button onClick={() => onLoan(2000)} className="mt-3 rounded-lg border border-ink/30 bg-white/55 px-3 py-2 text-xs font-bold">Оформить новый заём $2,000</button>}
          </div>
          <div className="rounded-2xl border-2 border-ink bg-white p-4 text-xs font-bold shadow-[2px_2px_0_0_var(--color-ink)]">
            <div className="mb-2 flex justify-between"><span>Водоснабжение</span><span>{waterServed}/{waterTotal}</span></div><div className="mb-2 flex justify-between"><span>Счастье</span><span>{happiness}%</span></div><div className="flex justify-between"><span>Доход за день</span><span>{lastNet >= 0 ? '+' : ''}${lastNet}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
