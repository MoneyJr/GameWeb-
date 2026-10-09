import { TrafficSystem } from './TrafficSystem'
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { MapControls as ThreeMapControls } from 'three-stdlib'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
import { BUILDING_BY_ID } from '../../store/buildingCatalog'
import { GRID_SIZE, TileType, ToolId, type Grid } from '../../types/city'
import { TileModel } from './BuildingMeshes'

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
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#eae4d5]/65 backdrop-blur-[2px]" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full border border-[#34312b]/20 bg-[#fbf9f4]/90 px-5 py-3 text-sm font-semibold text-[#514b40] shadow-lg">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#a6653d]/25 border-t-[#a6653d]" />
        Готовим город…
      </div>
    </div>
  )
}

function cellToWorld(x: number, y: number): [number, number, number] {
  const offset = (GRID_SIZE - 1) / 2
  return [x - offset, 0, y - offset]
}

function worldToCell(worldX: number, worldZ: number): Cell {
  const clamp = (value: number) => Math.min(GRID_SIZE - 1, Math.max(0, value))
  return {
    x: clamp(Math.floor(worldX + GRID_SIZE / 2)),
    y: clamp(Math.floor(worldZ + GRID_SIZE / 2)),
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[350, 350]} />
        <meshStandardMaterial color="#7a9954" roughness={0.95} metalness={0} />
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
    const crownMaterial = new THREE.MeshToonMaterial({ color: '#5f7845' }) as THREE.MeshToonMaterial & { flatShading: boolean }
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
    // Frame the starter block with near and far forest belts while keeping an open meadow around it.
    const clusters: [number, number][] = [[0, -18], [0, -28], [18, 0], [28, 0], [0, 18], [0, 28], [-18, 0], [-28, 0]]
    const greens = ['#405f32', '#4e6e37', '#617f43', '#73894a', '#526d3e']
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
      } while (Math.abs(x) < 11 && Math.abs(z) < 11)
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

    const hillColors = ['#9aab7a', '#87986d', '#a3ae81']
    const hillSpecs = [
      [-48, -78, 12, 3.4, 9], [-24, -84, 15, 4.8, 12], [18, -88, 17, 4.1, 13], [52, -76, 13, 3.5, 10],
      [-78, -12, 14, 4.2, 11], [80, 20, 15, 4.8, 12], [-65, 68, 18, 5, 13], [8, 82, 20, 4.5, 14], [70, 64, 16, 4.1, 12],
    ]
    hillSpecs.forEach(([x, z, sx, sy, sz], index) => {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 7),
        new THREE.MeshStandardMaterial({ color: hillColors[index % hillColors.length], roughness: 1, flatShading: true }),
      )
      hill.position.set(x, sy * 0.65 - 0.3, z)
      hill.scale.set(sx, sy, sz)
      hill.castShadow = true
      hill.receiveShadow = true
      root.add(hill)
    })
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(110, 56), new THREE.MeshStandardMaterial({ color: '#83949a', roughness: 1 }))
    sea.rotation.x = -Math.PI / 2
    sea.position.set(0, -0.004, -133)
    root.add(sea)
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(110, 5), new THREE.MeshStandardMaterial({ color: '#cfc09e', roughness: 1 }))
    shore.rotation.x = -Math.PI / 2
    shore.position.set(0, -0.003, -104)
    root.add(shore)
    return root
  }, [])

  return <primitive object={scenery} />
})

const World = memo(function World({ grid }: { grid: Grid }) {
  const isRoad = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && grid[y][x].type === TileType.ROAD
  return (
    <group>
      {grid.flat().map((cell) => {
        if (cell.type === TileType.EMPTY) return null
        // Keep five homes in the CityRT visual reference strip.
        return (
          <group key={`${cell.x}:${cell.y}`} position={cellToWorld(cell.x, cell.y)}>
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

/* -------------------------------------------------------------------------- */
/*  Интерактивный слой: Hover Plane + подсветка тайла + "рисование" мышью         */
/* -------------------------------------------------------------------------- */

interface InteractionLayerProps {
  grid: Grid
  activeTool: ToolId
  onPlace: (x: number, y: number, catalogId?: string) => void
  onRemove: (x: number, y: number) => void
  isTouchDevice: boolean
  onTouchPreview: (cell: Cell) => void
  onRoadLinePreview: (cells: Cell[]) => void
  onRoadDragState: (dragging: boolean) => void
  ghost: TouchGhost | null
  placementStyle?: string
  catalogId?: string
}

interface TouchGhost {
  cells: Cell[]
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


function SmogRadiusOverlay() {
  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[8, 48]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.15} depthWrite={false} />
    </mesh>
  )
}

function HoverHighlight({ color }: { color: string }) {
  const material = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (material.current !== null) {
      material.current.opacity = 0.42 + Math.sin(clock.elapsedTime * 5) * 0.12
    }
  })

  return (
    <mesh position={[0, 0.05, 0]} renderOrder={10}>
      <boxGeometry args={[1, 0.1, 1]} />
      <meshBasicMaterial ref={material} color={color} transparent opacity={0.5} depthWrite={false} />
      <Edges color="#1a1a1a" />
    </mesh>
  )
}

function GhostTilePreview({ tool, cell, style, catalogId, roadLinks }: { tool: ToolId; cell: Cell; style?: string; catalogId?: string; roadLinks: { north: boolean; south: boolean; east: boolean; west: boolean } }) {
  const group = useRef<THREE.Group>(null)
  const tile = TOOL_DEFINITIONS[tool].tile

  useEffect(() => {
    const clonedMaterials: THREE.Material[] = []
    group.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const clone = (material: THREE.Material) => {
        const ghostMaterial = material.clone()
        ghostMaterial.transparent = true
        ghostMaterial.opacity = 0.48
        ghostMaterial.depthWrite = false
        if ('color' in ghostMaterial) (ghostMaterial as THREE.MeshStandardMaterial).color.lerp(new THREE.Color('#b7edbb'), 0.28)
        clonedMaterials.push(ghostMaterial)
        return ghostMaterial
      }
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material)
    })
    return () => clonedMaterials.forEach((material) => material.dispose())
  }, [tool])

  if (!tile) return null
  return (
    <group ref={group} position={cellToWorld(cell.x, cell.y)} renderOrder={20}>
      <TileModel type={tile} style={style} catalogId={catalogId} animate={false} hasWater hasPower hasSupplies {...roadLinks} />
    </group>
  )
}

function InteractionLayer({ grid, activeTool, onPlace, onRemove, isTouchDevice, onTouchPreview, onRoadLinePreview, onRoadDragState, ghost, placementStyle, catalogId }: InteractionLayerProps) {
  const [hovered, setHovered] = useState<Cell | null>(null)
  const painting = useRef(false)
  const lastCell = useRef<Cell | null>(null)
  const touchTap = useRef<{ pointerId: number; x: number; y: number; cell: Cell; moved: boolean } | null>(null)
  const roadDrag = useRef<{ pointerId: number; x: number; y: number; start: Cell } | null>(null)

  const act = useCallback(
    (cell: Cell) => {
      if (activeTool === ToolId.BULLDOZE) onRemove(cell.x, cell.y)
      else if (activeTool !== ToolId.CURSOR) onPlace(cell.x, cell.y, catalogId)
    },
    [activeTool, catalogId, onPlace, onRemove],
  )

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
  }, [act, activeTool, onTouchPreview, onRoadDragState])

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const cell = worldToCell(event.point.x, event.point.z)
    setHovered((prev) => (prev !== null && prev.x === cell.x && prev.y === cell.y ? prev : cell))
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
    const cell = worldToCell(event.point.x, event.point.z)
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
      if (activeTool !== ToolId.CURSOR) {
        touchTap.current = {
          pointerId: event.nativeEvent.pointerId,
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
          cell,
          moved: false,
        }
      }
      return
    }
    if (event.nativeEvent.button !== 0 || activeTool === ToolId.CURSOR) return
    painting.current = true
    lastCell.current = cell
    act(cell)
  }

  let highlightColor = '#ffffff'
  if (hovered !== null) {
    const current = grid[hovered.y][hovered.x].type
    if (activeTool === ToolId.BULLDOZE) {
      highlightColor = current === TileType.EMPTY ? '#c9c4b5' : '#ff5a4d'
    } else if (activeTool !== ToolId.CURSOR) {
      highlightColor = current === TOOL_DEFINITIONS[activeTool].tile ? '#c9c4b5' : '#6fe37f'
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
        onPointerOut={() => setHovered(null)}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
            {hovered !== null && (
        <group position={cellToWorld(hovered.x, hovered.y)}>
            <HoverHighlight color={highlightColor} />
          {(activeTool === ToolId.COAL || activeTool === ToolId.INDUSTRIAL) && (
            <SmogRadiusOverlay />
          )}
        </group>
      )}
      {isTouchDevice && ghost && activeTool !== ToolId.BULLDOZE && (
        ghost.cells.map((cell) => {
          const cells = ghost.cells
          const roadLinks = {
            north: cells.some((other) => other.x === cell.x && other.y === cell.y - 1),
            south: cells.some((other) => other.x === cell.x && other.y === cell.y + 1),
            east: cells.some((other) => other.x === cell.x + 1 && other.y === cell.y),
            west: cells.some((other) => other.x === cell.x - 1 && other.y === cell.y),
          }
          return <GhostTilePreview key={`${cell.x},${cell.y}`} tool={activeTool} cell={cell} style={placementStyle} catalogId={catalogId} roadLinks={roadLinks} />
        })
      )}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Сцена                                                                        */
/* -------------------------------------------------------------------------- */

export interface CitySceneProps {
  grid: Grid
  activeTool: ToolId
  onPlace: (x: number, y: number, catalogId?: string) => void
  onRemove: (x: number, y: number) => void
  minutes: number
  budget?: number
  placementStyle?: string
  catalogId?: string
}

import { applyNightLevel } from './primitives'

const DAY_COLOR = new THREE.Color('#eae4d5')
const NIGHT_COLOR = new THREE.Color('#1a2130')

function calcNightLevel(minutes: number): number {
  if (minutes >= 1200 && minutes < 1260) {
    return (minutes - 1200) / 60
  }
  if (minutes >= 1260 || minutes < 300) {
    return 1
  }
  if (minutes >= 300 && minutes < 360) {
    return 1 - (minutes - 300) / 60
  }
  return 0
}

function NightManager({ minutes }: { minutes: number }) {
  useFrame(({ scene }) => {
    const level = calcNightLevel(minutes)
    applyNightLevel(level)
    scene.background = DAY_COLOR.clone().lerp(NIGHT_COLOR, level)
  })
  return null
}

export function CityScene({ grid, activeTool, onPlace, onRemove, minutes, budget = 0, placementStyle, catalogId }: CitySceneProps) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 768)
  const [sceneReady, setSceneReady] = useState(false)
  const [touchGhost, setTouchGhost] = useState<TouchGhost | null>(null)
  const controlsRef = useRef<PannableControls | null>(null)
  const handleTouchPreview = useCallback((cell: Cell) => {
    setTouchGhost((current) => {
      if (!current) return { cells: [cell] }
      if (activeTool === ToolId.ROAD) return { cells: straightCellLine(current.cells[0], cell) }
      return null
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
  useEffect(() => setTouchGhost(null), [activeTool])
  const markSceneReady = useCallback(() => setSceneReady(true), [])
  useEffect(() => {
    const updateViewport = () => setIsNarrow(window.innerWidth < 768)
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])
  const isReferencePreview = new URLSearchParams(window.location.search).get('preview') === 'cityrt'
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const cameraTarget: [number, number, number] = isReferencePreview ? [-0.5, 0, -0.5] : [0, 0, -3.5]
  const cameraPosition: [number, number, number] = [
    cameraTarget[0] + CAMERA_POSITION[0],
    CAMERA_POSITION[1],
    cameraTarget[2] + CAMERA_POSITION[2],
  ]
  const shadowMapSize: [number, number] = isNarrow ? [1024, 1024] : [2048, 2048]
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
  return (
    <>
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
      >
      <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
      onContextMenu={(e) => e.preventDefault()}
      flat
      dpr={[1, maxDpr]}
      gl={{ antialias: true }}
      className="absolute inset-0 touch-none select-none"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
      >
      <Suspense fallback={null}>
      <SceneCompiler onReady={markSceneReady} />
      <fogExp2 attach="fog" args={['#eae4d5', 0.012]} />
      <NightManager minutes={minutes} />
      {/* Remove <color attach="background" ... /> as it's managed by NightManager */}

      <OrthographicCamera makeDefault position={cameraPosition} zoom={isReferencePreview ? 90 : 56} near={-200} far={400} />

      <StableMapControls target={cameraTarget} controlsRef={controlsRef} isTouchDevice={isTouchDevice} />

      <ambientLight intensity={0.35} color="#fff6ea" />
      <directionalLight
        position={[16, 18, 12]}
        intensity={2.0}
        color="#fff5df"
        castShadow
        shadow-mapSize={shadowMapSize}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
      />

      <GroundSlab />
      <NaturalHorizon />
      <World grid={grid} />
      <TrafficSystem grid={grid} />
      <InteractionLayer
        grid={grid}
        activeTool={activeTool}
        onPlace={onPlace}
        onRemove={onRemove}
        isTouchDevice={isTouchDevice}
        onTouchPreview={handleTouchPreview}
        onRoadLinePreview={handleRoadLinePreview}
        onRoadDragState={handleRoadDragState}
        ghost={touchGhost}
        placementStyle={placementStyle}
        catalogId={catalogId}
      />
      </Suspense>
    </Canvas>
      </div>
      {isTouchDevice && touchGhost && activeTool !== ToolId.CURSOR && activeTool !== ToolId.BULLDOZE && (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center gap-2"
          style={{ bottom: 'calc(9.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Подтверждение постройки"
        >
          <button
            type="button"
            onClick={() => {
              const unitCost = catalogId ? BUILDING_BY_ID[catalogId]?.cost ?? TOOL_DEFINITIONS[activeTool].cost : TOOL_DEFINITIONS[activeTool].cost
              const cost = unitCost * (activeTool === ToolId.ROAD ? touchGhost.cells.length : 1)
              touchGhost.cells.forEach((cell) => onPlace(cell.x, cell.y, catalogId))
              if (budget >= cost) setTouchGhost(null)
            }}
            className="pointer-events-auto flex h-11 items-center justify-center gap-1.5 rounded-full border border-emerald-900/30 bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg active:scale-95"
            aria-label={`Построить за $${(catalogId ? BUILDING_BY_ID[catalogId]?.cost ?? TOOL_DEFINITIONS[activeTool].cost : TOOL_DEFINITIONS[activeTool].cost) * (activeTool === ToolId.ROAD ? touchGhost.cells.length : 1)}`}
          >
            <span aria-hidden="true">✓</span><span>${(catalogId ? BUILDING_BY_ID[catalogId]?.cost ?? TOOL_DEFINITIONS[activeTool].cost : TOOL_DEFINITIONS[activeTool].cost) * (activeTool === ToolId.ROAD ? touchGhost.cells.length : 1)}</span>
          </button>
          <button
            type="button"
            onClick={() => setTouchGhost(null)}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-stone-500/40 bg-stone-600 text-xl font-bold text-white shadow-lg active:scale-95"
            aria-label="Отменить постройку"
          >
            ×
          </button>
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
