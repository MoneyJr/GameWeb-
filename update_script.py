import os

# 1. Create TrafficSystem.tsx
traffic_code = """import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { Grid, TileType } from '../../types/city'
import { cellToWorld } from '../../lib/utils'

interface TrafficSystemProps {
  grid: Grid
}

const CAR_COUNT = 15
const CAR_SPEED = 1.2 // tiles per second
const CAR_COLORS = ['#ff5a4d', '#4fa8e8', '#e3a84f', '#6fe37f', '#dcd6c2']

const DIRS = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
]

interface CarState {
  x: number
  y: number
  dirIndex: number
  progress: number
  color: string
  active: boolean
}

export function TrafficSystem({ grid }: TrafficSystemProps) {
  const isRoad = (x: number, y: number) => {
    return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length && grid[y][x].type === TileType.ROAD
  }

  const roads = useMemo(() => {
    const list: { x: number; y: number }[] = []
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === TileType.ROAD) {
          list.push({ x: cell.x, y: cell.y })
        }
      }
    }
    return list
  }, [grid])

  const shouldSpawn = useMemo(() => {
    let hasRes = false
    let hasComOrInd = false
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === TileType.RESIDENTIAL) hasRes = true
        if (cell.type === TileType.COMMERCIAL || cell.type === TileType.INDUSTRIAL) hasComOrInd = true
      }
    }
    return hasRes && hasComOrInd && roads.length > 0
  }, [grid, roads.length])

  const carsRef = useRef<CarState[]>(
    Array.from({ length: CAR_COUNT }, () => ({
      x: 0,
      y: 0,
      dirIndex: 0,
      progress: 0,
      color: CAR_COLORS[0],
      active: false,
    })),
  )

  const groupRef = useRef<THREE.Group>(null)
  
  const carGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.12, 0.3), [])
  const mats = useMemo(() => CAR_COLORS.map(c => new THREE.MeshBasicMaterial({ color: c })), [])
  const headlightGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.04, 0.02), [])
  const headlightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffecaa' }), [])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    for (let i = 0; i < CAR_COUNT; i++) {
      const car = carsRef.current[i]
      const mesh = group.children[i] as THREE.Group

      if (!shouldSpawn) {
        if (car.active) {
          car.active = false
          mesh.visible = false
        }
        continue
      }

      if (!car.active) {
        if (Math.random() < 0.02 && roads.length > 0) {
          const road = roads[Math.floor(Math.random() * roads.length)]
          car.x = road.x
          car.y = road.y
          const validDirs = [0, 1, 2, 3].filter(d => isRoad(road.x + DIRS[d].dx, road.y + DIRS[d].dy))
          if (validDirs.length > 0) {
            car.dirIndex = validDirs[Math.floor(Math.random() * validDirs.length)]
            car.progress = 0
            car.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
            car.active = true
            mesh.visible = true
            const matIndex = CAR_COLORS.indexOf(car.color)
            const bodyMesh = mesh.children[0] as THREE.Mesh
            bodyMesh.material = mats[matIndex]
          }
        }
        continue
      }

      car.progress += delta * CAR_SPEED
      if (car.progress >= 1) {
        car.progress -= 1
        car.x += DIRS[car.dirIndex].dx
        car.y += DIRS[car.dirIndex].dy

        if (!isRoad(car.x, car.y)) {
          car.active = false
          mesh.visible = false
          continue
        }

        const forwardDir = car.dirIndex
        const leftDir = (car.dirIndex + 3) % 4
        const rightDir = (car.dirIndex + 1) % 4
        const backDir = (car.dirIndex + 2) % 4

        const options = []
        if (isRoad(car.x + DIRS[forwardDir].dx, car.y + DIRS[forwardDir].dy)) options.push(forwardDir)
        if (isRoad(car.x + DIRS[leftDir].dx, car.y + DIRS[leftDir].dy)) options.push(leftDir)
        if (isRoad(car.x + DIRS[rightDir].dx, car.y + DIRS[rightDir].dy)) options.push(rightDir)

        if (options.length > 0) {
          car.dirIndex = options[Math.floor(Math.random() * options.length)]
        } else {
          car.dirIndex = backDir
        }
      }

      const fromPos = cellToWorld(car.x, car.y)
      const toPos = cellToWorld(car.x + DIRS[car.dirIndex].dx, car.y + DIRS[car.dirIndex].dy)
      
      const px = fromPos[0] + (toPos[0] - fromPos[0]) * car.progress
      const pz = fromPos[2] + (toPos[2] - fromPos[2]) * car.progress
      
      const angle = Math.atan2(DIRS[car.dirIndex].dx, DIRS[car.dirIndex].dy)
      const offsetX = Math.cos(angle) * 0.12
      const offsetZ = -Math.sin(angle) * 0.12

      mesh.position.set(px + offsetX, 0.06, pz + offsetZ)
      mesh.rotation.y = angle
    }
  })

  return (
    <group ref={groupRef}>
      {carsRef.current.map((_, i) => (
        <group key={i} visible={false}>
          <mesh geometry={carGeo}>
            <Edges color="#14110d" />
          </mesh>
          <mesh geometry={headlightGeo} material={headlightMat} position={[-0.05, 0, 0.15]} />
          <mesh geometry={headlightGeo} material={headlightMat} position={[0.05, 0, 0.15]} />
        </group>
      ))}
    </group>
  )
}
"""
with open('src/components/3d/TrafficSystem.tsx', 'w') as f:
    f.write(traffic_code)

# 2. Modify CityScene.tsx to include TrafficSystem
with open('src/components/3d/CityScene.tsx', 'r') as f:
    content = f.read()

if 'import { TrafficSystem }' not in content:
    content = content.replace('import { MapControls } from \'@react-three/drei\'', 'import { MapControls } from \'@react-three/drei\'\nimport { TrafficSystem } from \'./TrafficSystem\'')
    if '<TrafficSystem grid={grid} />' not in content:
        content = content.replace('<World grid={grid} />', '<World grid={grid} />\n      <TrafficSystem grid={grid} />')
    with open('src/components/3d/CityScene.tsx', 'w') as f:
        f.write(content)

# 3. Modify useCitySimulation.ts to add demands
with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim_content = f.read()

if 'demands:' not in sim_content:
    demands_logic = """
  const demands = useMemo(() => {
    const counts = countTiles(state.grid)
    const jobs = counts.wateredShops * 6 + counts.wateredFactories * 12
    const unemployed = Math.max(0, state.population - jobs)
    const freeJobs = Math.max(0, jobs - state.population)
    const resDemand = Math.min(100, (freeJobs / 20) * 100)
    const shopsNeeded = Math.floor(state.population / 20)
    const comDemand = Math.min(100, Math.max(0, (shopsNeeded - counts.shops) / 5) * 100)
    const indDemand = Math.min(100, (unemployed / 20) * 100)
    return { residential: resDemand, commercial: comDemand, industrial: indDemand }
  }, [state.grid, state.population])
"""
    sim_content = sim_content.replace('const waterStats =', demands_logic + '\n  const waterStats =')
    sim_content = sim_content.replace('waterStats,', 'demands,\n    waterStats,')
    with open('src/hooks/useCitySimulation.ts', 'w') as f:
        f.write(sim_content)

# 4. Modify TopBar.tsx to display demands
with open('src/components/ui/TopBar.tsx', 'r') as f:
    tb_content = f.read()

if 'demands' not in tb_content:
    tb_content = tb_content.replace('interface TopBarProps {', 'interface TopBarProps {\n  demands: { residential: number; commercial: number; industrial: number }\n')
    tb_content = tb_content.replace('  day,\n  paused,', '  day,\n  demands,\n  paused,')
    rci_bars = """
        <div id="stat-rci" className="flex items-center gap-1.5 px-4 py-1.5 h-[34px]">
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-leaf transition-all duration-300" style={{ height: `${demands.residential}%` }} />
          </div>
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-sky transition-all duration-300" style={{ height: `${demands.commercial}%` }} />
          </div>
          <div className="flex flex-col justify-end w-2 h-full bg-ink/10 rounded overflow-hidden">
            <div className="w-full bg-amber-500 transition-all duration-300" style={{ height: `${demands.industrial}%` }} />
          </div>
        </div>
"""
    tb_content = tb_content.replace('<div id="stat-water"', rci_bars + '\n        <div id="stat-water"')
    with open('src/components/ui/TopBar.tsx', 'w') as f:
        f.write(tb_content)

print("Updates applied.")
