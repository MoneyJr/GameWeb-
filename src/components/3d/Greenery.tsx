import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRID_SIZE, TileType, type Grid } from '../../types/city'
import { getGradientMap } from './primitives'

const OFFSET = (GRID_SIZE - 1) / 2
const MAX_TREES = 3000
/** Пышное дерево — 4 гранёных «облака» разного размера. */
const CLUSTER: Array<[number, number, number, number]> = [[0, 0.4, 0, 0.2], [0.13, 0.46, 0.06, 0.15], [-0.12, 0.44, -0.07, 0.14], [0.02, 0.58, -0.02, 0.13]]

function hash(x: number, y: number, salt: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return value - Math.floor(value)
}

type Tree = { x: number; z: number; scale: number; color: number; pine: boolean }

/**
 * Деревья вокруг застройки, как в иллюстрированных городах: пышные гранёные кроны и ели.
 * Растут на пустых клетках рядом со зданиями и исчезают, когда клетку застраивают.
 */
export function Greenery({ grid, foliage }: { grid: Grid; foliage: string[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const crownOutlines = useRef<THREE.InstancedMesh>(null)
  const pines = useRef<THREE.InstancedMesh>(null)
  const pineOutlines = useRef<THREE.InstancedMesh>(null)
  const geometries = useMemo(() => ({
    trunk: new THREE.CylinderGeometry(0.018, 0.028, 0.32, 5).translate(0, 0.16, 0),
    crown: new THREE.IcosahedronGeometry(1, 1),
    pine: new THREE.ConeGeometry(0.16, 0.62, 7).translate(0, 0.42, 0),
  }), [])
  const materials = useMemo(() => {
    const toon = (color: string) => {
      const material = new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() })
      ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
      return material
    }
    return {
      trunk: toon('#4f3a2b'),
      crown: toon('#ffffff'),
      pine: toon('#ffffff'),
      outline: new THREE.MeshBasicMaterial({ color: '#1b1a17', side: THREE.BackSide }),
    }
  }, [])

  const trees = useMemo(() => {
    const built = new Uint8Array(GRID_SIZE * GRID_SIZE)
    for (const row of grid) for (const cell of row) if (cell.type !== TileType.EMPTY && cell.type !== TileType.ROAD) built[cell.y * GRID_SIZE + cell.x] = 1
    const result: Tree[] = []
    for (const row of grid) for (const cell of row) {
      if (cell.type !== TileType.EMPTY) continue
      let nearest = 99
      for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
        const nx = cell.x + dx, ny = cell.y + dy
        if (nx >= 0 && ny >= 0 && nx < GRID_SIZE && ny < GRID_SIZE && built[ny * GRID_SIZE + nx]) nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dy)))
      }
      if (nearest > 3) continue
      // Вплотную к домам — редкие деревья, дальше — густые рощи.
      const density = nearest <= 1 ? 0.3 : nearest === 2 ? 0.55 : 0.7
      if (hash(cell.x, cell.y, 1) > density) continue
      const count = 1 + Math.floor(hash(cell.x, cell.y, 2) * (nearest >= 2 ? 3 : 1.6))
      for (let i = 0; i < count && result.length < MAX_TREES; i += 1) {
        result.push({
          x: cell.x - OFFSET + (hash(cell.x, cell.y, 3 + i) - 0.5) * 0.7,
          z: cell.y - OFFSET + (hash(cell.x, cell.y, 5 + i) - 0.5) * 0.7,
          scale: 0.8 + hash(cell.x, cell.y, 7 + i) * 0.7,
          color: Math.floor(hash(cell.x, cell.y, 9 + i) * foliage.length),
          pine: hash(cell.x, cell.y, 11 + i) < 0.22,
        })
      }
    }
    return result
  }, [grid, foliage])

  useLayoutEffect(() => {
    const trunkMesh = trunks.current, crownMesh = crowns.current, crownLine = crownOutlines.current, pineMesh = pines.current, pineLine = pineOutlines.current
    if (!trunkMesh || !crownMesh || !crownLine || !pineMesh || !pineLine) return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    let crownIndex = 0, pineIndex = 0
    trees.forEach((tree, index) => {
      rotation.setFromAxisAngle(up, tree.x * 3.1 + tree.z)
      matrix.compose(position.set(tree.x, 0, tree.z), rotation, scale.setScalar(tree.scale))
      trunkMesh.setMatrixAt(index, matrix)
      color.set(foliage[tree.color])
      if (tree.pine) {
        // Ели темнее и холоднее основной листвы.
        color.offsetHSL(0.02, -0.05, -0.08)
        matrix.compose(position.set(tree.x, 0, tree.z), rotation, scale.set(tree.scale, tree.scale * 1.1, tree.scale))
        pineMesh.setMatrixAt(pineIndex, matrix)
        pineMesh.setColorAt(pineIndex, color)
        matrix.compose(position.set(tree.x, -0.01, tree.z), rotation, scale.set(tree.scale * 1.08, tree.scale * 1.14, tree.scale * 1.08))
        pineLine.setMatrixAt(pineIndex, matrix)
        pineIndex += 1
        return
      }
      CLUSTER.forEach(([cx, cy, cz, r], part) => {
        position.set(tree.x + cx * tree.scale, cy * tree.scale, tree.z + cz * tree.scale)
        matrix.compose(position, rotation, scale.setScalar(r * tree.scale))
        crownMesh.setMatrixAt(crownIndex, matrix)
        const tone = color.clone().offsetHSL(0, 0, part === 1 ? 0.05 : part === 2 ? -0.05 : part === 3 ? 0.08 : 0)
        crownMesh.setColorAt(crownIndex, tone)
        matrix.compose(position, rotation, scale.setScalar(r * tree.scale * 1.1))
        crownLine.setMatrixAt(crownIndex, matrix)
        crownIndex += 1
      })
    })
    trunkMesh.count = trees.length
    crownMesh.count = crownIndex
    crownLine.count = crownIndex
    pineMesh.count = pineIndex
    pineLine.count = pineIndex
    for (const mesh of [trunkMesh, crownMesh, crownLine, pineMesh, pineLine]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [trees, foliage])

  return <group>
    <instancedMesh ref={trunks} args={[geometries.trunk, materials.trunk, MAX_TREES]} castShadow frustumCulled={false} />
    <instancedMesh ref={crowns} args={[geometries.crown, materials.crown, MAX_TREES * CLUSTER.length]} castShadow receiveShadow frustumCulled={false} />
    <instancedMesh ref={crownOutlines} args={[geometries.crown, materials.outline, MAX_TREES * CLUSTER.length]} frustumCulled={false} />
    <instancedMesh ref={pines} args={[geometries.pine, materials.pine, MAX_TREES]} castShadow receiveShadow frustumCulled={false} />
    <instancedMesh ref={pineOutlines} args={[geometries.pine, materials.outline, MAX_TREES]} frustumCulled={false} />
  </group>
}
