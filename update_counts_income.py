import re

with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Update CityCounts
if 'parks:' not in sim:
    sim = sim.replace('pumps: number', 'pumps: number\n  parks: number\n  wind: number\n  coal: number\n  poweredConsumers: number\n  parkedHouses: number\n  smogHouses: number')
    sim = sim.replace('pumps: 0,', 'pumps: 0,\n    parks: 0,\n    wind: 0,\n    coal: 0,\n    poweredConsumers: 0,\n    parkedHouses: 0,\n    smogHouses: 0,')

counts_switch_old = """      switch (cell.type) {
        case TileType.ROAD:
          counts.roads += 1
          continue
        case TileType.WATER_PUMP:
          counts.pumps += 1
          continue
        case TileType.RESIDENTIAL:
          counts.houses += 1
          counts.houseCapacity += RESIDENTS_PER_HOUSE * cell.level
          if (cell.hasWater) counts.wateredCapacity += RESIDENTS_PER_HOUSE * cell.level
          break
        case TileType.COMMERCIAL:
          counts.shops += 1
          if (cell.hasWater) counts.wateredShops += 1
          break
        case TileType.INDUSTRIAL:
          counts.factories += 1
          if (cell.hasWater) counts.wateredFactories += 1
          break
        default:
          continue
      }
      counts.consumers += 1
      if (cell.hasWater) counts.wateredConsumers += 1"""

counts_switch_new = """      switch (cell.type) {
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
        case TileType.COAL:
          counts.coal += 1
          continue
        case TileType.RESIDENTIAL:
          counts.houses += 1
          counts.houseCapacity += RESIDENTS_PER_HOUSE * cell.level
          if (cell.hasWater) counts.wateredCapacity += RESIDENTS_PER_HOUSE * cell.level
          if (cell.smog) counts.smogHouses += 1
          break
        case TileType.COMMERCIAL:
          counts.shops += 1
          if (cell.hasWater) counts.wateredShops += 1
          break
        case TileType.INDUSTRIAL:
          counts.factories += 1
          if (cell.hasWater) counts.wateredFactories += 1
          break
        default:
          continue
      }
      counts.consumers += 1
      if (cell.hasWater) counts.wateredConsumers += 1
      if (cell.hasPower) counts.poweredConsumers += 1"""

sim = sim.replace(counts_switch_old, counts_switch_new)

# Power assignment logic in recomputeServices
sim = sim.replace('// Power calculation\n      let hasPower = false\n      if (cell.type === TileType.WIND || cell.type === TileType.COAL) hasPower = true\n      else if (powerDistance[cell.y][cell.x] > 0) {\n        // Assume connected to power grid\n        hasPower = true\n      }',
'''// Power is global for now, based on totalPower
      let hasPower = false
      if (cell.type === TileType.WIND || cell.type === TileType.COAL) hasPower = true
      else if (['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'].includes(cell.type)) {
        hasPower = totalPower > 0
        totalPower -= 1
      }
''')

# Fix parkedHouses count
# Add parked check in recomputeServices
sim = sim.replace('const smog = smogCount > 0', 'const smog = smogCount > 0\n      const parked = parks.some(([px, py]) => Math.abs(cell.x - px) + Math.abs(cell.y - py) <= 1)')
sim = sim.replace('return { ...cell, hasWater, hasPower, smog }', 'return { ...cell, hasWater, hasPower, smog, parked }')
sim = sim.replace('if (cell.smog) counts.smogHouses += 1', 'if (cell.smog) counts.smogHouses += 1\n          if ((cell as any).parked) counts.parkedHouses += 1')

# Income
sim = sim.replace('const taxes = Math.floor(population * taxedShare)', 'const taxes = Math.floor(population * taxedShare * (1 + (counts.parkedHouses / max(1, counts.houses)) * 0.1))')
sim = sim.replace('const upkeep = counts.roads * 0.2 + counts.pumps * 1', 'const upkeep = counts.roads * 0.2 + counts.pumps * 1 + counts.parks * 2 + counts.wind * 5 + counts.coal * 10')
sim = sim.replace('max(1, counts.houses)', 'Math.max(1, counts.houses)')

# Happiness
sim = sim.replace('return Math.round(100 - dryShare * 70)', '''
  let h = 100 - dryShare * 70
  if (counts.houses > 0) {
    h -= (counts.smogHouses / counts.houses) * 20
    h += (counts.parkedHouses / counts.houses) * 15
  }
  return Math.round(Math.min(100, Math.max(0, h)))
''')

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)
