import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID_SIZE, TileType, type Grid, type GridCell } from '../../types/city'
import { isCovered, landValueAt, type CoverageMaps } from '../../lib/coverage'
import type { OverlayMode } from '../../lib/overlays'

const OFFSET = (GRID_SIZE - 1) / 2
const GOOD = new THREE.Color('#22c55e')
const BAD = new THREE.Color('#ef4444')
const MID = new THREE.Color('#facc15')
const COLORS = {
  water: new THREE.Color('#3b82f6'), power: new THREE.Color('#f59e0b'), smog: new THREE.Color('#78350f'),
  police: new THREE.Color('#2563eb'), fire: new THREE.Color('#dc2626'), education: new THREE.Color('#7c3aed'), health: new THREE.Color('#db2777'),
}

const isBuilding = (cell: GridCell) =>
  cell.type !== TileType.EMPTY &&
  cell.type !== TileType.ROAD &&
  cell.type !== TileType.BRIDGE &&
  cell.type !== TileType.WATER &&
  cell.type !== TileType.RAIL &&
  cell.type !== TileType.RAIL_BRIDGE &&
  cell.type !== TileType.FOOTPRINT

function origin(grid: Grid, cell: GridCell): GridCell {
  return cell.type === TileType.FOOTPRINT && cell.refX !== undefined && cell.refY !== undefined ? grid[cell.refY]?.[cell.refX] ?? cell : cell
}

/** Цвет клетки для слоя или null, если клетку не подсвечиваем. */
function overlayColor(mode: OverlayMode, grid: Grid, cell: GridCell, coverage: CoverageMaps, out: THREE.Color): THREE.Color | null {
  const base = origin(grid, cell)
  switch (mode) {
    case 'water':
    case 'power': {
      const served = mode === 'water' ? base.hasWater : base.hasPower
      if (cell.type === TileType.ROAD || cell.type === TileType.BRIDGE) return served ? out.copy(COLORS[mode]) : null
      if (!isBuilding(base)) return null
      return out.copy(served ? GOOD : BAD)
    }
    case 'smog':
      if (cell.smog) return out.copy(COLORS.smog)
      if (cell.parked) return out.copy(GOOD)
      return null
    case 'police':
    case 'fire':
    case 'education':
    case 'health': {
      const covered = isCovered(coverage, mode, cell.x, cell.y)
      if (covered) return out.copy(COLORS[mode])
      return isBuilding(base) && (base.type === TileType.RESIDENTIAL || base.type === TileType.COMMERCIAL || base.type === TileType.INDUSTRIAL) ? out.copy(BAD) : null
    }
    case 'landValue': {
      if (cell.type === TileType.ROAD) return null
      const value = landValueAt(cell, coverage) / 100
      return value < 0.5 ? out.copy(BAD).lerp(MID, value * 2) : out.copy(MID).lerp(GOOD, (value - 0.5) * 2)
    }
    default:
      return null
  }
}

/** Полупрозрачная раскраска клеток поверх города (вода, свет, смог, службы, стоимость земли). */
export function OverlayLayer({ grid, coverage, mode }: { grid: Grid; coverage: CoverageMaps; mode: OverlayMode }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), [])
  useEffect(() => {
    const target = mesh.current
    if (!target || mode === 'none') return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    let count = 0
    for (const row of grid) for (const cell of row) {
      const tint = overlayColor(mode, grid, cell, coverage, color)
      if (!tint) continue
      matrix.makeTranslation(cell.x - OFFSET, 0.04, cell.y - OFFSET)
      target.setMatrixAt(count, matrix)
      target.setColorAt(count, tint)
      count += 1
    }
    target.count = count
    target.instanceMatrix.needsUpdate = true
    if (target.instanceColor) target.instanceColor.needsUpdate = true
  }, [grid, coverage, mode])
  useFrame(({ clock }) => { material.opacity = 0.42 + Math.sin(clock.elapsedTime * 2) * 0.06 })
  if (mode === 'none') return null
  return <instancedMesh ref={mesh} args={[geometry, material, GRID_SIZE * GRID_SIZE]} frustumCulled={false} renderOrder={5} />
}

const flameOuter = new THREE.MeshBasicMaterial({ color: '#f97316', toneMapped: false })
const flameInner = new THREE.MeshBasicMaterial({ color: '#fde047', toneMapped: false })
const flameGeometry = new THREE.ConeGeometry(0.16, 0.5, 6)

/** Огонь над горящими зданиями. */
export function FireLayer({ grid }: { grid: Grid }) {
  const burning = useMemo(() => grid.flat().filter((cell) => (cell.fire ?? 0) > 0), [grid])
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    group.current?.children.forEach((child, index) => {
      const t = clock.elapsedTime * 9 + index * 1.3
      child.scale.set(1 + Math.sin(t) * 0.12, 1 + Math.sin(t * 1.3) * 0.25, 1 + Math.cos(t) * 0.12)
    })
  })
  if (burning.length === 0) return null
  return <group ref={group}>
    {burning.map((cell) => <group key={`${cell.x}:${cell.y}`} position={[cell.x - OFFSET, 0.75, cell.y - OFFSET]}>
      <mesh geometry={flameGeometry} material={flameOuter} position={[0, 0.25, 0]} />
      <mesh geometry={flameGeometry} material={flameInner} position={[0, 0.2, 0]} scale={0.6} />
      <mesh geometry={flameGeometry} material={flameOuter} position={[0.22, 0.12, 0.1]} scale={0.6} />
    </group>)}
  </group>
}
