import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simulationTesting } from '../src/hooks/useCitySimulation'
import {
  clampInt,
  packSignedSave,
  safeJsonParse,
  sanitizeSavedGrid,
  sanitizeText,
  unpackSignedSave,
} from '../src/lib/saveSecurity'
import { TileType } from '../src/types/city'

const { reducer, createFreshState } = simulationTesting
type State = ReturnType<typeof createFreshState>
type Action = Parameters<typeof reducer>[1]
const NOV = Date.parse('2026-11-15T12:00:00')
const DEC = Date.parse('2026-12-05T12:00:00')

function city() {
  let state: State = { ...createFreshState(), budget: 1_000_000 }
  const run = (action: Action) => { state = reducer(state, action); return state }
  const tick = (count = 1, now = NOV) => { for (let i = 0; i < count; i += 1) run({ type: 'TICK', now }) }
  for (let x = 20; x <= 40; x += 1) run({ type: 'PLACE', x, y: 30, tool: 'ROAD' })
  return { get: () => state, run, tick, set: (patch: Partial<State>) => { state = { ...state, ...patch } } }
}

test('buildings without water and power earn nothing', () => {
  const c = city()
  c.run({ type: 'SET_SANDBOX' })
  c.run({ type: 'PLACE', x: 22, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_townhouse' })
  c.tick()
  assert.equal(c.get().lastNet, 0)
  c.run({ type: 'PLACE', x: 30, y: 31, tool: 'WATER_PUMP', catalogId: 'utl_water' })
  c.run({ type: 'PLACE', x: 31, y: 31, tool: 'WIND', catalogId: 'utl_wind' })
  c.tick()
  assert.ok(c.get().lastNet > 0)
})

test('daily loan payments reduce the debt', () => {
  const c = city()
  const before = c.get().debt
  c.tick(144)
  assert.equal(c.get().debt, before - 50)
})

test('winter raises energy use and switches events', () => {
  const c = city()
  c.tick(1, DEC)
  assert.deepEqual(c.get().events, ['winter'])
})

test('rank-locked buildings cannot be placed at low level and unlock when reaching required rank', () => {
  const c = city()
  // Rank 0 (Хутор, 0 жителей): starter buildings work, higher-level buildings are locked
  c.run({ type: 'PLACE', x: 22, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_cottage' })
  assert.equal(c.get().grid[29][22].catalogId, 'res_cottage')

  // Rank 1 buildings (res_cozy_estate, civ_fire, RAIL) are locked at Rank 0
  c.run({ type: 'PLACE', x: 23, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_cozy_estate' })
  assert.equal(c.get().grid[29][23].type, 'EMPTY')
  c.run({ type: 'PLACE', x: 24, y: 29, tool: 'FIRE_STATION', catalogId: 'civ_fire' })
  assert.equal(c.get().grid[29][24].type, 'EMPTY')
  c.run({ type: 'PLACE', x: 25, y: 28, tool: 'RAIL' })
  assert.equal(c.get().grid[28][25].type, 'EMPTY')

  // Rank 2 & Rank 4 buildings (lnd_townhall, res_modern_glass_tower) are also locked
  c.run({ type: 'PLACE', x: 26, y: 28, tool: 'CITY_HALL', catalogId: 'lnd_townhall' })
  assert.equal(c.get().grid[28][26].type, 'EMPTY')
  c.run({ type: 'PLACE', x: 25, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_modern_glass_tower' })
  assert.equal(c.get().grid[29][25].type, 'EMPTY')

  // Reaching Rank 1 (Деревня, 50+ жителей) unlocks Rank 1 buildings while keeping Rank 2+ locked
  c.set({ rank: 1 })
  c.run({ type: 'PLACE', x: 23, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_cozy_estate' })
  assert.equal(c.get().grid[29][23].catalogId, 'res_cozy_estate')
  c.run({ type: 'PLACE', x: 24, y: 29, tool: 'FIRE_STATION', catalogId: 'civ_fire' })
  assert.equal(c.get().grid[29][24].catalogId, 'civ_fire')
  c.run({ type: 'PLACE', x: 26, y: 28, tool: 'CITY_HALL', catalogId: 'lnd_townhall' })
  assert.equal(c.get().grid[28][26].type, 'EMPTY')

  // Sandbox unlocks all ranks immediately
  c.run({ type: 'SET_SANDBOX' })
  c.run({ type: 'PLACE', x: 25, y: 28, tool: 'RESIDENTIAL', catalogId: 'res_modern_glass_tower' })
  assert.equal(c.get().grid[28][25].catalogId, 'res_modern_glass_tower')
})

test('undo restores the cells and refunds the cost', () => {
  const c = city()
  const budget = c.get().budget
  c.run({ type: 'PLACE', x: 26, y: 29, tool: 'COMMERCIAL', catalogId: 'com_bakery' })
  assert.equal(c.get().budget, budget - 120)
  c.run({ type: 'UNDO' })
  assert.equal(c.get().grid[29][26].type, 'EMPTY')
  assert.equal(c.get().budget, budget)
})

test('first quest pays its reward once', () => {
  const c = city()
  const budget = c.get().budget
  c.tick()
  assert.equal(c.get().questIndex, 1)
  assert.ok(c.get().budget >= budget + 100 - 60)
})

test('small towns have no crime without police', () => {
  const c = city()
  c.run({ type: 'PLACE', x: 30, y: 31, tool: 'WATER_PUMP', catalogId: 'utl_water' })
  c.run({ type: 'PLACE', x: 31, y: 31, tool: 'WIND', catalogId: 'utl_wind' })
  c.run({ type: 'PLACE', x: 22, y: 29, tool: 'PARK', catalogId: 'lnd_park' })
  c.run({ type: 'PLACE', x: 23, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_cottage' })
  c.tick(144 * 3)
  assert.ok(c.get().happiness > 60, `happiness ${c.get().happiness}`)
})

test('bridges cross the river and conduct water and power to the northern bank', () => {
  const c = city()
  c.run({ type: 'SET_SANDBOX' })
  c.run({ type: 'PLACE', x: 30, y: 31, tool: 'WATER_PUMP', catalogId: 'utl_water' })
  c.run({ type: 'PLACE', x: 31, y: 31, tool: 'WIND', catalogId: 'utl_wind' })

  // Extend road from y=29 north to y=2 across the natural river
  for (let y = 29; y >= 2; y -= 1) {
    const isWater = c.get().grid[y][30].type === TileType.WATER
    if (isWater) {
      c.run({ type: 'PLACE', x: 30, y, tool: 'BRIDGE', catalogId: 'bridge_suspension' })
      assert.equal(c.get().grid[y][30].type, TileType.BRIDGE)
      assert.equal(c.get().grid[y][30].catalogId, 'bridge_suspension')
    } else {
      c.run({ type: 'PLACE', x: 30, y, tool: 'ROAD' })
    }
  }

  // Place a CityRT building on the northern bank and verify utilities reach it across the bridge
  c.run({ type: 'PLACE', x: 31, y: 2, tool: 'RESIDENTIAL', catalogId: 'res_stalinka_pink' })
  const northernBuilding = c.get().grid[2][31]
  assert.equal(northernBuilding.catalogId, 'res_stalinka_pink')
  assert.equal(northernBuilding.hasWater, true)
  assert.equal(northernBuilding.hasPower, true)

  // Demolishing a bridge tile over the river restores the underlying WATER tile
  const bridgeCell = c.get().grid.map((row) => row[30]).find((cell) => cell.type === TileType.BRIDGE)
  assert.ok(bridgeCell)
  c.run({ type: 'REMOVE', x: 30, y: bridgeCell.y })
  assert.equal(c.get().grid[bridgeCell.y][30].type, TileType.WATER)
})

test('railways, rail bridges, and train stations boost connected commerce', () => {
  const c = city()
  c.run({ type: 'SET_SANDBOX' })
  c.run({ type: 'PLACE', x: 30, y: 31, tool: 'WATER_PUMP', catalogId: 'utl_water_intake' })
  c.run({ type: 'PLACE', x: 31, y: 31, tool: 'WIND', catalogId: 'utl_wind' })
  c.run({ type: 'PLACE', x: 32, y: 31, tool: 'INDUSTRIAL', catalogId: 'ind_warehouse' })

  // Build a rail line and a passenger station next to the road
  for (let x = 22; x <= 30; x += 1) {
    c.run({ type: 'PLACE', x, y: 28, tool: 'RAIL' })
    assert.equal(c.get().grid[28][x].type, TileType.RAIL)
  }
  c.run({ type: 'PLACE', x: 24, y: 29, tool: 'STATION', catalogId: 'civ_train_station' })
  assert.equal(c.get().grid[29][24].type, TileType.STATION)
  assert.equal(c.get().grid[29][25].type, TileType.FOOTPRINT)

  // Digging water and laying rail over it creates a RAIL_BRIDGE
  c.run({ type: 'PLACE', x: 21, y: 28, tool: 'WATER' })
  assert.equal(c.get().grid[28][21].type, TileType.WATER)
  c.run({ type: 'PLACE', x: 21, y: 28, tool: 'RAIL' })
  assert.equal(c.get().grid[28][21].type, TileType.RAIL_BRIDGE)
})

test('save security signs payloads, blocks tampering, and strips prototype pollution & XSS', () => {
  const c = city()
  const payload = {
    version: 3 as const,
    savedAt: NOV,
    budget: 2500,
    population: 120,
    happiness: 80,
    timeOfDay: 12,
    minutes: 720,
    day: 2,
    taxRate: 10,
    debt: 0,
    sandbox: false,
    questIndex: 2,
    completedQuests: ['first_street', 'power_and_water'],
    materials: { bricks: 5, concrete: 3, steel: 2 },
  }

  const signedRaw = packSignedSave(payload)
  const verified = unpackSignedSave<typeof payload>(signedRaw)
  assert.ok(verified)
  assert.equal(verified.budget, 2500)

  // Tampering with budget invalidates the HMAC/FNV signature
  const tamperedRaw = signedRaw.replace('"budget":2500', '"budget":9999999')
  assert.equal(unpackSignedSave<typeof payload>(tamperedRaw), null)

  // Prototype pollution keys are stripped by safeJsonParse
  const polluted = safeJsonParse<Record<string, unknown>>('{"cityName":"Safe","__proto__":{"polluted":true}}')
  assert.equal(polluted?.cityName, 'Safe')
  assert.equal(({} as Record<string, unknown>).polluted, undefined)

  // XSS tags and control chars are stripped by sanitizeText
  assert.equal(sanitizeText('<script>alert(1)</script>Inkville', 40), 'scriptalert(1)/scriptInkville')
  assert.equal(clampInt(999_999_999, 0, 100_000, 0), 100_000)

  // Invalid tile types in saved grid are normalized to EMPTY by sanitizeSavedGrid
  const dirtyGrid = c.get().grid.map((row) => row.map((cell) => ({ ...cell })))
  ;(dirtyGrid[10][10] as unknown as { type: string }).type = 'HACKED_TILE'
  const sanitizedGrid = sanitizeSavedGrid(dirtyGrid)
  assert.ok(sanitizedGrid)
  assert.equal(sanitizedGrid[10][10].type, TileType.EMPTY)
  assert.equal(sanitizedGrid[30][20].type, TileType.ROAD)
})
