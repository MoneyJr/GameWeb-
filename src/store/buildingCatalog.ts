import { TileType, ToolId, type TileType as TileTypeValue, type ToolId as ToolIdValue } from '../types/city'

export type BuildingCategoryId = 'residential' | 'commercial' | 'industrial' | 'civic' | 'parks' | 'utilities'

export interface BuildingCatalogEntry {
  id: string
  name: string
  category: BuildingCategoryId
  tool: ToolIdValue
  tile: TileTypeValue
  cost: number
  /** Net income for one ten-minute tick before tax adjustments. */
  tickNet: number
  /** Gross taxable income per ten-minute tick. */
  income?: number
  /** Upkeep charged per ten-minute tick. */
  maintenance?: number
  population?: number
  /** Consumer requirement or legacy producer output, in resource units. */
  energy?: number
  water?: number
  givesEnergy?: number
  givesWater?: number
  pollution?: number
  happiness?: number
  model: string
}

const residential = ToolId.RESIDENTIAL
const commercial = ToolId.COMMERCIAL
const industrial = ToolId.INDUSTRIAL
const civic = ToolId.FIRE_STATION
const parks = ToolId.PARK

/** Canonical keys used by new placements. Aliases below keep older local saves readable. */
export const BUILDING_CATALOG: readonly BuildingCatalogEntry[] = [
  { id: 'res_cottage', name: 'Уютный коттедж', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 90, tickNet: 3, income: 3, population: 15, energy: 1, water: 1, model: 'cottage' },
  { id: 'res_townhouse', name: 'Европейский таунхаус', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 180, tickNet: 9, income: 9, population: 45, energy: 2, water: 2, model: 'townhouse' },
  { id: 'res_apartment', name: 'Доходный дом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 360, tickNet: 22, income: 22, population: 110, energy: 4, water: 3, model: 'apartment' },
  { id: 'com_bakery', name: 'Пекарня / Кафе', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 120, tickNet: 10, income: 10, energy: 1, water: 1, model: 'bakery' },
  { id: 'com_grocery', name: 'Угловой гастроном', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 220, tickNet: 18, income: 18, energy: 2, water: 1, model: 'grocer' },
  { id: 'com_mall', name: 'Торговый центр', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 450, tickNet: 38, income: 38, energy: 4, water: 2, model: 'mall' },
  { id: 'ind_workshop', name: 'Мастерская / Цех', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 160, tickNet: 16, income: 16, pollution: 2, energy: 2, water: 1, model: 'workshop' },
  { id: 'ind_factory', name: 'Кирпичная мануфактура', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 320, tickNet: 35, income: 35, pollution: 5, energy: 4, water: 3, model: 'manufactory' },
  { id: 'ind_warehouse', name: 'Логистический склад', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 240, tickNet: 22, income: 22, energy: 2, water: 1, model: 'warehouse' },
  { id: 'civ_fire', name: 'Пожарное депо', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 250, tickNet: -8, maintenance: 8, energy: 2, water: 1, model: 'fire-depot' },
  { id: 'civ_school', name: 'Школа с кортом', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 300, tickNet: -10, maintenance: 10, happiness: 15, energy: 3, water: 2, model: 'school' },
  { id: 'civ_hospital', name: 'Городская больница', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 450, tickNet: -16, maintenance: 16, happiness: 20, energy: 5, water: 3, model: 'hospital' },
  { id: 'lnd_park', name: 'Сквер с фонтаном', category: 'parks', tool: parks, tile: TileType.PARK, cost: 80, tickNet: 0, happiness: 10, water: 1, model: 'fountain-square' },
  { id: 'lnd_church', name: 'Церковь со шпилем', category: 'parks', tool: parks, tile: TileType.PARK, cost: 380, tickNet: -6, maintenance: 6, happiness: 15, energy: 2, water: 1, model: 'church' },
  { id: 'lnd_townhall', name: 'Ратуша с часами', category: 'civic', tool: ToolId.CITY_HALL, tile: TileType.CITY_HALL, cost: 500, tickNet: -10, maintenance: 10, happiness: 20, energy: 3, water: 2, model: 'townhall' },
  { id: 'utl_wind', name: 'Ветрогенератор', category: 'utilities', tool: ToolId.WIND, tile: TileType.WIND, cost: 140, tickNet: -2, maintenance: 2, givesEnergy: 10, model: 'wind-generator' },
  { id: 'utl_solar', name: 'Солнечная панель', category: 'utilities', tool: ToolId.SOLAR_PANEL, tile: TileType.SOLAR_PANEL, cost: 200, tickNet: -1, maintenance: 1, givesEnergy: 16, model: 'solar-station' },
  { id: 'utl_water', name: 'Водонапорная башня', category: 'utilities', tool: ToolId.WATER_PUMP, tile: TileType.WATER_PUMP, cost: 120, tickNet: -2, maintenance: 2, givesWater: 15, model: 'water-tower' },
]

const canonicalById = Object.fromEntries(BUILDING_CATALOG.map((entry) => [entry.id, entry])) as Record<string, BuildingCatalogEntry>

const LEGACY_CATALOG_ID_ALIASES: Record<string, string> = {
  cottage: 'res_cottage', townhouse: 'res_townhouse', apartment: 'res_apartment',
  bakery: 'com_bakery', grocer: 'com_grocery', mall: 'com_mall',
  workshop: 'ind_workshop', manufactory: 'ind_factory', warehouse: 'ind_warehouse',
  'fire-depot': 'civ_fire', school: 'civ_school', hospital: 'civ_hospital',
  'fountain-square': 'lnd_park', church: 'lnd_church',
  'wind-generator': 'utl_wind', 'solar-station': 'utl_solar', 'water-tower': 'utl_water',
}

export const canonicalCatalogId = (id: string | undefined): string | undefined =>
  id ? LEGACY_CATALOG_ID_ALIASES[id] ?? id : undefined

/** Includes aliases so saved cities from earlier catalog versions continue to resolve. */
export const BUILDING_BY_ID: Record<string, BuildingCatalogEntry> = Object.fromEntries([
  ...BUILDING_CATALOG.map((entry) => [entry.id, entry] as const),
  ...Object.entries(LEGACY_CATALOG_ID_ALIASES).map(([legacyId, canonicalId]) => [legacyId, canonicalById[canonicalId]] as const),
])

export const DEFAULT_CATALOG_ID_BY_TILE = {
  [TileType.RESIDENTIAL]: 'res_townhouse',
  [TileType.COMMERCIAL]: 'com_bakery',
  [TileType.INDUSTRIAL]: 'ind_workshop',
  [TileType.FIRE_STATION]: 'civ_fire',
  [TileType.PARK]: 'lnd_park',
  [TileType.WIND]: 'utl_wind',
  [TileType.SOLAR_PANEL]: 'utl_solar',
  [TileType.WATER_PUMP]: 'utl_water',
  [TileType.CITY_HALL]: 'lnd_townhall',
} as Partial<Record<TileTypeValue, string>>
