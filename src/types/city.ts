/** Размер квадратной сетки города (клеток по каждой стороне). */
export const GRID_SIZE = 64

/** Типы тайлов. Используем объект + union вместо enum (совместимо с erasableSyntaxOnly). */
export const TileType = {
  EMPTY: 'EMPTY',
  ROAD: 'ROAD',
  RESIDENTIAL: 'RESIDENTIAL',
  COMMERCIAL: 'COMMERCIAL',
  INDUSTRIAL: 'INDUSTRIAL',
  WATER_PUMP: 'WATER_PUMP',
  PARK: 'PARK',
  WIND: 'WIND',
  SOLAR_PANEL: 'SOLAR_PANEL',
  COAL: 'COAL',
  POLICE: 'POLICE',
  FIRE_STATION: 'FIRE_STATION',
  CITY_HALL: 'CITY_HALL',
  FOOTPRINT: 'FOOTPRINT',
} as const

export type TileType = (typeof TileType)[keyof typeof TileType]

/** Одна ячейка сетки. */
export interface GridCell {
  x: number
  y: number
  type: TileType
  /** Есть ли доступ к воде (рядом водонапорная башня). */
  hasWater: boolean
  /** Есть ли электричество (клетка — дорога или примыкает к дороге). */
  hasPower: boolean
  level: number
  style?: string
  refX?: number
  refY?: number
  smog?: boolean
  parked?: boolean
  hasSupplies?: boolean
  /** Resident count and capacity are stored per home so migration is persistent. */
  residents?: number
  maxResidents?: number
  residentialFloors?: number
  /** Prebuilt showcase structures are rendered finished on the first frame. */
  animate?: boolean
}

/** Матрица сетки, индексация grid[y][x]. */
export type Grid = GridCell[][]

/** Инструменты нижней панели. */
export const ToolId = {
  CURSOR: 'CURSOR',
  ROAD: 'ROAD',
  RESIDENTIAL: 'RESIDENTIAL',
  COMMERCIAL: 'COMMERCIAL',
  INDUSTRIAL: 'INDUSTRIAL',
  WATER_PUMP: 'WATER_PUMP',
  PARK: 'PARK',
  WIND: 'WIND',
  SOLAR_PANEL: 'SOLAR_PANEL',
  COAL: 'COAL',
  POLICE: 'POLICE',
  FIRE_STATION: 'FIRE_STATION',
  CITY_HALL: 'CITY_HALL',
  BULLDOZE: 'BULLDOZE',
} as const

export type ToolId = (typeof ToolId)[keyof typeof ToolId]

/** Скорость симуляции: 1x, 2x, 3x. */
export type SimSpeed = 1 | 2 | 3
