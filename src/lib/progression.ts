import type { Language } from '../i18n/I18nProvider'
import { ToolId } from '../types/city'

type Text = Record<Language, string>

/** Ранги города: открываются по максимальному достигнутому населению и открывают новые здания. */
export const RANKS: ReadonlyArray<{ population: number; icon: string; name: Text }> = [
  { population: 0, icon: '🌾', name: { en: 'Hamlet', ru: 'Хутор', de: 'Weiler', fr: 'Hameau' } },
  { population: 50, icon: '🏡', name: { en: 'Village', ru: 'Деревня', de: 'Dorf', fr: 'Village' } },
  { population: 200, icon: '⛪', name: { en: 'Town', ru: 'Посёлок', de: 'Marktflecken', fr: 'Bourg' } },
  { population: 500, icon: '🏘️', name: { en: 'City', ru: 'Город', de: 'Stadt', fr: 'Ville' } },
  { population: 1200, icon: '🏙️', name: { en: 'Big city', ru: 'Большой город', de: 'Großstadt', fr: 'Grande ville' } },
  { population: 3000, icon: '🌆', name: { en: 'Metropolis', ru: 'Мегаполис', de: 'Metropole', fr: 'Métropole' } },
]

export function rankForPopulation(population: number): number {
  let rank = 0
  RANKS.forEach((item, index) => { if (population >= item.population) rank = index })
  return rank
}

/** С какого ранга доступна постройка (по catalogId или инструменту). Всё, чего нет в списке, открыто сразу (Ранг 0 — Хутор). */
const UNLOCK_RANK: Record<string, number> = {
  // Ранг 1 — Деревня (50+)
  res_cozy_estate: 1, res_townhouse: 1, res_half_timbered: 1, res_villa_conservatory: 1, res_courtyard_east: 1,
  com_wine_tavern: 1, com_grocery: 1,
  ind_warehouse: 1,
  civ_fire: 1, civ_school: 1,
  park_plaza: 1, park_waterfront: 1, park_rose_garden: 1, lnd_parking: 1, park_town_square: 1,
  utl_solar: 1, utl_water_intake: 1,
  [ToolId.WATER]: 1,
  [ToolId.RAIL]: 1,
  [ToolId.FIRE_STATION]: 1,

  // Ранг 2 — Посёлок (200+)
  res_apartment: 2, res_brownstone_us: 2, res_brick_loft: 2, res_balcony_block: 2, res_brick_walkup: 2,
  com_market_hall: 2, com_dept_store: 2,
  ind_winery: 2, ind_brickworks: 2,
  civ_hospital: 2, civ_college_hall: 2, civ_train_station: 2,
  park_winter_tree: 2, lnd_clock_tower: 2, lnd_church: 2, lnd_townhall: 2,
  bridge_suspension: 2,
  [ToolId.POLICE]: 2,
  [ToolId.STATION]: 2,
  [ToolId.CITY_HALL]: 2,

  // Ранг 3 — Город (500+)
  res_panel_block: 3, res_modern_block: 3, res_stalinka_pink: 3, res_streamline_curve: 3, res_color_block: 3,
  com_mall: 3, com_grid_tower: 3, com_office_tower: 3,
  ind_factory: 3, ind_concrete_plant: 3, ind_freight_station: 3,
  civ_stadium: 3, civ_university: 3,

  // Ранг 4 — Большой город (1200+)
  res_modern_glass_tower: 4, res_highrise_slab: 4, res_bay_towers: 4,
  com_cinema_cosmos: 4, com_glass_podium_tower: 4, com_glass_skyscraper: 4,
  ind_steel_foundry: 4,
  civ_diamond_arena: 4, lnd_cathedral: 4,

  // Ранг 5 — Мегаполис (3000+)
  res_megapolis_complex: 5, com_diagrid_skyscraper: 5,
}

export const unlockRankOf = (id: string | undefined): number => (id ? UNLOCK_RANK[id] ?? 0 : 0)

/** Сводка города для проверки заданий. */
export interface QuestContext {
  population: number
  happiness: number
  roads: number
  bridges: number
  rails: number
  stations: number
  houses: number
  pumps: number
  generators: number
  unservicedHouses: number
  shops: number
  suppliedShops: number
  parks: number
  policeStations: number
  fireStations: number
  materials: { bricks: number; concrete: number; steel: number }
  catalog: Record<string, number>
}

export interface Quest {
  id: string
  reward: number
  text: Text
  check: (ctx: QuestContext) => boolean
}

export const QUESTS: readonly Quest[] = [
  { id: 'roads', reward: 100, check: (c) => c.roads >= 5, text: { en: 'Lay a road of 5 tiles', ru: 'Проложите дорогу из 5 клеток', de: 'Baue 5 Straßenfelder', fr: 'Tracez 5 cases de route' } },
  { id: 'homes', reward: 150, check: (c) => c.houses >= 3, text: { en: 'Build 3 homes along the road', ru: 'Постройте 3 дома у дороги', de: 'Baue 3 Häuser an der Straße', fr: 'Construisez 3 maisons' } },
  { id: 'water', reward: 150, check: (c) => c.pumps >= 1, text: { en: 'Build a water tower next to the road', ru: 'Поставьте водонапорную башню у дороги', de: 'Baue einen Wasserturm', fr: 'Construisez un château d’eau' } },
  { id: 'power', reward: 150, check: (c) => c.generators >= 1, text: { en: 'Build a wind generator', ru: 'Поставьте ветрогенератор', de: 'Baue eine Windanlage', fr: 'Construisez une éolienne' } },
  { id: 'serviced', reward: 200, check: (c) => c.houses >= 3 && c.unservicedHouses === 0, text: { en: 'Give every home water and power', ru: 'Дайте всем домам воду и свет', de: 'Versorge alle Häuser mit Wasser und Strom', fr: 'Raccordez toutes les maisons' } },
  { id: 'shop', reward: 150, check: (c) => c.shops >= 1, text: { en: 'Open a bakery or shop', ru: 'Откройте пекарню или магазин', de: 'Eröffne eine Bäckerei', fr: 'Ouvrez une boulangerie' } },
  { id: 'pop50', reward: 300, check: (c) => c.population >= 50, text: { en: 'Reach 50 residents', ru: 'Население 50 жителей', de: 'Erreiche 50 Einwohner', fr: 'Atteignez 50 habitants' } },
  { id: 'supplies', reward: 300, check: (c) => c.suppliedShops >= 1, text: { en: 'Connect a workshop to your shops by road', ru: 'Соедините мастерскую с магазинами дорогой', de: 'Verbinde eine Werkstatt per Straße mit Läden', fr: 'Reliez un atelier aux commerces' } },
  { id: 'parks', reward: 220, check: (c) => c.parks >= 2, text: { en: 'Build 2 parks or squares', ru: 'Разбейте 2 парка или сквера', de: 'Baue 2 Parks', fr: 'Aménagez 2 parcs' } },
  { id: 'waterfront', reward: 300, check: (c) => (c.catalog.park_waterfront ?? 0) >= 2 || (c.catalog.utl_water_intake ?? 0) >= 1, text: { en: 'Develop the riverfront: build 2 promenade tiles or a river water intake', ru: 'Обустройте берег: 2 клетки набережной или речной водозабор', de: 'Uferpromenade oder Flusswasserwerk bauen', fr: 'Aménagez 2 quais ou une prise d’eau fluviale' } },
  { id: 'bridge', reward: 400, check: (c) => c.bridges >= 1, text: { en: 'Build a bridge across the river or lake', ru: 'Перекиньте мост через реку или водоём', de: 'Baue eine Brücke über das Wasser', fr: 'Construisez un pont sur l’eau' } },
  { id: 'school', reward: 400, check: (c) => (c.catalog.civ_school ?? 0) >= 1, text: { en: 'Build a school', ru: 'Постройте школу', de: 'Baue eine Schule', fr: 'Construisez une école' } },
  { id: 'pop200', reward: 600, check: (c) => c.population >= 200, text: { en: 'Reach 200 residents', ru: 'Население 200 жителей', de: 'Erreiche 200 Einwohner', fr: 'Atteignez 200 habitants' } },
  { id: 'rail_tracks', reward: 450, check: (c) => c.rails >= 6, text: { en: 'Lay 6 tiles of railway track', ru: 'Проложите 6 клеток железной дороги', de: 'Verlege 6 Schienenfelder', fr: 'Posez 6 cases de voie ferrée' } },
  { id: 'train_station', reward: 650, check: (c) => c.stations >= 1 && c.rails >= 6, text: { en: 'Build a railway station connected to tracks to launch trains', ru: 'Постройте вокзал у рельсов и запустите поезда', de: 'Baue einen Bahnhof an den Gleisen', fr: 'Construisez une gare reliée aux rails' } },
  { id: 'fire', reward: 450, check: (c) => c.fireStations >= 1, text: { en: 'Build a fire station', ru: 'Постройте пожарное депо', de: 'Baue eine Feuerwache', fr: 'Construisez une caserne' } },
  { id: 'police', reward: 500, check: (c) => c.policeStations >= 1, text: { en: 'Build a police station', ru: 'Постройте полицейский участок', de: 'Baue eine Polizeiwache', fr: 'Construisez un commissariat' } },
  { id: 'brickworks', reward: 550, check: (c) => (c.catalog.ind_brickworks ?? 0) >= 1 && c.materials.bricks >= 5, text: { en: 'Open a brickworks and stockpile 5 bricks', ru: 'Запустите кирпичный завод и накопите 5 кирпича', de: 'Ziegelwerk bauen und 5 Ziegel lagern', fr: 'Construisez une briqueterie et stockez 5 briques' } },
  { id: 'college', reward: 700, check: (c) => (c.catalog.civ_college_hall ?? 0) >= 1 || (c.catalog.lnd_clock_tower ?? 0) >= 1, text: { en: 'Build a Colonial College or Campus Clock Tower', ru: 'Постройте колониальный колледж или часовую башню', de: 'Baue ein College oder einen Uhrturm', fr: 'Construisez un collège ou une tour d’horloge' } },
  { id: 'happy', reward: 800, check: (c) => c.population >= 300 && c.happiness >= 80, text: { en: 'Keep happiness at 80+ with 300 residents', ru: 'Счастье 80+ при населении от 300', de: 'Zufriedenheit 80+ bei 300 Einwohnern', fr: 'Bonheur 80+ avec 300 habitants' } },
  { id: 'pop500', reward: 1000, check: (c) => c.population >= 500, text: { en: 'Reach 500 residents', ru: 'Население 500 жителей', de: 'Erreiche 500 Einwohner', fr: 'Atteignez 500 habitants' } },
  { id: 'hospital', reward: 800, check: (c) => (c.catalog.civ_hospital ?? 0) >= 1, text: { en: 'Build a hospital', ru: 'Постройте больницу', de: 'Baue ein Krankenhaus', fr: 'Construisez un hôpital' } },
  { id: 'cityrt_district', reward: 950, check: (c) => (c.catalog.res_stalinka_pink ?? 0) + (c.catalog.res_streamline_curve ?? 0) + (c.catalog.res_color_block ?? 0) >= 2, text: { en: 'Build 2 architectural ensembles (Spire House, Streamline Liner or Colour Block)', ru: 'Возведите 2 ансамбля: Розовый дом со шпилем, Дом-лайнер или Дом с эркерами', de: 'Baue 2 Stadtensembles', fr: 'Construisez 2 ensembles architecturaux' } },
  { id: 'concrete', reward: 900, check: (c) => (c.catalog.ind_concrete_plant ?? 0) >= 1 && c.materials.concrete >= 10, text: { en: 'Build a concrete plant and produce 10 concrete', ru: 'Постройте бетонный комбинат и накопите 10 бетона', de: 'Betonwerk bauen und 10 Beton lagern', fr: 'Construisez une centrale à béton (10 béton)' } },
  { id: 'freight_rail', reward: 1100, check: (c) => (c.catalog.ind_freight_station ?? 0) >= 1 && c.rails >= 12, text: { en: 'Build a freight rail terminal and expand tracks to 12 tiles', ru: 'Постройте грузовой ж/д терминал и доведите пути до 12 клеток', de: 'Güterbahnhof und 12 Gleise bauen', fr: 'Construisez un terminal de fret et 12 rails' } },
  { id: 'office_district', reward: 1200, check: (c) => (c.catalog.com_office_tower ?? 0) + (c.catalog.com_grid_tower ?? 0) + (c.catalog.com_glass_skyscraper ?? 0) >= 2, text: { en: 'Create a business or high-rise district with 2 towers', ru: 'Возведите 2 высотные башни (Офисная или Белая решетчатая башня)', de: 'Baue 2 Hochhaustürme im Zentrum', fr: 'Érigez 2 tours dans le centre-ville' } },
  { id: 'pop1200', reward: 2000, check: (c) => c.population >= 1200, text: { en: 'Reach 1,200 residents', ru: 'Население 1 200 жителей', de: 'Erreiche 1.200 Einwohner', fr: 'Atteignez 1 200 habitants' } },
  { id: 'steel', reward: 1500, check: (c) => (c.catalog.ind_steel_foundry ?? 0) >= 1 && c.materials.steel >= 10, text: { en: 'Open a steel foundry and stockpile 10 steel', ru: 'Откройте стальной литейный цех и накопите 10 стали', de: 'Stahlgießerei bauen und 10 Stahl lagern', fr: 'Ouvrez une fonderie et stockez 10 aciers' } },
  { id: 'highrise', reward: 1800, check: (c) => (c.catalog.res_highrise_slab ?? 0) + (c.catalog.res_bay_towers ?? 0) + (c.catalog.res_modern_glass_tower ?? 0) + (c.catalog.com_glass_podium_tower ?? 0) >= 2, text: { en: 'Build 2 residential high-rises (City Slab, Bay Tower, Emerald or Glass Tower)', ru: 'Постройте 2 высотных жилых комплекса', de: 'Baue 2 Wohnhochhäuser', fr: 'Construisez 2 tours résidentielles' } },
  { id: 'arena', reward: 2200, check: (c) => (c.catalog.civ_diamond_arena ?? 0) >= 1 || (c.catalog.civ_university ?? 0) >= 1, text: { en: 'Build the Crystal Arena or University Campus', ru: 'Постройте арену «Кристалл» или Университет', de: 'Kristall-Arena oder Universität bauen', fr: 'Construisez l’Aréna Cristal ou l’Université' } },
  { id: 'pop3000', reward: 5000, check: (c) => c.population >= 3000, text: { en: 'Grow into a metropolis: 3,000 residents', ru: 'Станьте мегаполисом: 3 000 жителей', de: 'Werde Metropole: 3.000 Einwohner', fr: 'Devenez une métropole : 3 000 habitants' } },
  { id: 'diagrid', reward: 6500, check: (c) => (c.catalog.com_diagrid_skyscraper ?? 0) >= 1 || (c.catalog.res_megapolis_complex ?? 0) >= 1, text: { en: 'Crown your skyline with the Diagrid Skyscraper or Megapolis Complex', ru: 'Увенчайте силуэт города небоскрёбом «Диагрид» или «Мегаполисом»', de: 'Kröne die Skyline mit dem Diagrid-Wolkenkratzer', fr: 'Érigez le gratte-ciel Diagrid ou le complexe Megapolis' } },
]
