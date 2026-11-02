import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID_SIZE, TileType, type Grid } from '../../types/city'
import { getGradientMap, ROAD_CURB_OFFSET } from './primitives'

const OFFSET = (GRID_SIZE - 1) / 2
const MAX_PEOPLE = 140
const CLOTHES = ['#3d4a5c', '#6b4f3a', '#8a3b33', '#2f3e34', '#c9a24e', '#5b5f8a', '#e8e4da', '#4a4a4a', '#9a6b4f']
const SKIN = ['#e2b48c', '#c6956b', '#a8754f', '#f0c9a6']

/** Отрезок тротуара: сплошной ряд прямых дорог с тротуаром на одной стороне. */
type Run = { axis: 'x' | 'z'; from: number; to: number; line: number }
type Walker = { run: number; t: number; dir: number; speed: number; lateral: number; phase: number }

function hash(n: number) {
  const value = Math.sin(n * 91.345) * 47453.5453
  return value - Math.floor(value)
}

function buildRuns(grid: Grid): Run[] {
  const isRoad = (x: number, y: number) => grid[y]?.[x]?.type === TileType.ROAD
  const runs: Run[] = []
  const straightX = (x: number, y: number) => isRoad(x, y) && !isRoad(x, y - 1) && !isRoad(x, y + 1)
  const straightZ = (x: number, y: number) => isRoad(x, y) && !isRoad(x - 1, y) && !isRoad(x + 1, y)
  for (let y = 0; y < GRID_SIZE; y += 1) {
    let start = -1
    for (let x = 0; x <= GRID_SIZE; x += 1) {
      const ok = x < GRID_SIZE && straightX(x, y) && (isRoad(x - 1, y) || isRoad(x + 1, y))
      if (ok && start < 0) start = x
      if (!ok && start >= 0) {
        if (x - start >= 2) for (const sign of [-1, 1]) runs.push({ axis: 'x', from: start - OFFSET - 0.45, to: x - 1 - OFFSET + 0.45, line: y - OFFSET + sign * ROAD_CURB_OFFSET })
        start = -1
      }
    }
  }
  for (let x = 0; x < GRID_SIZE; x += 1) {
    let start = -1
    for (let y = 0; y <= GRID_SIZE; y += 1) {
      const ok = y < GRID_SIZE && straightZ(x, y) && (isRoad(x, y - 1) || isRoad(x, y + 1))
      if (ok && start < 0) start = y
      if (!ok && start >= 0) {
        if (y - start >= 2) for (const sign of [-1, 1]) runs.push({ axis: 'z', from: start - OFFSET - 0.45, to: y - 1 - OFFSET + 0.45, line: x - OFFSET + sign * ROAD_CURB_OFFSET })
        start = -1
      }
    }
  }
  return runs
}

/** Пешеходы на тротуарах: маленькие фигурки в приглушённых цветах, как на иллюстрации. */
export function Pedestrians({ grid }: { grid: Grid }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const geometries = useMemo(() => ({
    body: new THREE.CapsuleGeometry(0.02, 0.06, 2, 6).translate(0, 0.07, 0),
    head: new THREE.SphereGeometry(0.019, 6, 5).translate(0, 0.135, 0),
  }), [])
  const material = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: getGradientMap() }), [])
  // Сетка меняется каждый такт (жители), а маршруты — только при изменении дорог.
  const roadKey = useMemo(() => grid.flat().filter((cell) => cell.type === TileType.ROAD).map((cell) => cell.y * GRID_SIZE + cell.x).join(','), [grid])
  const gridRef = useRef(grid)
  gridRef.current = grid
  const runs = useMemo(() => buildRuns(gridRef.current), [roadKey])
  const populationBucket = useMemo(() => Math.floor(grid.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + (cell.type === TileType.RESIDENTIAL ? cell.residents ?? 0 : 0), 0), 0) / 30), [grid])
  const population = populationBucket * 30
  const walkers = useMemo<Walker[]>(() => {
    if (runs.length === 0) return []
    const count = Math.min(MAX_PEOPLE, Math.floor(population / 6), runs.length * 5)
    return Array.from({ length: count }, (_, i) => ({
      run: Math.floor(hash(i + 1) * runs.length),
      t: hash(i + 7),
      dir: hash(i + 13) < 0.5 ? -1 : 1,
      speed: 0.12 + hash(i + 17) * 0.12,
      lateral: (hash(i + 23) - 0.5) * 0.08,
      phase: hash(i + 29) * 6,
    }))
  }, [runs, population])

  useLayoutEffect(() => {
    const body = bodies.current, head = heads.current
    if (!body || !head) return
    const color = new THREE.Color()
    walkers.forEach((_, i) => {
      body.setColorAt(i, color.set(CLOTHES[Math.floor(hash(i + 31) * CLOTHES.length)]))
      head.setColorAt(i, color.set(SKIN[Math.floor(hash(i + 37) * SKIN.length)]))
    })
    body.count = walkers.length
    head.count = walkers.length
    if (body.instanceColor) body.instanceColor.needsUpdate = true
    if (head.instanceColor) head.instanceColor.needsUpdate = true
  }, [walkers])

  const matrix = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ clock }, delta) => {
    const body = bodies.current, head = heads.current
    if (!body || !head || walkers.length === 0) return
    const step = Math.min(delta, 0.1)
    walkers.forEach((walker, i) => {
      const run = runs[walker.run]
      if (!run) return
      const length = run.to - run.from
      walker.t += (walker.dir * walker.speed * step) / length
      if (walker.t > 1) { walker.t = 1; walker.dir = -1 }
      if (walker.t < 0) { walker.t = 0; walker.dir = 1 }
      const along = run.from + walker.t * length
      const bob = Math.abs(Math.sin(clock.elapsedTime * 9 + walker.phase)) * 0.01
      const x = run.axis === 'x' ? along : run.line + walker.lateral
      const z = run.axis === 'x' ? run.line + walker.lateral : along
      matrix.makeTranslation(x, 0.06 + bob, z)
      body.setMatrixAt(i, matrix)
      head.setMatrixAt(i, matrix)
    })
    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
  })

  return <group>
    <instancedMesh ref={bodies} args={[geometries.body, material, MAX_PEOPLE]} castShadow frustumCulled={false} />
    <instancedMesh ref={heads} args={[geometries.head, material, MAX_PEOPLE]} frustumCulled={false} />
  </group>
}
