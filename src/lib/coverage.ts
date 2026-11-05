import { GRID_SIZE, TileType, type Grid, type GridCell } from '../types/city'

export type ServiceKind = 'police' | 'fire' | 'education' | 'health'

export type CoverageMaps = Record<ServiceKind, Uint8Array>

export const SERVICE_RADIUS: Record<ServiceKind, number> = {
  police: 8,
  fire: 8,
  education: 7,
  health: 9,
}

function stamp(map: Uint8Array, cx: number, cy: number, radius: number) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(GRID_SIZE - 1, cy + radius); y += 1) {
    const span = radius - Math.abs(y - cy)
    for (let x = Math.max(0, cx - span); x <= Math.min(GRID_SIZE - 1, cx + span); x += 1) {
      map[y * GRID_SIZE + x] = 1
    }
  }
}

/** Строит карты покрытия служб (полиция, пожарные, школы, больницы) по манхэттенскому радиусу. */
export function computeCoverage(grid: Grid): CoverageMaps {
  const maps: CoverageMaps = {
    police: new Uint8Array(GRID_SIZE * GRID_SIZE),
    fire: new Uint8Array(GRID_SIZE * GRID_SIZE),
    education: new Uint8Array(GRID_SIZE * GRID_SIZE),
    health: new Uint8Array(GRID_SIZE * GRID_SIZE),
  }
  for (const row of grid) for (const cell of row) {
    if (!cell.hasWater || !cell.hasPower) continue
    if (cell.type === TileType.POLICE) stamp(maps.police, cell.x, cell.y, SERVICE_RADIUS.police)
    if (cell.type === TileType.FIRE_STATION && (!cell.catalogId || cell.catalogId === 'civ_fire')) {
      stamp(maps.fire, cell.x, cell.y, SERVICE_RADIUS.fire)
    }
    if (cell.catalogId === 'civ_school') stamp(maps.education, cell.x, cell.y, SERVICE_RADIUS.education)
    if (cell.catalogId === 'civ_college_hall') stamp(maps.education, cell.x, cell.y, 10)
    if (cell.catalogId === 'civ_university') stamp(maps.education, cell.x, cell.y, 14)
    if (cell.catalogId === 'civ_hospital') stamp(maps.health, cell.x, cell.y, SERVICE_RADIUS.health)
  }
  return maps
}

export function isCovered(maps: CoverageMaps, kind: ServiceKind, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && maps[kind][y * GRID_SIZE + x] === 1
}

/** Оценка стоимости земли клетки (0–100): вода, свет, парки, службы и отсутствие смога. */
export function landValueAt(cell: GridCell, maps: CoverageMaps): number {
  let value = 20
  if (cell.hasWater) value += 15
  if (cell.hasPower) value += 15
  if (cell.parked) value += 25
  if (isCovered(maps, 'police', cell.x, cell.y)) value += 8
  if (isCovered(maps, 'fire', cell.x, cell.y)) value += 7
  if (isCovered(maps, 'education', cell.x, cell.y)) value += 10
  if (isCovered(maps, 'health', cell.x, cell.y)) value += 10
  if (cell.smog) value -= 35
  return Math.max(0, Math.min(100, value))
}
