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

/** С какого ранга доступна постройка (по catalogId или инструменту). Всё, чего нет в списке, открыто сразу. */
const UNLOCK_RANK: Record<string, number> = {
  res_townhouse: 1, res_half_timbered: 1, com_grocery: 1, ind_warehouse: 1, civ_school: 1, park_rose_garden: 1, park_town_square: 1, lnd_parking: 1, utl_solar: 1,
  res_apartment: 2, res_brick_loft: 2, com_wine_tavern: 2, com_market_hall: 2, ind_winery: 2, ind_brickworks: 2, civ_hospital: 2, lnd_church: 2, [ToolId.POLICE]: 2,
  res_panel_block: 3, res_modern_block: 3, com_office_tower: 3, com_glass_skyscraper: 4, com_mall: 3, ind_factory: 3, ind_concrete_plant: 3, civ_stadium: 3, civ_university: 3,
  res_modern_glass_tower: 4, com_cinema_cosmos: 4, ind_steel_foundry: 4, lnd_cathedral: 4,
}

export const unlockRankOf = (id: string | undefined): number => (id ? UNLOCK_RANK[id] ?? 0 : 0)

/** Сводка города для проверки заданий. */
export interface QuestContext {
  population: number
  happiness: number
  roads: number
  houses: number
  pumps: number
  generators: number
  unservicedHouses: number
  shops: number
  suppliedShops: number
  parks: number
  policeStations: number
  fireStations: number
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
  { id: 'parks', reward: 200, check: (c) => c.parks >= 2, text: { en: 'Build 2 parks or squares', ru: 'Разбейте 2 парка или сквера', de: 'Baue 2 Parks', fr: 'Aménagez 2 parcs' } },
  { id: 'school', reward: 400, check: (c) => (c.catalog.civ_school ?? 0) >= 1, text: { en: 'Build a school', ru: 'Постройте школу', de: 'Baue eine Schule', fr: 'Construisez une école' } },
  { id: 'pop200', reward: 600, check: (c) => c.population >= 200, text: { en: 'Reach 200 residents', ru: 'Население 200 жителей', de: 'Erreiche 200 Einwohner', fr: 'Atteignez 200 habitants' } },
  { id: 'fire', reward: 400, check: (c) => c.fireStations >= 1, text: { en: 'Build a fire station', ru: 'Постройте пожарное депо', de: 'Baue eine Feuerwache', fr: 'Construisez une caserne' } },
  { id: 'police', reward: 500, check: (c) => c.policeStations >= 1, text: { en: 'Build a police station', ru: 'Постройте полицейский участок', de: 'Baue eine Polizeiwache', fr: 'Construisez un commissariat' } },
  { id: 'happy', reward: 800, check: (c) => c.population >= 300 && c.happiness >= 80, text: { en: 'Keep happiness at 80+ with 300 residents', ru: 'Счастье 80+ при населении от 300', de: 'Zufriedenheit 80+ bei 300 Einwohnern', fr: 'Bonheur 80+ avec 300 habitants' } },
  { id: 'pop500', reward: 1000, check: (c) => c.population >= 500, text: { en: 'Reach 500 residents', ru: 'Население 500 жителей', de: 'Erreiche 500 Einwohner', fr: 'Atteignez 500 habitants' } },
  { id: 'hospital', reward: 800, check: (c) => (c.catalog.civ_hospital ?? 0) >= 1, text: { en: 'Build a hospital', ru: 'Постройте больницу', de: 'Baue ein Krankenhaus', fr: 'Construisez un hôpital' } },
  { id: 'pop1200', reward: 2000, check: (c) => c.population >= 1200, text: { en: 'Reach 1,200 residents', ru: 'Население 1 200 жителей', de: 'Erreiche 1.200 Einwohner', fr: 'Atteignez 1 200 habitants' } },
  { id: 'pop3000', reward: 5000, check: (c) => c.population >= 3000, text: { en: 'Grow into a metropolis: 3,000 residents', ru: 'Станьте мегаполисом: 3 000 жителей', de: 'Werde Metropole: 3.000 Einwohner', fr: 'Devenez une métropole : 3 000 habitants' } },
]
