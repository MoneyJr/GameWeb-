import { TileType, ToolId, type TileType as TileTypeValue, type ToolId as ToolIdValue } from '../types/city'

export type BuildingCategoryId = 'residential' | 'commercial' | 'industrial' | 'civic' | 'parks' | 'utilities'

export interface BuildingCatalogEntry {
  id: string
  name: string
  category: BuildingCategoryId
  tool: ToolIdValue
  tile: TileTypeValue
  cost: number
  /** Net cash change for one ten-minute simulation tick. */
  tickNet: number
  population?: number
  energy?: number
  water?: number
  happiness?: number
  model: string
}

export const BUILDING_CATALOG: readonly BuildingCatalogEntry[] = [
  { id: 'cottage', name: 'Уютный коттедж', category: 'residential', tool: ToolId.RESIDENTIAL, tile: TileType.RESIDENTIAL, cost: 80, tickNet: 3, population: 15, model: 'cottage' },
  { id: 'townhouse', name: 'Европейский таунхаус', category: 'residential', tool: ToolId.RESIDENTIAL, tile: TileType.RESIDENTIAL, cost: 180, tickNet: 9, population: 45, model: 'townhouse' },
  { id: 'apartment', name: 'Доходный дом', category: 'residential', tool: ToolId.RESIDENTIAL, tile: TileType.RESIDENTIAL, cost: 380, tickNet: 22, population: 110, model: 'apartment' },
  { id: 'bakery', name: 'Пекарня / Кафе', category: 'commercial', tool: ToolId.COMMERCIAL, tile: TileType.COMMERCIAL, cost: 120, tickNet: 10, model: 'bakery' },
  { id: 'grocer', name: 'Угловой гастроном', category: 'commercial', tool: ToolId.COMMERCIAL, tile: TileType.COMMERCIAL, cost: 220, tickNet: 18, model: 'grocer' },
  { id: 'mall', name: 'Торговый центр', category: 'commercial', tool: ToolId.COMMERCIAL, tile: TileType.COMMERCIAL, cost: 450, tickNet: 38, water: 2, energy: 2, model: 'mall' },
  { id: 'workshop', name: 'Мастерская / Цех', category: 'industrial', tool: ToolId.INDUSTRIAL, tile: TileType.INDUSTRIAL, cost: 160, tickNet: 16, model: 'workshop' },
  { id: 'manufactory', name: 'Кирпичная мануфактура', category: 'industrial', tool: ToolId.INDUSTRIAL, tile: TileType.INDUSTRIAL, cost: 320, tickNet: 35, happiness: -10, model: 'manufactory' },
  { id: 'warehouse', name: 'Логистический склад', category: 'industrial', tool: ToolId.INDUSTRIAL, tile: TileType.INDUSTRIAL, cost: 260, tickNet: 24, model: 'warehouse' },
  { id: 'fire-depot', name: 'Пожарное депо', category: 'civic', tool: ToolId.FIRE_STATION, tile: TileType.FIRE_STATION, cost: 250, tickNet: -8, model: 'fire-depot' },
  { id: 'school', name: 'Начальная школа', category: 'civic', tool: ToolId.FIRE_STATION, tile: TileType.FIRE_STATION, cost: 300, tickNet: -10, happiness: 15, model: 'school' },
  { id: 'hospital', name: 'Городская больница', category: 'civic', tool: ToolId.FIRE_STATION, tile: TileType.FIRE_STATION, cost: 450, tickNet: -15, happiness: 20, model: 'hospital' },
  { id: 'fountain-square', name: 'Сквер с фонтаном', category: 'parks', tool: ToolId.PARK, tile: TileType.PARK, cost: 90, tickNet: 0, happiness: 8, model: 'fountain-square' },
  { id: 'church', name: 'Старинная церковь со шпилем', category: 'parks', tool: ToolId.PARK, tile: TileType.PARK, cost: 400, tickNet: -6, happiness: 18, model: 'church' },
  { id: 'triumphal-arch', name: 'Триумфальная арка', category: 'parks', tool: ToolId.PARK, tile: TileType.PARK, cost: 500, tickNet: 0, happiness: 25, model: 'triumphal-arch' },
  { id: 'wind-generator', name: 'Ветрогенератор', category: 'utilities', tool: ToolId.WIND, tile: TileType.WIND, cost: 150, tickNet: 0, energy: 8, model: 'wind-generator' },
  { id: 'solar-station', name: 'Солнечная станция', category: 'utilities', tool: ToolId.SOLAR_PANEL, tile: TileType.SOLAR_PANEL, cost: 220, tickNet: 0, energy: 14, model: 'solar-station' },
  { id: 'water-tower', name: 'Водонапорная башня', category: 'utilities', tool: ToolId.WATER_PUMP, tile: TileType.WATER_PUMP, cost: 120, tickNet: 0, water: 15, model: 'water-tower' },
]

export const BUILDING_BY_ID = Object.fromEntries(BUILDING_CATALOG.map((entry) => [entry.id, entry])) as Record<string, BuildingCatalogEntry>
export const DEFAULT_CATALOG_ID_BY_TILE = {
  [TileType.RESIDENTIAL]: 'townhouse',
  [TileType.COMMERCIAL]: 'bakery',
  [TileType.INDUSTRIAL]: 'workshop',
  [TileType.FIRE_STATION]: 'fire-depot',
  [TileType.PARK]: 'fountain-square',
  [TileType.WIND]: 'wind-generator',
  [TileType.SOLAR_PANEL]: 'solar-station',
  [TileType.WATER_PUMP]: 'water-tower',
} as Partial<Record<TileTypeValue, string>>
