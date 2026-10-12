export const CITY_PROFILE_KEY = 'inkville-city-profile'
export const MAYOR_NAME_KEY = 'inkville-mayor-name'
const CITY_STATS_KEY = 'inkville-city-stats'

export interface CityStats {
  foundedCities: number
  totalPlaySeconds: number
}

export function readCityStats(): CityStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(CITY_STATS_KEY) ?? '{}') as Partial<CityStats>
    return {
      foundedCities: Math.max(0, Math.floor(Number(parsed.foundedCities) || 0)),
      totalPlaySeconds: Math.max(0, Math.floor(Number(parsed.totalPlaySeconds) || 0)),
    }
  } catch { return { foundedCities: 0, totalPlaySeconds: 0 } }
}

function writeCityStats(stats: CityStats) {
  try { localStorage.setItem(CITY_STATS_KEY, JSON.stringify(stats)) } catch { /* Statistics are optional when storage is unavailable. */ }
}

export function registerFoundedCity() {
  const stats = readCityStats()
  writeCityStats({ ...stats, foundedCities: stats.foundedCities + 1 })
}

export function addPlaySeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 1) return
  const stats = readCityStats()
  writeCityStats({ ...stats, totalPlaySeconds: stats.totalPlaySeconds + Math.floor(seconds) })
}
