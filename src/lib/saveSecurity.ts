import { GRID_SIZE, TileType, type Grid, type GridCell } from '../types/city'
import { isNaturalWaterCell } from './cityConfig'

const SAVE_PEPPER = 'inkville-integrity-v2-9f4b2c7e'

const VALID_TILE_TYPES = new Set<string>(Object.values(TileType))
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Безопасный JSON.parse с защитой от prototype pollution и ограничением размера. */
export function safeJsonParse<T>(raw: string | null | undefined, maxBytes = 2_000_000): T | null {
  if (!raw || typeof raw !== 'string' || raw.length > maxBytes) return null
  try {
    return JSON.parse(raw, (key, value) => (DANGEROUS_KEYS.has(key) ? undefined : value)) as T
  } catch {
    return null
  }
}

/** Очищает пользовательский ввод (название города, имя мэра) от управляющих символов и угловых скобок. */
export function sanitizeText(input: unknown, fallbackOrMaxLength: string | number = '', maybeFallbackOrMaxLength?: string | number): string {
  const fallback =
    typeof fallbackOrMaxLength === 'string'
      ? fallbackOrMaxLength
      : typeof maybeFallbackOrMaxLength === 'string'
        ? maybeFallbackOrMaxLength
        : ''
  const maxLength =
    typeof fallbackOrMaxLength === 'number'
      ? fallbackOrMaxLength
      : typeof maybeFallbackOrMaxLength === 'number'
        ? maybeFallbackOrMaxLength
        : 40
  if (typeof input !== 'string') return fallback
  let stripped = ''
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) continue
    const ch = input[i]
    if (ch === '<' || ch === '>' || ch === '`' || ch === '"' || ch === '\\') continue
    stripped += ch
  }
  const cleaned = stripped.replace(/\s+/g, ' ').trim().slice(0, maxLength)
  return cleaned || fallback
}

/** Ограничивает целое число в заданном диапазоне; при NaN/Infinity возвращает fallback. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.floor(num)))
}

/** Вычисляет 64-битную контрольную подпись (две 32-битные ветви с лавинным перемешиванием). */
export function computeSaveSignature(payloadJson: string): string {
  const input = `${SAVE_PEPPER}:${payloadJson.length}:${payloadJson}`
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + ((i & 0xff) << 8)
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  h1 ^= h1 >>> 16
  h1 = Math.imul(h1, 0x7feb352d)
  h1 ^= h1 >>> 15
  h2 ^= h2 >>> 13
  h2 = Math.imul(h2, 0xc2b2ae35)
  h2 ^= h2 >>> 16
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

interface SignedSaveEnvelope<T> {
  __inkvilleV: 2
  sig: string
  data: T
}

/** Упаковывает состояние сохранения в подписанный конверт. */
export function packSignedSave<T>(data: T): string {
  const payloadJson = JSON.stringify(data)
  const sig = computeSaveSignature(payloadJson)
  const envelope: SignedSaveEnvelope<T> = { __inkvilleV: 2, sig, data }
  return JSON.stringify(envelope)
}

/**
 * Распаковывает и проверяет сохранение.
 * Подписанные сохранения с нарушенной подписью отклоняются; старые неподписанные сохранения проходят валидацию схемы.
 */
export function unpackSignedSave<T>(raw: string | null | undefined): T | null {
  const parsed = safeJsonParse<SignedSaveEnvelope<T> | T>(raw)
  if (!parsed || typeof parsed !== 'object') return null
  if ('__inkvilleV' in parsed && parsed.__inkvilleV === 2) {
    if (typeof parsed.sig !== 'string' || !parsed.data || typeof parsed.data !== 'object') return null
    const expected = computeSaveSignature(JSON.stringify(parsed.data))
    if (parsed.sig !== expected) return null
    return parsed.data
  }
  return parsed as T
}

/** Проверяет и нормализует сетку города из сохранения (поддерживает миграцию старых 64×64 карт до 128×128). */
export function sanitizeSavedGrid(rawGrid: unknown): Grid | null {
  if (!Array.isArray(rawGrid) || (rawGrid.length !== GRID_SIZE && rawGrid.length !== 64)) return null
  const srcSize = rawGrid.length
  const result: Grid = []
  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = y < srcSize ? rawGrid[y] : undefined
    if (y < srcSize && (!Array.isArray(row) || row.length !== srcSize)) return null
    const cleanRow: GridCell[] = []
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (y >= srcSize || x >= srcSize) {
        const naturalWater = isNaturalWaterCell(x, y)
        cleanRow.push({
          x,
          y,
          type: naturalWater ? TileType.WATER : TileType.EMPTY,
          naturalWater: naturalWater || undefined,
          hasWater: false,
          hasPower: false,
          level: 1,
          orientation: 0,
        })
        continue
      }
      const cell = (row as unknown[])[x] as Partial<GridCell> | null | undefined
      if (!cell || typeof cell !== 'object') return null
      const type = typeof cell.type === 'string' && VALID_TILE_TYPES.has(cell.type)
        ? (cell.type as TileType)
        : TileType.EMPTY
      const orientation = cell.orientation === 1 || cell.orientation === 2 || cell.orientation === 3 ? cell.orientation : 0
      const cleanCell: GridCell = {
        x,
        y,
        type,
        hasWater: Boolean(cell.hasWater),
        hasPower: Boolean(cell.hasPower),
        level: clampInt(cell.level, 1, 3, 1),
        orientation,
      }
      if (typeof cell.style === 'string' && cell.style.length <= 24) cleanCell.style = sanitizeText(cell.style, 24, '') || undefined
      if (typeof cell.catalogId === 'string' && /^[a-z0-9_-]{1,40}$/i.test(cell.catalogId)) cleanCell.catalogId = cell.catalogId
      if (typeof cell.refX === 'number' && Number.isInteger(cell.refX) && cell.refX >= 0 && cell.refX < GRID_SIZE) cleanCell.refX = cell.refX
      if (typeof cell.refY === 'number' && Number.isInteger(cell.refY) && cell.refY >= 0 && cell.refY < GRID_SIZE) cleanCell.refY = cell.refY
      if (cell.smog) cleanCell.smog = true
      if (cell.parked) cleanCell.parked = true
      if (cell.hasSupplies) cleanCell.hasSupplies = true
      if (cell.naturalWater) cleanCell.naturalWater = true
      if (cell.residents !== undefined) cleanCell.residents = clampInt(cell.residents, 0, 5000, 0)
      if (cell.maxResidents !== undefined) cleanCell.maxResidents = clampInt(cell.maxResidents, 1, 5000, 15)
      if (cell.residentialFloors !== undefined) cleanCell.residentialFloors = clampInt(cell.residentialFloors, 1, 60, 2)
      if (cell.fire !== undefined) cleanCell.fire = clampInt(cell.fire, 1, 60, 1)
      cleanRow.push(cleanCell)
    }
    result.push(cleanRow)
  }
  return result
}
