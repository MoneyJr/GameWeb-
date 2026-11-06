import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID_SIZE, TileType } from '../../types/city'
import type { Grid } from '../../types/city'
import { getGradientMap, getToonMaterial, vehicleHeadlightBeamMaterial, ROAD_LANE_OFFSET } from './primitives'
import { createVehicleMesh, VEHICLE_COLORS, VEHICLE_KINDS } from './Vehicles'

interface RoadCell {
  x: number
  y: number
  /** True, когда точка находится внутри парковки (парковочный карман, проезд или выезд на улицу). */
  inParking?: boolean
}
interface CarRoute {
  path: RoadCell[]
  kind: 'passenger' | 'delivery'
}
interface CarState {
  routeIndex: number
  segment: number
  reverse: boolean
  progress: number
  colorIndex: number
  active: boolean
  delivery: boolean
  vehicleType: 'car' | 'truck' | 'bus'
  currentSpeed: number
  pauseTimer: number
}

const CAR_COUNT = 36
const CAR_SPEED = 1.25
const SAFE_DISTANCE = 1.1
const STOP_DISTANCE = 0.75
const CAR_COLORS = VEHICLE_COLORS
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

function isRoadLike(type: TileType | undefined): boolean {
  return type === TileType.ROAD || type === TileType.BRIDGE
}

interface ParkingBayExit {
  /** Путь от парковочного места внутри парковки до первой клетки дороги (включительно) */
  exitChain: RoadCell[]
  roadPort: RoadCell
}

function buildRoadRoutes(grid: Grid): CarRoute[] {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const isRoad = (x: number, y: number) =>
    y >= 0 && y < height && x >= 0 && x < width && isRoadLike(grid[y]?.[x]?.type)

  const resolveRoot = (x: number, y: number) => {
    const cell = grid[y]?.[x]
    if (!cell) return undefined
    return cell.type === TileType.FOOTPRINT && cell.refX !== undefined && cell.refY !== undefined
      ? grid[cell.refY]?.[cell.refX]
      : cell
  }

  const isParkingTile = (x: number, y: number) => {
    if (y < 0 || y >= height || x < 0 || x >= width) return false
    const root = resolveRoot(x, y)
    return root?.type === TileType.PARK && root.catalogId === 'lnd_parking'
  }

  const homes: RoadCell[] = []
  const destinations: { x: number; y: number; kind: 'passenger' | 'delivery' }[] = []
  const factories: RoadCell[] = []
  const parkingBays: ParkingBayExit[] = []

  const addUnique = (arr: RoadCell[], port: RoadCell) => {
    if (!arr.some((item) => item.x === port.x && item.y === port.y)) arr.push(port)
  }
  const addDestination = (port: RoadCell, kind: 'passenger' | 'delivery' = 'passenger') => {
    if (!destinations.some((item) => item.x === port.x && item.y === port.y && item.kind === kind)) {
      destinations.push({ ...port, kind })
    }
  }

  // Находит кратчайший выезд через территорию парковки (или блока смежных парковок) на ближайшую клетку дороги
  const findParkingExitToRoad = (startCellX: number, startCellY: number): { parkingCells: { x: number; y: number }[]; roadPort: RoadCell } | null => {
    const startKey = `${startCellX},${startCellY}`
    const queue: { x: number; y: number }[] = [{ x: startCellX, y: startCellY }]
    const prev = new Map<string, string | null>([[startKey, null]])

    for (let head = 0; head < queue.length; head += 1) {
      const cur = queue[head]
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        if (isRoad(nx, ny)) {
          const parkingCells: { x: number; y: number }[] = []
          let k: string | null = `${cur.x},${cur.y}`
          while (k !== null) {
            const [px, py] = k.split(',').map(Number)
            parkingCells.push({ x: px, y: py })
            k = prev.get(k) ?? null
          }
          parkingCells.reverse()
          return { parkingCells, roadPort: { x: nx, y: ny, inParking: false } }
        }
      }
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        const k = `${nx},${ny}`
        if (!prev.has(k) && isParkingTile(nx, ny)) {
          prev.set(k, `${cur.x},${cur.y}`)
          queue.push({ x: nx, y: ny })
        }
      }
    }
    return null
  }

  for (const row of grid) {
    for (const cell of row) {
      // Если это корневая клетка парковки 2×1 — создаём точки выезда из свободных парковочных слотов (слоты 2 и 5)
      if (cell.type === TileType.PARK && cell.catalogId === 'lnd_parking') {
        const orient = cell.orientation ?? 0
        const w = orient % 2 ? 1 : 2
        const d = orient % 2 ? 2 : 1
        const cx = cell.x + (w - 1) * 0.5
        const cy = cell.y + (d - 1) * 0.5
        const theta = orient * (Math.PI / 2)
        const cos = Math.cos(theta)
        const sin = Math.sin(theta)
        const toGrid = (lx: number, lz: number): RoadCell => ({
          x: cx + lx * cos + lz * sin,
          y: cy - lx * sin + lz * cos,
          inParking: true,
        })

        // Два свободных парковочных кармана в ParkingLotMesh: слот 2 (lx = -0.22) и слот 5 (lx = +0.44)
        for (const slotLx of [-0.22, 0.44]) {
          const stall = toGrid(slotLx, -0.22)
          const aisle = toGrid(slotLx, 0.2)
          const nearX = Math.max(cell.x, Math.min(cell.x + w - 1, Math.round(aisle.x)))
          const nearY = Math.max(cell.y, Math.min(cell.y + d - 1, Math.round(aisle.y)))
          const exitInfo = findParkingExitToRoad(nearX, nearY)
          if (!exitInfo) continue

          const { parkingCells, roadPort } = exitInfo
          const lastP = parkingCells[parkingCells.length - 1]
          const exitChain: RoadCell[] = [stall, aisle]

          // Если парковка внутри большого парковочного квартала — ведём машину по проездам до выезда на улицу
          for (let pIdx = 1; pIdx < parkingCells.length; pIdx += 1) {
            const pc = parkingCells[pIdx]
            exitChain.push({ x: pc.x, y: pc.y + 0.16 * cos, inParking: true })
          }

          // Точка пересечения бордюра (выезд с парковки на проезжую часть)
          exitChain.push({
            x: lastP.x * 0.38 + roadPort.x * 0.62,
            y: lastP.y * 0.38 + roadPort.y * 0.62,
            inParking: true,
          })
          exitChain.push(roadPort)
          parkingBays.push({ exitChain, roadPort })
        }
      }

      const root = resolveRoot(cell.x, cell.y)
      if (!root) continue
      const rType = root.type
      const isParking = rType === TileType.PARK && root.catalogId === 'lnd_parking'
      const isCivicOrStation =
        rType === TileType.STATION ||
        rType === TileType.FIRE_STATION ||
        rType === TileType.CITY_HALL ||
        rType === TileType.POLICE ||
        rType === TileType.PARK ||
        rType === TileType.WATER_PUMP ||
        rType === TileType.WIND ||
        rType === TileType.SOLAR_PANEL ||
        rType === TileType.COAL

      if (
        rType !== TileType.RESIDENTIAL &&
        rType !== TileType.COMMERCIAL &&
        rType !== TileType.INDUSTRIAL &&
        !isCivicOrStation
      ) {
        continue
      }

      for (const [dx, dy] of NEIGHBORS) {
        const x = cell.x + dx
        const y = cell.y + dy
        if (!isRoad(x, y)) continue
        const port: RoadCell = { x, y, inParking: false }
        if (isParking) {
          addDestination(port, 'passenger')
        } else if (rType === TileType.RESIDENTIAL) {
          addUnique(homes, port)
          addDestination(port, 'passenger')
        } else if (rType === TileType.INDUSTRIAL) {
          addUnique(factories, port)
          addDestination(port, 'delivery')
        } else {
          addDestination(port, 'passenger')
        }
      }
    }
  }

  const routes: CarRoute[] = []
  const routeKeys = new Set<string>()
  const addRouteIfValid = (path: RoadCell[], kind: 'passenger' | 'delivery') => {
    if (path.length < 3) return
    const forwardKey = path.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('|')
    const reverseKey = [...path].reverse().map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('|')
    const canonicalKey = forwardKey < reverseKey ? forwardKey : reverseKey
    if (routeKeys.has(canonicalKey)) return
    routeKeys.add(canonicalKey)
    routes.push({ path, kind })
  }

  // Полный обход дорожной сети от выбранной клетки дороги
  const bfsRoadNetwork = (startRoad: RoadCell) => {
    const startKey = `${startRoad.x},${startRoad.y}`
    const queue: RoadCell[] = [startRoad]
    const previous = new Map<string, string | null>([[startKey, null]])
    const dist = new Map<string, number>([[startKey, 0]])
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      const curKey = `${current.x},${current.y}`
      const curDist = dist.get(curKey) ?? 0
      for (const [dx, dy] of NEIGHBORS) {
        const x = current.x + dx
        const y = current.y + dy
        const key = `${x},${y}`
        if (!isRoad(x, y) || previous.has(key)) continue
        previous.set(key, curKey)
        dist.set(key, curDist + 1)
        queue.push({ x, y, inParking: false })
      }
    }
    const reconstructRoadPath = (endCell: { x: number; y: number }): RoadCell[] => {
      const roadPath: RoadCell[] = []
      let key: string | null = `${endCell.x},${endCell.y}`
      while (key !== null) {
        const [x, y] = key.split(',').map(Number)
        roadPath.push({ x, y, inParking: false })
        key = previous.get(key) ?? null
      }
      roadPath.reverse()
      return roadPath
    }
    return { queue, dist, reconstructRoadPath }
  }

  // 1. Главные маршруты: выезд прямо с парковочных мест (parkingBays) на улицу и поездка в город / на другую парковку
  parkingBays.forEach((bay, bayIdx) => {
    const { queue, dist, reconstructRoadPath } = bfsRoadNetwork(bay.roadPort)
    if (queue.length < 2) return

    // Достижимые городские точки назначения, отсортированные по дальности поездки (предпочитаем дальние маршруты по городу)
    const reachableTargets = destinations
      .map((d) => ({ d, distance: dist.get(`${d.x},${d.y}`) ?? -1 }))
      .filter((item) => item.distance >= 4)
      .sort((a, b) => b.distance - a.distance)

    if (reachableTargets.length > 0) {
      const pickIdx = (bayIdx * 3) % Math.max(1, Math.min(reachableTargets.length, 8))
      const chosen = reachableTargets[pickIdx].d
      const roadPath = reconstructRoadPath(chosen)
      // Соединяем выезд из парковочного слота с городским маршрутом
      addRouteIfValid([...bay.exitChain.slice(0, -1), ...roadPath], 'passenger')
    }

    // Маршрут из этой парковки в другую удалённую парковку (машина выезжает из слота А, едет по городу и паркуется в слот Б)
    const otherBays = parkingBays
      .map((other) => ({ other, distance: dist.get(`${other.roadPort.x},${other.roadPort.y}`) ?? -1 }))
      .filter((item) => item.distance >= 5)
      .sort((a, b) => b.distance - a.distance)

    if (otherBays.length > 0) {
      const targetBay = otherBays[bayIdx % otherBays.length].other
      const roadPath = reconstructRoadPath(targetBay.roadPort)
      const arrivalChain = [...targetBay.exitChain.slice(0, -1)].reverse()
      addRouteIfValid([...bay.exitChain.slice(0, -1), ...roadPath, ...arrivalChain], 'passenger')
    } else {
      // Если других парковок или дальних зданий нет — машина выезжает с парковки и объезжает самую дальнюю часть дорожной сети
      const farthestRoad = queue[queue.length - 1]
      if (farthestRoad.x !== bay.roadPort.x || farthestRoad.y !== bay.roadPort.y) {
        const roadPath = reconstructRoadPath(farthestRoad)
        addRouteIfValid([...bay.exitChain.slice(0, -1), ...roadPath], 'passenger')
      }
    }
  })

  // 2. Маршруты от жилых домов и заводов по городу
  const buildingSources = [
    ...homes.map((source) => ({ source, kind: 'passenger' as const })),
    ...factories.map((source) => ({ source, kind: 'delivery' as const })),
  ]

  buildingSources.forEach(({ source, kind }, srcIdx) => {
    const { queue, dist, reconstructRoadPath } = bfsRoadNetwork(source)
    if (queue.length < 2) return
    const reachable = destinations
      .filter((d) => d.kind === 'passenger' || kind === 'delivery')
      .map((d) => ({ d, distance: dist.get(`${d.x},${d.y}`) ?? -1 }))
      .filter((item) => item.distance >= 4)
      .sort((a, b) => b.distance - a.distance)

    const target = reachable.length > 0 ? reachable[srcIdx % Math.min(reachable.length, 6)].d : queue[queue.length - 1]
    if (target.x === source.x && target.y === source.y) return
    addRouteIfValid(reconstructRoadPath(target), kind)
  })

  return routes
}

export function TrafficSystem({ grid, minutes }: { grid: Grid; minutes: number }) {
  const isDark = minutes < 360 || minutes >= 1200
  const routes = useMemo(() => buildRoadRoutes(grid), [grid])
  const carsRef = useRef<CarState[]>(Array.from({ length: CAR_COUNT }, (_, index) => ({
    routeIndex: 0, segment: 0, reverse: false, progress: 0, colorIndex: 0, active: false, delivery: false,
    vehicleType: index < 2 ? 'truck' as const : 'car' as const, currentSpeed: 0, pauseTimer: 0,
  })))
  const vehicleModels = useMemo(() => carsRef.current.map((_, index) => {
    // Грузовики с прицепом — на базе фургона, остальные — разные легковые модели.
    const sedan = createVehicleMesh(index < 2 ? 'van' : VEHICLE_KINDS[index % VEHICLE_KINDS.length], CAR_COLORS[index % CAR_COLORS.length])
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
    // Машины меньше, чтобы помещаться в полосы между тротуарами.
    sedan.scale.setScalar(0.7)
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
        car.currentSpeed = 0
        mesh.visible = false
        continue
      }
      if (!car.active) {
        if (Math.random() > 0.14) continue
        car.routeIndex = (i + Math.floor(Math.random() * routes.length)) % routes.length
        const chosenRoute = routes[car.routeIndex]
        car.delivery = chosenRoute.kind === 'delivery'
        const startsInParking = Boolean(chosenRoute.path[0]?.inParking)
        // Если маршрут начинается на парковке — спавним машину прямо на парковочном месте, чтобы она красиво выезжала в город
        car.reverse = startsInParking ? false : Math.random() < 0.5
        car.segment = car.reverse ? chosenRoute.path.length - 1 : 0
        car.progress = 0
        car.pauseTimer = startsInParking ? 0.35 + (i % 5) * 0.35 : 0
        car.colorIndex = (i * 3 + Math.floor(Math.random() * CAR_COLORS.length)) % CAR_COLORS.length
        const spawnPath = chosenRoute.path
        const spawnFrom = car.reverse ? spawnPath[spawnPath.length - 1] : spawnPath[0]
        const spawnTo = car.reverse ? spawnPath[spawnPath.length - 2] : spawnPath[1]
        const spawnA = cellToWorld(spawnFrom.x, spawnFrom.y)
        const spawnB = cellToWorld(spawnTo.x, spawnTo.y)
        const spawnDx = spawnB[0] - spawnA[0]
        const spawnDz = spawnB[2] - spawnA[2]
        const spawnLen = Math.hypot(spawnDx, spawnDz) || 1
        const spawnLane = spawnFrom.inParking ? 0 : ROAD_LANE_OFFSET
        const spawnPosition = new THREE.Vector3(
          spawnA[0] - (spawnDz / spawnLen) * spawnLane,
          0.055,
          spawnA[2] + (spawnDx / spawnLen) * spawnLane,
        )
        const minClearance = spawnFrom.inParking ? 0.35 : SAFE_DISTANCE
        if (group.children.some((other, otherIndex) => otherIndex !== i && other.visible &&
          Math.hypot(other.position.x - spawnPosition.x, other.position.z - spawnPosition.z) < minClearance)) continue
        const trailer = mesh.getObjectByName('vehicle-trailer')
        if (trailer) trailer.visible = car.vehicleType === 'truck' && !startsInParking
        const paint = getToonMaterial(CAR_COLORS[car.colorIndex % CAR_COLORS.length])
        mesh.traverse((part) => { if (part.name === 'vehicle-body' && part instanceof THREE.Mesh) part.material = paint })
        car.active = true
        mesh.visible = true
        mesh.position.copy(spawnPosition)
        mesh.rotation.y = Math.atan2(spawnDx, spawnDz)
      }

      if (car.pauseTimer > 0) {
        car.pauseTimer = Math.max(0, car.pauseTimer - dt)
        car.currentSpeed = 0
        continue
      }

      const oldSegment = car.segment
      const oldProgress = car.progress
      const oldReverse = car.reverse
      const oldPosition = mesh.position.clone()
      const path = routes[car.routeIndex].path
      const currentFromIndex = car.segment
      const currentToIndex = car.reverse ? car.segment - 1 : car.segment + 1
      const currentFromCell = path[currentFromIndex]
      const currentToCell = path[currentToIndex]
      if (!currentFromCell || !currentToCell) { car.active = false; mesh.visible = false; continue }
      const currentFrom = cellToWorld(currentFromCell.x, currentFromCell.y)
      const currentTo = cellToWorld(currentToCell.x, currentToCell.y)
      const currentDx = currentTo[0] - currentFrom[0]
      const currentDz = currentTo[2] - currentFrom[2]
      const segLength = Math.max(0.25, Math.hypot(currentDx, currentDz))
      const directionX = currentDx / segLength
      const directionZ = currentDz / segLength
      const inParkingManeuver = Boolean(currentFromCell.inParking || currentToCell.inParking)

      let carAhead: { state: CarState; gap: number } | null = null
      if (!inParkingManeuver) {
        for (let otherIndex = 0; otherIndex < CAR_COUNT; otherIndex += 1) {
          if (otherIndex === i) continue
          const otherMesh = group.children[otherIndex]
          const otherState = carsRef.current[otherIndex]
          if (!otherMesh?.visible || !otherState.active) continue
          const otherDirectionX = Math.sin(otherMesh.rotation.y)
          const otherDirectionZ = Math.cos(otherMesh.rotation.y)
          if (directionX * otherDirectionX + directionZ * otherDirectionZ < 0.85) continue
          const relativeX = otherMesh.position.x - mesh.position.x
          const relativeZ = otherMesh.position.z - mesh.position.z
          const gap = relativeX * directionX + relativeZ * directionZ
          const lateral = Math.abs(relativeX * directionZ - relativeZ * directionX)
          if (gap <= 0 || lateral > 0.38 || gap >= SAFE_DISTANCE) continue
          if (!carAhead || gap < carAhead.gap) carAhead = { state: otherState, gap }
        }
      }

      const nextRoad = path[car.reverse ? Math.max(car.segment - 1, 0) : Math.min(car.segment + 1, path.length - 1)]
      const nextGridX = Math.round(nextRoad?.x ?? 0)
      const nextGridY = Math.round(nextRoad?.y ?? 0)
      const nextDegree = nextRoad && !nextRoad.inParking
        ? NEIGHBORS.reduce((sum, [dx, dy]) => sum + (isRoadLike(grid[nextGridY + dy]?.[nextGridX + dx]?.type) ? 1 : 0), 0)
        : 0
      const braking = inParkingManeuver ? 0.65 : nextDegree >= 3 && car.progress > 0.45 ? 0.42 : 1
      let speed = CAR_SPEED * braking
      if (carAhead) {
        speed = Math.min(speed, carAhead.state.currentSpeed)
        if (carAhead.gap < STOP_DISTANCE) speed = 0
      }
      car.currentSpeed = speed
      car.progress += (dt * speed) / segLength
      while (car.progress >= 1) {
        car.progress -= 1
        if (!car.reverse) {
          if (car.segment >= path.length - 2) {
            car.reverse = true
            car.segment = path.length - 1
            if (path[path.length - 1]?.inParking) {
              car.progress = 0
              car.pauseTimer = 1.8
              break
            }
          } else {
            car.segment += 1
          }
        } else if (car.segment <= 1) {
          car.reverse = false
          car.segment = 0
          if (path[0]?.inParking) {
            car.progress = 0
            car.pauseTimer = 1.8
            break
          }
        } else {
          car.segment -= 1
        }
      }

      const fromIndex = car.segment
      const toIndex = car.reverse ? car.segment - 1 : car.segment + 1
      const fromCell = path[fromIndex]
      const toCell = path[toIndex]
      if (!fromCell || !toCell) { car.active = false; mesh.visible = false; continue }
      const from = cellToWorld(fromCell.x, fromCell.y)
      const to = cellToWorld(toCell.x, toCell.y)
      const dx = to[0] - from[0]
      const dz = to[2] - from[2]
      const len = Math.hypot(dx, dz) || 1
      const ux = dx / len
      const uz = dz / len

      // Плавный переход смещения полосы: внутри парковки = 0 (по центру проезда/слота), на улице = ROAD_LANE_OFFSET
      const fromLane = fromCell.inParking ? 0 : ROAD_LANE_OFFSET
      const toLane = toCell.inParking ? 0 : ROAD_LANE_OFFSET
      const laneOffset = fromLane + (toLane - fromLane) * car.progress
      const laneX = -uz * laneOffset
      const laneZ = ux * laneOffset

      const fromElevation = !fromCell.inParking && grid[Math.round(fromCell.y)]?.[Math.round(fromCell.x)]?.type === TileType.BRIDGE ? 0.21 : 0.055
      const toElevation = !toCell.inParking && grid[Math.round(toCell.y)]?.[Math.round(toCell.x)]?.type === TileType.BRIDGE ? 0.21 : 0.055
      const carY = fromElevation + (toElevation - fromElevation) * car.progress
      const nextPosition = new THREE.Vector3(from[0] + dx * car.progress + laneX, carY, from[2] + dz * car.progress + laneZ)

      const isBlocked = !fromCell.inParking && !toCell.inParking && group.children.some((other, otherIndex) => {
        if (otherIndex === i || !other.visible) return false
        const otherDirectionX = Math.sin(other.rotation.y)
        const otherDirectionZ = Math.cos(other.rotation.y)
        if (ux * otherDirectionX + uz * otherDirectionZ < 0.85) return false
        const relativeX = other.position.x - nextPosition.x
        const relativeZ = other.position.z - nextPosition.z
        const lateral = Math.abs(relativeX * uz - relativeZ * ux)
        return lateral < 0.38 && Math.hypot(relativeX, relativeZ) < 0.48
      })
      if (isBlocked) {
        car.segment = oldSegment
        car.progress = oldProgress
        car.reverse = oldReverse
        car.currentSpeed = 0
        mesh.position.copy(oldPosition)
        continue
      }

      // Плавный масштаб: в парковочном слоте = 0.50 (как у стоящих рядом авто), на дороге = 0.70
      const fromScale = fromCell.inParking ? 0.5 : 0.7
      const toScale = toCell.inParking ? 0.5 : 0.7
      vehicleModels[i].scale.setScalar(fromScale + (toScale - fromScale) * car.progress)

      mesh.position.copy(nextPosition)
      const targetYaw = Math.atan2(dx, dz)
      let diffYaw = targetYaw - mesh.rotation.y
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2
      mesh.rotation.y += diffYaw * Math.min(1, dt * 14)

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
