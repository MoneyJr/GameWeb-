import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { GRID_SIZE, TileType } from '../../types/city'
import type { Grid } from '../../types/city'

interface RoadCell { x: number; y: number }
interface CarRoute { path: RoadCell[]; kind: 'passenger' | 'delivery' }
interface CarState {
  routeIndex: number
  segment: number
  reverse: boolean
  progress: number
  colorIndex: number
  active: boolean
  delivery: boolean
}

const CAR_COUNT = 12
const CAR_SPEED = 1.15
const CAR_COLORS = ['#bf5140', '#4e7890', '#d49a45', '#728952', '#d5c7a9']
const CABIN_COLORS = ['#ead8b5', '#c9d9dc', '#f1d28e', '#dce5d4', '#f1e6cd']
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]]

function cellToWorld(x: number, y: number): [number, number, number] {
  const offset = (gridSize - 1) / 2
  return [x - offset, 0, y - offset]
}

// GRID_SIZE is fixed for this simulation; keeping the world conversion aligned with CityScene.
const gridSize = GRID_SIZE

function buildRoadRoutes(grid: Grid): CarRoute[] {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const isRoad = (x: number, y: number) => y >= 0 && y < height && x >= 0 && x < width && grid[y][x].type === TileType.ROAD
  const homes: RoadCell[] = []
  const destinations: { x: number; y: number; kind: 'passenger' | 'delivery' }[] = []
  const factories: RoadCell[] = []

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type !== TileType.RESIDENTIAL && cell.type !== TileType.COMMERCIAL && cell.type !== TileType.INDUSTRIAL) continue
      for (const [dx, dy] of NEIGHBORS) {
        const x = cell.x + dx
        const y = cell.y + dy
        if (!isRoad(x, y)) continue
        const port = { x, y }
        if (cell.type === TileType.RESIDENTIAL) {
          if (!homes.some((item) => item.x === x && item.y === y)) homes.push(port)
        } else if (cell.type === TileType.INDUSTRIAL) {
          if (!factories.some((item) => item.x === x && item.y === y)) factories.push(port)
        } else if (!destinations.some((item) => item.x === x && item.y === y && item.kind === 'passenger')) destinations.push({ ...port, kind: 'passenger' })
      }
    }
  }
  if ((homes.length === 0 && factories.length === 0) || destinations.length === 0) return []

  const routes: CarRoute[] = []
  const routeKeys = new Set<string>()
  for (const { source, kind } of [...homes.map(source => ({ source, kind: 'passenger' as const })), ...factories.map(source => ({ source, kind: 'delivery' as const }))]) {
    const targets = destinations.filter((destination) => destination.kind === 'passenger' || kind === 'delivery')
    if (!targets.length) continue
    const home = source
    const startKey = `${home.x},${home.y}`
    const queue: RoadCell[] = [home]
    const previous = new Map<string, string | null>([[startKey, null]])
    let found: RoadCell | undefined
    for (let head = 0; head < queue.length && !found; head += 1) {
      const current = queue[head]
      if (targets.some((d) => d.x === current.x && d.y === current.y)) {
        found = current
        break
      }
      for (const [dx, dy] of NEIGHBORS) {
        const x = current.x + dx
        const y = current.y + dy
        const key = `${x},${y}`
        if (!isRoad(x, y) || previous.has(key)) continue
        previous.set(key, `${current.x},${current.y}`)
        queue.push({ x, y })
      }
    }
    if (!found) continue

    const path: RoadCell[] = []
    let key: string | null = `${found.x},${found.y}`
    while (key !== null) {
      const [x, y] = key.split(',').map(Number)
      path.push({ x, y })
      key = previous.get(key) ?? null
    }
    path.reverse()
    if (path.length < 2) continue
    const forwardKey = path.map((p) => `${p.x},${p.y}`).join('|')
    const reverseKey = [...path].reverse().map((p) => `${p.x},${p.y}`).join('|')
    const canonicalKey = forwardKey < reverseKey ? forwardKey : reverseKey
    if (routeKeys.has(canonicalKey)) continue
    routeKeys.add(canonicalKey)
    routes.push({ path, kind })
  }
  return routes
}

export function TrafficSystem({ grid }: { grid: Grid }) {
  const routes = useMemo(() => buildRoadRoutes(grid), [grid])
  const carsRef = useRef<CarState[]>(Array.from({ length: CAR_COUNT }, () => ({
    routeIndex: 0, segment: 0, reverse: false, progress: 0, colorIndex: 0, active: false, delivery: false,
  })))
  const groupRef = useRef<THREE.Group>(null)
  const bodyGeometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.13, 0.46), [])
  const cabinGeometry = useMemo(() => new THREE.BoxGeometry(0.21, 0.13, 0.25), [])
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(0.055, 0.055, 0.045, 8), [])
  const lightGeometry = useMemo(() => new THREE.BoxGeometry(0.055, 0.035, 0.018), [])
  const bodyMaterials = useMemo(() => CAR_COLORS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.82 })), [])
  const cabinMaterials = useMemo(() => CABIN_COLORS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 })), [])
  const wheelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 1 }), [])
  const lightMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff1b8' }), [])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < CAR_COUNT; i += 1) {
      const car = carsRef.current[i]
      const mesh = group.children[i] as THREE.Group
      if (routes.length === 0 || car.routeIndex >= routes.length) {
        car.active = false
        mesh.visible = false
        continue
      }
      if (!car.active) {
        if (Math.random() > 0.025) continue
        car.routeIndex = Math.floor(Math.random() * routes.length)
        car.delivery = routes[car.routeIndex].kind === 'delivery'
        car.reverse = Math.random() < 0.5
        car.segment = car.reverse ? routes[car.routeIndex].path.length - 1 : 0
        car.progress = 0
        car.colorIndex = Math.floor(Math.random() * CAR_COLORS.length)
        const body = mesh.children[0] as THREE.Mesh
        const cabin = mesh.children[1] as THREE.Mesh
        body.material = bodyMaterials[car.colorIndex]
        cabin.material = cabinMaterials[car.colorIndex]
        if (mesh.children[8]) mesh.children[8].visible = car.delivery
        car.active = true
        mesh.visible = true
      }

      const path = routes[car.routeIndex].path
      car.progress += dt * CAR_SPEED
      while (car.progress >= 1) {
        car.progress -= 1
        if (!car.reverse) {
          if (car.segment >= path.length - 2) { car.reverse = true; car.segment = path.length - 1 }
          else car.segment += 1
        } else if (car.segment <= 1) {
          car.reverse = false
          car.segment = 0
        } else car.segment -= 1
      }

      const fromIndex = car.reverse ? car.segment : car.segment
      const toIndex = car.reverse ? car.segment - 1 : car.segment + 1
      const fromCell = path[fromIndex]
      const toCell = path[toIndex]
      if (!fromCell || !toCell) { car.active = false; mesh.visible = false; continue }
      const from = cellToWorld(fromCell.x, fromCell.y)
      const to = cellToWorld(toCell.x, toCell.y)
      const dx = to[0] - from[0]
      const dz = to[2] - from[2]
      const lane = car.colorIndex % 2 === 0 ? 0.1 : -0.1
      mesh.position.set(from[0] + dx * car.progress + dz * lane, 0.055, from[2] + dz * car.progress - dx * lane)
      mesh.rotation.y = Math.atan2(dx, dz)
    }
  })

  return (
    <group ref={groupRef}>
      {carsRef.current.map((_, i) => (
        <group key={i} visible={false}>
          <mesh geometry={bodyGeometry} castShadow receiveShadow><primitive object={bodyMaterials[0]} attach="material" /><Edges color="#211e1a" /></mesh>
          <mesh geometry={cabinGeometry} position={[0, 0.11, -0.015]} castShadow receiveShadow><primitive object={cabinMaterials[0]} attach="material" /><Edges color="#211e1a" /></mesh>
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <mesh key={`${x}:${z}`} geometry={wheelGeometry} material={wheelMaterial} position={[x * 0.155, -0.025, z * 0.145]} rotation={[0, 0, Math.PI / 2]} castShadow />
          )))}
          <mesh geometry={lightGeometry} material={lightMaterial} position={[-0.085, 0.035, 0.235]} />
          <mesh geometry={lightGeometry} material={lightMaterial} position={[0.085, 0.035, 0.235]} />
          <mesh visible={false} position={[0, 0.16, -0.01]}><boxGeometry args={[0.2, 0.1, 0.16]} /><meshStandardMaterial color="#e3dbca" /><Edges color="#211e1a" /></mesh>
        </group>
      ))}
    </group>
  )
}
