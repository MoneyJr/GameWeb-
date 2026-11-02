import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRID_SIZE, TileType, type Grid } from '../../types/city'
import { getToonMaterial } from './primitives'

const OFFSET = (GRID_SIZE - 1) / 2
const MAX_TREES = 2600
const CROWNS: Array<[number, number, number, number]> = [[0, 0.36, 0, 0.19], [0.1, 0.44, 0.05, 0.13], [-0.09, 0.42, -0.06, 0.12]]

function hash(x: number, y: number, salt: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Деревья-«облачка» вокруг застройки, как в иллюстрированных городах:
 * растут на пустых клетках рядом со зданиями и исчезают, когда клетку застраивают.
 */
export function Greenery({ grid, foliage }: { grid: Grid; foliage: string[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const outlines = useRef<THREE.InstancedMesh>(null)
  const trunkGeometry = useMemo(() => new THREE.CylinderGeometry(0.018, 0.026, 0.28, 6).translate(0, 0.14, 0), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const crownMaterial = useMemo(() => {
    const material = getToonMaterial('#ffffff').clone()
    return material
  }, [])
  const outlineMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1b1a17', side: THREE.BackSide }), [])

  const trees = useMemo(() => {
    const built = new Uint8Array(GRID_SIZE * GRID_SIZE)
    for (const row of grid) for (const cell of row) if (cell.type !== TileType.EMPTY && cell.type !== TileType.ROAD) built[cell.y * GRID_SIZE + cell.x] = 1
    const result: Array<{ x: number; z: number; scale: number; color: number }> = []
    for (const row of grid) for (const cell of row) {
      if (cell.type !== TileType.EMPTY) continue
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        const nx = cell.x + dx, ny = cell.y + dy
        if (nx >= 0 && ny >= 0 && nx < GRID_SIZE && ny < GRID_SIZE && built[ny * GRID_SIZE + nx]) { near = true; break }
      }
      if (!near || hash(cell.x, cell.y, 1) > 0.42) continue
      const count = hash(cell.x, cell.y, 2) > 0.6 ? 2 : 1
      for (let i = 0; i < count && result.length < MAX_TREES; i += 1) {
        result.push({
          x: cell.x - OFFSET + (hash(cell.x, cell.y, 3 + i) - 0.5) * 0.6,
          z: cell.y - OFFSET + (hash(cell.x, cell.y, 5 + i) - 0.5) * 0.6,
          scale: 0.75 + hash(cell.x, cell.y, 7 + i) * 0.6,
          color: Math.floor(hash(cell.x, cell.y, 9 + i) * foliage.length),
        })
      }
    }
    return result
  }, [grid, foliage])

  useLayoutEffect(() => {
    const trunkMesh = trunks.current, crownMesh = crowns.current, outlineMesh = outlines.current
    if (!trunkMesh || !crownMesh || !outlineMesh) return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    let crownIndex = 0
    trees.forEach((tree, index) => {
      matrix.compose(position.set(tree.x, 0, tree.z), quaternion, scale.setScalar(tree.scale))
      trunkMesh.setMatrixAt(index, matrix)
      CROWNS.forEach(([cx, cy, cz, r], part) => {
        position.set(tree.x + cx * tree.scale, cy * tree.scale, tree.z + cz * tree.scale)
        matrix.compose(position, quaternion, scale.setScalar(r * tree.scale))
        crownMesh.setMatrixAt(crownIndex, matrix)
        color.set(foliage[tree.color]).offsetHSL(0, 0, part === 1 ? 0.06 : part === 2 ? -0.04 : 0)
        crownMesh.setColorAt(crownIndex, color)
        matrix.compose(position, quaternion, scale.setScalar(r * tree.scale * 1.1))
        outlineMesh.setMatrixAt(crownIndex, matrix)
        crownIndex += 1
      })
    })
    trunkMesh.count = trees.length
    crownMesh.count = crownIndex
    outlineMesh.count = crownIndex
    trunkMesh.instanceMatrix.needsUpdate = true
    crownMesh.instanceMatrix.needsUpdate = true
    outlineMesh.instanceMatrix.needsUpdate = true
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true
    trunkMesh.computeBoundingSphere()
    crownMesh.computeBoundingSphere()
    outlineMesh.computeBoundingSphere()
  }, [trees, foliage])

  return <group>
    <instancedMesh ref={trunks} args={[trunkGeometry, getToonMaterial('#5a4030'), MAX_TREES]} castShadow frustumCulled={false} />
    <instancedMesh ref={crowns} args={[sphere, crownMaterial, MAX_TREES * CROWNS.length]} castShadow receiveShadow frustumCulled={false} />
    <instancedMesh ref={outlines} args={[sphere, outlineMaterial, MAX_TREES * CROWNS.length]} frustumCulled={false} />
  </group>
}
