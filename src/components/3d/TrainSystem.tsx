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
}

interface TrainState {
  routeIndex: number
  distance: number
  direction: 1 | -1
  pauseTimer: number
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
        routes.push({
          path,
          kind: touchesFreight ? 'freight' : routes.length % 2 === 1 ? 'freight' : 'passenger',
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

function samplePathPosition(
  grid: Grid,
  path: RailCell[],
  distance: number,
): { x: number; y: number; z: number; yaw: number } {
  const maxDist = Math.max(0, path.length - 1)
  const clamped = Math.max(0, Math.min(maxDist - 0.0001, distance))
  const seg = Math.min(path.length - 2, Math.floor(clamped))
  const t = clamped - seg
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
        state.distance += dt * TRAIN_SPEED * state.direction
        const minHead = (CARS_PER_TRAIN - 1) * CAR_SPACING
        if (state.direction === 1 && state.distance >= maxTravel) {
          state.distance = maxTravel
          state.direction = -1
          state.pauseTimer = 1.2
        } else if (state.direction === -1 && state.distance <= minHead) {
          state.distance = minHead
          state.direction = 1
          state.pauseTimer = 1.2
        }
      }

      for (let cIdx = 0; cIdx < CARS_PER_TRAIN; cIdx++) {
        const carObj = trainGroup.children[cIdx] as THREE.Group | undefined
        if (!carObj) continue
        const carDist =
          state.direction === 1
            ? state.distance - cIdx * CAR_SPACING
            : state.distance - (CARS_PER_TRAIN - 1 - cIdx) * CAR_SPACING
        const sample = samplePathPosition(grid, route.path, carDist)
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
