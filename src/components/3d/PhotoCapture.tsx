import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** Собирает кадр: снимок сцены в «бумажной» рамке с подписью города. */
async function composePhoto(source: string, caption: string, subtitle: string): Promise<Blob | null> {
  const image = new Image()
  image.src = source
  await image.decode()
  const border = Math.round(image.width * 0.035)
  const band = Math.round(image.width * 0.12)
  const canvas = document.createElement('canvas')
  canvas.width = image.width + border * 2
  canvas.height = image.height + border * 2 + band
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#f4eedd'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, border, border)
  ctx.lineWidth = Math.max(2, Math.round(image.width * 0.004))
  ctx.strokeStyle = '#1b1a17'
  ctx.strokeRect(border, border, image.width, image.height)
  const fontSize = Math.round(band * 0.36)
  ctx.fillStyle = '#1b1a17'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${fontSize}px Nunito, system-ui, sans-serif`
  ctx.fillText(caption, border, border * 2 + image.height + band * 0.38)
  ctx.font = `600 ${Math.round(fontSize * 0.55)}px Nunito, system-ui, sans-serif`
  ctx.fillStyle = '#5b4d3d'
  ctx.fillText(subtitle, border, border * 2 + image.height + band * 0.75)
  ctx.textAlign = 'right'
  ctx.font = `800 ${Math.round(fontSize * 0.6)}px Nunito, system-ui, sans-serif`
  ctx.fillStyle = '#a65336'
  ctx.fillText('Inkville', canvas.width - border, border * 2 + image.height + band * 0.5)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

/** Внутри Canvas: по событию INK_CAPTURE рендерит кадр и отдаёт картинку событием INK_PHOTO. */
export function PhotoCapture() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const onCapture = (event: Event) => {
      const detail = (event as CustomEvent<{ caption: string; subtitle: string }>).detail
      // Значки состояния (нет света, воды, товаров) в кадр не попадают.
      const hidden: { visible: boolean }[] = []
      scene.traverse((object) => {
        if (object.userData.hideInPhoto && object.visible) { object.visible = false; hidden.push(object) }
      })
      gl.render(scene, camera)
      const source = gl.domElement.toDataURL('image/png')
      hidden.forEach((object) => { object.visible = true })
      void composePhoto(source, detail?.caption ?? 'Inkville', detail?.subtitle ?? '').then((blob) => {
        if (blob) window.dispatchEvent(new CustomEvent('INK_PHOTO', { detail: blob }))
      })
    }
    window.addEventListener('INK_CAPTURE', onCapture)
    return () => window.removeEventListener('INK_CAPTURE', onCapture)
  }, [camera, gl, scene])
  return null
}
