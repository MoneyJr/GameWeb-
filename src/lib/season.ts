/**
 * Визуальный сезон города по реальному календарю.
 * Для проверки: ?season=winter|spring|summer|autumn (или ?event=winter).
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

export interface SeasonPalette {
  /** Цвет земли днём. */
  ground: string
  /** Цвет неба/фона днём. */
  sky: string
  /** Листва деревьев на горизонте. */
  foliage: string[]
  hills: string[]
  vines: string[]
  river: string
  riverBank: string
  /** 0 — без снега, 1 — снег на крышах и снегопад. */
  snow: number
}

export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  autumn: {
    ground: '#b8b672', sky: '#e3dcc4',
    foliage: ['#eab308', '#eab308', '#eab308', '#eab308', '#eab308', '#d97724', '#d97724', '#d97724', '#991b1b', '#991b1b'],
    hills: ['#c49a45', '#a36f32', '#8b7355'], vines: ['#d99b26', '#e5a93c', '#c86d24', '#963824'],
    river: '#2b6cb0', riverBank: '#c9ad7f', snow: 0,
  },
  winter: {
    ground: '#f6f8fa', sky: '#eaf0f4',
    foliage: ['#f1f5f9', '#f1f5f9', '#e2e8f0', '#3f6b4f', '#3f6b4f', '#2f5640', '#4b7a5c', '#f8fafc'],
    hills: ['#eef2f5', '#d6dee5', '#c3ced8'], vines: ['#8a7560', '#76624f', '#e2e8f0', '#f1f5f9'],
    river: '#9cc0d8', riverBank: '#dfe6ec', snow: 1,
  },
  spring: {
    ground: '#a8d07c', sky: '#e2ecdc',
    foliage: ['#f9a8d4', '#f9a8d4', '#fbcfe8', '#86c06c', '#6aa84f', '#86c06c', '#fde68a', '#a3d977'],
    hills: ['#a9c27a', '#8fae62', '#b8c98c'], vines: ['#86c06c', '#a3d977', '#f9a8d4', '#6aa84f'],
    river: '#3b82c4', riverBank: '#c9b98f', snow: 0,
  },
  summer: {
    ground: '#9cc46f', sky: '#d9e8e6',
    foliage: ['#4d8b3f', '#5b9a46', '#3f7a35', '#6aa84f', '#4d8b3f', '#7cb342', '#3f7a35'],
    hills: ['#9fb35e', '#86a04c', '#b0a65c'], vines: ['#5b9a46', '#4d8b3f', '#7cb342', '#3f7a35'],
    river: '#2b74b8', riverBank: '#c8b07f', snow: 0,
  },
}

function forcedSeason(): Season | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const season = params.get('season')
    if (season === 'winter' || season === 'spring' || season === 'summer' || season === 'autumn') return season
    if (params.get('event') === 'winter') return 'winter'
  } catch { /* no window */ }
  return null
}

export function currentSeason(now = Date.now()): Season {
  const forced = forcedSeason()
  if (forced) return forced
  const month = new Date(now).getMonth()
  if (month === 11 || month <= 1) return 'winter'
  if (month <= 4) return 'spring'
  if (month <= 7) return 'summer'
  return 'autumn'
}
