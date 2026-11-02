import { Building2, X, Landmark } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import type { IncomeBreakdown } from '../../hooks/useCitySimulation'

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
  finance: IncomeBreakdown
  budget: number
}

export function CityHallModal({ onClose, taxRates, onTaxChange, debt, onLoan, onRepay, population, happiness, lastNet, waterServed, waterTotal, finance, budget }: CityHallModalProps) {
  const { t } = useI18n()
  const controls: [keyof TaxRates, string][] = [['residential', t('modal.residents')], ['commercial', t('modal.trade')], ['industrial', t('modal.factories')]]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[calc(100dvh-32px)] w-full max-w-[480px] overflow-y-auto rounded-3xl border-[3px] border-ink bg-[#f0ede6] p-5 shadow-[0_12px_0_0_var(--color-ink)] sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl border-2 border-ink bg-amber-200 shadow-[2px_2px_0_0_var(--color-ink)]"><Building2 className="size-6" /></div><div><h2 className="text-2xl font-black">{t('modal.cityHall')}</h2><p className="text-xs font-semibold text-ink-soft">{t('modal.taxAndTreasury')}</p></div></div>
          <button onClick={onClose} aria-label={t('modal.close')} className="rounded-full p-2 hover:bg-stone-200"><X className="size-6" /></button>
        </div>
        <div className="space-y-4">
          {budget < 0 && <p className="rounded-2xl border-2 border-rose-700 bg-rose-50 p-3 text-xs font-bold text-rose-800">{t('finance.bankrupt')}</p>}
          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
            <h3 className="mb-2 text-sm font-bold">{t('finance.title')}</h3>
            {([['residential', t('modal.residents')], ['commercial', t('modal.trade')], ['industrial', t('modal.factories')], ['other', t('finance.other')]] as const).map(([key, label]) => {
              const perDay = Math.round(finance[key] * 144)
              return perDay === 0 && key === 'other' ? null : <div key={key} className="mb-1 flex justify-between text-xs font-semibold"><span>{label}</span><span className="tabular-nums text-emerald-700">+${perDay.toLocaleString()}</span></div>
            })}
            <div className="mb-1 flex justify-between text-xs font-semibold"><span>{t('finance.maintenance')}</span><span className="tabular-nums text-rose-700">−${Math.round(finance.maintenance * 144).toLocaleString()}</span></div>
            {debt > 0 && <div className="mb-1 flex justify-between text-xs font-semibold"><span>{t('finance.loan')}</span><span className="tabular-nums text-rose-700">−$50</span></div>}
            <div className="mt-2 flex justify-between border-t border-ink/15 pt-2 text-sm font-black"><span>{t('finance.perDay')}</span><span className={`tabular-nums ${finance.net * 144 - (debt > 0 ? 50 : 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{finance.net * 144 - (debt > 0 ? 50 : 0) >= 0 ? '+' : '−'}${Math.abs(Math.round(finance.net * 144 - (debt > 0 ? 50 : 0))).toLocaleString()}</span></div>
          </div>
          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
            <h3 className="mb-3 text-sm font-bold">{t('modal.taxRates')}</h3>
            {controls.map(([key, label]) => <label key={key} className="mb-3 grid grid-cols-[88px_1fr_42px] items-center gap-2 text-xs font-bold last:mb-0"><span>{label}</span><input type="range" min="1" max="20" value={taxRates[key]} onChange={e => onTaxChange(key, Number(e.target.value))} className="accent-ink" /><span className="text-right text-sm">{taxRates[key]}%</span></label>)}
          </div>
          <div className="rounded-2xl border-2 border-ink bg-[#e8dfcf] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><Landmark className="size-6 shrink-0" /><div><div className="text-sm font-black">{t('modal.bank')}</div><div className="text-xs font-semibold">{t('modal.residents')}: {population}</div></div></div>
              {debt > 0 && <button onClick={onRepay} className="shrink-0 rounded-lg border-2 border-ink bg-[#d6a15f] px-3 py-2 text-xs font-black">{t('modal.repay', debt.toLocaleString())}</button>}
            </div>
            {debt > 0 ? <p className="mt-3 rounded-lg bg-white/55 px-3 py-2 text-xs font-bold">{t('modal.startLoan')}</p> : <button onClick={() => onLoan(2000)} className="mt-3 rounded-lg border border-ink/30 bg-white/55 px-3 py-2 text-xs font-bold">{t('modal.newLoan')}</button>}
          </div>
          <div className="rounded-2xl border-2 border-ink bg-white p-4 text-xs font-bold shadow-[2px_2px_0_0_var(--color-ink)]">
            <div className="mb-2 flex justify-between"><span>{t('modal.water')}</span><span>{waterServed}/{waterTotal}</span></div><div className="mb-2 flex justify-between"><span>{t('modal.happiness')}</span><span>{happiness}%</span></div><div className="flex justify-between"><span>{t('modal.netTick')}</span><span>{lastNet >= 0 ? '+' : ''}${lastNet}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
