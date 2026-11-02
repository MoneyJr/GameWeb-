import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { QUESTS, RANKS, type QuestContext } from '../../lib/progression'

const DONE_TEXT = { en: 'All advisor tasks complete!', ru: 'Все задания советника выполнены!', de: 'Alle Aufgaben erledigt!', fr: 'Toutes les missions accomplies !' }
const TASK_LABEL = { en: 'Task', ru: 'Задание', de: 'Aufgabe', fr: 'Mission' }
const RANK_UP = { en: 'New rank', ru: 'Новый ранг', de: 'Neuer Rang', fr: 'Nouveau rang' }
const NEW_BUILDINGS = { en: 'new buildings unlocked', ru: 'открыты новые здания', de: 'neue Gebäude freigeschaltet', fr: 'nouveaux bâtiments' }
const TO_NEXT = { en: 'to', ru: 'до', de: 'bis', fr: 'vers' }

/** Карточка ранга и текущего задания советника. Сворачивается, чтобы не мешать на телефоне. */
export function QuestCard({ rank, questIndex, context, sandbox }: { rank: number; questIndex: number; context: QuestContext; sandbox: boolean }) {
  const { language } = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [celebration, setCelebration] = useState<{ text: string; key: number } | null>(null)
  const previous = useRef({ rank, questIndex })

  useEffect(() => {
    const before = previous.current
    previous.current = { rank, questIndex }
    if (rank > before.rank) {
      setCelebration({ text: `${RANKS[rank].icon} ${RANK_UP[language]}: ${RANKS[rank].name[language]} — ${NEW_BUILDINGS[language]}!`, key: Date.now() })
    } else if (questIndex > before.questIndex) {
      const done = QUESTS[questIndex - 1]
      if (done) setCelebration({ text: `✅ ${done.text[language]} · +$${done.reward.toLocaleString()}`, key: Date.now() })
    }
  }, [rank, questIndex, language])

  useEffect(() => {
    if (!celebration) return undefined
    window.dispatchEvent(new CustomEvent('INK_SOUND', { detail: 'success' }))
    const timer = window.setTimeout(() => setCelebration(null), 3800)
    return () => window.clearTimeout(timer)
  }, [celebration])

  const current = RANKS[rank]
  const next = RANKS[rank + 1]
  const progress = next ? Math.min(1, (context.population - current.population) / (next.population - current.population)) : 1
  const quest = sandbox ? undefined : QUESTS[questIndex]

  return <div className="pointer-events-auto absolute left-[calc(env(safe-area-inset-left)+12px)] top-[calc(env(safe-area-inset-top)+64px)] z-20 w-[min(250px,calc(100vw-90px))]">
    <div className="rounded-2xl border border-[#2C241D]/25 bg-[#F4EEDD]/92 p-2.5 text-[#342a20] shadow-md backdrop-blur-md">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex w-full items-center gap-2 text-left" aria-expanded={!collapsed}>
        <span aria-hidden="true" className="text-lg leading-none">{current.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-black">{current.name[language]}</span>
          {next && <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#2C241D]/10"><span className="block h-full rounded-full bg-[#a65336] transition-all duration-700" style={{ width: `${progress * 100}%` }} /></span>}
          {next && <span className="mt-0.5 block text-[10px] font-semibold text-stone-600">{context.population.toLocaleString()} / {next.population.toLocaleString()} {TO_NEXT[language]} {next.icon} {next.name[language]}</span>}
        </span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {!collapsed && !sandbox && <div className="mt-2 border-t border-[#2C241D]/10 pt-2 text-xs">
        {quest ? <>
          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{TASK_LABEL[language]} {questIndex + 1}/{QUESTS.length}</span>
          <p className="mt-0.5 font-bold leading-snug">{quest.text[language]}</p>
          <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">+${quest.reward.toLocaleString()}</span>
        </> : <p className="font-bold">🏆 {DONE_TEXT[language]}</p>}
      </div>}
    </div>
    {celebration && <div key={celebration.key} className="toast-in-left mt-2 rounded-xl border-2 border-[#2C241D] bg-[#fff7e0] px-3 py-2 text-xs font-extrabold text-[#2C241D] shadow-[3px_3px_0_#2C241D]">{celebration.text}</div>}
  </div>
}
