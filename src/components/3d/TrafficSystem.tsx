import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID_SIZE, TileType } from '../../types/city'
import type { Grid } from '../../types/city'
import { getGradientMap, getToonMaterial, vehicleHeadlightBeamMaterial } from './primitives'

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

const inkLineMaterial = new THREE.LineBasicMaterial({ color: '#2b1e17', transparent: true, opacity: 0.9 })

function outlinedPart(geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 32), inkLineMaterial))
  return mesh
}

/** Compact procedural sedan, with its nose pointing along local +Z. */
export function createSedanMesh(colorHex: string): THREE.Group {
  const car = new THREE.Group()
  const bodyMat = getToonMaterial(colorHex)
  const glassMat = getToonMaterial('#1e293b')
  const wheelMat = getToonMaterial('#18181b')
  const hubMat = getToonMaterial('#cbd5e1')
  const lampMat = new THREE.MeshToonMaterial({ color: '#cbd5e1', emissive: '#fef08a', emissiveIntensity: 0, gradientMap: getGradientMap() })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ color: '#111827', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  shadow.userData.noInkOutline = true
  car.add(shadow)

  const chassis = outlinedPart(new THREE.BoxGeometry(0.42, 0.14, 0.85), bodyMat, 'vehicle-body')
  chassis.position.y = 0.12
  car.add(chassis)
  const cabin = outlinedPart(new THREE.BoxGeometry(0.36, 0.14, 0.46), glassMat, 'vehicle-glasshouse')
  cabin.position.set(0, 0.24, -0.055)
  car.add(cabin)
  const roof = outlinedPart(new THREE.BoxGeometry(0.37, 0.02, 0.38), bodyMat, 'vehicle-roof')
  roof.position.set(0, 0.315, -0.055)
  car.add(roof)

  const wheelGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.04, 8)
  const hubGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.042, 8)
  for (const x of [-0.21, 0.21]) for (const z of [-0.26, 0.26]) {
    const wheel = outlinedPart(wheelGeometry, wheelMat, 'vehicle-wheel')
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.065, z)
    car.add(wheel)
    const hub = new THREE.Mesh(hubGeometry, hubMat)
    hub.rotation.z = Math.PI / 2
    hub.position.set(x + (x < 0 ? -0.022 : 0.022), 0.065, z)
    car.add(hub)
  }

  for (const x of [-0.13, 0.13]) {
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), lampMat)
    front.name = 'vehicle-headlight'
    front.position.set(x, 0.14, 0.43)
    front.userData.noInkOutline = true
    car.add(front)
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.02), getToonMaterial('#ef4444'))
  tail.position.set(0, 0.13, -0.43)
  tail.userData.noInkOutline = true
  car.add(tail)
  return car
}

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
  const carsRef = useRef<CarState[]>(Array.from({ length: CAR_COUNT }, (_, index) => ({
    routeIndex: 0, segment: 0, reverse: false, progress: 0, colorIndex: 0, active: false, delivery: false,
    vehicleType: index < 2 ? 'truck' as const : 'car' as const,
  })))
  const vehicleModels = useMemo(() => carsRef.current.map((_, index) => {
    const sedan = createSedanMesh(CAR_COLORS[index % CAR_COLORS.length])
    const trailer = new THREE.Group()
    trailer.name = 'vehicle-trailer'
    trailer.visible = index < 2
    trailer.position.set(0, 0, -0.58)
    const trailerBody = outlinedPart(new THREE.BoxGeometry(0.4, 0.25, 0.55), getToonMaterial('#aeb1a9'), 'trailer-body')
    trailerBody.position.y = 0.22
    trailer.add(trailerBody)
    const trailerWheels = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 8)
    for (const x of [-0.21, 0.21]) {
      const wheel = outlinedPart(trailerWheels, getToonMaterial('#18181b'), 'trailer-wheel')
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.075, 0)
      trailer.add(wheel)
    }
    sedan.add(trailer)
    return sedan
  }), [])
  const groupRef = useRef<THREE.Group>(null)
  const beamGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.045, 0)
    shape.lineTo(0.045, 0)
    shape.lineTo(0.17, 1.6)
    shape.lineTo(-0.17, 1.6)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  const beamMaterial = vehicleHeadlightBeamMaterial

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
        const body = mesh.getObjectByName('vehicle-body') as THREE.Mesh | undefined
        if (body) body.material = getToonMaterial(CAR_COLORS[car.colorIndex])
        car.active = true
        mesh.visible = true
      }

      const oldSegment = car.segment
      const oldProgress = car.progress
      const oldReverse = car.reverse
      const oldPosition = mesh.position.clone()
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
      const nextPosition = new THREE.Vector3(from[0] + dx * car.progress + dz * lane, 0.055, from[2] + dz * car.progress - dx * lane)
      const isBlocked = group.children.some((other, otherIndex) => otherIndex !== i && other.visible &&
        Math.hypot(other.position.x - nextPosition.x, other.position.z - nextPosition.z) < 0.72)
      if (isBlocked) {
        car.segment = oldSegment
        car.progress = oldProgress
        car.reverse = oldReverse
        mesh.position.copy(oldPosition)
        continue
      }
      mesh.position.copy(nextPosition)
      mesh.rotation.y = Math.atan2(dx, dz)
      const headlights = mesh.getObjectByName('vehicle-headlight-beams')
      if (headlights) headlights.visible = isDark
      mesh.traverse((part) => {
        if (!part.name.includes('vehicle-headlight') || !(part instanceof THREE.Mesh)) return
        const material = part.material as THREE.MeshToonMaterial
        material.color.set(isDark ? '#fef08a' : '#cbd5e1')
        material.emissive.set(isDark ? '#fef08a' : '#000000')
        material.emissiveIntensity = isDark ? 1 : 0
      })
    }
  })

  return (
    <group ref={groupRef}>
      {carsRef.current.map((_, i) => (
        <group key={i} visible={false}>
          <primitive object={vehicleModels[i]} />
          <group name="vehicle-headlight-beams" visible={isDark}>
            {[-0.1, 0.1].map((x) => <mesh key={`beam-${x}`} geometry={beamGeometry} position={[x, 0.02, 0.48]} rotation={[Math.PI / 2, 0, 0]} material={beamMaterial} userData={{ noInkOutline: true }} renderOrder={2} />)}
          </group>
        </group>
      ))}
    </group>
  )
}
