import { GRID_SIZE, TileType, type Grid, type GridCell } from '../types/city'

/** Городские службы с радиусом действия. */
export type ServiceKind = 'police' | 'fire' | 'education' | 'health'

export const SERVICE_KINDS: readonly ServiceKind[] = ['police', 'fire', 'education', 'health']

/** Радиус действия службы в клетках. */
export const SERVICE_RADIUS: Record<ServiceKind, number> = { police: 10, fire: 10, education: 12, health: 14 }

export type CoverageMaps = Record<ServiceKind, Uint8Array>

export function serviceKindOf(cell: GridCell): ServiceKind | null {
  if (cell.type === TileType.POLICE) return 'police'
  if (cell.type !== TileType.FIRE_STATION) return null
  if (!cell.catalogId || cell.catalogId === 'civ_fire') return 'fire'
  if (cell.catalogId === 'civ_school' || cell.catalogId === 'civ_university') return 'education'
  if (cell.catalogId === 'civ_hospital') return 'health'
  return null
}

/** Карта покрытия: 1 — клетка в радиусе хотя бы одной станции этой службы. */
export function computeCoverage(grid: Grid): CoverageMaps {
  const maps: CoverageMaps = {
    police: new Uint8Array(GRID_SIZE * GRID_SIZE),
    fire: new Uint8Array(GRID_SIZE * GRID_SIZE),
    education: new Uint8Array(GRID_SIZE * GRID_SIZE),
    health: new Uint8Array(GRID_SIZE * GRID_SIZE),
  }
  for (const row of grid) for (const cell of row) {
    const kind = serviceKindOf(cell)
    if (!kind) continue
    // Станция работает только с водой и электричеством.
    if (!cell.hasPower || !cell.hasWater) continue
    // Университет охватывает образованием почти весь город.
    const radius = cell.catalogId === 'civ_university' ? 18 : SERVICE_RADIUS[kind]
    const map = maps[kind]
    for (let y = Math.max(0, cell.y - radius); y <= Math.min(GRID_SIZE - 1, cell.y + radius); y += 1) {
      for (let x = Math.max(0, cell.x - radius); x <= Math.min(GRID_SIZE - 1, cell.x + radius); x += 1) {
        const dx = x - cell.x, dy = y - cell.y
        if (dx * dx + dy * dy <= radius * radius) map[y * GRID_SIZE + x] = 1
      }
    }
  }
  return maps
}

export const isCovered = (maps: CoverageMaps, kind: ServiceKind, x: number, y: number) => maps[kind][y * GRID_SIZE + x] === 1

/** Стоимость земли 0–100: парки и службы повышают, смог снижает. */
export function landValueAt(cell: GridCell, maps: CoverageMaps): number {
  let value = 45
  if (cell.parked) value += 18
  if (cell.smog) value -= 30
  if (isCovered(maps, 'education', cell.x, cell.y)) value += 10
  if (isCovered(maps, 'health', cell.x, cell.y)) value += 10
  if (isCovered(maps, 'police', cell.x, cell.y)) value += 8
  if (cell.hasWater) value += 5
  if (cell.hasPower) value += 4
  return Math.max(0, Math.min(100, value))
}
