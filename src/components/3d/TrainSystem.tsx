import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID_SIZE, TileType, type Grid } from '../../types/city'
import { getGradientMap, getToonMaterial, vehicleHeadlightBeamMaterial } from './primitives'

interface RailCell {
  x: number
  y: number
}

interface RailRoute {
  path: RailCell[]
  kind: 'passenger' | 'freight'
  stationStops: number[]
  isLoop: boolean
}

interface TrainState {
  routeIndex: number
  distance: number
  direction: 1 | -1
  pauseTimer: number
  lastStopIndex: number
}

const MAX_TRAINS = 4
const CARS_PER_TRAIN = 3
const CAR_SPACING = 0.76
const TRAIN_SPEED = 2.15
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

const inkOutlineMat = new THREE.LineBasicMaterial({ color: '#1b1815', transparent: true, opacity: 0.92 })

function outlinedMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), inkOutlineMat))
  return mesh
}

function createTrainCarMesh(isLocomotive: boolean, kind: 'passenger' | 'freight', carIndex: number): THREE.Group {
  const group = new THREE.Group()
  const primaryColor = kind === 'passenger' ? '#c93b2f' : '#2f5d6b'
  const accentColor = kind === 'passenger' ? '#f2ece1' : '#e09a2b'
  const roofColor = '#464c52'
  const chassisMat = getToonMaterial('#2b2f33')
  const primaryMat = getToonMaterial(primaryColor)
  const accentMat = getToonMaterial(accentColor)
  const roofMat = getToonMaterial(roofColor)
  const windowMat = new THREE.MeshToonMaterial({
    color: '#8ecae6',
    emissive: '#ffd27a',
    emissiveIntensity: 0,
    gradientMap: getGradientMap(),
  })

  // Ходовая тележка и рама вагона
  const undercarriage = outlinedMesh(new THREE.BoxGeometry(0.32, 0.08, 0.64), chassisMat)
  undercarriage.position.y = 0.07
  group.add(undercarriage)

  if (isLocomotive || kind === 'passenger') {
    // Кузов локомотива или пассажирского вагона
    const body = outlinedMesh(new THREE.BoxGeometry(0.36, 0.22, 0.68), primaryMat)
    body.position.y = 0.21
    group.add(body)

    const stripe = outlinedMesh(new THREE.BoxGeometry(0.37, 0.06, 0.69), accentMat)
    stripe.position.y = 0.21
    group.add(stripe)

    const roof = outlinedMesh(new THREE.BoxGeometry(0.32, 0.04, 0.64), roofMat)
    roof.position.y = 0.34
    group.add(roof)

    // Полоса окон
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.374, 0.065, 0.54), windowMat)
    windows.name = 'train-windows'
    windows.position.y = 0.255
    group.add(windows)

    if (isLocomotive) {
      // Прожектор локомотива
      const headlamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.05, 0.02),
        new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false }),
      )
      headlamp.position.set(0, 0.26, 0.35)
      group.add(headlamp)
    }
  } else {
    // Грузовой вагон с контейнером или углём/материалами
    const containerColor = carIndex % 2 === 1 ? '#d9822b' : '#3b78a8'
    const cargo = outlinedMesh(new THREE.BoxGeometry(0.34, 0.2, 0.62), getToonMaterial(containerColor))
    cargo.position.y = 0.21
    group.add(cargo)
  }

  return group
}

function isRailCell(grid: Grid, x: number, y: number): boolean {
  const cell = grid[y]?.[x]
  return cell !== undefined && (cell.type === TileType.RAIL || cell.type === TileType.RAIL_BRIDGE)
}

function hasNeighborStation(grid: Grid, x: number, y: number): { has: boolean; freight: boolean } {
  for (const [dx, dy] of NEIGHBORS) {
    const n = grid[y + dy]?.[x + dx]
    if (!n) continue
    const root =
      n.type === TileType.FOOTPRINT && n.refX !== undefined && n.refY !== undefined
        ? grid[n.refY]?.[n.refX]
        : n
    if (root?.type === TileType.STATION) {
      return { has: true, freight: root.catalogId === 'ind_freight_station' }
    }
  }
  return { has: false, freight: false }
}

/**
 * Ищет связные маршруты вдоль железнодорожных путей (TileType.RAIL / RAIL_BRIDGE).
 */
function buildRailRoutes(grid: Grid): RailRoute[] {
  const visited = new Set<string>()
  const routes: RailRoute[] = []

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!isRailCell(grid, x, y)) continue
      const startKey = `${x},${y}`
      if (visited.has(startKey)) continue

      // Находим все клетки этой связной ж/д ветки
      const component: RailCell[] = []
      const compQueue: RailCell[] = [{ x, y }]
      visited.add(startKey)
      let touchesFreight = false

      for (let head = 0; head < compQueue.length; head++) {
        const cur = compQueue[head]
        component.push(cur)
        const st = hasNeighborStation(grid, cur.x, cur.y)
        if (st.freight) touchesFreight = true
        for (const [dx, dy] of NEIGHBORS) {
          const nx = cur.x + dx
          const ny = cur.y + dy
          const nKey = `${nx},${ny}`
          if (!visited.has(nKey) && isRailCell(grid, nx, ny)) {
            visited.add(nKey)
            compQueue.push({ x: nx, y: ny })
          }
        }
      }

      if (component.length < 4) continue

      // Ищем самый длинный путь в компоненте (два прохода BFS)
      const bfsFarthest = (start: RailCell): { farthest: RailCell; parent: Map<string, RailCell | null> } => {
        const parent = new Map<string, RailCell | null>([[`${start.x},${start.y}`, null]])
        const q: RailCell[] = [start]
        let last = start
        for (let i = 0; i < q.length; i++) {
          const cur = q[i]
          last = cur
          for (const [dx, dy] of NEIGHBORS) {
            const nx = cur.x + dx
            const ny = cur.y + dy
            const k = `${nx},${ny}`
            if (!parent.has(k) && isRailCell(grid, nx, ny)) {
              parent.set(k, cur)
              q.push({ x: nx, y: ny })
            }
          }
        }
        return { farthest: last, parent }
      }

      const firstPass = bfsFarthest(component[0])
      const secondPass = bfsFarthest(firstPass.farthest)
      const path: RailCell[] = []
      let cursor: RailCell | null = secondPass.farthest
      while (cursor !== null) {
        path.push(cursor)
        cursor = secondPass.parent.get(`${cursor.x},${cursor.y}`) ?? null
      }
      path.reverse()

      if (path.length >= 4) {
        const first = path[0]
        const last = path[path.length - 1]
        const isLoop = Math.abs(first.x - last.x) + Math.abs(first.y - last.y) === 1
        if (isLoop) {
          path.push({ x: first.x, y: first.y })
        }

        // Определяем индексы клеток рядом со станциями и ж/д платформами (по одной точке остановки на перрон)
        const rawStops: number[] = []
        for (let idx = 0; idx < path.length; idx++) {
          const st = hasNeighborStation(grid, path[idx].x, path[idx].y)
          if (st.has) rawStops.push(idx)
        }
        const stationStops: number[] = []
        let groupStart = -1
        for (let i = 0; i < rawStops.length; i++) {
          if (groupStart === -1) groupStart = i
          const isEndOfRun = i === rawStops.length - 1 || rawStops[i + 1] > rawStops[i] + 1
          if (isEndOfRun) {
            const mid = Math.floor((groupStart + i) / 2)
            stationStops.push(rawStops[mid])
            groupStart = -1
          }
        }

        routes.push({
          path,
          kind: touchesFreight ? 'freight' : routes.length % 2 === 1 ? 'freight' : 'passenger',
          stationStops,
          isLoop,
        })
      }
    }
  }

  return routes.slice(0, MAX_TRAINS)
}

function cellToWorld(x: number, y: number): [number, number, number] {
  const half = (GRID_SIZE - 1) / 2
  return [x - half, 0, y - half]
}

/**
 * Вычисляет координаты и поворот вагона вдоль маршрута с плавным радиусным скруглением на 90° поворотах.
 */
function samplePathPosition(
  grid: Grid,
  path: RailCell[],
  distance: number,
  isLoop: boolean,
): { x: number; y: number; z: number; yaw: number } {
  const n = path.length
  const maxDist = Math.max(0, n - 1)
  const d = isLoop
    ? ((distance % maxDist) + maxDist) % maxDist
    : Math.max(0, Math.min(maxDist - 0.0001, distance))

  // Каждая клетка i отвечает за интервал [i - 0.5, i + 0.5], где на повороте строим квадратичную кривую Безье
  const cellIdx = Math.min(n - 1, Math.max(0, Math.round(d)))
  const localU = d - (cellIdx - 0.5) // в диапазоне [0, 1] внутри клетки cellIdx

  if (cellIdx > 0 && cellIdx < n - 1) {
    const prev = path[cellIdx - 1]
    const curr = path[cellIdx]
    const next = path[cellIdx + 1]
    const pPrev = cellToWorld(prev.x, prev.y)
    const pCurr = cellToWorld(curr.x, curr.y)
    const pNext = cellToWorld(next.x, next.y)

    const yPrev = grid[prev.y]?.[prev.x]?.type === TileType.RAIL_BRIDGE ? 0.22 : 0.075
    const yCurr = grid[curr.y]?.[curr.x]?.type === TileType.RAIL_BRIDGE ? 0.22 : 0.075
    const yNext = grid[next.y]?.[next.x]?.type === TileType.RAIL_BRIDGE ? 0.22 : 0.075

    // Середины граней входа и выхода из клетки curr
    const m0x = (pPrev[0] + pCurr[0]) * 0.5
    const m0z = (pPrev[2] + pCurr[2]) * 0.5
    const m0y = (yPrev + yCurr) * 0.5

    const m1x = (pCurr[0] + pNext[0]) * 0.5
    const m1z = (pCurr[2] + pNext[2]) * 0.5
    const m1y = (yCurr + yNext) * 0.5

    const u = Math.max(0, Math.min(1, localU))
    const inv = 1 - u
    const x = inv * inv * m0x + 2 * inv * u * pCurr[0] + u * u * m1x
    const z = inv * inv * m0z + 2 * inv * u * pCurr[2] + u * u * m1z
    const y = inv * inv * m0y + 2 * inv * u * yCurr + u * u * m1y

    const tx = 2 * inv * (pCurr[0] - m0x) + 2 * u * (m1x - pCurr[0])
    const tz = 2 * inv * (pCurr[2] - m0z) + 2 * u * (m1z - pCurr[2])
    return {
      x,
      y,
      z,
      yaw: Math.atan2(tx, tz),
    }
  }

  const seg = Math.min(n - 2, Math.floor(d))
  const t = d - seg
  const a = path[seg]
  const b = path[seg + 1]
  const wa = cellToWorld(a.x, a.y)
  const wb = cellToWorld(b.x, b.y)
  const ya = grid[a.y]?.[a.x]?.type === TileType.RAIL_BRIDGE ? 0.22 : 0.075
  const yb = grid[b.y]?.[b.x]?.type === TileType.RAIL_BRIDGE ? 0.22 : 0.075

  const dx = wb[0] - wa[0]
  const dz = wb[2] - wa[2]
  return {
    x: wa[0] + dx * t,
    y: ya + (yb - ya) * t,
    z: wa[2] + dz * t,
    yaw: Math.atan2(dx, dz),
  }
}

export function TrainSystem({ grid, minutes }: { grid: Grid; minutes: number }) {
  const isDark = minutes < 360 || minutes >= 1200
  const routes = useMemo(() => buildRailRoutes(grid), [grid])
  const groupRef = useRef<THREE.Group>(null)

  const trainStatesRef = useRef<TrainState[]>(
    Array.from({ length: MAX_TRAINS }, (_, i) => ({
      routeIndex: i,
      distance: 0,
      direction: 1,
      pauseTimer: 0,
      lastStopIndex: -1,
    })),
  )

  const trainMeshes = useMemo(
    () =>
      Array.from({ length: MAX_TRAINS }, (_, trainIdx) => {
        const kind = trainIdx % 2 === 0 ? ('passenger' as const) : ('freight' as const)
        return Array.from({ length: CARS_PER_TRAIN }, (__, carIdx) =>
          createTrainCarMesh(carIdx === 0, kind, carIdx),
        )
      }),
    [],
  )

  const beamGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.06, 0)
    shape.lineTo(0.06, 0)
    shape.lineTo(0.24, 2.1)
    shape.lineTo(-0.24, 2.1)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])

  useFrame((_, delta) => {
    const root = groupRef.current
    if (!root) return
    const dt = Math.min(delta, 0.05)

    for (let tIdx = 0; tIdx < MAX_TRAINS; tIdx++) {
      const trainGroup = root.children[tIdx] as THREE.Group | undefined
      if (!trainGroup) continue
      const route = routes[tIdx]
      if (!route || route.path.length < 4) {
        trainGroup.visible = false
        continue
      }

      trainGroup.visible = true
      const state = trainStatesRef.current[tIdx]
      const maxTravel = route.path.length - 1

      if (state.pauseTimer > 0) {
        state.pauseTimer = Math.max(0, state.pauseTimer - dt)
      } else {
        const prevDist = state.distance
        state.distance += dt * TRAIN_SPEED * state.direction
        const minHead = (CARS_PER_TRAIN - 1) * CAR_SPACING

        // Проверяем остановку на промежуточных ж/д станциях и платформах
        for (const stopIdx of route.stationStops) {
          if (state.lastStopIndex === stopIdx) continue
          const crossedForward = state.direction === 1 && prevDist < stopIdx && state.distance >= stopIdx
          const crossedBackward = state.direction === -1 && prevDist > stopIdx && state.distance <= stopIdx
          if (crossedForward || crossedBackward) {
            state.distance = stopIdx
            state.lastStopIndex = stopIdx
            state.pauseTimer = 2.6
            break
          }
        }

        if (route.isLoop) {
          if (state.distance >= maxTravel) {
            state.distance -= maxTravel
            state.lastStopIndex = -1
          } else if (state.distance < 0) {
            state.distance += maxTravel
            state.lastStopIndex = -1
          }
        } else if (state.direction === 1 && state.distance >= maxTravel) {
          state.distance = maxTravel
          state.direction = -1
          state.lastStopIndex = -1
          state.pauseTimer = 1.8
        } else if (state.direction === -1 && state.distance <= minHead) {
          state.distance = minHead
          state.direction = 1
          state.lastStopIndex = -1
          state.pauseTimer = 1.8
        }
      }

      for (let cIdx = 0; cIdx < CARS_PER_TRAIN; cIdx++) {
        const carObj = trainGroup.children[cIdx] as THREE.Group | undefined
        if (!carObj) continue
        const carDist =
          state.direction === 1
            ? state.distance - cIdx * CAR_SPACING
            : state.distance - (CARS_PER_TRAIN - 1 - cIdx) * CAR_SPACING
        const sample = samplePathPosition(grid, route.path, carDist, route.isLoop)
        carObj.position.set(sample.x, sample.y, sample.z)
        carObj.rotation.y = state.direction === 1 ? sample.yaw : sample.yaw + Math.PI

        carObj.traverse((part) => {
          if (part.name === 'train-windows' && part instanceof THREE.Mesh) {
            const mat = part.material as THREE.MeshToonMaterial
            mat.emissiveIntensity = isDark ? 1.4 : 0
          }
        })
      }
    }
  })

  return (
    <group ref={groupRef}>
      {trainMeshes.map((cars, tIdx) => (
        <group key={tIdx} visible={false}>
          {cars.map((carMesh, cIdx) => (
            <group key={cIdx}>
              <primitive object={carMesh} />
              {cIdx === 0 && (
                <mesh
                  geometry={beamGeometry}
                  position={[0, 0.05, 0.38]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={vehicleHeadlightBeamMaterial}
                  visible={isDark}
                  userData={{ noInkOutline: true }}
                  renderOrder={2}
                />
              )}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}
