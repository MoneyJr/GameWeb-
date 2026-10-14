import { TrafficSystem } from './TrafficSystem'
import { LivingCityParticles } from './LivingCityParticles'
import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { MapControls as ThreeMapControls } from 'three-stdlib'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
import { BUILDING_BY_ID } from '../../store/buildingCatalog'
import { GRID_SIZE, TileType, ToolId, type Grid } from '../../types/city'
import { TileModel } from './BuildingMeshes'
import { useI18n } from '../../i18n/I18nProvider'
import { InkOutlinePassEffect, ToonShadingSetup } from './InkOutlinePass'

const CAMERA_POSITION: [number, number, number] = [28, 32, 28]
/** Полярный угол камеры рассчитывается из заданного изометрического положения. */
const ISO_POLAR_ANGLE = Math.acos(CAMERA_POSITION[1] / Math.hypot(...CAMERA_POSITION))
const PAN_LIMIT = GRID_SIZE / 2 + 4

type Cell = { x: number; y: number }

/** Минимальный срез API OrbitControls, который нужен для ограничения панорамирования. */
interface PannableControls {
  target: THREE.Vector3
  object: THREE.Object3D
  domElement?: HTMLElement
  enabled: boolean
  dollyIn: (scale: number) => void
  dollyOut: (scale: number) => void
  update: () => void
}

/** Значение "кнопка ничего не делает" для OrbitControls (в типах drei null не допускается). */
const MOUSE_NONE = -1 as THREE.MOUSE

function SceneCompiler({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let active = true
    void gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .finally(() => { if (active) onReady() })
    return () => { active = false }
  }, [camera, gl, onReady, scene])
  return null
}

function StableMapControls({
  target,
  controlsRef,
  isTouchDevice,
}: {
  target: [number, number, number]
  controlsRef: MutableRefObject<PannableControls | null>
  isTouchDevice: boolean
}) {
  const { camera, gl, get, set } = useThree()
  const controls = useMemo(() => new ThreeMapControls(camera, gl.domElement), [camera, gl])

  useEffect(() => {
    const previousControls = get().controls
    set({ controls })
    return () => set({ controls: previousControls })
  }, [controls, get, set])

  useEffect(() => {
    controlsRef.current = controls
    controls.enabled = true
    controls.enablePan = true
    controls.enableZoom = true
    controls.enableRotate = !isTouchDevice
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.screenSpacePanning = false
    controls.panSpeed = 1.2
    controls.zoomSpeed = 1
    controls.minZoom = 20
    controls.maxZoom = 250
    controls.minPolarAngle = ISO_POLAR_ANGLE
    controls.maxPolarAngle = ISO_POLAR_ANGLE
    controls.target.set(...target)
    controls.mouseButtons = {
      LEFT: MOUSE_NONE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
    controls.update()

    const onChange = () => {
      const dx = THREE.MathUtils.clamp(controls.target.x, -PAN_LIMIT, PAN_LIMIT) - controls.target.x
      const dz = THREE.MathUtils.clamp(controls.target.z, -PAN_LIMIT, PAN_LIMIT) - controls.target.z
      if (dx !== 0 || dz !== 0) {
        controls.target.x += dx
        controls.target.z += dz
        controls.object.position.x += dx
        controls.object.position.z += dz
      }
    }
    controls.addEventListener('change', onChange)

    const activeTouchPointers = new Set<number>()
    const rememberTouch = (event: PointerEvent) => {
      if (event.pointerType === 'touch') activeTouchPointers.add(event.pointerId)
    }
    const forgetTouch = (event: PointerEvent) => activeTouchPointers.delete(event.pointerId)
    const cancelTouchPointers = () => {
      for (const pointerId of activeTouchPointers) {
        gl.domElement.dispatchEvent(new PointerEvent('pointercancel', {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
        }))
      }
      activeTouchPointers.clear()
    }
    const recoverWindowPointerUp = (event: PointerEvent) => {
      if (!activeTouchPointers.has(event.pointerId)) return
      activeTouchPointers.delete(event.pointerId)
      gl.domElement.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        pointerId: event.pointerId,
        pointerType: 'touch',
      }))
    }
    const recoverTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) cancelTouchPointers()
    }

    gl.domElement.addEventListener('pointerdown', rememberTouch, true)
    gl.domElement.addEventListener('pointerup', forgetTouch, true)
    gl.domElement.addEventListener('pointercancel', forgetTouch, true)
    window.addEventListener('pointerup', recoverWindowPointerUp)
    window.addEventListener('touchend', recoverTouchEnd, { passive: true })
    window.addEventListener('touchcancel', cancelTouchPointers, { passive: true })

    return () => {
      controlsRef.current = null
      controls.removeEventListener('change', onChange)
      gl.domElement.removeEventListener('pointerdown', rememberTouch, true)
      gl.domElement.removeEventListener('pointerup', forgetTouch, true)
      gl.domElement.removeEventListener('pointercancel', forgetTouch, true)
      window.removeEventListener('pointerup', recoverWindowPointerUp)
      window.removeEventListener('touchend', recoverTouchEnd)
      window.removeEventListener('touchcancel', cancelTouchPointers)
    }
  }, [controls, controlsRef, gl.domElement, isTouchDevice, target[0], target[1], target[2]])

  useFrame(() => controls.update(), -1)
  return <primitive object={controls} />
}

function SceneLoadingOverlay() {
  const { t } = useI18n()
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#eae4d5]/65 backdrop-blur-[2px]" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full border border-[#34312b]/20 bg-[#fbf9f4]/90 px-5 py-3 text-sm font-semibold text-[#514b40] shadow-lg">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#a6653d]/25 border-t-[#a6653d]" />
        {t('title.loading1')}
      </div>
    </div>
  )
}

function cellToWorld(x: number, y: number): [number, number, number] {
  const offset = (GRID_SIZE - 1) / 2
  return [x - offset, 0, y - offset]
}

function catalogCenterOffset(catalogId?: string, orientation = 0): [number, number] {
  const footprint = catalogId ? BUILDING_BY_ID[catalogId]?.footprint : undefined
  if (!footprint) return [0, 0]
  const width = orientation % 2 ? footprint[1] : footprint[0]
  const depth = orientation % 2 ? footprint[0] : footprint[1]
  return [(width - 1) / 2, (depth - 1) / 2]
}

function worldToCell(worldX: number, worldZ: number): Cell | null {
  const half = GRID_SIZE / 2
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) return null
  if (worldX < -half || worldZ < -half || worldX >= half || worldZ >= half) return null
  return {
    x: Math.floor(worldX + half),
    y: Math.floor(worldZ + half),
  }
}

/** Все клетки на отрезке между двумя клетками (алгоритм Брезенхэма) — чтобы линия дорог не имела дыр. */
function cellsBetween(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = []
  let { x, y } = from
  const dx = Math.abs(to.x - x)
  const dy = Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let err = dx - dy
  for (;;) {
    cells.push({ x, y })
    if (x === to.x && y === to.y) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
  return cells
}

/* -------------------------------------------------------------------------- */
/*  Мир: земля, сетка и все построенные тайлы                                   */
/* -------------------------------------------------------------------------- */

export const GroundSlab = memo(function GroundSlab() {
  const gridLines = useMemo(() => {
    const helper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, '#2a3420', '#2a3420')
    if (helper.material instanceof THREE.Material) {
      helper.material.transparent = true
      helper.material.opacity = 0.12
    }
    return helper
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[350, 350]} />
        <meshToonMaterial color="#cfb997" />
      </mesh>
      <primitive object={gridLines} position={[0, 0.003, 0]} />
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[350, 350]} />
        <shadowMaterial color="#383f4d" transparent opacity={0.28} />
      </mesh>
    </group>
  )
})

export const NaturalHorizon = memo(function NaturalHorizon() {
  const scenery = useMemo(() => {
    const root = new THREE.Group()
    const treeCount = 1200
    const trunkGeometry = new THREE.CylinderGeometry(0.075, 0.12, 0.9, 6)
    const crownGeometry = new THREE.IcosahedronGeometry(0.7, 1)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#493629', roughness: 1 })
    const crownMaterial = new THREE.MeshToonMaterial({ color: '#ea580c' }) as THREE.MeshToonMaterial & { flatShading: boolean }
    crownMaterial.flatShading = true
    trunkMaterial.fog = false
    crownMaterial.fog = false
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount)
    const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, treeCount)
    trunks.castShadow = true
    crowns.castShadow = true
    trunks.receiveShadow = true
    crowns.receiveShadow = true
    // This forest spans multiple distant clusters; let Three draw the clusters independently of a local frustum bound.
    trunks.frustumCulled = false
    crowns.frustumCulled = false
    const transform = new THREE.Object3D()
    // Two staggered, overlapping woodland belts form a continuous natural edge
    // beyond the 64-cell buildable square. The playfield stays clear for roads.
    const clusters: [number, number][] = Array.from({ length: 32 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2
      const radius = index % 2 ? 56 : 43
      return [Math.cos(angle) * radius, Math.sin(angle) * radius]
    })
    const greens = ['#ea580c', '#c02626', '#eab308', '#854d0e', '#c25b2a']
    let seed = 81273
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < treeCount; i += 1) {
      const cluster = clusters[i % clusters.length]
      let x = 0
      let z = 0
      do {
        x = cluster[0] + (random() + random() + random() - 1.5) * 6
        z = cluster[1] + (random() + random() + random() - 1.5) * 6
      } while (Math.abs(x) < GRID_SIZE / 2 + 2 && Math.abs(z) < GRID_SIZE / 2 + 2)
      const scale = 0.7 + random() * 1.05
      const yaw = random() * Math.PI * 2
      transform.position.set(x, 0.45 * scale, z)
      transform.rotation.set(0, yaw, 0)
      transform.scale.set(scale, scale * (0.82 + random() * 0.45), scale)
      transform.updateMatrix()
      trunks.setMatrixAt(i, transform.matrix)
      transform.position.y = 1.1 * scale
      transform.scale.set(scale * (0.85 + random() * 0.3), scale * (0.9 + random() * 0.4), scale * (0.85 + random() * 0.3))
      transform.updateMatrix()
      crowns.setMatrixAt(i, transform.matrix)
      crowns.setColorAt(i, new THREE.Color(greens[Math.floor(random() * greens.length)]))
    }
    trunks.instanceMatrix.needsUpdate = true
    crowns.instanceMatrix.needsUpdate = true
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true
    trunks.computeBoundingSphere()
    crowns.computeBoundingSphere()
    root.add(trunks, crowns)

    const leafColors = ['#ea580c', '#c02626', '#eab308', '#854d0e']
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), 420)
    leaves.frustumCulled = false
    for (let i = 0; i < leaves.count; i += 1) {
      const cluster = clusters[i % clusters.length]
      transform.position.set(cluster[0] + (random() - 0.5) * 16, 0.008, cluster[1] + (random() - 0.5) * 16)
      transform.rotation.set(-Math.PI / 2, random() * Math.PI, random() * Math.PI)
      transform.scale.setScalar(0.4 + random() * 1.1)
      transform.updateMatrix()
      leaves.setMatrixAt(i, transform.matrix)
      leaves.setColorAt(i, new THREE.Color(leafColors[Math.floor(random() * leafColors.length)]))
    }
    leaves.instanceMatrix.needsUpdate = true
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true
    root.add(leaves)

    const hillColors = ['#c49a45', '#a36f32', '#8b7355']
    const hillSpecs = [
      [-48, -78, 12, 3.4, 9], [-24, -84, 15, 4.8, 12], [18, -88, 17, 4.1, 13], [52, -76, 13, 3.5, 10],
      [-78, -12, 14, 4.2, 11], [80, 20, 15, 4.8, 12], [-65, 68, 18, 5, 13], [8, 82, 20, 4.5, 14], [70, 64, 16, 4.1, 12],
    ]
    hillSpecs.forEach(([x, z, sx, sy, sz], index) => {
      const hillMaterial = new THREE.MeshToonMaterial({ color: hillColors[index % hillColors.length] })
      ;(hillMaterial as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), hillMaterial)
      hill.position.set(x, sy * 0.65 - 0.3, z)
      hill.scale.set(sx, sy, sz)
      hill.castShadow = true
      hill.receiveShadow = true
      const hillOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(hill.geometry, 28),
        new THREE.LineBasicMaterial({ color: '#261c14', transparent: true, opacity: 0.75 }),
      )
      hill.add(hillOutline)
      root.add(hill)
      const lowerRidgeMaterial = new THREE.MeshToonMaterial({ color: hillColors[(index + 1) % hillColors.length] })
      ;(lowerRidgeMaterial as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
      const lowerRidge = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), lowerRidgeMaterial)
      lowerRidge.position.set(x + (index % 2 ? -sx * 0.58 : sx * 0.58), 0.02, z + sz * 0.22)
      lowerRidge.scale.set(sx * 0.9, sy * 0.46, sz * 0.78)
      lowerRidge.castShadow = true
      lowerRidge.receiveShadow = true
      root.add(lowerRidge)
    })
    // Draw vineyard terraces as two instanced layers so the distant slopes read
    // as cultivated land without adding hundreds of separate draw calls.
    const vineColors = ['#ea580c', '#ca8a04', '#c02626', '#eab308']
    const rowMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.045, 0.1),
      new THREE.MeshToonMaterial({ color: '#795b36' }),
      hillSpecs.length * 5,
    )
    const vineLeafMaterial = new THREE.MeshToonMaterial({ color: '#ffffff' })
    ;(vineLeafMaterial as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    const leafMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      vineLeafMaterial,
      hillSpecs.length * 5 * 9,
    )
    let rowIndex = 0
    let leafIndex = 0
    hillSpecs.forEach(([x, z, sx, sy, sz], hillIndex) => {
      for (let row = 0; row < 5; row += 1) {
        const localZ = (row - 2) * sz * 0.19
        const profile = Math.sqrt(Math.max(0.12, 1 - (localZ * localZ) / (sz * sz)))
        const y = sy * 0.65 - 0.3 + sy * profile * 0.54 + 0.05
        transform.position.set(x, y, z + localZ)
        transform.rotation.set(0, (hillIndex % 2) * Math.PI / 2, 0)
        transform.scale.set(sx * 1.7, 1, 1)
        transform.updateMatrix()
        rowMesh.setMatrixAt(rowIndex, transform.matrix)
        for (let vine = 0; vine < 9; vine += 1) {
          const t = vine / 8 - 0.5
          const vx = x + t * sx * 1.35
          const vz = z + localZ
          transform.position.set(vx, y + 0.08 + random() * 0.05, vz + (random() - 0.5) * 0.13)
          transform.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3)
          transform.scale.setScalar(0.65 + random() * 0.55)
          transform.updateMatrix()
          leafMesh.setMatrixAt(leafIndex, transform.matrix)
          leafMesh.setColorAt(leafIndex, new THREE.Color(vineColors[(vine + row + hillIndex) % vineColors.length]))
          leafIndex += 1
        }
        rowIndex += 1
      }
    })
    rowMesh.instanceMatrix.needsUpdate = true
    leafMesh.instanceMatrix.needsUpdate = true
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true
    rowMesh.castShadow = true
    leafMesh.castShadow = true
    root.add(rowMesh, leafMesh)
    const riverCenter = (x: number) => -39 + Math.sin(x * 0.045) * 5.6 + Math.sin(x * 0.105) * 1.4
    const ribbon = (halfWidth: number, side = 0, edgeOffset = 0) => {
      const positions: number[] = []
      const indices: number[] = []
      const samples = 180
      for (let i = 0; i <= samples; i += 1) {
        const x = -105 + (210 * i) / samples
        const z = riverCenter(x)
        positions.push(x, 0.012 + side * 0.001, z + edgeOffset - halfWidth, x, 0.012 + side * 0.001, z + edgeOffset + halfWidth)
        if (i < samples) {
          const a = i * 2
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      return geometry
    }
    const riverBanks = new THREE.Mesh(ribbon(4.05), new THREE.MeshToonMaterial({ color: '#c49a45', side: THREE.DoubleSide }))
    const river = new THREE.Mesh(ribbon(3.35, 1), new THREE.MeshToonMaterial({ color: '#2b6cb0', side: THREE.DoubleSide }))
    riverBanks.receiveShadow = true
    river.receiveShadow = true
    root.add(riverBanks, river)
    for (const side of [-1, 1]) {
      const foam = new THREE.Mesh(ribbon(0.26, 2, side * 3.48), new THREE.MeshBasicMaterial({ color: '#f1eadb', transparent: true, opacity: 0.82, side: THREE.DoubleSide }))
      // Pale ribbons mark the waterline with a soft illustrated foam edge.
      root.add(foam)
    }
    return root
  }, [])

  return <primitive object={scenery} />
})

const World = memo(function World({ grid }: { grid: Grid }) {
  const isRoad = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && grid[y][x].type === TileType.ROAD
  return (
    <group>
      {grid[0].map((cell) => {
        const crossesNorthEdge = cell.type === TileType.ROAD && grid[1][cell.x]?.type === TileType.ROAD
        if (!crossesNorthEdge) return null
        const x = cell.x - (GRID_SIZE - 1) / 2
        const riverZ = -39 + Math.sin(x * 0.045) * 5.6 + Math.sin(x * 0.105) * 1.4
        return <StoneArchBridge key={`bridge-${cell.x}`} x={x} riverZ={riverZ} />
      })}
      {grid.flat().map((cell) => {
        if (cell.type === TileType.EMPTY) return null
        const orientation = cell.orientation ?? 0
        const [offsetX, offsetZ] = catalogCenterOffset(cell.catalogId, orientation)
        // Keep five homes in the CityRT visual reference strip.
        return (
          <group key={`${cell.x}:${cell.y}`} position={cellToWorld(cell.x + offsetX, cell.y + offsetZ)} rotation={[0, orientation * Math.PI / 2, 0]}>
            <TileModel
              key={cell.type}
              type={cell.type}
              catalogId={cell.catalogId}
              variant={(cell.x * 7 + cell.y * 13) % 4}
              hasWater={cell.hasWater}
              hasPower={cell.hasPower}
              hasSupplies={cell.hasSupplies}
              level={cell.level}
              smog={cell.smog}
              animate={cell.animate ?? true}
              style={cell.style}
              north={isRoad(cell.x, cell.y - 1)}
              south={isRoad(cell.x, cell.y + 1)}
              east={isRoad(cell.x + 1, cell.y)}
              west={isRoad(cell.x - 1, cell.y)}
            />
          </group>
        )
      })}
    </group>
  )
})

function StoneArchBridge({ x, riverZ }: { x: number; riverZ: number }) {
  const boundaryZ = -(GRID_SIZE - 1) / 2 - 0.5
  const length = Math.max(8.5, boundaryZ - riverZ + 4)
  const centerZ = (boundaryZ + riverZ) / 2
  const postCount = Math.max(6, Math.floor(length / 1.15))
  const archGeometry = useMemo(() => {
    const points = Array.from({ length: 13 }, (_, i) => {
      const z = -length / 2 + (length * i) / 12
      const t = i / 12
      return new THREE.Vector3(0, 0.08 + Math.sin(t * Math.PI) * 0.2, z)
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.12, 6, false)
  }, [length])
  return <group position={[x, 0, centerZ]}>
    <mesh position={[0, 0.35, 0]} castShadow receiveShadow><boxGeometry args={[2.05, 0.28, length]} /><meshToonMaterial color="#b6aa95" /><Edges color="#261c14" threshold={28} /></mesh>
    {[-0.94, 0.94].map(side => <group key={side}>
      <mesh geometry={archGeometry} position={[side, 0, 0]} castShadow><meshToonMaterial color="#9d907d" /><Edges color="#261c14" threshold={28} /></mesh>
      <mesh position={[side, 0.62, 0]} castShadow><boxGeometry args={[0.16, 0.42, length]} /><meshToonMaterial color="#c8bca7" /><Edges color="#261c14" threshold={28} /></mesh>
      {Array.from({ length: postCount }, (_, i) => <mesh key={i} position={[side, 0.92, -length / 2 + (length * i) / (postCount - 1)]} castShadow><boxGeometry args={[0.22, 0.2, 0.2]} /><meshToonMaterial color="#d2c5af" /><Edges color="#261c14" threshold={28} /></mesh>)}
    </group>)}
  </group>
}

/* -------------------------------------------------------------------------- */
/*  Интерактивный слой: Hover Plane + подсветка тайла + "рисование" мышью         */
/* -------------------------------------------------------------------------- */

interface InteractionLayerProps {
  grid: Grid
  activeTool: ToolId
  onPlace: (x: number, y: number, catalogId?: string, orientation?: 0 | 1 | 2 | 3) => void
  onRemove: (x: number, y: number) => void
  onSelectCell: (x: number, y: number) => void
  isTouchDevice: boolean
  onTouchPreview: (cell: Cell) => void
  onRoadLinePreview: (cells: Cell[]) => void
  onRoadDragState: (dragging: boolean) => void
  onPlacementTooltip: (tooltip: PlacementTooltip | null) => void
  ghost: TouchGhost | null
  placementStyle?: string
  catalogId?: string
  orientation: 0 | 1 | 2 | 3
}

interface TouchGhost {
  cells: Cell[]
}

interface PlacementTooltip {
  x: number
  y: number
  valid: boolean
  reason: string | null
  tool: ToolId
  catalogId?: string
}

function placementFootprint(tool: ToolId, catalogId?: string, style?: string, orientation = 0): [number, number] {
  const footprint = catalogId ? BUILDING_BY_ID[catalogId]?.footprint : undefined
  if (footprint) return orientation % 2 ? [footprint[1], footprint[0]] : footprint
  if (tool === ToolId.CITY_HALL) return [2, 2]
  if (tool === ToolId.PARK && style === 'PARK') return [2, 2]
  if (tool === ToolId.PARK && style === 'LARGE_PARK') return [3, 3]
  return [1, 1]
}

function validatePlacement(grid: Grid, cell: Cell, tool: ToolId, catalogId?: string, style?: string, orientation = 0): string | null {
  const [width, depth] = placementFootprint(tool, catalogId, style, orientation)
  if (cell.x < 0 || cell.y < 0 || cell.x + width > GRID_SIZE || cell.y + depth > GRID_SIZE) return 'ghost.outOfBounds'
  for (let y = cell.y; y < cell.y + depth; y += 1) {
    for (let x = cell.x; x < cell.x + width; x += 1) {
      if (grid[y][x].type !== TileType.EMPTY) return 'ghost.occupied'
    }
  }
  if (tool === ToolId.ROAD) return null
  for (let x = cell.x; x < cell.x + width; x += 1) {
    if (cell.y > 0 && grid[cell.y - 1][x].type === TileType.ROAD) return null
    if (cell.y + depth < GRID_SIZE && grid[cell.y + depth][x].type === TileType.ROAD) return null
  }
  for (let y = cell.y; y < cell.y + depth; y += 1) {
    if (cell.x > 0 && grid[y][cell.x - 1].type === TileType.ROAD) return null
    if (cell.x + width < GRID_SIZE && grid[y][cell.x + width].type === TileType.ROAD) return null
  }
  return 'ghost.road'
}

function straightCellLine(start: Cell, end: Cell): Cell[] {
  const useX = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
  const target = useX
    ? { x: THREE.MathUtils.clamp(end.x, 0, GRID_SIZE - 1), y: start.y }
    : { x: start.x, y: THREE.MathUtils.clamp(end.y, 0, GRID_SIZE - 1) }
  const dx = Math.sign(target.x - start.x)
  const dy = Math.sign(target.y - start.y)
  const length = Math.max(Math.abs(target.x - start.x), Math.abs(target.y - start.y))
  return Array.from({ length: length + 1 }, (_, index) => ({ x: start.x + dx * index, y: start.y + dy * index }))
}


function FootprintCell({ cell, tint }: { cell: Cell; tint: string }) {
  return <mesh userData={{ noInkOutline: true }} position={[cell.x - (GRID_SIZE - 1) / 2, 0.026, cell.y - (GRID_SIZE - 1) / 2]} renderOrder={15}>
    <boxGeometry args={[0.96, 0.025, 0.96]} />
    <meshBasicMaterial color={tint} transparent opacity={0.5} depthWrite={false} depthTest />
  </mesh>
}

function HoverHighlight({ color }: { color: string }) {
  return (
    <mesh position={[0, 0.018, 0]} renderOrder={10}>
      <boxGeometry args={[0.94, 0.012, 0.94]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
      <Edges color="#1a1a1a" />
    </mesh>
  )
}

function GhostTilePreview({ tool, cell, style, catalogId, tint, roadLinks, orientation = 0 }: { tool: ToolId; cell: Cell; style?: string; catalogId?: string; tint: string; roadLinks: { north: boolean; south: boolean; east: boolean; west: boolean }; orientation?: number }) {
  const group = useRef<THREE.Group>(null)
  const tile = TOOL_DEFINITIONS[tool].tile

  useLayoutEffect(() => {
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    group.current?.traverse((object) => {
      if (object instanceof THREE.Line || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
        object.visible = false
        return
      }
      if (!(object instanceof THREE.Mesh)) return
      object.material = ghostMaterial
      object.raycast = () => undefined
    })
    return () => ghostMaterial.dispose()
  }, [tool, tint, cell.x, cell.y, catalogId])

  if (!tile) return null
  const [offsetX, offsetZ] = catalogCenterOffset(catalogId, orientation)
  return (
    <group ref={group} userData={{ noInkOutline: true }} position={cellToWorld(cell.x + offsetX, cell.y + offsetZ)} rotation={[0, orientation * Math.PI / 2, 0]} scale={[1, 1, 1]} renderOrder={20}>
      <TileModel type={tile} style={style} catalogId={catalogId} animate={false} hasWater hasPower hasSupplies {...roadLinks} />
    </group>
  )
}

function InteractionLayer({ grid, activeTool, onPlace, onRemove, onSelectCell, isTouchDevice, onTouchPreview, onRoadLinePreview, onRoadDragState, onPlacementTooltip, ghost, placementStyle, catalogId, orientation }: InteractionLayerProps) {
  const { gl } = useThree()
  const [hoverState, setHoverState] = useState<{ cell: Cell; tool: ToolId; catalogId?: string } | null>(null)
  const hovered = hoverState?.tool === activeTool && hoverState.catalogId === catalogId ? hoverState.cell : null
  const setHovered = useCallback((cell: Cell | null) => setHoverState(cell ? { cell, tool: activeTool, catalogId } : null), [activeTool, catalogId])
  const painting = useRef(false)
  const lastCell = useRef<Cell | null>(null)
  const touchTap = useRef<{ pointerId: number; x: number; y: number; cell: Cell; moved: boolean } | null>(null)
  const roadDrag = useRef<{ pointerId: number; x: number; y: number; start: Cell } | null>(null)

  const act = useCallback(
    (cell: Cell) => {
      if (activeTool === ToolId.BULLDOZE) {
        if (grid[cell.y]?.[cell.x]?.type !== TileType.EMPTY) onRemove(cell.x, cell.y)
        setHovered(null)
      } else if (activeTool !== ToolId.CURSOR && validatePlacement(grid, cell, activeTool, catalogId, placementStyle, orientation) === null) {
        onPlace(cell.x, cell.y, catalogId, orientation)
        setHovered(null)
      }
    },
    [activeTool, catalogId, grid, onPlace, onRemove, placementStyle, orientation, setHovered],
  )
  const footprint = placementFootprint(activeTool, catalogId, placementStyle, orientation)

  useEffect(() => {
    const clearHover = () => { setHovered(null); onPlacementTooltip(null) }
    const clearOutsideCanvas = (event: PointerEvent) => {
      const bounds = gl.domElement.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) clearHover()
    }
    gl.domElement.addEventListener('pointerleave', clearHover)
    window.addEventListener('pointermove', clearOutsideCanvas)
    return () => {
      gl.domElement.removeEventListener('pointerleave', clearHover)
      window.removeEventListener('pointermove', clearOutsideCanvas)
    }
  }, [gl, onPlacementTooltip, setHovered])

  useEffect(() => {
    const trackTouchMove = (event: PointerEvent) => {
      const gesture = touchTap.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true
    }
    const stop = (event?: PointerEvent) => {
      if (roadDrag.current && event?.pointerId === roadDrag.current.pointerId) {
        roadDrag.current = null
        onRoadDragState(false)
      }
      const gesture = touchTap.current
      if (gesture && event?.pointerId === gesture.pointerId) {
        if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 10) {
          if (activeTool === ToolId.BULLDOZE) act(gesture.cell)
          else if (activeTool === ToolId.CURSOR) onSelectCell(gesture.cell.x, gesture.cell.y)
          else onTouchPreview(gesture.cell)
        }
        touchTap.current = null
      }
      painting.current = false
      lastCell.current = null
    }
    const cancel = (event: PointerEvent) => {
      if (roadDrag.current?.pointerId === event.pointerId) {
        roadDrag.current = null
        onRoadDragState(false)
      }
      if (touchTap.current?.pointerId === event.pointerId) touchTap.current = null
      painting.current = false
      lastCell.current = null
    }
    const clearOnBlur = () => {
      if (roadDrag.current) onRoadDragState(false)
      roadDrag.current = null
      touchTap.current = null
      painting.current = false
      lastCell.current = null
    }
    window.addEventListener('pointermove', trackTouchMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', clearOnBlur)
    return () => {
      window.removeEventListener('pointermove', trackTouchMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', clearOnBlur)
    }
  }, [act, activeTool, onSelectCell, onTouchPreview, onRoadDragState])

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const bounds = gl.domElement.getBoundingClientRect()
    const { x, z } = event.point
    const { clientX, clientY } = event.nativeEvent
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(clientX) || !Number.isFinite(clientY) || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
      setHovered(null)
      onPlacementTooltip(null)
      return
    }
    const cell = worldToCell(x, z)
    if (!cell) {
      setHovered(null)
      onPlacementTooltip(null)
      return
    }
    if (!hovered || hovered.x !== cell.x || hovered.y !== cell.y) setHovered(cell)
    if (event.nativeEvent.pointerType === 'touch' || activeTool === ToolId.CURSOR || activeTool === ToolId.BULLDOZE) {
      onPlacementTooltip(null)
    } else {
      const reason = validatePlacement(grid, cell, activeTool, catalogId, placementStyle, orientation)
      onPlacementTooltip({ x: clientX, y: clientY, valid: reason === null, reason, tool: activeTool, catalogId })
    }
    const drag = roadDrag.current
    if (drag?.pointerId === event.nativeEvent.pointerId) {
      if (Math.hypot(event.nativeEvent.clientX - drag.x, event.nativeEvent.clientY - drag.y) > 10) {
        onRoadLinePreview(straightCellLine(drag.start, cell))
      }
      return
    }
    const gesture = touchTap.current
    if (gesture?.pointerId === event.nativeEvent.pointerId) {
      if (Math.hypot(event.nativeEvent.clientX - gesture.x, event.nativeEvent.clientY - gesture.y) > 10) gesture.moved = true
      return
    }
    if (painting.current && lastCell.current !== null) {
      const previous = lastCell.current
      if (previous.x === cell.x && previous.y === cell.y) return
      for (const step of cellsBetween(previous, cell).slice(1)) act(step)
      lastCell.current = cell
    }
  }

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    const { x, z } = event.point
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    const cell = worldToCell(x, z)
    if (!cell) return
    if (event.nativeEvent.pointerType === 'touch') {
      if (!event.nativeEvent.isPrimary) {
        touchTap.current = null
        return
      }
      if (
        activeTool === ToolId.ROAD && ghost &&
        cell.x === ghost.cells[0]?.x && cell.y === ghost.cells[0]?.y
      ) {
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        roadDrag.current = { pointerId: event.nativeEvent.pointerId, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, start: ghost.cells[0] }
        onRoadDragState(true)
        return
      }
      touchTap.current = {
          pointerId: event.nativeEvent.pointerId,
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
          cell,
          moved: false,
        }
      return
    }
    if (event.nativeEvent.button !== 0) return
    if (activeTool === ToolId.CURSOR) {
      onSelectCell(cell.x, cell.y)
      return
    }
    painting.current = true
    lastCell.current = cell
    act(cell)
  }

  let highlightColor = '#c9aa71'
  if (hovered !== null) {
    const current = grid[hovered.y][hovered.x].type
    if (activeTool === ToolId.BULLDOZE) {
      highlightColor = current === TileType.EMPTY ? '#c9c4b5' : '#ff5a4d'
    } else if (activeTool !== ToolId.CURSOR) {
      highlightColor = validatePlacement(grid, hovered, activeTool, catalogId, placementStyle, orientation) === null ? '#10b981' : '#ef4444'
    }
  }

  return (
    <group>
      <mesh
        name="hover-plane"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        onPointerMove={handleMove}
        onPointerDown={handleDown}
        onPointerUp={(event) => {
          if (roadDrag.current?.pointerId === event.nativeEvent.pointerId) {
            roadDrag.current = null
            onRoadDragState(false)
          }
          const gesture = touchTap.current
          if (gesture?.pointerId === event.nativeEvent.pointerId) {
            if (!gesture.moved && Math.hypot(event.nativeEvent.clientX - gesture.x, event.nativeEvent.clientY - gesture.y) <= 10) {
              if (activeTool === ToolId.BULLDOZE) act(gesture.cell)
              else if (activeTool === ToolId.CURSOR) onSelectCell(gesture.cell.x, gesture.cell.y)
              else onTouchPreview(gesture.cell)
            }
            touchTap.current = null
          }
        }}
        onPointerCancel={(event) => {
          if (roadDrag.current?.pointerId === event.nativeEvent.pointerId) {
            roadDrag.current = null
            onRoadDragState(false)
          }
          if (touchTap.current?.pointerId === event.nativeEvent.pointerId) touchTap.current = null
        }}
        onPointerOut={() => { setHovered(null); onPlacementTooltip(null) }}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {hovered !== null && (
        <group position={cellToWorld(hovered.x, hovered.y)}>
            <HoverHighlight color={highlightColor} />
        </group>
      )}
      {(isTouchDevice ? ghost?.cells[0] : hovered) && activeTool !== ToolId.CURSOR && activeTool !== ToolId.BULLDOZE && (() => {
        const anchor = (isTouchDevice ? ghost?.cells[0] : hovered)!
        const roadCells = activeTool === ToolId.ROAD ? (isTouchDevice ? ghost?.cells ?? [] : [anchor]) : []
        const valid = activeTool === ToolId.ROAD
          ? roadCells.every((item) => validatePlacement(grid, item, activeTool, catalogId, placementStyle, orientation) === null)
          : validatePlacement(grid, anchor, activeTool, catalogId, placementStyle, orientation) === null
        const tint = valid ? '#10b981' : '#ef4444'
        const cells = activeTool === ToolId.ROAD ? roadCells : Array.from({ length: footprint[0] * footprint[1] }, (_, i) => ({ x: anchor.x + i % footprint[0], y: anchor.y + Math.floor(i / footprint[0]) }))
        const modelCells = activeTool === ToolId.ROAD ? roadCells : [anchor]
        return <group>
          {cells.map((item) => <FootprintCell key={`footprint-${item.x}-${item.y}`} cell={item} tint={tint} />)}
          {modelCells.map((item) => {
            const links = activeTool === ToolId.ROAD ? {
              north: (isTouchDevice ? ghost?.cells ?? [] : []).some((other) => other.x === item.x && other.y === item.y - 1),
              south: (isTouchDevice ? ghost?.cells ?? [] : []).some((other) => other.x === item.x && other.y === item.y + 1),
              east: (isTouchDevice ? ghost?.cells ?? [] : []).some((other) => other.x === item.x + 1 && other.y === item.y),
              west: (isTouchDevice ? ghost?.cells ?? [] : []).some((other) => other.x === item.x - 1 && other.y === item.y),
            } : { north: false, south: false, east: false, west: false }
            return <GhostTilePreview key={`ghost-model-${item.x}-${item.y}`} tool={activeTool} cell={item} style={placementStyle} catalogId={catalogId} tint={tint} roadLinks={links} orientation={orientation} />
          })}
        </group>
      })()}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Сцена                                                                        */
/* -------------------------------------------------------------------------- */

export interface CitySceneProps {
  grid: Grid
  activeTool: ToolId
  onPlace: (x: number, y: number, catalogId?: string, orientation?: 0 | 1 | 2 | 3) => void
  onRemove: (x: number, y: number) => void
  onSelectCell: (x: number, y: number) => void
  minutes: number
  budget?: number
  placementStyle?: string
  catalogId?: string
}

import { applyNightLevel } from './primitives'

const DAY_SKY = new THREE.Color('#e7d4b7')
const DUSK_SKY = new THREE.Color('#b889a2')
const NIGHT_COLOR = new THREE.Color('#141b2d')
const SUN_COLOR = new THREE.Color('#fff3db')
const DUSK_SUN_COLOR = new THREE.Color('#ff8c42')
const MOON_COLOR = new THREE.Color('#7aa2dc')
const DAY_AMBIENT = new THREE.Color('#e8d5be')
const DUSK_AMBIENT = new THREE.Color('#d89b91')
const NIGHT_AMBIENT = new THREE.Color('#243354')
const DAY_SUN_POSITION = new THREE.Vector3(30, 45, 25)
const DUSK_SUN_POSITION = new THREE.Vector3(20, 11, 14)
const MOON_POSITION = new THREE.Vector3(-24, 28, 14)

function calcNightLevel(minutes: number): number {
  if (minutes >= 1170 && minutes < 1260) {
    return (minutes - 1170) / 90
  }
  if (minutes >= 1260 || minutes < 300) {
    return 1
  }
  if (minutes >= 300 && minutes < 360) {
    return 1 - (minutes - 300) / 60
  }
  return 0
}

function NightManager({ minutes, ambientRef, sunRef }: {
  minutes: number
  ambientRef: MutableRefObject<THREE.AmbientLight | null>
  sunRef: MutableRefObject<THREE.DirectionalLight | null>
}) {
  const background = useMemo(() => new THREE.Color(), [])
  const ambientColor = useMemo(() => new THREE.Color(), [])
  const sunColor = useMemo(() => new THREE.Color(), [])
  const displayMinutes = useRef(minutes)
  useFrame(({ scene }, delta) => {
    // JavaScript's % keeps the sign of the dividend. Euclidean modulo keeps
    // the shortest cyclic delta stable when the clock crosses midnight.
    const minuteDelta = THREE.MathUtils.euclideanModulo(minutes - displayMinutes.current + 720, 1440) - 720
    displayMinutes.current = (displayMinutes.current + minuteDelta * (1 - Math.exp(-delta * 2.2)) + 1440) % 1440
    const time = displayMinutes.current
    const level = calcNightLevel(time)
    const ambient = ambientRef.current
    const sun = sunRef.current
    const sunAngle = (time / 1440) * Math.PI * 2
    const sunHeight = Math.sin(sunAngle - Math.PI / 2)
    const twilightFloor = Math.sin(Math.PI / 12)
    const dusk = time >= 1080 && time < 1260
      ? THREE.MathUtils.clamp(-sunHeight / Math.SQRT1_2, 0, 1)
      : 0
    const dawn = time >= 300 && time < 360
      ? THREE.MathUtils.clamp((sunHeight + twilightFloor) / twilightFloor, 0, 1)
      : 0

    if (time >= 360 && time < 1080) {
      background.copy(DAY_SKY)
      ambientColor.copy(DAY_AMBIENT)
      sunColor.copy(SUN_COLOR)
      ambient && (ambient.intensity = 0.5)
      sun && sun.position.copy(DAY_SUN_POSITION) && (sun.intensity = 1.7)
    } else if (time >= 1080 && time < 1260) {
      background.copy(DAY_SKY).lerp(DUSK_SKY, dusk)
      ambientColor.copy(DAY_AMBIENT).lerp(DUSK_AMBIENT, dusk)
      sunColor.copy(SUN_COLOR).lerp(DUSK_SUN_COLOR, dusk)
      ambient && (ambient.intensity = THREE.MathUtils.lerp(0.5, 0.38, dusk))
      if (sun) {
        sun.position.copy(DAY_SUN_POSITION).lerp(DUSK_SUN_POSITION, dusk)
        sun.intensity = THREE.MathUtils.lerp(1.7, 0.05, dusk)
      }
      if (dusk > 0.72) {
        const nightBlend = (dusk - 0.72) / 0.28
        background.lerp(NIGHT_COLOR, nightBlend)
        ambientColor.lerp(NIGHT_AMBIENT, nightBlend)
        sunColor.lerp(MOON_COLOR, nightBlend)
        if (sun) {
          sun.position.lerp(MOON_POSITION, nightBlend)
        sun.intensity = THREE.MathUtils.lerp(0.05, 0.55, nightBlend)
        }
        if (ambient) ambient.intensity = THREE.MathUtils.lerp(0.38, 0.7, nightBlend)
      }
    } else if (time >= 300 && time < 360) {
      background.copy(NIGHT_COLOR).lerp(DAY_SKY, dawn)
      ambientColor.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, dawn)
      sunColor.copy(MOON_COLOR).lerp(SUN_COLOR, dawn)
      ambient && (ambient.intensity = THREE.MathUtils.lerp(0.7, 0.5, dawn))
      if (sun) {
        sun.position.copy(MOON_POSITION).lerp(DAY_SUN_POSITION, dawn)
        sun.intensity = THREE.MathUtils.lerp(0.55, 1.7, dawn)
      }
    } else {
      background.copy(NIGHT_COLOR)
      ambientColor.copy(NIGHT_AMBIENT)
      sunColor.copy(MOON_COLOR)
      ambient && (ambient.intensity = 0.7)
      if (sun) {
        sun.position.copy(MOON_POSITION)
        sun.intensity = 0.55
      }
    }

    if (ambient) ambient.color.copy(ambientColor)
    if (sun) sun.color.copy(sunColor)
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(background)
      scene.fog.density = 0.0015
    }
    scene.background = background
    applyNightLevel(level)
  })
  return null
}

export function CityScene({ grid, activeTool, onPlace, onRemove, onSelectCell, minutes, budget = 0, placementStyle, catalogId }: CitySceneProps) {
  const { t } = useI18n()
  const [sceneReady, setSceneReady] = useState(false)
  const [touchGhost, setTouchGhost] = useState<TouchGhost | null>(null)
  const [orientation, setOrientation] = useState<0 | 1 | 2 | 3>(0)
  const [placementTooltip, setPlacementTooltip] = useState<PlacementTooltip | null>(null)
  const controlsRef = useRef<PannableControls | null>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const handleTouchPreview = useCallback((cell: Cell) => {
    setTouchGhost((current) => {
      if (!current) return { cells: [cell] }
      if (activeTool === ToolId.ROAD) return { cells: straightCellLine(current.cells[0], cell) }
      return current.cells[0].x === cell.x && current.cells[0].y === cell.y ? current : { cells: [cell] }
    })
  }, [activeTool])
  const handleRoadLinePreview = useCallback((cells: Cell[]) => {
    setTouchGhost((current) => {
      if (!current) return current
      if (current.cells.length === cells.length && current.cells.every((cell, index) => cell.x === cells[index].x && cell.y === cells[index].y)) return current
      return { cells }
    })
  }, [])
  const handleRoadDragState = useCallback((dragging: boolean) => {
    const controls = controlsRef.current as (PannableControls & { resetState?: () => void; state?: number }) | null
    if (!controls) return
    controls.enabled = !dragging
    if (!dragging) {
      controls.resetState?.()
      if (controls.state !== undefined) controls.state = -1
      controls.update()
    }
  }, [])
  const handlePlacementTooltip = useCallback((tooltip: PlacementTooltip | null) => setPlacementTooltip(tooltip), [])
  useEffect(() => { setTouchGhost(null); setOrientation(0) }, [activeTool, catalogId])
  const rotatePlacement = useCallback(() => setOrientation((value) => ((value + 1) % 4) as 0 | 1 | 2 | 3), [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'r' || activeTool === ToolId.CURSOR || activeTool === ToolId.BULLDOZE) return
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      event.preventDefault()
      rotatePlacement()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, rotatePlacement])
  const markSceneReady = useCallback(() => setSceneReady(true), [])
  const isReferencePreview = new URLSearchParams(window.location.search).get('preview') === 'cityrt'
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const cameraTarget: [number, number, number] = isReferencePreview ? [-0.5, 0, -0.5] : [0, 0, -3.5]
  const cameraPosition: [number, number, number] = [
    cameraTarget[0] + CAMERA_POSITION[0],
    CAMERA_POSITION[1],
    cameraTarget[2] + CAMERA_POSITION[2],
  ]
  const shadowMapSize: [number, number] = [2048, 2048]
  const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const preventCanvasGesture = (event: TouchEvent) => {
      const target = event.target
      if (target instanceof Node && canvasContainerRef.current?.contains(target) && event.cancelable) {
        event.preventDefault()
      }
    }
    window.addEventListener('touchmove', preventCanvasGesture, { passive: false })
    return () => window.removeEventListener('touchmove', preventCanvasGesture)
  }, [])
  const zoomBy = (direction: 'in' | 'out') => {
    const controls = controlsRef.current
    if (!controls || !(controls.object instanceof THREE.OrthographicCamera)) return
    const camera = controls.object
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (direction === 'in' ? 1.25 : 1 / 1.25), 20, 250)
    camera.updateProjectionMatrix()
    controls.update()
  }
  const unitCost = catalogId ? BUILDING_BY_ID[catalogId]?.cost ?? TOOL_DEFINITIONS[activeTool].cost : TOOL_DEFINITIONS[activeTool].cost
  const ghostCost = unitCost * (activeTool === ToolId.ROAD ? touchGhost?.cells.length ?? 1 : 1)
  const ghostPlacementError = touchGhost
    ? activeTool === ToolId.ROAD
      ? touchGhost.cells.map((cell) => validatePlacement(grid, cell, activeTool, catalogId, placementStyle, orientation)).find(Boolean) ?? null
      : validatePlacement(grid, touchGhost.cells[0], activeTool, catalogId, placementStyle, orientation)
    : null
  const ghostCanPlace = ghostPlacementError === null && budget >= ghostCost
  return (
    <>
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
      >
      <Canvas
      shadows={{ type: THREE.BasicShadowMap }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.BasicShadowMap
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.15
      }}
      onContextMenu={(e) => e.preventDefault()}
      dpr={[1, maxDpr]}
      gl={{ antialias: true }}
      className="absolute inset-0 touch-none select-none"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
      >
      <Suspense fallback={null}>
      <SceneCompiler onReady={markSceneReady} />
      <fogExp2 attach="fog" args={['#d5c7b2', 0.0015]} />
      <NightManager minutes={minutes} ambientRef={ambientRef} sunRef={sunRef} />
      {/* Remove <color attach="background" ... /> as it's managed by NightManager */}

      <OrthographicCamera makeDefault position={cameraPosition} zoom={isReferencePreview ? 90 : 56} near={-200} far={400} />

      <StableMapControls target={cameraTarget} controlsRef={controlsRef} isTouchDevice={isTouchDevice} />

      <ambientLight ref={ambientRef} intensity={0.5} color="#e8d5be" />
      <directionalLight
        ref={sunRef}
        position={[35, 50, 25]}
        intensity={1.7}
        color="#fff3db"
        castShadow
        shadow-mapSize={shadowMapSize}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
      />

      <GroundSlab />
      <NaturalHorizon />
      <World grid={grid} />
      <LivingCityParticles grid={grid} />
      <TrafficSystem grid={grid} />
      <InteractionLayer
        grid={grid}
        activeTool={activeTool}
        onPlace={onPlace}
        onRemove={onRemove}
        onSelectCell={onSelectCell}
        isTouchDevice={isTouchDevice}
        onTouchPreview={handleTouchPreview}
        onRoadLinePreview={handleRoadLinePreview}
        onRoadDragState={handleRoadDragState}
        onPlacementTooltip={handlePlacementTooltip}
        ghost={touchGhost}
        placementStyle={placementStyle}
        catalogId={catalogId}
        orientation={orientation}
      />
      <ToonShadingSetup />
      <InkOutlinePassEffect />
      </Suspense>
    </Canvas>
      </div>
      {placementTooltip && placementTooltip.tool === activeTool && placementTooltip.catalogId === catalogId && activeTool !== ToolId.CURSOR && activeTool !== ToolId.BULLDOZE && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-12 px-3 py-1.5 text-xs font-bold transition-all"
          style={{ left: placementTooltip.x, top: placementTooltip.y }}
          role="status"
        >
          <span className={`block whitespace-nowrap rounded-lg border px-2.5 py-1 shadow-lg backdrop-blur-md ${placementTooltip.valid ? 'border-emerald-300 bg-emerald-100/90 text-emerald-700' : 'border-rose-300 bg-rose-100/90 text-rose-700'}`}>
            {placementTooltip.valid ? t('ghost.available') : t(placementTooltip.reason ?? 'ghost.occupied')}
          </span>
        </div>
      )}
      {isTouchDevice && touchGhost && activeTool !== ToolId.CURSOR && activeTool !== ToolId.BULLDOZE && (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2"
          style={{ bottom: 'calc(9.5rem + env(safe-area-inset-bottom))' }}
          aria-label={t('ghost.confirm')}
        >
          {ghostPlacementError && <div role="status" className="rounded-full border border-red-900/20 bg-[#fffaf4]/95 px-3 py-1 text-xs font-bold text-red-700 shadow-md">{t(ghostPlacementError)}</div>}
          {!ghostPlacementError && budget < ghostCost && <div role="status" className="rounded-full border border-red-900/20 bg-[#fffaf4]/95 px-3 py-1 text-xs font-bold text-red-700 shadow-md">{t('ghost.noMoney')}</div>}
          <div className="flex justify-center gap-2">
            <button type="button" onClick={rotatePlacement} className="pointer-events-auto flex h-11 items-center justify-center gap-1 rounded-full border border-[#7a4b2e]/30 bg-[#fff7e9] px-3 text-xs font-bold text-[#714a30] shadow-md active:scale-95">↻ {t('ghost.rotate')}</button>
            <button
              type="button"
              disabled={!ghostCanPlace}
              onClick={() => {
                if (!ghostCanPlace) return
                touchGhost.cells.forEach((cell) => onPlace(cell.x, cell.y, catalogId, orientation))
                setTouchGhost(null)
              }}
              className={`pointer-events-auto flex h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-bold text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${ghostCanPlace ? 'border-emerald-900/30 bg-emerald-600' : 'border-red-900/30 bg-red-600'}`}
              aria-label={`${t('ghost.confirm')} $${ghostCost}`}
            >
              <span aria-hidden="true">✓</span><span>{t('ghost.confirm')} · ${ghostCost}</span>
            </button>
            <button
              type="button"
              onClick={() => setTouchGhost(null)}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-stone-500/40 bg-stone-600 text-xl font-bold text-white shadow-lg active:scale-95"
              aria-label={t('ghost.cancel')}
            >×</button>
          </div>
        </div>
      )}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 md:hidden" aria-label="Управление масштабом камеры">
        <button type="button" onClick={() => zoomBy('in')} aria-label="Приблизить" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[#292a2c]/35 bg-[#fbf9f4]/75 text-2xl font-medium text-[#292a2c] shadow-md backdrop-blur-sm active:scale-95">+</button>
        <button type="button" onClick={() => zoomBy('out')} aria-label="Отдалить" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[#292a2c]/35 bg-[#fbf9f4]/75 text-2xl font-medium text-[#292a2c] shadow-md backdrop-blur-sm active:scale-95">−</button>
      </div>
    {!sceneReady && <SceneLoadingOverlay />}
    </>
  )
}
