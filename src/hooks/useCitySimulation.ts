import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { TOOL_DEFINITIONS } from '../lib/cityConfig'
import { BUILDING_BY_ID, canonicalCatalogId, DEFAULT_CATALOG_ID_BY_TILE } from '../store/buildingCatalog'
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
export const DAILY_LOAN_PAYMENT = 10
/** Длительность тика при скорости 1x (мс). */
export const BASE_TICK_MS = 2000
/** Сколько игровых минут проходит за тик. Бюджет пересчитывается каждые 10 минут. */
export const MINUTES_PER_TICK = 10
/** Радиус водонапорной башни: на сколько клеток дорожной сети (по пути) она раздаёт воду. */
export const WATER_RADIUS = 12
/** Макс. длина участка дорожного графа от генератора до потребителя. */
export const POWER_RADIUS = 10
export const POLICE_CAPACITY_PER_STATION = 800
export const FIRE_CAPACITY_PER_STATION = 800

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
}

type Action =
  | { type: 'PLACE'; x: number; y: number; tool: import('../types/city').ToolId; style?: string; catalogId?: string }
  | { type: 'REMOVE'; x: number; y: number }
  | { type: 'TICK' }
  | { type: 'CHEAT_BUDGET'; amount: number }
  | { type: 'CHEAT_TIME'; ticks: number }
  | { type: 'SET_TAX'; category: 'residential' | 'commercial' | 'industrial'; rate: number }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN' }
  | { type: 'RESET' }

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
 * Вода: водонапорная башня питает примыкающие дороги, дальше вода течёт по связной дорожной сети
 * не дальше WATER_RADIUS клеток. Здание получает воду, если примыкает к запитанной дороге.
 *
 * Клетки, у которых ничего не изменилось, сохраняют ссылку (важно для React.memo в 3D-сцене).
 */
function recomputeServices(grid: Grid): Grid {
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
      if (cell.type === TileType.COAL || cell.type === TileType.INDUSTRIAL) {
        coals.push([cell.x, cell.y])
      }
      if (cell.type === TileType.PARK) {
        parks.push([cell.x, cell.y])
      }
      if (cell.type === TileType.INDUSTRIAL) factories.push([cell.x, cell.y])
    }
  }

  // Water BFS
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head]
    const distance = roadDistance[y][x]
    if (distance >= WATER_RADIUS) continue
    for (const [dx, dy] of NEIGHBOR_STEPS) {
      const nx = x + dx
      const ny = y + dy
      if (isRoad(nx, ny) && roadDistance[ny][nx] === 0) {
        roadDistance[ny][nx] = distance + 1
        queue.push([nx, ny])
      }
    }
  }

  // Электричество следует только по непрерывным дорогам, максимум 10 клеток от генератора.
  for (let head = 0; head < powerQueue.length; head += 1) {
    const [x, y] = powerQueue[head]
    const distance = powerDistance[y][x]
    if (distance >= POWER_RADIUS) continue
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
  const nextToServedRoad = (x: number, y: number, service: (x: number, y: number) => boolean) =>
    NEIGHBOR_STEPS.some(([dx, dy]) => service(x + dx, y + dy))
  const isPoweredSource = (x: number, y: number) => powerSources.some(([sx, sy]) => sx === x && sy === y)

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
      else if (occupied) hasWater = nextToServedRoad(cell.x, cell.y, isWateredRoad)
      
      // Smog calculation
      let smogCount = 0
      for (const [cx, cy] of coals) {
        if (Math.abs(cell.x - cx) + Math.abs(cell.y - cy) <= 8) smogCount++
      }
      for (const [px, py] of parks) {
        if (Math.abs(cell.x - px) + Math.abs(cell.y - py) <= 1) smogCount--
      }
      const smog = smogCount > 0
      const parked = parks.some(([px, py]) => Math.abs(cell.x - px) + Math.abs(cell.y - py) <= 1)
      const hasSupplies = cell.type === TileType.COMMERCIAL && NEIGHBOR_STEPS.some(([dx, dy]) => {
        const nx = cell.x + dx, ny = cell.y + dy
        return isRoad(nx, ny) && factoryComponents.has(component[ny][nx])
      })

      let hasPower = false
      if (cell.type === TileType.WIND || cell.type === TileType.SOLAR_PANEL || cell.type === TileType.COAL) hasPower = true
      else if (occupied) hasPower = isPoweredSource(cell.x, cell.y) || nextToServedRoad(cell.x, cell.y, isPoweredRoad)

      const catalogId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
      const catalogEntry = catalogId ? BUILDING_BY_ID[catalogId] : undefined
      const consumesUtilities = !!catalogEntry && catalogEntry.category !== 'utilities' && (catalogEntry.energy !== undefined || catalogEntry.water !== undefined)
      if (consumesUtilities) {
        const requiredWater = catalogEntry?.water ?? 1
        const requiredPower = catalogEntry?.energy ?? 1
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
}

export let globalParkValue = 0;
function countTiles(grid: Grid): CityCounts {
  let parkValue = 0;
  const counts: CityCounts = {
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
  }
  for (const row of grid) {
    for (const cell of row) {
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
          if ((cell as any).parked) counts.parkedHouses += 1
          if (cell.parked) parkValue = Math.min(12, parkValue + 3)
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
  globalParkValue = parkValue;
  return counts
}

/** Каталог задаёт готовую чистую сумму за каждый десятиминутный такт. */
function computeNetIncome(grid: Grid, taxRates: SimState['taxRates']): number {
  let total = 0
  for (const row of grid) for (const cell of row) {
    if (cell.type === TileType.EMPTY || cell.type === TileType.ROAD || cell.type === TileType.FOOTPRINT) continue
    const catalogId = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
    const entry = catalogId ? BUILDING_BY_ID[catalogId] : undefined
    if (!entry) continue
    const taxGroup = entry.category === 'residential' ? 'residential'
      : entry.category === 'commercial' ? 'commercial'
        : entry.category === 'industrial' ? 'industrial' : undefined
    const taxableIncome = entry.income ?? Math.max(0, entry.tickNet)
    const taxMultiplier = taxGroup && taxableIncome > 0 ? taxRates[taxGroup] / 10 : 1
    total += taxableIncome * taxMultiplier - (entry.maintenance ?? Math.max(0, -entry.tickNet))
  }
  return Math.round(total)
}

/** Целевое счастье учитывает нехватку воды, загрязнение и перегруз полиции. */
function targetHappiness(counts: CityCounts, crimeRate: number, grid: Grid): number {
  if (counts.consumers === 0) return 100
  let h = 100 - crimeRate * 0.5
  if (counts.houses > 0) {
    h -= (counts.smogHouses / counts.houses) * 20
  }
  h += globalParkValue
  for (const row of grid) for (const cell of row) {
    const id = cell.catalogId ?? DEFAULT_CATALOG_ID_BY_TILE[cell.type]
    if (id) h += BUILDING_BY_ID[id]?.happiness ?? 0
  }
  return Math.round(Math.min(100, Math.max(0, h)))
}

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'RESET':
      return createFreshState()
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
      
      // Determine size
      let w = 1, h = 1;
      if (tool === ToolId.CITY_HALL) {
        if (state.grid.some(row => row.some(c => c.type === TileType.CITY_HALL))) return state;
        w = 2; h = 2;
      }
      if (catalogEntry?.id === 'com_mall') w = 2
      if (tool === ToolId.PARK) {
        if (style === 'PARK') { w = 2; h = 2; }
        if (style === 'LARGE_PARK') { w = 3; h = 3; }
      }
      
      // Check space
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (!inBounds(x+dx, y+dy) || state.grid[y+dy][x+dx].type !== TileType.EMPTY) return state;
        }
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
      
      newGrid = recomputeServices(newGrid)
      return { ...state, grid: newGrid, budget: state.budget - cost }
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
      let w = 1, h = 1;
      if (targetCell.type === TileType.CITY_HALL) { w = 2; h = 2; }
      if (targetCell.catalogId === 'com_mall') w = 2
      if (targetCell.type === TileType.PARK) {
        if (targetCell.style === 'PARK') { w = 2; h = 2; }
        if (targetCell.style === 'LARGE_PARK') { w = 3; h = 3; }
      }
      
      let newGrid = state.grid.map((row, r) =>
        row.map((cell, c) => {
          if (r >= targetY && r < targetY + h && c >= targetX && c < targetX + w) {
            return { ...cell, type: TileType.EMPTY, style: undefined, level: 1, hasWater: false, hasPower: false, smog: false, parked: false, residents: undefined, maxResidents: undefined, residentialFloors: undefined, refX: undefined, refY: undefined, animate: undefined };
          }
          return cell;
        })
      )
      
      newGrid = recomputeServices(newGrid)
      return { ...state, grid: newGrid }
    }
case 'TICK': {
      const nextMinutes = state.minutes + MINUTES_PER_TICK
      const nextDay = state.day + Math.floor(nextMinutes / MINUTES_PER_DAY)
      const gameMinute = nextMinutes % MINUTES_PER_DAY
      const isMidnight = nextDay > state.day
      const crossesHour = Math.floor(nextMinutes / 60) > Math.floor(state.minutes / 60)
      const immigrationWindow = gameMinute % 150 === 0
      const demographicWindow = gameMinute % 360 === 0
      const cityGrid = state.grid.map(row => row.map(cell => {
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

        const level = isMidnight && cell.parked && !cell.smog ? Math.min(4, cell.level + 1) : cell.level
        return nextResidents === residents && level === cell.level
          ? cell
          : { ...cell, residents: nextResidents, maxResidents: capacity, level }
      }))
      const population = cityGrid.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
      const counts = countTiles(cityGrid)
      const net = computeNetIncome(cityGrid, state.taxRates)
      const totalPoliceCap = counts.policeStations * POLICE_CAPACITY_PER_STATION
      const crimeRate = population > totalPoliceCap && population > 0
        ? Math.min(100, Math.round(((population - totalPoliceCap) / population) * 100))
        : 0
      const unservicedHouseShare = counts.houses > 0 ? counts.unservicedHouses / counts.houses : 0
      const happinessDrift = (targetHappiness(counts, crimeRate, cityGrid) - state.happiness) * MINUTES_PER_TICK / MINUTES_PER_DAY
      const dailyServiceLoss = unservicedHouseShare * 25 * MINUTES_PER_TICK / MINUTES_PER_DAY
      const netTickIncome = net - (state.debt > 0 && isMidnight ? DAILY_LOAN_PAYMENT : 0)
      return {
        ...state,
        grid: cityGrid,
        population,
        budget: Math.max(0, Math.round(state.budget + netTickIncome)),
        lastNet: netTickIncome,
        happiness: Math.round(Math.min(100, Math.max(0, state.happiness + happinessDrift - dailyServiceLoss))),
        minutes: gameMinute,
        day: nextDay,
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
  }
}

function createInitialState(): SimState {
  try {
    const raw = localStorage.getItem('inkville-save-v2')
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
          return { ...normalizedCell, residentialFloors: cell.residentialFloors ?? profile.floors, maxResidents, residents: Math.min(maxResidents, residents) }
        }))
        const population = grid.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0)
        return {
          ...save,
          grid,
          population,
          budget: Math.max(0, Math.floor(Number.isFinite(save.budget) ? save.budget : START_BUDGET)),
        }
      }
    }
  } catch { /* Ignore malformed or unavailable browser storage and start a fresh city. */ }
  return createFreshState()
}

/** Чистое состояние симуляции города: сетка, инструмент, экономика и игровой таймер. */
export function useCitySimulation() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  if (typeof window !== "undefined") { (window as any).__SIM_DISPATCH = dispatch; (window as any).__SIM_STATE = state; }
  const [activeTool, setActiveTool] = useState<ToolId>(ToolId.CURSOR)
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed] = useState<SimSpeed>(1)

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), BASE_TICK_MS / speed)
    return () => window.clearInterval(timer)
  }, [paused, speed])

  useEffect(() => {
    try {
      const hasCity = state.grid.some(row => row.some(cell => cell.type !== TileType.EMPTY))
      if (hasCity) localStorage.setItem('inkville-save-v2', JSON.stringify(state))
      else localStorage.removeItem('inkville-save-v2')
    } catch { /* Storage can be unavailable in private browsing. */ }
  }, [state])

  const placeTile = useCallback(
    (x: number, y: number, style?: string, catalogId?: string) => dispatch({ type: 'PLACE', x, y, tool: activeTool, style, catalogId }),
    [activeTool],
  )

  const removeTile = useCallback((x: number, y: number) => dispatch({ type: 'REMOVE', x, y }), [])

  const togglePause = useCallback(() => setPaused((value) => !value), [])

  
  const demands = useMemo(() => {
    const counts = countTiles(state.grid)
    const jobs = counts.servicedShops * 6 + counts.servicedFactories * 12
    const unemployed = Math.max(0, state.population - jobs)
    const freeJobs = Math.max(0, jobs - state.population)
    const resDemand = Math.min(100, (freeJobs / 20) * 100)
    const shopsNeeded = Math.floor(state.population / 20)
    const comDemand = Math.min(100, Math.max(0, (shopsNeeded - counts.shops) / 5) * 100)
    const indDemand = Math.min(100, (unemployed / 20) * 100)
    return { residential: resDemand, commercial: comDemand, industrial: indDemand }
  }, [state.grid, state.population])

  const waterStats = useMemo(() => {
    const counts = countTiles(state.grid)
    return { served: counts.wateredConsumers, total: counts.consumers }
  }, [state.grid])

  const capacityStats = useMemo(() => {
    const counts = countTiles(state.grid)
    const policeCapacity = counts.policeStations * POLICE_CAPACITY_PER_STATION
    const fireCapacity = counts.fireStations * FIRE_CAPACITY_PER_STATION
    const crimeRate = state.population > policeCapacity && state.population > 0
      ? Math.min(100, Math.round(((state.population - policeCapacity) / state.population) * 100))
      : 0
    return { policeCapacity, fireCapacity, crimeRate }
  }, [state.grid, state.population])

  return {
    grid: state.grid,
    population: state.population,
    budget: state.budget,
    lastNet: state.lastNet,
    happiness: state.happiness,
    taxRates: state.taxRates,
    debt: state.debt,
    demands,
    waterStats,
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
    reset: useCallback(() => dispatch({ type: 'RESET' }), []),
  }
}

export type CitySimulation = ReturnType<typeof useCitySimulation>
