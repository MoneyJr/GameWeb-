import { Layers, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { OVERLAY_META, OVERLAY_MODES, type OverlayMode } from '../../lib/overlays'

/** Кнопка «Слои»: подсветка воды, света, смога, служб и стоимости земли поверх города. */
export function OverlayPicker({ mode, onChange }: { mode: OverlayMode; onChange: (mode: OverlayMode) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const active = mode !== 'none' ? OVERLAY_META[mode] : null
  return <div className="absolute left-[calc(env(safe-area-inset-left)+12px)] top-1/2 z-30 flex -translate-y-1/2 flex-col items-start gap-2">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t('overlay.title')} title={t('overlay.title')}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-md backdrop-blur-sm active:scale-95 ${active ? 'border-[#2C241D] bg-[#2C241D] text-white' : 'border-[#292a2c]/35 bg-[#fbf9f4]/80 text-[#292a2c]'}`}>
      <Layers size={20} strokeWidth={1.8} />
    </button>
    {open && <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto rounded-2xl border border-[#292a2c]/20 bg-[#fbf9f4]/95 p-1.5 shadow-lg backdrop-blur-md">
      {OVERLAY_MODES.map((item) => {
        const meta = OVERLAY_META[item]
        const selected = item === mode
        return <button key={item} type="button" aria-pressed={selected} onClick={() => { onChange(selected ? 'none' : item); setOpen(false) }}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold ${selected ? 'bg-[#2C241D] text-white' : 'text-stone-800 hover:bg-stone-200/60'}`}>
          <span aria-hidden="true" className="text-base">{meta.icon}</span>{t(meta.key)}
        </button>
      })}
    </div>}
    {active && !open && <div className="flex max-w-[60vw] items-center gap-1.5 rounded-full border border-[#292a2c]/20 bg-[#fbf9f4]/90 py-1 pl-2.5 pr-1 text-[11px] font-bold text-stone-800 shadow-md backdrop-blur-sm">
      <span aria-hidden="true">{active.icon}</span>
      <span className="truncate">{t(active.key)} · {t(`overlay.legend.${mode}`)}</span>
      <button type="button" onClick={() => onChange('none')} aria-label={t('overlay.off')} className="grid size-6 place-items-center rounded-full hover:bg-stone-200"><X size={14} /></button>
    </div>}
  </div>
}
