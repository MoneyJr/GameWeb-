import { GRID_SIZE, TileType, ToolId } from '../types/city'

export interface ToolDefinition {
  id: ToolId
  label: string
  /** Горячая клавиша (цифра или буква). */
  hotkey: string
  /** Стоимость постройки одной клетки. */
  cost: number
  /** Какой тайл ставит инструмент (null — инструмент ничего не строит). */
  tile: TileType | null
}

/** Центральная линия судоходной реки (в координатах сетки 0..GRID_SIZE-1). */
export function riverCenterGridY(_x: number): number {
  return 7.5
}

/** Природное русло реки и лесная заводь на стартовой карте (без ступенчатых зазубрин на сетке). */
export function isNaturalWaterCell(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false
  if (y >= 6 && y <= 9) return true
  if (x >= 50 && x <= 56 && y >= 46 && y <= 50) {
    const isCorner = (x === 50 || x === 56) && (y === 46 || y === 50)
    return !isCorner
  }
  return false
}

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  [ToolId.CURSOR]: { id: ToolId.CURSOR, label: 'Курсор', hotkey: '1', cost: 0, tile: null },
  [ToolId.ROAD]: { id: ToolId.ROAD, label: 'Дорога', hotkey: '2', cost: 10, tile: TileType.ROAD },
  [ToolId.BRIDGE]: { id: ToolId.BRIDGE, label: 'Мост', hotkey: 'B', cost: 60, tile: TileType.BRIDGE },
  [ToolId.RAIL]: { id: ToolId.RAIL, label: 'Железная дорога', hotkey: 'T', cost: 25, tile: TileType.RAIL },
  [ToolId.STATION]: { id: ToolId.STATION, label: 'Вокзал', hotkey: 'T+S', cost: 550, tile: TileType.STATION },
  [ToolId.WATER]: { id: ToolId.WATER, label: 'Водоём / Канал', hotkey: 'W', cost: 30, tile: TileType.WATER },
  [ToolId.RESIDENTIAL]: {
    id: ToolId.RESIDENTIAL,
    label: 'Жилая зона',
    hotkey: '3',
    cost: 100,
    tile: TileType.RESIDENTIAL,
  },
  [ToolId.COMMERCIAL]: {
    id: ToolId.COMMERCIAL,
    label: 'Торговля',
    hotkey: '4',
    cost: 150,
    tile: TileType.COMMERCIAL,
  },
  [ToolId.INDUSTRIAL]: {
    id: ToolId.INDUSTRIAL,
    label: 'Завод',
    hotkey: '5',
    cost: 200,
    tile: TileType.INDUSTRIAL,
  },
  [ToolId.WATER_PUMP]: {
    id: ToolId.WATER_PUMP,
    label: 'Вода',
    hotkey: '6',
    cost: 120,
    tile: TileType.WATER_PUMP,
  },
  [ToolId.PARK]: { id: ToolId.PARK, label: 'Парк', hotkey: '7', cost: 80, tile: TileType.PARK },
  [ToolId.WIND]: { id: ToolId.WIND, label: 'Ветряк', hotkey: '8', cost: 250, tile: TileType.WIND },
  [ToolId.SOLAR_PANEL]: { id: ToolId.SOLAR_PANEL, label: 'Солнечная панель', hotkey: 'V+S', cost: 300, tile: TileType.SOLAR_PANEL },
  [ToolId.COAL]: { id: ToolId.COAL, label: 'ТЭС', hotkey: '9', cost: 500, tile: TileType.COAL },
  [ToolId.POLICE]: { id: ToolId.POLICE, label: 'Полиция', hotkey: 'V+P', cost: 400, tile: TileType.POLICE },
  [ToolId.FIRE_STATION]: { id: ToolId.FIRE_STATION, label: 'Пожарные', hotkey: 'V+F', cost: 350, tile: TileType.FIRE_STATION },
  [ToolId.CITY_HALL]: { id: ToolId.CITY_HALL, label: 'Мэрия', hotkey: 'M', cost: 500, tile: TileType.CITY_HALL },
  [ToolId.BULLDOZE]: { id: ToolId.BULLDOZE, label: 'Снос', hotkey: '0', cost: 0, tile: null },
}

export const TOOL_ORDER: readonly ToolId[] = [
  ToolId.CURSOR,
  ToolId.ROAD,
  ToolId.BRIDGE,
  ToolId.RAIL,
  ToolId.STATION,
  ToolId.WATER,
  ToolId.RESIDENTIAL,
  ToolId.COMMERCIAL,
  ToolId.INDUSTRIAL,
  ToolId.WATER_PUMP,
  ToolId.PARK,
  ToolId.WIND,
  ToolId.COAL,
  ToolId.CITY_HALL,
  ToolId.BULLDOZE,
  ToolId.POLICE,
  ToolId.FIRE_STATION,
  ToolId.SOLAR_PANEL,
]
