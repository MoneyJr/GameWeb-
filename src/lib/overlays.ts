export type OverlayMode = 'none' | 'water' | 'power' | 'smog' | 'police' | 'fire' | 'education' | 'health' | 'landValue'

export const OVERLAY_MODES: readonly Exclude<OverlayMode, 'none'>[] = ['water', 'power', 'smog', 'police', 'fire', 'education', 'health', 'landValue']

/** Иконка и подпись-ключ i18n для каждого слоя. */
export const OVERLAY_META: Record<Exclude<OverlayMode, 'none'>, { icon: string; key: string; color: string }> = {
  water: { icon: '💧', key: 'overlay.water', color: '#3b82f6' },
  power: { icon: '⚡', key: 'overlay.power', color: '#eab308' },
  smog: { icon: '🏭', key: 'overlay.smog', color: '#92400e' },
  police: { icon: '👮', key: 'overlay.police', color: '#2563eb' },
  fire: { icon: '🚒', key: 'overlay.fire', color: '#dc2626' },
  education: { icon: '🎓', key: 'overlay.education', color: '#7c3aed' },
  health: { icon: '🏥', key: 'overlay.health', color: '#db2777' },
  landValue: { icon: '💰', key: 'overlay.landValue', color: '#16a34a' },
}
