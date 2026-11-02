/** Качество графики: на слабых телефонах отключаем тени и снижаем чёткость. */
export type QualityLevel = 'auto' | 'low' | 'medium' | 'high'

export interface QualityProfile {
  level: Exclude<QualityLevel, 'auto'>
  shadows: boolean
  shadowMapSize: number
  maxDpr: number
  antialias: boolean
  snowCount: number
}

const STORAGE_KEY = 'inkville-quality'
const PROFILES: Record<Exclude<QualityLevel, 'auto'>, QualityProfile> = {
  low: { level: 'low', shadows: false, shadowMapSize: 512, maxDpr: 1, antialias: false, snowCount: 700 },
  medium: { level: 'medium', shadows: true, shadowMapSize: 1024, maxDpr: 1.5, antialias: true, snowCount: 1400 },
  high: { level: 'high', shadows: true, shadowMapSize: 2048, maxDpr: 2, antialias: true, snowCount: 2200 },
}

export function readQualityLevel(): QualityLevel {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'low' || value === 'medium' || value === 'high' || value === 'auto' ? value : 'auto'
  } catch { return 'auto' }
}

export function saveQualityLevel(level: QualityLevel): void {
  try { localStorage.setItem(STORAGE_KEY, level) } catch { /* optional */ }
}

/** Автовыбор: компьютер — высокое, телефон — среднее, слабый телефон — низкое. */
export function detectQuality(): Exclude<QualityLevel, 'auto'> {
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 8
  if (!touch) return 'high'
  if (memory <= 3 || cores <= 4) return 'low'
  return 'medium'
}

export function resolveQuality(level: QualityLevel): QualityProfile {
  return PROFILES[level === 'auto' ? detectQuality() : level]
}
