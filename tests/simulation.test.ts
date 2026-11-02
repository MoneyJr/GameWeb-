import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simulationTesting } from '../src/hooks/useCitySimulation'

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

test('rank-locked buildings cannot be placed outside sandbox', () => {
  const c = city()
  c.run({ type: 'PLACE', x: 25, y: 29, tool: 'RESIDENTIAL', catalogId: 'res_modern_glass_tower' })
  assert.equal(c.get().grid[29][25].type, 'EMPTY')
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
