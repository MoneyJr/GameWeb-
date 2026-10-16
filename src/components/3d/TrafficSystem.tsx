import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { GRID_SIZE, TileType } from '../../types/city'
import type { Grid } from '../../types/city'
import { vehicleHeadlightBeamMaterial, vehicleTaillightMaterial } from './primitives'
import { prepareModel } from './ModelAsset'

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
  vehicleType: 'car' | 'truck' | 'bus'
}

const CAR_COUNT = 12
const CAR_SPEED = 1.15
const CAR_COLORS = ['#991b1b', '#1e40af', '#d97706', '#334155', '#496b59']
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

export function TrafficSystem({ grid, minutes }: { grid: Grid; minutes: number }) {
  const isDark = minutes < 360 || minutes >= 1200
  const routes = useMemo(() => buildRoadRoutes(grid), [grid])
  const carScene = useGLTF('/models/city-pack-car.glb').scene
  const pickupScene = useGLTF('/models/city-pack-pickup.glb').scene
  const busScene = useGLTF('/models/city-pack-bus.glb').scene
  const carModels = useMemo(() => CAR_COLORS.map((color) => prepareModel(carScene, [0.9, 0.34, 0.42], true, color)), [carScene])
  const pickupModel = useMemo(() => prepareModel(pickupScene, [1.02, 0.42, 0.48], true), [pickupScene])
  const busModel = useMemo(() => prepareModel(busScene, [1.12, 0.46, 0.48], true), [busScene])
  const carsRef = useRef<CarState[]>(Array.from({ length: CAR_COUNT }, (_, index) => ({
    routeIndex: 0, segment: 0, reverse: false, progress: 0, colorIndex: 0, active: false, delivery: false,
    vehicleType: index < 2 ? 'truck' as const : index < 4 ? 'bus' as const : 'car' as const,
  })))
  const vehicleModels = useMemo(() => carsRef.current.map((car, index) => {
    const source = car.vehicleType === 'truck' ? pickupModel : car.vehicleType === 'bus' ? busModel : carModels[index % carModels.length]
    return source.clone(true)
  }), [busModel, carModels, pickupModel])
  const groupRef = useRef<THREE.Group>(null)
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(0.065, 0.065, 0.04, 8), [])
  const lightBarGeometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.025, 0.02), [])
  const beamGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.045, 0)
    shape.lineTo(0.045, 0)
    shape.lineTo(0.17, -2)
    shape.lineTo(-0.17, -2)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  const shadowGeometry = useMemo(() => new THREE.PlaneGeometry(0.9, 0.45), [])
  const headlightGeometry = useMemo(() => new THREE.SphereGeometry(0.035, 8, 6), [])
  const tireMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#18181b' }), [])
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), [])
  const frontLampMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#cbd5e1', emissive: '#000000', emissiveIntensity: 0 }), [])
  const rearLampMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#ef4444', emissive: '#000000', emissiveIntensity: 0 }), [])
  const headlightBeamMaterial = vehicleHeadlightBeamMaterial

  useEffect(() => {
    frontLampMaterial.color.set(isDark ? '#fef08a' : '#cbd5e1')
    frontLampMaterial.emissive.set(isDark ? '#fef08a' : '#000000')
    frontLampMaterial.emissiveIntensity = isDark ? 1 : 0
    rearLampMaterial.emissive.set(isDark ? '#ef4444' : '#000000')
    rearLampMaterial.emissiveIntensity = isDark ? 0.8 : 0
  }, [frontLampMaterial, isDark, rearLampMaterial])

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
        const trailer = mesh.getObjectByName('vehicle-trailer')
        if (trailer) trailer.visible = car.vehicleType === 'truck'
        car.active = true
        mesh.visible = true
      }

      const path = routes[car.routeIndex].path
      const nextRoad = path[Math.min(car.segment + 1, path.length - 1)]
      const nextDegree = nextRoad ? NEIGHBORS.reduce((sum, [dx, dy]) => sum + (grid[nextRoad.y + dy]?.[nextRoad.x + dx]?.type === TileType.ROAD ? 1 : 0), 0) : 0
      const braking = nextDegree >= 3 && car.progress > 0.45 ? 0.34 : 1
      car.progress += dt * CAR_SPEED * braking
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
          <primitive object={vehicleModels[i]} />
          {/* Lightweight contact shadow and non-lighting headlamp accents. */}
          <mesh geometry={shadowGeometry} material={shadowMaterial} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noInkOutline: true }} />
          <mesh geometry={lightBarGeometry} material={vehicleTaillightMaterial} position={[0, 0.13, -0.45]} />
          {[-1, 1].map((side) => (
            <group key={`lamps-${side}`}>
              <mesh geometry={headlightGeometry} material={frontLampMaterial} position={[side * 0.13, 0.14, 0.43]} />
              <mesh geometry={headlightGeometry} material={rearLampMaterial} position={[side * 0.13, 0.14, -0.43]} />
            </group>
          ))}
          {[-0.1, 0.1].map((x) => <mesh key={`beam-${x}`} visible={isDark} geometry={beamGeometry} position={[x, 0.02, 0.5]} rotation={[-Math.PI / 2, 0, 0]} material={headlightBeamMaterial} userData={{ noInkOutline: true }} renderOrder={2} />)}
          {/* Small city vans/trucks reuse the silhouette with a separate trailer. */}
          <mesh visible={false} position={[0, 0.16, -0.01]}><boxGeometry args={[0.2, 0.1, 0.16]} /><meshToonMaterial color="#e3dbca" /><Edges color="#211e1a" /></mesh>
          <group name="vehicle-trailer" visible={false} position={[0, 0.2, -1.02]}>
            <mesh><boxGeometry args={[0.62, 0.32, 0.8]} /><meshToonMaterial color="#aeb1a9" /><Edges color="#211e1a" /></mesh>
            {[-1, 1].map((side) => <mesh key={side} geometry={wheelGeometry} material={tireMaterial} position={[side * 0.31, -0.12, -0.12]} rotation={[0, 0, Math.PI / 2]} />)}
          </group>
        </group>
      ))}
    </group>
  )
}
