import { clampInt, safeJsonParse, sanitizeText } from './saveSecurity'

export const CITY_PROFILE_KEY = 'inkville-city-profile'
export const MAYOR_NAME_KEY = 'inkville-mayor-name'
const CITY_STATS_KEY = 'inkville-city-stats'

export interface CityStats {
  foundedCities: number
  totalPlaySeconds: number
}

export function readCityStats(): CityStats {
  const parsed = safeJsonParse<Partial<CityStats>>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(CITY_STATS_KEY) : null,
  )
  return {
    foundedCities: clampInt(parsed?.foundedCities, 0, 1_000_000, 0),
    totalPlaySeconds: clampInt(parsed?.totalPlaySeconds, 0, 1_000_000_000, 0),
  }
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
  writeCityStats({ ...stats, totalPlaySeconds: stats.totalPlaySeconds + Math.min(86_400, Math.floor(seconds)) })
}

export { sanitizeText }
