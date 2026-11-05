import type { Season } from '../lib/season'
import { TileType, ToolId, type TileType as TileTypeValue, type ToolId as ToolIdValue } from '../types/city'

export type BuildingCategoryId = 'residential' | 'commercial' | 'industrial' | 'civic' | 'parks' | 'landmarks' | 'utilities' | 'rail'

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
  /** Placement footprint in simulation tiles (width, depth). */
  footprint?: [number, number]
  materialCost?: { bricks?: number; concrete?: number; steel?: number }
  model: string
  /** Сезонная постройка: доступна для строительства только в этот сезон. */
  season?: Season
}

const residential = ToolId.RESIDENTIAL
const commercial = ToolId.COMMERCIAL
const industrial = ToolId.INDUSTRIAL
const civic = ToolId.FIRE_STATION
const parks = ToolId.PARK
const station = ToolId.STATION

/** Canonical keys used by new placements. Aliases below keep older local saves readable. */
export const BUILDING_CATALOG: readonly BuildingCatalogEntry[] = [
  // Жилые здания
  { id: 'res_cottage', name: 'Уютный коттедж', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 90, tickNet: 3, income: 3, population: 15, energy: 1, water: 1, model: 'cottage' },
  { id: 'res_cozy_estate', name: 'Уютная усадьба с садом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 130, tickNet: 5, income: 5, population: 24, energy: 1, water: 1, model: 'cozy-estate' },
  { id: 'res_townhouse', name: 'Европейский таунхаус', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 180, tickNet: 9, income: 9, population: 45, energy: 2, water: 2, model: 'townhouse' },
  { id: 'res_half_timbered', name: 'Фахверковый дом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 220, tickNet: 12, income: 12, population: 55, energy: 2, water: 2, model: 'half-timbered' },
  { id: 'res_villa_conservatory', name: 'Вилла с зимним садом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 260, tickNet: 15, income: 15, population: 65, happiness: 4, energy: 2, water: 2, model: 'villa-conservatory' },
  { id: 'res_courtyard_east', name: 'Южный дом с куполом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 310, tickNet: 18, income: 18, population: 85, happiness: 4, energy: 2, water: 2, model: 'courtyard-east' },
  { id: 'res_apartment', name: 'Доходный дом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 360, tickNet: 22, income: 22, population: 110, energy: 4, water: 3, model: 'apartment' },
  { id: 'res_brownstone_us', name: 'Американский браунстоун', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 390, tickNet: 24, income: 24, population: 115, happiness: 3, energy: 3, water: 3, model: 'brownstone-us' },
  { id: 'res_brick_loft', name: 'Кирпичный лофт', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 420, tickNet: 26, income: 26, population: 120, energy: 3, water: 3, happiness: 3, model: 'brick-loft' },
  { id: 'res_balcony_block', name: 'Бежевый дом с балконами', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 460, tickNet: 29, income: 29, population: 140, energy: 4, water: 3, happiness: 3, model: 'balcony-block' },
  { id: 'res_brick_walkup', name: 'Кирпичный корпус с лестницами', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 520, tickNet: 36, income: 36, population: 175, energy: 4, water: 4, happiness: 4, footprint: [2, 1], materialCost: { bricks: 4 }, model: 'brick-walkup' },
  { id: 'res_panel_block', name: 'Панельный жилой блок', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 550, tickNet: 45, income: 45, population: 220, energy: 6, water: 5, footprint: [2, 2], model: 'panel-block' },
  { id: 'res_modern_block', name: 'Современный жилой дом', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 600, tickNet: 34, income: 34, population: 160, energy: 5, water: 4, happiness: 4, model: 'modern-block' },
  { id: 'res_stalinka_pink', name: 'Розовый дом со шпилем', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 680, tickNet: 52, income: 52, population: 240, happiness: 10, energy: 6, water: 5, footprint: [2, 2], materialCost: { bricks: 8 }, model: 'stalinka-pink' },
  { id: 'res_streamline_curve', name: 'Дом-лайнер с баками', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 740, tickNet: 58, income: 58, population: 270, happiness: 9, energy: 7, water: 5, footprint: [2, 2], materialCost: { concrete: 8 }, model: 'streamline-curve' },
  { id: 'res_color_block', name: 'Дом с цветными эркерами', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 790, tickNet: 62, income: 62, population: 285, happiness: 11, energy: 7, water: 5, footprint: [2, 1], materialCost: { concrete: 10 }, model: 'color-block' },
  { id: 'com_grid_tower', name: 'Белая решетчатая башня', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 880, tickNet: 66, income: 66, population: 320, happiness: 8, energy: 6, water: 4, materialCost: { concrete: 8, steel: 4 }, model: 'grid-tower' },
  { id: 'res_modern_glass_tower', name: 'Стеклянная башня', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 850, tickNet: 75, income: 75, population: 350, happiness: 15, energy: 8, water: 6, footprint: [2, 2], materialCost: { concrete: 15 }, model: 'modern-glass-tower' },
  { id: 'res_highrise_slab', name: 'Высотная пластина «Сити»', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 980, tickNet: 88, income: 88, population: 420, happiness: 12, energy: 10, water: 8, footprint: [2, 1], materialCost: { concrete: 14, steel: 6 }, model: 'highrise-slab' },
  { id: 'res_bay_towers', name: 'Голубая башня с эркерами', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 1120, tickNet: 105, income: 105, population: 490, happiness: 16, energy: 11, water: 9, footprint: [2, 2], materialCost: { concrete: 18, steel: 8 }, model: 'bay-towers' },
  { id: 'com_glass_podium_tower', name: 'Изумрудная башня на подиуме', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 1350, tickNet: 125, income: 125, population: 560, happiness: 14, energy: 11, water: 7, footprint: [2, 2], materialCost: { concrete: 16, steel: 10 }, model: 'glass-podium-tower' },
  { id: 'res_megapolis_complex', name: 'Мега-комплекс «Мегаполис»', category: 'residential', tool: residential, tile: TileType.RESIDENTIAL, cost: 1500, tickNet: 240, income: 240, population: 1050, happiness: 25, energy: 20, water: 15, footprint: [4, 2], materialCost: { concrete: 30, steel: 15 }, model: 'megapolis-complex' },

  // Коммерция и офисы
  { id: 'com_bakery', name: 'Пекарня / Кафе', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 120, tickNet: 10, income: 10, energy: 1, water: 1, model: 'bakery' },
  { id: 'com_wine_tavern', name: 'Винная таверна / Погребок', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 190, tickNet: 16, income: 16, energy: 1, water: 1, happiness: 4, model: 'wine-tavern' },
  { id: 'com_grocery', name: 'Угловой гастроном', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 220, tickNet: 18, income: 18, energy: 2, water: 1, model: 'grocer' },
  { id: 'com_market_hall', name: 'Крытый фермерский рынок', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 320, tickNet: 24, income: 24, energy: 2, water: 1, footprint: [2, 1], model: 'market-hall' },
  { id: 'com_dept_store', name: 'Универмаг с витринами', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 390, tickNet: 32, income: 32, happiness: 6, energy: 3, water: 2, footprint: [2, 1], model: 'dept-store' },
  { id: 'com_mall', name: 'Торговый центр', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 450, tickNet: 38, income: 38, energy: 4, water: 2, footprint: [2, 1], model: 'mall' },
  { id: 'com_cinema_cosmos', name: 'Кинотеатр «Космос»', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 480, tickNet: 42, income: 42, happiness: 12, footprint: [3, 2], model: 'cinema-cosmos' },
  { id: 'com_office_tower', name: 'Офисная башня', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 1100, tickNet: 80, income: 80, energy: 8, water: 4, footprint: [2, 2], materialCost: { concrete: 10, steel: 5 }, model: 'office-tower' },
  { id: 'com_glass_skyscraper', name: 'Стеклянный небоскрёб', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 2200, tickNet: 160, income: 160, energy: 14, water: 6, happiness: 10, footprint: [2, 2], materialCost: { concrete: 20, steel: 20 }, model: 'glass-skyscraper' },
  { id: 'com_diagrid_skyscraper', name: 'Небоскрёб «Диагрид»', category: 'commercial', tool: commercial, tile: TileType.COMMERCIAL, cost: 3200, tickNet: 245, income: 245, energy: 18, water: 8, happiness: 18, footprint: [2, 2], materialCost: { concrete: 28, steel: 28 }, model: 'diagrid-skyscraper' },

  // Промышленность
  { id: 'ind_workshop', name: 'Мастерская / Цех', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 160, tickNet: 16, income: 16, pollution: 2, energy: 2, water: 1, model: 'workshop' },
  { id: 'ind_warehouse', name: 'Логистический склад', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 240, tickNet: 22, income: 22, energy: 2, water: 1, model: 'warehouse' },
  { id: 'ind_factory', name: 'Кирпичная мануфактура', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 320, tickNet: 35, income: 35, pollution: 5, energy: 4, water: 3, model: 'manufactory' },
  { id: 'ind_winery', name: 'Винодельня / Винный погреб', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 340, tickNet: 30, income: 30, pollution: 1, energy: 2, water: 2, footprint: [2, 1], model: 'winery' },
  { id: 'ind_brickworks', name: 'Кирпичный завод', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 420, tickNet: 26, income: 26, pollution: 4, energy: 3, water: 2, footprint: [2, 1], model: 'brickworks' },
  { id: 'ind_concrete_plant', name: 'Бетонный комбинат', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 620, tickNet: 24, income: 24, pollution: 5, energy: 5, water: 4, footprint: [2, 2], model: 'concrete-plant' },
  { id: 'ind_steel_foundry', name: 'Стальной литейный цех', category: 'industrial', tool: industrial, tile: TileType.INDUSTRIAL, cost: 760, tickNet: 22, income: 22, pollution: 6, energy: 7, water: 3, footprint: [2, 2], model: 'steel-foundry' },

  // Службы и образование
  { id: 'civ_fire', name: 'Пожарное депо', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 250, tickNet: -8, maintenance: 8, energy: 2, water: 1, model: 'fire-depot' },
  { id: 'civ_school', name: 'Школа с кортом', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 300, tickNet: -10, maintenance: 10, happiness: 15, energy: 3, water: 2, model: 'school' },
  { id: 'civ_hospital', name: 'Городская больница', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 450, tickNet: -16, maintenance: 16, happiness: 20, energy: 5, water: 3, model: 'hospital' },
  { id: 'civ_college_hall', name: 'Колониальный колледж', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 780, tickNet: -14, maintenance: 14, happiness: 19, energy: 4, water: 3, footprint: [3, 2], materialCost: { bricks: 6 }, model: 'college-hall' },
  { id: 'civ_stadium', name: 'Спортивный стадион', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 400, tickNet: -8, maintenance: 8, happiness: 18, footprint: [3, 3], model: 'stadium' },
  { id: 'civ_university', name: 'Университет', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 1600, tickNet: -20, maintenance: 20, happiness: 22, energy: 6, water: 4, footprint: [3, 3], model: 'university' },
  { id: 'civ_diamond_arena', name: 'Арена «Кристалл»', category: 'civic', tool: civic, tile: TileType.FIRE_STATION, cost: 2100, tickNet: 18, income: 34, maintenance: 16, happiness: 28, energy: 10, water: 5, footprint: [3, 3], materialCost: { concrete: 18, steel: 14 }, model: 'diamond-arena' },

  // Парки, набережные и достопримечательности
  { id: 'lnd_park', name: 'Сквер с фонтаном', category: 'parks', tool: parks, tile: TileType.PARK, cost: 80, tickNet: 0, happiness: 10, water: 1, model: 'fountain-square' },
  { id: 'park_plaza', name: 'Площадь с брусчаткой', category: 'parks', tool: parks, tile: TileType.PARK, cost: 90, tickNet: -1, maintenance: 1, happiness: 8, model: 'plaza' },
  { id: 'park_waterfront', name: 'Набережная с променадом', category: 'parks', tool: parks, tile: TileType.PARK, cost: 110, tickNet: 2, income: 2, happiness: 11, model: 'waterfront' },
  { id: 'park_rose_garden', name: 'Осенний розарий и сквер', category: 'parks', tool: parks, tile: TileType.PARK, cost: 120, tickNet: 0, happiness: 12, model: 'rose-garden' },
  { id: 'lnd_parking', name: 'Парковка', category: 'parks', tool: parks, tile: TileType.PARK, cost: 150, tickNet: 6, income: 6, footprint: [2, 1], model: 'parking' },
  { id: 'park_town_square', name: 'Городская площадь с беседкой', category: 'parks', tool: parks, tile: TileType.PARK, cost: 280, tickNet: -3, maintenance: 3, happiness: 16, footprint: [2, 2], model: 'town-square' },
  { id: 'park_winter_tree', name: 'Главная городская ёлка', category: 'parks', tool: parks, tile: TileType.PARK, cost: 300, tickNet: -3, maintenance: 3, happiness: 18, model: 'winter-tree', season: 'winter' },
  { id: 'lnd_clock_tower', name: 'Кампусная часовая башня', category: 'landmarks', tool: parks, tile: TileType.PARK, cost: 340, tickNet: -4, maintenance: 4, happiness: 14, energy: 1, model: 'clock-tower' },
  { id: 'lnd_church', name: 'Церковь со шпилем', category: 'parks', tool: parks, tile: TileType.PARK, cost: 380, tickNet: -6, maintenance: 6, happiness: 15, energy: 2, water: 1, model: 'church' },
  { id: 'lnd_townhall', name: 'Городская Ратуша', category: 'landmarks', tool: ToolId.CITY_HALL, tile: TileType.CITY_HALL, cost: 500, tickNet: -10, maintenance: 10, happiness: 20, energy: 3, water: 2, footprint: [2, 2], model: 'townhall' },
  { id: 'lnd_cathedral', name: 'Белокаменный собор', category: 'landmarks', tool: parks, tile: TileType.PARK, cost: 650, tickNet: -12, maintenance: 12, happiness: 25, footprint: [2, 2], model: 'cathedral' },

  // Коммунальные сети
  { id: 'utl_water', name: 'Водонапорная башня', category: 'utilities', tool: ToolId.WATER_PUMP, tile: TileType.WATER_PUMP, cost: 120, tickNet: -2, maintenance: 2, givesWater: 15, model: 'water-tower' },
  { id: 'utl_water_intake', name: 'Речной водозабор', category: 'utilities', tool: ToolId.WATER_PUMP, tile: TileType.WATER_PUMP, cost: 220, tickNet: -3, maintenance: 3, givesWater: 28, energy: 2, model: 'water-intake' },
  { id: 'utl_wind', name: 'Ветрогенератор', category: 'utilities', tool: ToolId.WIND, tile: TileType.WIND, cost: 140, tickNet: -2, maintenance: 2, givesEnergy: 10, model: 'wind-generator' },
  { id: 'utl_solar', name: 'Солнечная панель', category: 'utilities', tool: ToolId.SOLAR_PANEL, tile: TileType.SOLAR_PANEL, cost: 200, tickNet: -1, maintenance: 1, givesEnergy: 16, model: 'solar-station' },

  // Железная дорога и вокзалы
  { id: 'civ_train_station', name: 'Пассажирский вокзал', category: 'rail', tool: station, tile: TileType.STATION, cost: 550, tickNet: 14, income: 22, maintenance: 8, happiness: 14, energy: 4, water: 2, footprint: [3, 1], model: 'train-station' },
  { id: 'ind_freight_station', name: 'Грузовой ж/д терминал', category: 'rail', tool: station, tile: TileType.STATION, cost: 650, tickNet: 20, income: 30, maintenance: 10, pollution: 1, energy: 4, water: 2, footprint: [3, 1], model: 'freight-station' },

  // Поля
  { id: 'field_wheat', name: 'Пшеничное поле', category: 'parks', tool: parks, tile: TileType.FIELD_WHEAT, cost: 40, tickNet: 4, income: 4, model: 'wheat-field' },
  { id: 'field_plow', name: 'Вспаханная пашня', category: 'parks', tool: parks, tile: TileType.FIELD_PLOW, cost: 35, tickNet: 0, model: 'plowed-field' },
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
  [TileType.RESIDENTIAL]: 'res_cottage',
  [TileType.COMMERCIAL]: 'com_bakery',
  [TileType.INDUSTRIAL]: 'ind_workshop',
  [TileType.FIRE_STATION]: 'civ_fire',
  [TileType.PARK]: 'lnd_park',
  [TileType.WIND]: 'utl_wind',
  [TileType.SOLAR_PANEL]: 'utl_solar',
  [TileType.WATER_PUMP]: 'utl_water',
  [TileType.CITY_HALL]: 'lnd_townhall',
  [TileType.STATION]: 'civ_train_station',
  [TileType.FIELD_WHEAT]: 'field_wheat',
  [TileType.FIELD_PLOW]: 'field_plow',
} as Partial<Record<TileTypeValue, string>>
