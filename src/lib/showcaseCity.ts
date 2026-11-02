import { simulationTesting } from '../hooks/useCitySimulation'
import type { Grid, ToolId } from '../types/city'

/**
 * Город для стартового экрана, построенный самой симуляцией (с водой, светом и жителями),
 * чтобы фон всегда показывал актуальный стиль игры: уютный квартал, современный центр, кампус и площади.
 */
export function buildShowcaseGrid(): Grid {
  const { reducer, createFreshState } = simulationTesting
  let state = reducer(createFreshState(), { type: 'SET_SANDBOX' })
  state = { ...state, budget: 1_000_000 }
  const run = (action: Parameters<typeof reducer>[1]) => { state = reducer(state, action) }
  const road = (x: number, y: number) => { if (state.grid[y][x].type === 'EMPTY') run({ type: 'PLACE', x, y, tool: 'ROAD' }) }
  const put = (x: number, y: number, tool: ToolId, catalogId: string) => run({ type: 'PLACE', x, y, tool, catalogId })

  for (const y of [26, 32, 38]) for (let x = 20; x <= 44; x += 1) road(x, y)
  for (const x of [22, 30, 38]) for (let y = 20; y <= 44; y += 1) road(x, y)

  // Сети: вода и солнечные панели на окраине.
  for (let y = 21; y <= 25; y += 1) put(39, y, 'SOLAR_PANEL', 'utl_solar')
  for (let y = 21; y <= 24; y += 1) put(37, y, 'WIND', 'utl_wind')
  for (let y = 27; y <= 37; y += 1) put(39, y, 'SOLAR_PANEL', 'utl_solar')
  for (let y = 39; y <= 44; y += 1) put(39, y, 'SOLAR_PANEL', 'utl_solar')
  for (const y of [27, 28, 29, 30, 31, 37, 39, 40, 41, 42, 43, 44]) put(21, y, 'WATER_PUMP', 'utl_water')

  // Склад на окраине снабжает магазины (без дыма).
  put(41, 25, 'INDUSTRIAL', 'ind_warehouse'); put(42, 27, 'INDUSTRIAL', 'ind_warehouse')

  // Уютный европейский квартал.
  const cozy = ['res_townhouse', 'res_half_timbered', 'com_bakery', 'res_cottage', 'res_townhouse', 'com_wine_tavern', 'res_half_timbered']
  cozy.forEach((id, i) => put(23 + i, 31, id.startsWith('com') ? 'COMMERCIAL' : 'RESIDENTIAL', id))
  ;['res_cozy_estate', 'res_cottage', 'res_townhouse', 'res_half_timbered', 'res_cottage', 'res_townhouse'].forEach((id, i) => put(23 + i, 27, 'RESIDENTIAL', id))
  put(23, 29, 'PARK', 'lnd_park'); put(29, 28, 'PARK', 'lnd_church'); put(24, 29, 'PARK', 'park_rose_garden')

  // Современный центр.
  put(31, 28, 'COMMERCIAL', 'com_office_tower')
  put(31, 30, 'COMMERCIAL', 'com_glass_skyscraper')
  put(37, 30, 'RESIDENTIAL', 'res_modern_block'); put(37, 31, 'RESIDENTIAL', 'res_modern_block')
  ;[33, 34, 35].forEach((x) => put(x, 31, 'RESIDENTIAL', 'res_modern_block'))
  for (let x = 31; x <= 37; x += 1) put(x, 27, 'RESIDENTIAL', x % 3 === 0 ? 'res_modern_block' : 'res_brick_loft')

  // Кампус, площади, парковка.
  put(23, 33, 'FIRE_STATION', 'civ_university')
  put(27, 36, 'PARK', 'park_town_square')
  put(29, 33, 'PARK', 'park_plaza')
  put(31, 33, 'PARK', 'lnd_parking')
  put(36, 33, 'RESIDENTIAL', 'res_modern_glass_tower')
  for (let x = 31; x <= 35; x += 1) put(x, 37, 'RESIDENTIAL', x % 2 ? 'res_apartment' : 'res_townhouse')
  put(33, 34, 'COMMERCIAL', 'com_grocery'); put(34, 34, 'FIRE_STATION', 'civ_school')

  // Окраины: домики и лофты вдоль внешних улиц.
  for (let x = 23; x <= 37; x += 1) if (x !== 30) put(x, 25, 'RESIDENTIAL', x % 4 === 0 ? 'res_cozy_estate' : 'res_cottage')
  for (let x = 23; x <= 37; x += 1) if (x !== 30) put(x, 39, 'RESIDENTIAL', x % 3 === 0 ? 'res_brick_loft' : x % 3 === 1 ? 'res_townhouse' : 'res_cottage')

  // Немного времени, чтобы заселились жители (пешеходы зависят от населения).
  const now = Date.parse('2026-10-15T12:00:00')
  for (let i = 0; i < 80; i += 1) run({ type: 'TICK', now })
  // Витрина показывает готовый город — без анимации стройки.
  return state.grid.map((row) => row.map((cell) => (cell.animate ? { ...cell, animate: false } : cell)))
}
