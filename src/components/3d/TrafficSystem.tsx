import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GRID_SIZE, TileType } from '../../types/city'
import type { Grid } from '../../types/city'
import { vehicleHeadlightBeamMaterial, vehicleHeadlightMaterial, vehicleTaillightMaterial } from './primitives'

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
const GLASS_COLORS = ['#1e293b', '#263b50', '#263744', '#344454', '#23333b']
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
  const carsRef = useRef<CarState[]>(Array.from({ length: CAR_COUNT }, (_, index) => ({
    routeIndex: 0, segment: 0, reverse: false, progress: 0, colorIndex: 0, active: false, delivery: false,
    vehicleType: index < 2 ? 'truck' as const : index < 4 ? 'bus' as const : 'car' as const,
  })))
  const groupRef = useRef<THREE.Group>(null)
  // Local +Z is the vehicle's forward axis. The rounded silhouette keeps the
  // cars readable at city scale without reducing them to a single cuboid.
  const bodyGeometry = useMemo(() => new RoundedBoxGeometry(1.48, 0.3, 0.72, 3, 0.075), [])
  const cabinGeometry = useMemo(() => new RoundedBoxGeometry(0.9, 0.31, 0.61, 3, 0.085), [])
  const roofGeometry = useMemo(() => new RoundedBoxGeometry(0.76, 0.045, 0.58, 2, 0.02), [])
  const sideWindowGeometry = useMemo(() => new THREE.PlaneGeometry(0.31, 0.2), [])
  const windowHighlightGeometry = useMemo(() => new THREE.PlaneGeometry(0.025, 0.15), [])
  const slopedGlassGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.29, 0)
    shape.lineTo(0.29, 0)
    shape.lineTo(0.23, 0.2)
    shape.lineTo(-0.23, 0.2)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), [])
  const hubGeometry = useMemo(() => new THREE.CylinderGeometry(0.075, 0.075, 0.084, 12), [])
  const headlightGeometry = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), [])
  const lightBarGeometry = useMemo(() => new RoundedBoxGeometry(0.29, 0.035, 0.025, 2, 0.012), [])
  const bumperGeometry = useMemo(() => new RoundedBoxGeometry(0.66, 0.07, 0.075, 2, 0.025), [])
  const beamGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.1, 0)
    shape.lineTo(0.1, 0)
    shape.lineTo(0.43, -2)
    shape.lineTo(-0.43, -2)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(0.5, 16), [])
  const bodyMaterials = useMemo(() => CAR_COLORS.map((color) => new THREE.MeshToonMaterial({ color })), [])
  const cabinMaterials = useMemo(() => GLASS_COLORS.map((color) => new THREE.MeshToonMaterial({ color, emissive: '#fef08a', emissiveIntensity: 0.035 })), [])
  const trimMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#202329' }), [])
  const windowHighlightMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#91b9c5', transparent: true, opacity: 0.7, toneMapped: false }), [])
  const tireMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#18181b' }), [])
  const hubMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#cbd5e1' }), [])
  const truckMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#9a9a91' }), [])
  const busMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#e0ae28' }), [])
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), [])
  const headlightBeamMaterial = vehicleHeadlightBeamMaterial

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
        const body = mesh.getObjectByName('vehicle-body') as THREE.Mesh
        const cabin = mesh.getObjectByName('vehicle-cabin') as THREE.Mesh
        body.material = car.vehicleType === 'truck' ? truckMaterial : car.vehicleType === 'bus' ? busMaterial : bodyMaterials[car.colorIndex]
        cabin.material = cabinMaterials[car.colorIndex]
        body.scale.set(car.vehicleType === 'bus' ? 1.25 : 1, 1, car.vehicleType === 'bus' ? 1.7 : 1)
        cabin.scale.set(car.vehicleType === 'bus' ? 1.1 : 1, 1, car.vehicleType === 'bus' ? 1.3 : 1)
        const roof = mesh.getObjectByName('vehicle-roof') as THREE.Mesh | undefined
        if (roof) roof.material = car.vehicleType === 'truck' ? truckMaterial : car.vehicleType === 'bus' ? busMaterial : bodyMaterials[car.colorIndex]
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
          {/* Contact shadow and low chassis */}
          <mesh geometry={shadowGeometry} material={shadowMaterial} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6, 0.9, 1]} userData={{ noInkOutline: true }} />
          <mesh name="vehicle-body" geometry={bodyGeometry} position={[0, 0.32, 0]} castShadow receiveShadow><primitive object={bodyMaterials[0]} attach="material" /><Edges color="#211e1a" /></mesh>
          <mesh name="vehicle-cabin" geometry={cabinGeometry} position={[0, 0.59, -0.13]} castShadow receiveShadow><primitive object={cabinMaterials[0]} attach="material" /><Edges color="#211e1a" /></mesh>
          {/* Sloped front and fastback glazing, plus four side panes */}
          <mesh geometry={slopedGlassGeometry} material={cabinMaterials[0]} position={[0, 0.51, 0.19]} rotation={[-0.62, 0, 0]} />
          <mesh geometry={slopedGlassGeometry} material={cabinMaterials[0]} position={[0, 0.51, -0.43]} rotation={[0.62, Math.PI, 0]} />
          {[-1, 1].flatMap((side) => [-1, 1].map((half) => (
            <group key={`side-window-${side}-${half}`} position={[side * 0.307, 0.6, -0.13 + half * 0.19]} rotation={[0, side * Math.PI / 2, 0]}>
              <mesh geometry={sideWindowGeometry} material={cabinMaterials[0]} />
              <mesh geometry={windowHighlightGeometry} material={windowHighlightMaterial} position={[-0.105, 0, 0.002]} />
            </group>
          )))}
          <mesh name="vehicle-roof" geometry={roofGeometry} position={[0, 0.77, -0.15]} castShadow><primitive object={bodyMaterials[0]} attach="material" /><Edges color="#211e1a" /></mesh>
          {/* Wheel wells are indicated by shadow-dark faceted arches and proper wheels. */}
          {[-1, 1].flatMap((side) => [-1, 1].map((axle) => (
            <group key={`wheel-${side}-${axle}`} position={[side * 0.36, 0.15, axle * 0.48]} rotation={[0, 0, Math.PI / 2]}>
              <mesh geometry={wheelGeometry} material={tireMaterial} castShadow receiveShadow />
              <mesh geometry={hubGeometry} material={hubMaterial} position={[0, side * 0.045, 0]} />
            </group>
          )))}
          <mesh geometry={bumperGeometry} material={trimMaterial} position={[0, 0.24, 0.735]} />
          <mesh geometry={bumperGeometry} material={trimMaterial} position={[0, 0.24, -0.735]} />
          <mesh geometry={headlightGeometry} material={vehicleHeadlightMaterial} position={[-0.25, 0.34, 0.69]} />
          <mesh geometry={headlightGeometry} material={vehicleHeadlightMaterial} position={[0.25, 0.34, 0.69]} />
          <mesh geometry={lightBarGeometry} material={vehicleTaillightMaterial} position={[0, 0.36, -0.69]} />
          {[-0.25, 0.25].map((x) => <mesh key={`beam-${x}`} geometry={beamGeometry} position={[x, 0.026, 0.78]} rotation={[-Math.PI / 2, 0, 0]} material={headlightBeamMaterial} userData={{ noInkOutline: true }} renderOrder={2} />)}
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
