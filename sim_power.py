import re

with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

recompute_logic = """function recomputeServices(grid: Grid): Grid {
  const roadDistance: number[][] = grid.map((r) => r.map(() => 0))
  const powerDistance: number[][] = grid.map((r) => r.map(() => 0))
  const queue: [number, number][] = []
  const powerQueue: [number, number][] = []
  
  let totalPower = 0
  const coals: [number, number][] = []
  const parks: [number, number][] = []

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TileType.WATER_PUMP) {
        roadDistance[cell.y][cell.x] = 1
        queue.push([cell.x, cell.y])
      }
      if (cell.type === TileType.WIND) {
        totalPower += 15
        powerDistance[cell.y][cell.x] = 1
        powerQueue.push([cell.x, cell.y])
      }
      if (cell.type === TileType.COAL) {
        totalPower += 60
        coals.push([cell.x, cell.y])
        powerDistance[cell.y][cell.x] = 1
        powerQueue.push([cell.x, cell.y])
      }
      if (cell.type === TileType.PARK) {
        parks.push([cell.x, cell.y])
      }
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

  // Power BFS
  for (let head = 0; head < powerQueue.length; head += 1) {
    const [x, y] = powerQueue[head]
    const distance = powerDistance[y][x]
    for (const [dx, dy] of NEIGHBOR_STEPS) {
      const nx = x + dx
      const ny = y + dy
      if (inBounds(nx, ny) && powerDistance[ny][nx] === 0) {
        // Power travels along roads OR adjacent tiles
        powerDistance[ny][nx] = distance + 1
        powerQueue.push([nx, ny])
      }
    }
  }

  const isWateredRoad = (x: number, y: number): boolean => isRoad(x, y) && roadDistance[y][x] > 0

  return grid.map((row) =>
    row.map((cell) => {
      const occupied = cell.type !== TileType.EMPTY && cell.type !== TileType.ROAD
      let hasWater = false
      if (cell.type === TileType.WATER_PUMP) hasWater = true
      else if (cell.type === TileType.ROAD) hasWater = isWateredRoad(cell.x, cell.y)
      else if (occupied) {
        hasWater = NEIGHBOR_STEPS.some(([dx, dy]) => isWateredRoad(cell.x + dx, cell.y + dy))
      }
      
      // Smog calculation
      let smogCount = 0
      for (const [cx, cy] of coals) {
        if (Math.abs(cell.x - cx) + Math.abs(cell.y - cy) <= 5) smogCount++
      }
      for (const [px, py] of parks) {
        if (Math.abs(cell.x - px) + Math.abs(cell.y - py) <= 1) smogCount--
      }
      const smog = smogCount > 0

      // Power calculation
      let hasPower = false
      if (cell.type === TileType.WIND || cell.type === TileType.COAL) hasPower = true
      else if (powerDistance[cell.y][cell.x] > 0) {
        // Assume connected to power grid
        hasPower = true
      }

      if (hasWater === cell.hasWater && hasPower === cell.hasPower && smog === cell.smog && cell.style === (cell as any).style) return cell
      return { ...cell, hasWater, hasPower, smog }
    }),
  )
}

function countTiles(grid: Grid): CityCounts"""

sim = re.sub(r'function recomputeServices.*?function countTiles\(grid: Grid\): CityCounts', recompute_logic, sim, flags=re.DOTALL)

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)
