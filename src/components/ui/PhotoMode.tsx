import { Camera, Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { playSound } from '../../lib/sound'

/** Фото-режим: интерфейс скрыт, игрок выбирает ракурс и делает снимок города, которым можно поделиться. */
export function PhotoMode({ caption, subtitle, onExit }: { caption: string; subtitle: string; onExit: () => void }) {
  const { t } = useI18n()
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const onPhoto = (event: Event) => {
      const blob = (event as CustomEvent<Blob>).detail
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    }
    window.addEventListener('INK_PHOTO', onPhoto)
    return () => window.removeEventListener('INK_PHOTO', onPhoto)
  }, [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  const shoot = () => {
    playSound('click')
    setFlash(true)
    window.setTimeout(() => setFlash(false), 180)
    window.dispatchEvent(new CustomEvent('INK_CAPTURE', { detail: { caption, subtitle } }))
  }
  const fileName = `${caption.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'inkville'}.jpg`
  const file = photo ? new File([photo.blob], fileName, { type: 'image/jpeg' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const share = async () => {
    if (!file) return
    try { await navigator.share({ files: [file], title: caption, text: `${caption} — Inkville` }) } catch { /* cancelled */ }
  }

  return <>
    {flash && <div className="pointer-events-none fixed inset-0 z-[60] bg-white/80" />}
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+20px)] z-50 flex items-center justify-center gap-6">
      <button type="button" onClick={onExit} aria-label={t('photo.exit')} className="grid size-12 place-items-center rounded-full border border-[#292a2c]/30 bg-[#fbf9f4]/90 shadow-md backdrop-blur-sm active:scale-95"><X size={22} /></button>
      <button type="button" onClick={shoot} aria-label={t('photo.shoot')} className="grid size-[72px] place-items-center rounded-full border-4 border-[#fbf9f4] bg-[#a65336] text-white shadow-lg active:scale-95"><Camera size={30} /></button>
      <span className="size-12" />
    </div>
    <p className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-50 text-center text-xs font-bold text-[#2C241D] [text-shadow:0_1px_0_#fff]">{t('photo.hint')}</p>
    {photo && <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-stone-900/70 p-4 backdrop-blur-sm" onClick={() => setPhoto(null)}>
      <img src={photo.url} alt={caption} className="max-h-[70dvh] max-w-full rounded-lg shadow-2xl" onClick={(event) => event.stopPropagation()} />
      <div className="flex flex-wrap justify-center gap-3" onClick={(event) => event.stopPropagation()}>
        {canShare && <button type="button" onClick={share} className="flex items-center gap-2 rounded-full bg-[#a65336] px-5 py-3 text-sm font-black text-white shadow-lg"><Share2 size={18} />{t('photo.share')}</button>}
        <a href={photo.url} download={fileName} className="flex items-center gap-2 rounded-full bg-[#fbf9f4] px-5 py-3 text-sm font-black text-[#2C241D] shadow-lg"><Download size={18} />{t('photo.save')}</a>
        <button type="button" onClick={() => setPhoto(null)} className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white">{t('photo.again')}</button>
      </div>
    </div>}
  </>
}
