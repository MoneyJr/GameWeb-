import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { TOOL_DEFINITIONS } from '../lib/cityConfig'
import { BUILDING_BY_ID, canonicalCatalogId, DEFAULT_CATALOG_ID_BY_TILE } from '../store/buildingCatalog'
import { QUESTS, rankForPopulation, unlockRankOf, type QuestContext } from '../lib/progression'
import { computeCoverage, isCovered, type CoverageMaps } from '../lib/coverage'
import { activeEvents, eventModifiers, sameEvents, type CityEventId, type CityEventModifiers } from '../lib/cityEvents'
import {
  GRID_SIZE,
  TileType,
  ToolId,
  type Grid,
  type GridCell,
  type SimSpeed,
} from '../types/city'

/** Стартовый бюджет, выданный как банковский заём. */
export const START_BUDGET = 1000
export const INITIAL_LOAN = 1000
export const DAILY_LOAN_PAYMENT = 50
/** Длительность тика при скорости 1x (мс). */
export const BASE_TICK_MS = 2000
/** Сколько игровых минут проходит за тик. Бюджет пересчитывается каждые 10 минут. */
export const MINUTES_PER_TICK = 10
export const POLICE_CAPACITY_PER_STATION = 800
export const FIRE_CAPACITY_PER_STATION = 800
/** Небольшой посёлок обходится без полиции: преступность начинается только сверх этого населения. */
export const CRIME_FREE_POPULATION = 300

const MINUTES_PER_DAY = 24 * 60

function seededRandom(...parts: number[]): number {
  let seed = 2166136261
  for (const part of parts) {
    seed ^= Math.trunc(part)
    seed = Math.imul(seed, 16777619)
  }
  seed ^= seed >>> 16
  seed = Math.imul(seed, 0x7feb352d)
  seed ^= seed >>> 15
  seed = Math.imul(seed, 0x846ca68b)
  seed ^= seed >>> 16
  return (seed >>> 0) / 4294967296
}

const zoningDistance = (a: GridCell, b: GridCell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

function hasNearbyCatalog(grid: Grid, cell: GridCell, predicate: (id: string | undefined) => boolean, radius = 2): boolean {
  for (let y = Math.max(0, cell.y - radius); y <= Math.min(GRID_SIZE - 1, cell.y + radius); y += 1) {
    for (let x = Math.max(0, cell.x - radius); x <= Math.min(GRID_SIZE - 1, cell.x + radius); x += 1) {
      const candidate = grid[y][x]
      if (zoningDistance(cell, candidate) <= radius && predicate(candidate.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[candidate.type])) return true
    }
  }
  return false
}

/** Источник смога — любое производство с загрязнением 2+ из каталога. */
function isPollutingBuilding(id: string | undefined): boolean {
  const entry = id ? BUILDING_BY_ID[id] : undefined
  return entry?.category === 'industrial' && (entry.pollution ?? 0) >= 2
}

/** Зелёные и культурные объекты (парки, скверы, храмы), которые повышают ценность жилья рядом. */
function isGreenAmenity(id: string | undefined): boolean {
  const entry = id ? BUILDING_BY_ID[id] : undefined
  return !!entry && (entry.category === 'parks' || entry.category === 'landmarks') && (entry.happiness ?? 0) > 0
}

/** Наносит значение на все клетки в манхэттенском радиусе вокруг точки. */
function stampRadius(field: Int16Array, cx: number, cy: number, radius: number, value: number) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(GRID_SIZE - 1, cy + radius); y += 1) {
    const span = radius - Math.abs(y - cy)
    for (let x = Math.max(0, cx - span); x <= Math.min(GRID_SIZE - 1, cx + span); x += 1) field[y * GRID_SIZE + x] += value
  }
}

function residenceProfile(x: number, y: number, day = 1, minute = 0) {
  // Keep this in sync with the Residential variant used by the city renderer.
  const variant = (x * 7 + y * 13) % 4
  const floors = 2 + (variant % 3)
  const random = seededRandom(x, y, day, minute, 41)
  const maxResidents = floors >= 3
    ? 70 + Math.floor(random * 31)
    : 4 + Math.floor(random * 5)
  return { floors, maxResidents }
}

function getHomeCapacity(cell: GridCell): number {
  return cell.maxResidents ?? residenceProfile(cell.x, cell.y).maxResidents
}

export interface Notice {
  id: number
  text: string
}

interface SimState {
  grid: Grid
  population: number
  budget: number
  /** Суточный чистый доход, распределённый по игровым тикам. */
  lastNet: number
  /** Счастье жителей, 0–100. */
  happiness: number
  taxRates: { residential: number; commercial: number; industrial: number }
  debt: number
  /** Игровое время в минутах от полуночи. */
  minutes: number
  ticks: number
  day: number
  notice: Notice | null
  noticeSeq: number
  materials: { bricks: number; concrete: number; steel: number }
  warehouseCapacity: number
  /** Активные сезонные события. */
  events: CityEventId[]
  /** Максимальный достигнутый ранг города (не понижается). */
  rank: number
  /** Номер текущего задания советника. */
  questIndex: number
  /** Песочница: всё открыто, большой бюджет. */
  sandbox: boolean
  /** История для «Отменить» (не сохраняется). */
  undo: UndoEntry[]
}

interface UndoEntry {
  /** Клетки в том виде, какими они были до действия. */
  cells: GridCell[]
  refund: number
  materials: { bricks: number; concrete: number; steel: number }
}

const UNDOABLE = new Set(['PLACE', 'REMOVE', 'UPGRADE', 'MERGE', 'MERGE_TOWERS'])
const UNDO_LIMIT = 20

/** Обёртка над reducer: запоминает изменённые клетки для отмены и обрабатывает UNDO. */
function reducerWithUndo(state: SimState, action: Action): SimState {
  if (action.type === 'UNDO') {
    const entry = state.undo[state.undo.length - 1]
    if (!entry) return state
    const grid = state.grid.map((row) => row.slice())
    for (const cell of entry.cells) grid[cell.y][cell.x] = cell
    return {
      ...state,
      grid: recomputeServices(grid, eventModifiers(state.events).energyMultiplier),
      budget: state.budget + entry.refund,
      materials: {
        bricks: state.materials.bricks + entry.materials.bricks,
        concrete: state.materials.concrete + entry.materials.concrete,
        steel: state.materials.steel + entry.materials.steel,
      },
      undo: state.undo.slice(0, -1),
    }
  }
  const next = reducer(state, action)
  if (!UNDOABLE.has(action.type) || next.grid === state.grid) return next
  const cells: GridCell[] = []
  for (let y = 0; y < GRID_SIZE; y += 1) for (let x = 0; x < GRID_SIZE; x += 1) {
    const before = state.grid[y][x], after = next.grid[y][x]
    if (before.type !== after.type || before.catalogId !== after.catalogId || before.level !== after.level || before.refX !== after.refX || before.refY !== after.refY) cells.push(before)
  }
  if (cells.length === 0) return next
  const entry: UndoEntry = {
    cells,
    refund: Math.max(0, state.budget - next.budget),
    materials: {
      bricks: Math.max(0, state.materials.bricks - next.materials.bricks),
      concrete: Math.max(0, state.materials.concrete - next.materials.concrete),
      steel: Math.max(0, state.materials.steel - next.materials.steel),
    },
  }
  return { ...next, undo: [...state.undo.slice(-(UNDO_LIMIT - 1)), entry] }
}

type Action =
  | { type: 'PLACE'; x: number; y: number; tool: import('../types/city').ToolId; style?: string; catalogId?: string; orientation?: 0 | 1 | 2 | 3 }
  | { type: 'REMOVE'; x: number; y: number }
  | { type: 'UPGRADE'; x: number; y: number }
  | { type: 'MERGE'; x: number; y: number }
  | { type: 'MERGE_TOWERS'; x: number; y: number }
  | { type: 'EXPAND_WAREHOUSE' }
  | { type: 'TICK'; now: number }
  | { type: 'CHEAT_BUDGET'; amount: number }
  | { type: 'CHEAT_TIME'; ticks: number }
  | { type: 'SET_TAX'; category: 'residential' | 'commercial' | 'industrial'; rate: number }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN' }
  | { type: 'RESET' }
  | { type: 'SET_SANDBOX' }
  | { type: 'UNDO' }

function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, (_, y) =>
    Array.from({ length: GRID_SIZE }, (_, x): GridCell => ({
      x,
      y,
      type: TileType.EMPTY,
      hasWater: false,
      hasPower: false,
      level: 1,
    })),
  )
}

function inBounds(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE
}

const NEIGHBOR_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * Пересчитывает наличие воды и электричества.
 *
 * Источники подключают примыкающие дороги и питают всю связную дорожную сеть.
 * Мульти-тайловое здание подключено, если дорога касается любой клетки периметра фундамента.
 *
 * Клетки, у которых ничего не изменилось, сохраняют ссылку (важно для React.memo в 3D-сцене).
 */
function recomputeServices(grid: Grid, energyMultiplier = 1): Grid {
  const isRoad = (x: number, y: number): boolean => inBounds(x, y) && grid[y][x].type === TileType.ROAD

  const roadDistance: number[][] = grid.map((r) => r.map(() => 0))
  const powerDistance: number[][] = grid.map((r) => r.map(() => 0))
  const queue: [number, number][] = []
  const powerQueue: [number, number][] = []
  const coals: [number, number][] = []
  const parks: [number, number][] = []
  const factories: [number, number][] = []
  const powerSources: [number, number][] = []
  let powerCapacity = 0
  let waterCapacity = 0

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TileType.WATER_PUMP) {
        const waterId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[TileType.WATER_PUMP]
        waterCapacity += waterId ? BUILDING_BY_ID[waterId]?.givesWater ?? BUILDING_BY_ID[waterId]?.water ?? 15 : 15
        for (const [dx, dy] of NEIGHBOR_STEPS) {
          const nx = cell.x + dx
          const ny = cell.y + dy
          if (isRoad(nx, ny) && roadDistance[ny][nx] === 0) {
            roadDistance[ny][nx] = 1
            queue.push([nx, ny])
          }
        }
      }
      if (cell.type === TileType.WIND || cell.type === TileType.SOLAR_PANEL || cell.type === TileType.COAL) {
        const powerId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
        powerCapacity += powerId ? BUILDING_BY_ID[powerId]?.givesEnergy ?? BUILDING_BY_ID[powerId]?.energy ?? (cell.type === TileType.COAL ? 60 : 8) : 8
        powerSources.push([cell.x, cell.y])
        for (const [dx, dy] of NEIGHBOR_STEPS) {
          const nx = cell.x + dx
          const ny = cell.y + dy
          if (isRoad(nx, ny) && powerDistance[ny][nx] === 0) {
            powerDistance[ny][nx] = 1
            powerQueue.push([nx, ny])
          }
        }
      }
      if (cell.type === TileType.COAL || (cell.type === TileType.INDUSTRIAL && isPollutingBuilding(cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]))) {
        coals.push([cell.x, cell.y])
      }
      if (cell.type === TileType.PARK) {
        parks.push([cell.x, cell.y])
      }
      if (cell.type === TileType.INDUSTRIAL) factories.push([cell.x, cell.y])
    }
  }

  // Water BFS across the complete connected road component.
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head]
    const distance = roadDistance[y][x]
    for (const [dx, dy] of NEIGHBOR_STEPS) {
      const nx = x + dx
      const ny = y + dy
      if (isRoad(nx, ny) && roadDistance[ny][nx] === 0) {
        roadDistance[ny][nx] = distance + 1
        queue.push([nx, ny])
      }
    }
  }

  // Electricity follows every road reachable from any connected generator.
  for (let head = 0; head < powerQueue.length; head += 1) {
    const [x, y] = powerQueue[head]
    const distance = powerDistance[y][x]
    for (const [dx, dy] of NEIGHBOR_STEPS) {
      const nx = x + dx
      const ny = y + dy
      if (isRoad(nx, ny) && powerDistance[ny][nx] === 0) {
        powerDistance[ny][nx] = distance + 1
        powerQueue.push([nx, ny])
      }
    }
  }

  const isWateredRoad = (x: number, y: number): boolean => isRoad(x, y) && roadDistance[y][x] > 0
  const isPoweredRoad = (x: number, y: number): boolean => isRoad(x, y) && powerDistance[y][x] > 0
  const buildingTouchesServedRoad = (cell: GridCell, service: (x: number, y: number) => boolean) => {
    if (cell.type === TileType.FOOTPRINT) return false
    const size = cell.catalogId ? BUILDING_BY_ID[cell.catalogId]?.footprint : undefined
    let width = cell.type === TileType.CITY_HALL ? 2 : size?.[0] ?? 1
    let height = cell.type === TileType.CITY_HALL ? 2 : size?.[1] ?? 1
    if ((cell.orientation ?? 0) % 2 === 1) [width, height] = [height, width]
    for (let dx = 0; dx < width; dx += 1) {
      if (service(cell.x + dx, cell.y - 1) || service(cell.x + dx, cell.y + height)) return true
    }
    for (let dy = 0; dy < height; dy += 1) {
      if (service(cell.x - 1, cell.y + dy) || service(cell.x + width, cell.y + dy)) return true
    }
    return false
  }
  const powerSourceKeys = new Set(powerSources.map(([sx, sy]) => sy * GRID_SIZE + sx))
  const isPoweredSource = (x: number, y: number) => powerSourceKeys.has(y * GRID_SIZE + x)

  // Смог и близость к паркам считаем один раз «штампами», а не перебором для каждой клетки.
  const smogField = new Int16Array(GRID_SIZE * GRID_SIZE)
  const parkField = new Int16Array(GRID_SIZE * GRID_SIZE)
  for (const [cx, cy] of coals) stampRadius(smogField, cx, cy, 2, 1)
  for (const [px, py] of parks) {
    stampRadius(smogField, px, py, 1, -1)
    stampRadius(parkField, px, py, 1, 1)
  }

  const component = grid.map((row) => row.map(() => -1))
  let componentId = 0
  for (let y = 0; y < GRID_SIZE; y += 1) for (let x = 0; x < GRID_SIZE; x += 1) {
    if (!isRoad(x, y) || component[y][x] >= 0) continue
    const work: [number, number][] = [[x, y]]
    component[y][x] = componentId
    for (let head = 0; head < work.length; head += 1) {
      const [cx, cy] = work[head]
      for (const [dx, dy] of NEIGHBOR_STEPS) {
        const nx = cx + dx, ny = cy + dy
        if (isRoad(nx, ny) && component[ny][nx] < 0) { component[ny][nx] = componentId; work.push([nx, ny]) }
      }
    }
    componentId += 1
  }
  const factoryComponents = new Set<number>()
  for (const [x, y] of factories) for (const [dx, dy] of NEIGHBOR_STEPS) {
    const nx = x + dx, ny = y + dy
    if (isRoad(nx, ny)) factoryComponents.add(component[ny][nx])
  }

  let waterUsed = 0
  let powerUsed = 0
  return grid.map((row) =>
    row.map((cell) => {
      const occupied = cell.type !== TileType.EMPTY && cell.type !== TileType.ROAD
      let hasWater = false
      if (cell.type === TileType.WATER_PUMP) hasWater = true
      else if (cell.type === TileType.ROAD) hasWater = isWateredRoad(cell.x, cell.y)
      else if (occupied) hasWater = buildingTouchesServedRoad(cell, isWateredRoad)
      
      const smog = smogField[cell.y * GRID_SIZE + cell.x] > 0
      const parked = parkField[cell.y * GRID_SIZE + cell.x] > 0
      const hasSupplies = cell.type === TileType.COMMERCIAL && NEIGHBOR_STEPS.some(([dx, dy]) => {
        const nx = cell.x + dx, ny = cell.y + dy
        return isRoad(nx, ny) && factoryComponents.has(component[ny][nx])
      })

      let hasPower = false
      if (cell.type === TileType.WIND || cell.type === TileType.SOLAR_PANEL || cell.type === TileType.COAL) hasPower = true
      else if (occupied) hasPower = isPoweredSource(cell.x, cell.y) || buildingTouchesServedRoad(cell, isPoweredRoad)

      const catalogId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
      const catalogEntry = catalogId ? BUILDING_BY_ID[catalogId] : undefined
      const consumesUtilities = !!catalogEntry && catalogEntry.category !== 'utilities' && (catalogEntry.energy !== undefined || catalogEntry.water !== undefined)
      if (consumesUtilities) {
        const requiredWater = catalogEntry?.water ?? 1
        const requiredPower = (catalogEntry?.energy ?? 1) * energyMultiplier
        hasWater = hasWater && waterUsed + requiredWater <= waterCapacity
        hasPower = hasPower && powerUsed + requiredPower <= powerCapacity
        if (hasWater) waterUsed += requiredWater
        if (hasPower) powerUsed += requiredPower
      }


      let residents = cell.residents
      const maxResidents = cell.type === TileType.RESIDENTIAL ? getHomeCapacity(cell) : cell.maxResidents
      if (
        cell.type === TileType.RESIDENTIAL && hasWater && hasPower &&
        !(cell.hasWater && cell.hasPower) && (residents ?? 0) === 0
      ) {
        residents = Math.floor(maxResidents! * (0.4 + seededRandom(cell.x, cell.y, 73) * 0.1))
      }
      if (
        hasWater === cell.hasWater && hasPower === cell.hasPower && smog === cell.smog &&
        parked === cell.parked && hasSupplies === cell.hasSupplies &&
        residents === cell.residents && maxResidents === cell.maxResidents
      ) return cell
      return { ...cell, hasWater, hasPower, smog, parked, hasSupplies, residents, maxResidents }
    }),
  )
}

export interface CityCounts {
  energyProduced: number
  energyConsumed: number
  waterProduced: number
  waterConsumed: number
  roads: number
  houses: number
  houseCapacity: number
  wateredCapacity: number
  poweredCapacity: number
  servicedCapacity: number
  shops: number
  wateredShops: number
  poweredShops: number
  servicedShops: number
  suppliedShops: number
  factories: number
  wateredFactories: number
  poweredFactories: number
  servicedFactories: number
  pumps: number
  parks: number
  wind: number
  solarPanels: number
  coal: number
  policeStations: number
  fireStations: number
  unwateredHouses: number
  unservicedHouses: number
  poweredConsumers: number
  parkedHouses: number
  smogHouses: number
  consumers: number
  wateredConsumers: number
  /** Бонус к счастью от домов рядом с парками (0–12). */
  parkValue: number
}

function countTiles(grid: Grid): CityCounts {
  let parkValue = 0;
  const counts: CityCounts = {
    energyProduced: 0,
    energyConsumed: 0,
    waterProduced: 0,
    waterConsumed: 0,
    roads: 0,
    houses: 0,
    houseCapacity: 0,
    wateredCapacity: 0,
    poweredCapacity: 0,
    servicedCapacity: 0,
    shops: 0,
    wateredShops: 0,
    poweredShops: 0,
    servicedShops: 0,
    suppliedShops: 0,
    factories: 0,
    wateredFactories: 0,
    poweredFactories: 0,
    servicedFactories: 0,
        pumps: 0,
    parks: 0,
    wind: 0,
    solarPanels: 0,
    coal: 0,
    policeStations: 0,
    fireStations: 0,
    unwateredHouses: 0,
    unservicedHouses: 0,
    poweredConsumers: 0,
    parkedHouses: 0,
    smogHouses: 0,
    consumers: 0,
    wateredConsumers: 0,
    parkValue: 0,
  }
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type !== TileType.EMPTY && cell.type !== TileType.ROAD && cell.type !== TileType.FOOTPRINT) {
        const id = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
        const entry = id ? BUILDING_BY_ID[id] : undefined
        if (entry?.category === 'utilities' || cell.type === TileType.COAL) {
          counts.energyProduced += entry?.givesEnergy ?? entry?.energy ?? (cell.type === TileType.COAL ? 60 : 0)
          counts.waterProduced += entry?.givesWater ?? 0
        } else {
          counts.energyConsumed += entry?.energy ?? 0
          counts.waterConsumed += entry?.water ?? 0
        }
      }
      switch (cell.type) {
        case TileType.ROAD:
          counts.roads += 1
          continue
        case TileType.WATER_PUMP:
          counts.pumps += 1
          continue
        case TileType.PARK:
          counts.parks += 1
          continue
        case TileType.WIND:
          counts.wind += 1
          continue
        case TileType.SOLAR_PANEL:
          counts.solarPanels += 1
          continue
        case TileType.COAL:
          counts.coal += 1
          continue
        case TileType.POLICE:
          counts.policeStations += 1
          continue
        case TileType.FIRE_STATION:
          if (cell.catalogId === 'civ_fire' || !cell.catalogId) counts.fireStations += 1
          continue
        case TileType.RESIDENTIAL:
          counts.houses += 1
          counts.houseCapacity += getHomeCapacity(cell)
          if (cell.hasWater) counts.wateredCapacity += getHomeCapacity(cell)
          if (cell.hasPower) counts.poweredCapacity += getHomeCapacity(cell)
          if (cell.hasWater && cell.hasPower) counts.servicedCapacity += getHomeCapacity(cell)
          if (!cell.hasWater) counts.unwateredHouses += 1
          if (!cell.hasWater || !cell.hasPower) counts.unservicedHouses += 1
          if (cell.smog) counts.smogHouses += 1
          if (cell.parked) {
            counts.parkedHouses += 1
            parkValue = Math.min(12, parkValue + 3)
          }
          break
        case TileType.COMMERCIAL:
          counts.shops += 1
          if (cell.hasWater) counts.wateredShops += 1
          if (cell.hasPower) counts.poweredShops += 1
          if (cell.hasPower && cell.hasWater) counts.servicedShops += 1
          if (cell.hasSupplies) counts.suppliedShops += 1
          break
        case TileType.INDUSTRIAL:
          counts.factories += 1
          if (cell.hasWater) counts.wateredFactories += 1
          if (cell.hasPower) counts.poweredFactories += 1
          if (cell.hasPower && cell.hasWater) counts.servicedFactories += 1
          break
        default:
          continue
      }
      counts.consumers += 1
      if (cell.hasWater) counts.wateredConsumers += 1
      if (cell.hasPower) counts.poweredConsumers += 1
    }
  }
  counts.parkValue = parkValue
  return counts
}

/** Каталог задаёт готовую чистую сумму за каждый десятиминутный такт. */
export interface IncomeBreakdown {
  residential: number
  commercial: number
  industrial: number
  other: number
  maintenance: number
  net: number
}

/** Доходы по категориям и расходы на содержание за один такт (10 игровых минут). */
function computeIncomeBreakdown(grid: Grid, taxRates: SimState['taxRates'], modifiers: CityEventModifiers): IncomeBreakdown {
  const result: IncomeBreakdown = { residential: 0, commercial: 0, industrial: 0, other: 0, maintenance: 0, net: 0 }
  for (const row of grid) for (const cell of row) {
    if (cell.type === TileType.EMPTY || cell.type === TileType.ROAD || cell.type === TileType.FOOTPRINT) continue
    const catalogId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
    const entry = catalogId ? BUILDING_BY_ID[catalogId] : undefined
    if (!entry) continue
    const taxGroup = entry.category === 'residential' ? 'residential'
      : entry.category === 'commercial' ? 'commercial'
        : entry.category === 'industrial' ? 'industrial' : undefined
    // Жилые дома, магазины и заводы без воды или света не работают и налогов не платят.
    const serviced = !taxGroup || (cell.hasWater && cell.hasPower && !cell.fire)
    const taxableIncome = serviced ? entry.income ?? Math.max(0, entry.tickNet) : 0
    let taxMultiplier = taxGroup && taxableIncome > 0 ? taxRates[taxGroup] / 10 : 1
    if (cell.type === TileType.RESIDENTIAL && cell.level > 1) taxMultiplier *= 1 + (cell.level - 1) * 0.4
    if (cell.type === TileType.RESIDENTIAL && hasNearbyCatalog(grid, cell, isGreenAmenity)) taxMultiplier *= 1.3
    if (cell.type === TileType.RESIDENTIAL && hasNearbyCatalog(grid, cell, isPollutingBuilding)) taxMultiplier *= 0.8
    // Магазинам без поставок с заводов (через дорожную сеть) не хватает товара.
    if (cell.type === TileType.COMMERCIAL && !cell.hasSupplies) taxMultiplier *= 0.8
    taxMultiplier *= modifiers.incomeMultiplier[catalogId!] ?? 1
    result[taxGroup ?? 'other'] += taxableIncome * taxMultiplier
    result.maintenance += entry.maintenance ?? Math.max(0, -entry.tickNet)
  }
  result.net = Math.round(result.residential + result.commercial + result.industrial + result.other - result.maintenance)
  return result
}

function computeNetIncome(grid: Grid, taxRates: SimState['taxRates'], modifiers: CityEventModifiers): number {
  return computeIncomeBreakdown(grid, taxRates, modifiers).net
}

/** Сколько жителей «обслуживает» одно очко счастья от парков, школ, больниц и т.п. */
const RESIDENTS_PER_AMENITY_POINT = 10
const AMENITY_HAPPINESS_MAX = 20
const BASE_HAPPINESS = 70

/**
 * Целевое счастье: база 70, плюс до +20 за обеспеченность досугом и услугами
 * (относительно населения), бонус уютных домов у парков и события; минус смог и преступность.
 */
function targetHappiness(counts: CityCounts, crimeRate: number, grid: Grid, population: number, modifiers: CityEventModifiers): number {
  if (counts.consumers === 0) return 100
  let h = BASE_HAPPINESS - crimeRate * 0.5 + modifiers.happinessBonus
  if (counts.houses > 0) {
    h -= (counts.smogHouses / counts.houses) * 25
    const cozyHomes = grid.flat().filter((cell) => cell.type === TileType.RESIDENTIAL && hasNearbyCatalog(grid, cell, isGreenAmenity)).length
    h += (cozyHomes / counts.houses) * 5
  }
  h += counts.parkValue
  let amenityPoints = 0
  for (const row of grid) for (const cell of row) {
    const id = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
    if (id) amenityPoints += BUILDING_BY_ID[id]?.happiness ?? 0
  }
  const amenityDemand = Math.max(20, population / RESIDENTS_PER_AMENITY_POINT)
  h += AMENITY_HAPPINESS_MAX * Math.min(1, amenityPoints / amenityDemand)
  return Math.round(Math.min(100, Math.max(0, h)))
}

/** Пожары начинаются только в городе от этого населения — новичков не наказываем. */
export const FIRE_SAFE_POPULATION = 300
const FIRE_CHANCE_UNCOVERED = 0.00012
const FIRE_CHANCE_COVERED = 0.00002
const FIRE_TICKS_COVERED = 6
const FIRE_TICKS_UNCOVERED = 30

/**
 * Пожары: здание без пожарного депо в радиусе загорается чаще и горит дольше.
 * Пока горит — не платит налоги и теряет жителей; без депо после пожара дом теряет уровень.
 */
function updateFires(grid: Grid, coverage: CoverageMaps, population: number, day: number, minute: number): { grid: Grid; started: GridCell | null } {
  let started: GridCell | null = null
  const next = grid.map((row) => row.map((cell) => {
    const burnable = cell.type === TileType.RESIDENTIAL || cell.type === TileType.COMMERCIAL || cell.type === TileType.INDUSTRIAL
    if (!burnable) return cell
    const covered = isCovered(coverage, 'fire', cell.x, cell.y)
    if (cell.fire) {
      const remaining = cell.fire - 1
      if (remaining > 0) {
        const residents = cell.type === TileType.RESIDENTIAL ? Math.max(0, (cell.residents ?? 0) - 1) : cell.residents
        return { ...cell, fire: remaining, residents }
      }
      // Потушили. Без пожарных дом успел сильно пострадать.
      if (!covered && cell.type === TileType.RESIDENTIAL) {
        return { ...cell, fire: undefined, level: 1, residents: Math.floor((cell.residents ?? 0) / 2) }
      }
      return { ...cell, fire: undefined }
    }
    if (population < FIRE_SAFE_POPULATION) return cell
    const chance = covered ? FIRE_CHANCE_COVERED : FIRE_CHANCE_UNCOVERED
    if (seededRandom(cell.x, cell.y, day, minute, 911) >= chance) return cell
    const burning = { ...cell, fire: covered ? FIRE_TICKS_COVERED : FIRE_TICKS_UNCOVERED }
    started ??= burning
    return burning
  }))
  return { grid: next, started }
}

/** Доля жителей вне радиуса полиции; маленький посёлок обходится без полиции. */
function crimeRateFor(grid: Grid, coverage: CoverageMaps, population: number): number {
  if (population <= CRIME_FREE_POPULATION) return 0
  let uncovered = 0
  for (const row of grid) for (const cell of row) {
    if (cell.type === TileType.RESIDENTIAL && !isCovered(coverage, 'police', cell.x, cell.y)) uncovered += cell.residents ?? 0
  }
  return Math.min(100, Math.round((uncovered / population) * 100))
}

function buildQuestContext(grid: Grid, counts: CityCounts, population: number, happiness: number): QuestContext {
  const catalog: Record<string, number> = {}
  for (const row of grid) for (const cell of row) {
    const id = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
    if (id && cell.type !== TileType.FOOTPRINT) catalog[id] = (catalog[id] ?? 0) + 1
  }
  return {
    population, happiness,
    roads: counts.roads, houses: counts.houses, pumps: counts.pumps,
    generators: counts.wind + counts.solarPanels + counts.coal,
    unservicedHouses: counts.unservicedHouses, shops: counts.shops, suppliedShops: counts.suppliedShops,
    parks: counts.parks, policeStations: counts.policeStations, fireStations: counts.fireStations,
    catalog,
  }
}

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'RESET':
      return createFreshState()
    case 'SET_SANDBOX':
      return { ...state, sandbox: true, budget: Math.max(state.budget, 50_000), debt: 0, rank: Math.max(state.rank, 4), materials: { bricks: state.warehouseCapacity, concrete: state.warehouseCapacity, steel: state.warehouseCapacity } }
    case 'SET_TAX':
      return { ...state, taxRates: { ...state.taxRates, [action.category]: Math.min(20, Math.max(1, action.rate)) } }
    case 'TAKE_LOAN':
      if (state.debt > 0) return { ...state, notice: { id: Date.now(), text: 'Погасите текущий займ перед новым.' } }
      return { ...state, budget: state.budget + action.amount, debt: action.amount }
    case 'REPAY_LOAN':
      if (state.debt <= 0 || state.budget < state.debt) return state
      return { ...state, budget: state.budget - state.debt, debt: 0 }
    
    case 'PLACE': {
      const { x, y, tool, style } = action
      if (!inBounds(x, y)) return state
      
      const requiredRank = unlockRankOf(action.catalogId ?? tool)
      if (!state.sandbox && state.rank < requiredRank) {
        return { ...state, notice: { id: Date.now(), text: 'Эта постройка откроется на следующем ранге города. Растите население!' } }
      }
      const baseDef = TOOL_DEFINITIONS[tool]
      const catalogEntry = action.catalogId ? BUILDING_BY_ID[action.catalogId] : undefined
      const def = catalogEntry ? { ...baseDef, tile: catalogEntry.tile, cost: catalogEntry.cost } : baseDef
      
      let cost = def.cost;
      if (tool === ToolId.PARK) {
        if (style === 'SQUARE') cost = 50;
        else if (style === 'PARK') cost = 100;
        else if (style === 'LARGE_PARK') cost = 150;
      }
      if (state.budget < cost) {

        return { ...state, notice: { id: Date.now(), text: 'Недостаточно средств!' } }
      }
      const materialCost = catalogEntry?.materialCost ?? {}
      if (state.materials.bricks < (materialCost.bricks ?? 0) || state.materials.concrete < (materialCost.concrete ?? 0) || state.materials.steel < (materialCost.steel ?? 0)) {
        const missing = state.materials.concrete < (materialCost.concrete ?? 0)
          ? `Недостаточно бетона (Имеется: ${state.materials.concrete} / Требуется: ${materialCost.concrete})`
          : state.materials.bricks < (materialCost.bricks ?? 0)
            ? `Недостаточно кирпича (Имеется: ${state.materials.bricks} / Требуется: ${materialCost.bricks})`
            : `Недостаточно стали (Имеется: ${state.materials.steel} / Требуется: ${materialCost.steel})`
        return { ...state, notice: { id: Date.now(), text: missing } }
      }
      
      // Determine size
      let w = catalogEntry?.footprint?.[0] ?? 1
      let h = catalogEntry?.footprint?.[1] ?? 1
      if ((action.orientation ?? 0) % 2 === 1) [w, h] = [h, w]
      if (tool === ToolId.CITY_HALL) {
        if (state.grid.some(row => row.some(c => c.type === TileType.CITY_HALL))) return state;
        w = 2; h = 2;
      }
      if (tool === ToolId.PARK && !catalogEntry) {
        if (style === 'PARK') { w = 2; h = 2; }
        if (style === 'LARGE_PARK') { w = 3; h = 3; }
      }
      
      // Check space
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (!inBounds(x+dx, y+dy)) return { ...state, notice: { id: Date.now(), text: 'Фундамент выходит за пределы карты.' } }
          if (state.grid[y+dy][x+dx].type !== TileType.EMPTY) return { ...state, notice: { id: Date.now(), text: 'Место занято.' } }
        }
      }

      if (tool !== ToolId.ROAD) {
        let roadAccess = false
        for (let dx = 0; dx < w; dx += 1) {
          roadAccess ||= (inBounds(x + dx, y - 1) && state.grid[y - 1][x + dx].type === TileType.ROAD)
          roadAccess ||= (inBounds(x + dx, y + h) && state.grid[y + h][x + dx].type === TileType.ROAD)
        }
        for (let dy = 0; dy < h; dy += 1) {
          roadAccess ||= (inBounds(x - 1, y + dy) && state.grid[y + dy][x - 1].type === TileType.ROAD)
          roadAccess ||= (inBounds(x + w, y + dy) && state.grid[y + dy][x + w].type === TileType.ROAD)
        }
        if (!roadAccess) return { ...state, notice: { id: Date.now(), text: 'Нужна дорога у края фундамента.' } }
      }

      let newGrid = state.grid.map((row, r) =>
        row.map((cell, c) => {
          if (r >= y && r < y + h && c >= x && c < x + w) {
            if (r === y && c === x) {
              const home = def.tile === TileType.RESIDENTIAL
                ? (catalogEntry?.population
                  ? { floors: catalogEntry.id === 'res_cottage' ? 1 : catalogEntry.id === 'res_apartment' ? 4 : 3, maxResidents: catalogEntry.population }
                  : residenceProfile(x, y, state.day, state.minutes))
                : undefined
              return {
                ...cell,
                type: def.tile!,
                level: 1,
                style,
                catalogId: catalogEntry?.id,
                orientation: action.orientation ?? 0,
                smog: false,
                animate: true,
                ...(home ? { residentialFloors: home.floors, maxResidents: home.maxResidents, residents: 0 } : {}),
              }
            }
            return { ...cell, type: TileType.FOOTPRINT, refX: x, refY: y, animate: true };
          }
          return cell;
        })
      )
      
      newGrid = recomputeServices(newGrid, eventModifiers(state.events).energyMultiplier)
      return { ...state, grid: newGrid, budget: state.budget - cost, materials: { bricks: state.materials.bricks - (materialCost.bricks ?? 0), concrete: state.materials.concrete - (materialCost.concrete ?? 0), steel: state.materials.steel - (materialCost.steel ?? 0) } }
    }
    case 'REMOVE': {
      const { x, y } = action
      if (!inBounds(x, y)) return state
      
      let targetX = x, targetY = y
      if (state.grid[y][x].type === TileType.FOOTPRINT) {
        targetX = state.grid[y][x].refX!;
        targetY = state.grid[y][x].refY!;
      }
      
      const targetCell = state.grid[targetY][targetX]
      if (targetCell.type === TileType.EMPTY) return state
      
      // Determine bounds
      let w = targetCell.catalogId ? BUILDING_BY_ID[targetCell.catalogId]?.footprint?.[0] ?? 1 : 1
      let h = targetCell.catalogId ? BUILDING_BY_ID[targetCell.catalogId]?.footprint?.[1] ?? 1 : 1
      if ((targetCell.orientation ?? 0) % 2 === 1) [w, h] = [h, w]
      if (targetCell.type === TileType.CITY_HALL) { w = 2; h = 2; }
      if (targetCell.type === TileType.PARK && !targetCell.catalogId) {
        if (targetCell.style === 'PARK') { w = 2; h = 2; }
        if (targetCell.style === 'LARGE_PARK') { w = 3; h = 3; }
      }
      
      let newGrid = state.grid.map((row, r) =>
        row.map((cell, c) => {
          if (r >= targetY && r < targetY + h && c >= targetX && c < targetX + w) {
            return { ...cell, type: TileType.EMPTY, style: undefined, level: 1, orientation: undefined, hasWater: false, hasPower: false, smog: false, parked: false, fire: undefined, residents: undefined, maxResidents: undefined, residentialFloors: undefined, refX: undefined, refY: undefined, animate: undefined };
          }
          return cell;
        })
      )
      
      newGrid = recomputeServices(newGrid, eventModifiers(state.events).energyMultiplier)
      return { ...state, grid: newGrid }
    }
    case 'UPGRADE': {
      const { x, y } = action
      if (!inBounds(x, y)) return state
      const cell = state.grid[y][x]
      if (cell.type !== TileType.RESIDENTIAL || cell.level >= 3) return state
      const cost = cell.level === 1 ? 150 : 300
      const materialCost = cell.level === 1 ? { bricks: 2, concrete: 1, steel: 0 } : { bricks: 3, concrete: 2, steel: 1 }
      if (state.budget < cost || state.materials.bricks < materialCost.bricks || state.materials.concrete < materialCost.concrete || state.materials.steel < materialCost.steel) {
        return { ...state, notice: { id: Date.now(), text: 'Недостаточно денег или строительных материалов для улучшения.' } }
      }
      const grid = state.grid.map((row, rowIndex) => row.map((entry, columnIndex) => rowIndex === y && columnIndex === x
        ? { ...entry, level: entry.level + 1, maxResidents: Math.round((entry.maxResidents ?? 70) * 1.4), residents: Math.min(Math.round((entry.maxResidents ?? 70) * 1.4), Math.round((entry.residents ?? 0) * 1.4)) }
        : entry))
      return { ...state, grid, budget: state.budget - cost, materials: { bricks: state.materials.bricks - materialCost.bricks, concrete: state.materials.concrete - materialCost.concrete, steel: state.materials.steel - materialCost.steel } }
    }
    case 'MERGE': {
      const { x, y } = action
      if (x < 0 || y < 0 || x + 2 > GRID_SIZE || y + 2 > GRID_SIZE) return state
      const cells = [state.grid[y][x], state.grid[y][x + 1], state.grid[y + 1][x], state.grid[y + 1][x + 1]]
      if (!cells.every((cell) => cell.type === TileType.RESIDENTIAL && cell.level >= 3) || state.materials.concrete < 10 || state.materials.steel < 5 || state.budget < 1000) {
        return { ...state, notice: { id: Date.now(), text: 'Для объединения нужны четыре дома 3 уровня, 10 бетона, 5 стали и $1,000.' } }
      }
      const grid = state.grid.map((row) => row.map((cell) => ({ ...cell })))
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
        grid[y + dy][x + dx] = { ...grid[y + dy][x + dx], type: TileType.EMPTY, catalogId: undefined, residents: undefined, maxResidents: undefined, residentialFloors: undefined, level: 1 }
      }
      grid[y][x] = { ...grid[y][x], type: TileType.RESIDENTIAL, catalogId: 'res_modern_glass_tower', level: 1, residents: 140, maxResidents: 350, residentialFloors: 18, orientation: 0 }
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) grid[y + dy][x + dx] = { ...grid[y + dy][x + dx], type: TileType.FOOTPRINT, refX: x, refY: y }
      const recomputed = recomputeServices(grid, eventModifiers(state.events).energyMultiplier)
      const population = recomputed.reduce((total, row) => total + row.reduce((sum, cell) => sum + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
      return { ...state, grid: recomputed, population, budget: state.budget - 1000, materials: { ...state.materials, concrete: state.materials.concrete - 10, steel: state.materials.steel - 5 } }
    }
    case 'MERGE_TOWERS': {
      const { x, y } = action
      if (!inBounds(x, y)) return state
      const source = state.grid[y][x]
      if (source.catalogId !== 'res_modern_glass_tower') return state
      const neighbors = [[x + 2, y], [x - 2, y], [x, y + 2], [x, y - 2]] as const
      const neighbor = neighbors.map(([nx, ny]) => inBounds(nx, ny) ? state.grid[ny][nx] : undefined).find((cell) => cell?.catalogId === 'res_modern_glass_tower')
      if (!neighbor || state.budget < 1500 || state.materials.concrete < 30 || state.materials.steel < 15) {
        return { ...state, notice: { id: Date.now(), text: 'Для мега-комплекса нужны соседняя башня, $1,500, 30 бетона и 15 стали.' } }
      }
      const x0 = Math.min(x, neighbor.x), y0 = Math.min(y, neighbor.y)
      const vertical = x === neighbor.x
      const width = vertical ? 2 : 4, height = vertical ? 4 : 2
      const belongsToMergedTowers = (cell: GridCell) => (cell.catalogId === 'res_modern_glass_tower' && ((cell.x === x && cell.y === y) || (cell.x === neighbor.x && cell.y === neighbor.y))) || (cell.type === TileType.FOOTPRINT && ((cell.refX === x && cell.refY === y) || (cell.refX === neighbor.x && cell.refY === neighbor.y)))
      for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
        if (!inBounds(x0 + dx, y0 + dy) || !belongsToMergedTowers(state.grid[y0 + dy][x0 + dx])) return { ...state, notice: { id: Date.now(), text: 'Участки башен должны непосредственно примыкать и не перекрываться другими зданиями.' } }
      }
      const grid = state.grid.map((row) => row.map((cell) => ({ ...cell })))
      const residents = (state.grid[y][x].residents ?? 0) + (neighbor.residents ?? 0)
      for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) grid[y0 + dy][x0 + dx] = { ...grid[y0 + dy][x0 + dx], type: TileType.EMPTY, catalogId: undefined, refX: undefined, refY: undefined, residents: undefined, maxResidents: undefined, residentialFloors: undefined, orientation: undefined, level: 1 }
      grid[y0][x0] = { ...grid[y0][x0], type: TileType.RESIDENTIAL, catalogId: 'res_megapolis_complex', orientation: vertical ? 1 : 0, residents, maxResidents: 1050, residentialFloors: 30, level: 1, animate: true }
      for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) if (dx || dy) grid[y0 + dy][x0 + dx] = { ...grid[y0 + dy][x0 + dx], type: TileType.FOOTPRINT, refX: x0, refY: y0 }
      return { ...state, grid: recomputeServices(grid, eventModifiers(state.events).energyMultiplier), budget: state.budget - 1500, materials: { ...state.materials, concrete: state.materials.concrete - 30, steel: state.materials.steel - 15 } }
    }
    case 'EXPAND_WAREHOUSE':
      if (state.budget < 500) return { ...state, notice: { id: Date.now(), text: 'Для расширения склада нужно $500.' } }
      return { ...state, budget: state.budget - 500, warehouseCapacity: state.warehouseCapacity + 50 }
case 'TICK': {
      const nextMinutes = state.minutes + MINUTES_PER_TICK
      const nextDay = state.day + Math.floor(nextMinutes / MINUTES_PER_DAY)
      const gameMinute = nextMinutes % MINUTES_PER_DAY
      const isMidnight = nextDay > state.day
      const crossesHour = Math.floor(nextMinutes / 60) > Math.floor(state.minutes / 60)
      const immigrationWindow = gameMinute % 150 === 0
      const demographicWindow = gameMinute % 360 === 0
      const events = activeEvents({ day: nextDay, now: action.now })
      const eventsChanged = !sameEvents(events, state.events)
      const modifiers = eventModifiers(events)
      // При смене сезона (например, зимнее отопление) пересчитываем распределение энергии.
      const baseGrid = eventsChanged ? recomputeServices(state.grid, modifiers.energyMultiplier) : state.grid
      const cityGrid = baseGrid.map(row => row.map(cell => {
        if (cell.type !== TileType.RESIDENTIAL) return cell
        const capacity = getHomeCapacity(cell)
        const residents = cell.residents ?? 0
        const serviced = cell.hasWater && cell.hasPower
        let nextResidents = residents

        if (!serviced && crossesHour) {
          nextResidents = Math.max(0, residents - 2)
        } else if (serviced && immigrationWindow && state.happiness > 60 && residents < capacity) {
          const newcomers = 2 + Math.floor(seededRandom(cell.x, cell.y, nextDay, gameMinute, 151) * 4)
          nextResidents = Math.min(capacity, residents + newcomers)
        } else if (serviced && demographicWindow && residents > 0) {
          const fluctuation = 1 + Math.floor(seededRandom(cell.x, cell.y, nextDay, gameMinute, 251) * 3)
          const direction = seededRandom(cell.x, cell.y, nextDay, gameMinute, 353) < 0.5 ? -1 : 1
          nextResidents = Math.min(capacity, Math.max(0, residents + direction * fluctuation))
        }

        // Дом у парка без смога сам дорастает до 2 уровня; дальше — только платное улучшение.
        const grows = isMidnight && serviced && cell.parked && !cell.smog && cell.level < 2
        const level = grows ? 2 : cell.level
        const maxResidents = grows ? Math.round(capacity * 1.4) : capacity
        return nextResidents === residents && level === cell.level && maxResidents === cell.maxResidents
          ? cell
          : { ...cell, residents: nextResidents, maxResidents, level }
      }))
      const populationBefore = cityGrid.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
      const coverage = computeCoverage(cityGrid)
      const fires = updateFires(cityGrid, coverage, populationBefore, nextDay, gameMinute)
      const finalGrid = fires.grid
      const population = finalGrid.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
      const counts = countTiles(finalGrid)
      const net = computeNetIncome(finalGrid, state.taxRates, modifiers)
      const crimeRate = crimeRateFor(finalGrid, coverage, population)
      const fireNotice = fires.started
        ? { id: Date.now(), text: isCovered(coverage, 'fire', fires.started.x, fires.started.y)
          ? '🔥 Пожар! Пожарные уже выехали.'
          : '🔥 Пожар! Рядом нет пожарного депо — здание горит долго.' }
        : state.notice
      const unservicedHouseShare = counts.houses > 0 ? counts.unservicedHouses / counts.houses : 0
      const happinessDrift = (targetHappiness(counts, crimeRate, finalGrid, population, modifiers) - state.happiness) * MINUTES_PER_TICK / MINUTES_PER_DAY
      // Пустая казна: службы недополучают денег, жители недовольны.
      const bankruptLoss = state.budget < 0 ? 15 : 0
      const dailyServiceLoss = (unservicedHouseShare * 25 + bankruptLoss) * MINUTES_PER_TICK / MINUTES_PER_DAY
      // Ежедневный платёж по кредиту действительно уменьшает долг.
      const loanPayment = state.debt > 0 && isMidnight ? Math.min(DAILY_LOAN_PAYMENT, state.debt) : 0
      const netTickIncome = net - loanPayment
      const materials = { ...state.materials }
      for (const row of finalGrid) for (const cell of row) if (cell.type === TileType.INDUSTRIAL && !cell.fire) {
        if (cell.catalogId === 'ind_brickworks') materials.bricks = Math.min(state.warehouseCapacity, materials.bricks + 1)
        if (cell.catalogId === 'ind_concrete_plant') materials.concrete = Math.min(state.warehouseCapacity, materials.concrete + 1)
        if (cell.catalogId === 'ind_steel_foundry') materials.steel = Math.min(state.warehouseCapacity, materials.steel + 1)
      }
      const rank = Math.max(state.rank, rankForPopulation(population))
      // Задания советника: награда сразу на счёт, затем следующее задание.
      let questIndex = state.questIndex
      let questReward = 0
      const quest = QUESTS[questIndex]
      if (quest && quest.check(buildQuestContext(finalGrid, counts, population, state.happiness))) {
        questReward = quest.reward
        questIndex += 1
      }
      const nextBudget = Math.round(state.budget + netTickIncome + questReward)
      return {
        ...state,
        rank,
        questIndex,
        grid: finalGrid,
        population,
        notice: state.budget >= 0 && nextBudget < 0
          ? { id: Date.now(), text: '⚠️ Казна пуста! Поднимите налоги в мэрии или снесите убыточные здания.' }
          : fireNotice,
        budget: nextBudget,
        lastNet: netTickIncome,
        happiness: Math.min(100, Math.max(0, state.happiness + happinessDrift - dailyServiceLoss)),
        debt: state.debt - loanPayment,
        minutes: gameMinute,
        day: nextDay,
        ticks: state.ticks + 1,
        materials,
        events,
      }
    }
    default:
      return state
  }
}

function createFreshState(): SimState {
  return {
    grid: createEmptyGrid(),
    population: 0,
    budget: START_BUDGET,
    lastNet: 0,
    happiness: 100,
    taxRates: { residential: 10, commercial: 10, industrial: 10 },
    debt: INITIAL_LOAN,
    minutes: 840,
    ticks: 0,
    day: 1,
    notice: null,
    noticeSeq: 0,
    materials: { bricks: 0, concrete: 0, steel: 0 },
    warehouseCapacity: 100,
    events: activeEvents({ day: 1, now: Date.now() }),
    rank: 0,
    questIndex: 0,
    sandbox: false,
    undo: [],
  }
}

function createInitialState(): SimState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const save = JSON.parse(raw) as SimState
      if (save.grid?.length === GRID_SIZE && save.grid.every(row => row.length === GRID_SIZE) && save.taxRates) {
        let legacyResidents = Math.max(0, Math.floor(Number.isFinite(save.population) ? save.population : 0))
        const day = save.day ?? 1
        const minute = save.minutes ?? 840
        const grid = save.grid.map(row => row.map(cell => {
          const catalogId = canonicalCatalogId(cell.catalogId)
          const normalizedCell = catalogId === cell.catalogId ? cell : { ...cell, catalogId }
          if (cell.type !== TileType.RESIDENTIAL) return normalizedCell
          const profile = residenceProfile(cell.x, cell.y, day, minute)
          const maxResidents = cell.maxResidents ?? profile.maxResidents
          let residents = cell.residents
          if (residents == null) {
            residents = Math.min(maxResidents, legacyResidents)
            legacyResidents = Math.max(0, legacyResidents - residents)
            if (residents === 0 && cell.hasWater && cell.hasPower) {
              residents = Math.floor(maxResidents * (0.4 + seededRandom(cell.x, cell.y, 73) * 0.1))
            }
          }
          // Уровень 4 был доступен только через старый бесплатный авто-рост — приводим к максимуму 3.
          return { ...normalizedCell, level: Math.min(3, cell.level ?? 1), residentialFloors: cell.residentialFloors ?? profile.floors, maxResidents, residents: Math.min(maxResidents, residents) }
        }))
        const population = grid.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
        return {
          ...save,
          // Сохранённые здания уже достроены — не проигрываем анимацию стройки при каждом запуске.
          grid: grid.map((row) => row.map((cell) => (cell.animate ? { ...cell, animate: false } : cell))),
          population,
          budget: Math.max(0, Math.floor(Number.isFinite(save.budget) ? save.budget : START_BUDGET)),
          materials: save.materials ?? { bricks: 0, concrete: 0, steel: 0 },
          warehouseCapacity: save.warehouseCapacity ?? 100,
          events: activeEvents({ day, now: Date.now() }),
          rank: Math.max(save.rank ?? 0, rankForPopulation(population)),
          questIndex: save.questIndex ?? 0,
          sandbox: save.sandbox ?? false,
          undo: [],
        }
      }
    }
  } catch { /* Ignore malformed or unavailable browser storage and start a fresh city. */ }
  return createFreshState()
}

const SAVE_KEY = 'inkville-save-v2'
const SAVE_INTERVAL_MS = 10_000

function persistState(state: SimState) {
  try {
    const hasCity = state.grid.some(row => row.some(cell => cell.type !== TileType.EMPTY))
    if (hasCity) localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, undo: undefined }))
    else localStorage.removeItem(SAVE_KEY)
  } catch { /* Storage can be unavailable in private browsing. */ }
}

/** Чистое состояние симуляции города: сетка, инструмент, экономика и игровой таймер. */
export function useCitySimulation() {
  const [state, dispatch] = useReducer(reducerWithUndo, undefined, createInitialState)
  if (typeof window !== "undefined") { (window as any).__SIM_DISPATCH = dispatch; (window as any).__SIM_STATE = state; }
  const [activeTool, setActiveTool] = useState<ToolId>(ToolId.CURSOR)
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed] = useState<SimSpeed>(1)

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), BASE_TICK_MS / speed)
    return () => window.clearInterval(timer)
  }, [paused, speed])

  // Сохранение: не чаще раза в 10 секунд, плюс сразу при уходе со страницы.
  const latestState = useRef(state)
  const lastSavedAt = useRef(0)
  useEffect(() => {
    latestState.current = state
    const isEmpty = !state.grid.some(row => row.some(cell => cell.type !== TileType.EMPTY))
    if (isEmpty || Date.now() - lastSavedAt.current >= SAVE_INTERVAL_MS) {
      persistState(state)
      lastSavedAt.current = Date.now()
    }
  }, [state])
  useEffect(() => {
    const flush = () => {
      persistState(latestState.current)
      lastSavedAt.current = Date.now()
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [])

  const placeTile = useCallback(
    (x: number, y: number, style?: string, catalogId?: string, orientation: 0 | 1 | 2 | 3 = 0) => dispatch({ type: 'PLACE', x, y, tool: activeTool, style, catalogId, orientation }),
    [activeTool],
  )

  const removeTile = useCallback((x: number, y: number) => dispatch({ type: 'REMOVE', x, y }), [])
  const setTaxRate = useCallback((category: keyof SimState['taxRates'], rate: number) => dispatch({ type: 'SET_TAX', category, rate }), [])
  const takeLoan = useCallback((amount: number) => dispatch({ type: 'TAKE_LOAN', amount }), [])
  const repayLoan = useCallback(() => dispatch({ type: 'REPAY_LOAN' }), [])
  const upgradeTile = useCallback((x: number, y: number) => dispatch({ type: 'UPGRADE', x, y }), [])
  const mergeNeighborhood = useCallback((x: number, y: number) => dispatch({ type: 'MERGE', x, y }), [])
  const mergeTowers = useCallback((x: number, y: number) => dispatch({ type: 'MERGE_TOWERS', x, y }), [])
  const expandWarehouse = useCallback(() => dispatch({ type: 'EXPAND_WAREHOUSE' }), [])
  const enableSandbox = useCallback(() => dispatch({ type: 'SET_SANDBOX' }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])

  const togglePause = useCallback(() => setPaused((value) => !value), [])

  
  // Один подсчёт клеток на изменение сетки вместо пяти отдельных.
  const counts = useMemo(() => countTiles(state.grid), [state.grid])
  const modifiers = useMemo(() => eventModifiers(state.events), [state.events])

  const demands = useMemo(() => {
    const jobs = counts.servicedShops * 6 + counts.servicedFactories * 12
    const unemployed = Math.max(0, state.population - jobs)
    const freeJobs = Math.max(0, jobs - state.population)
    const resDemand = Math.min(100, (freeJobs / 20) * 100)
    const shopsNeeded = Math.floor(state.population / 20)
    const comDemand = Math.min(100, Math.max(0, (shopsNeeded - counts.shops) / 5) * 100)
    const indDemand = Math.min(100, (unemployed / 20) * 100)
    return { residential: resDemand, commercial: comDemand, industrial: indDemand }
  }, [counts, state.population])

  const waterStats = useMemo(() => (
    { served: counts.wateredConsumers, total: counts.consumers, produced: counts.waterProduced, consumed: counts.waterConsumed }
  ), [counts])

  const energyStats = useMemo(() => (
    { produced: counts.energyProduced, consumed: Math.round(counts.energyConsumed * modifiers.energyMultiplier) }
  ), [counts, modifiers])

  const coverage = useMemo(() => computeCoverage(state.grid), [state.grid])
  const capacityStats = useMemo(() => {
    // Доля зданий в радиусе полиции и пожарных (в процентах).
    let buildings = 0, police = 0, fire = 0
    for (const row of state.grid) for (const cell of row) {
      if (cell.type !== TileType.RESIDENTIAL && cell.type !== TileType.COMMERCIAL && cell.type !== TileType.INDUSTRIAL) continue
      buildings += 1
      if (isCovered(coverage, 'police', cell.x, cell.y)) police += 1
      if (isCovered(coverage, 'fire', cell.x, cell.y)) fire += 1
    }
    const percent = (value: number) => buildings ? Math.round((value / buildings) * 100) : 100
    return { policeCapacity: percent(police), fireCapacity: percent(fire), crimeRate: crimeRateFor(state.grid, coverage, state.population) }
  }, [coverage, state.grid, state.population])

  const prestige = useMemo(() => {
    const developed = counts.houses + counts.shops + counts.factories + counts.parks
    if (developed === 0) return 0
    return Math.min(5, Math.round((state.happiness / 25 + counts.parks * 0.22 + counts.shops * 0.06 + counts.houses * 0.01) * 10) / 10)
  }, [counts, state.happiness])

  return {
    grid: state.grid,
    population: state.population,
    budget: state.budget,
    lastNet: state.lastNet,
    happiness: Math.round(state.happiness),
    events: state.events,
    coverage,
    rank: state.rank,
    questIndex: state.questIndex,
    sandbox: state.sandbox,
    questContext: useMemo(() => buildQuestContext(state.grid, counts, state.population, state.happiness), [counts, state.grid, state.population, state.happiness]),
    enableSandbox,
    undo,
    canUndo: state.undo.length > 0,
    finance: useMemo(() => computeIncomeBreakdown(state.grid, state.taxRates, eventModifiers(state.events)), [state.grid, state.taxRates, state.events]),
    taxRates: state.taxRates,
    debt: state.debt,
    demands,
    waterStats,
    energyStats,
    prestige,
    capacityStats,
    minutes: state.minutes,
    ticks: state.ticks,
    day: state.day,
    notice: state.notice,
    activeTool,
    setActiveTool,
    paused,
    togglePause,
    speed,
    setSpeed,
    placeTile,
    removeTile,
    upgradeTile,
    mergeNeighborhood,
    mergeTowers,
    expandWarehouse,
    setTaxRate,
    takeLoan,
    repayLoan,
    materials: state.materials,
    warehouseCapacity: state.warehouseCapacity,
    reset: useCallback(() => dispatch({ type: 'RESET' }), []),
  }
}

export type CitySimulation = ReturnType<typeof useCitySimulation>

/** Для автотестов симуляции (npm run test:sim). */
export const simulationTesting = { reducer: reducerWithUndo, createFreshState }
