import { TrafficSystem } from './TrafficSystem'
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, MapControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { TOOL_DEFINITIONS } from '../../lib/cityConfig'
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
  domElement: HTMLElement
  enabled: boolean
  dollyIn: (scale: number) => void
  dollyOut: (scale: number) => void
  update: () => boolean
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
  onPlace: (x: number, y: number) => void
  onRemove: (x: number, y: number) => void
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

function InteractionLayer({ grid, activeTool, onPlace, onRemove }: InteractionLayerProps) {
  const [hovered, setHovered] = useState<Cell | null>(null)
  const painting = useRef(false)
  const lastCell = useRef<Cell | null>(null)

  const act = useCallback(
    (cell: Cell) => {
      if (activeTool === ToolId.BULLDOZE) onRemove(cell.x, cell.y)
      else if (activeTool !== ToolId.CURSOR) onPlace(cell.x, cell.y)
    },
    [activeTool, onPlace, onRemove],
  )

  useEffect(() => {
    const stop = () => {
      painting.current = false
      lastCell.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [])

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const cell = worldToCell(event.point.x, event.point.z)
    setHovered((prev) => (prev !== null && prev.x === cell.x && prev.y === cell.y ? prev : cell))
    if (painting.current && lastCell.current !== null) {
      const previous = lastCell.current
      if (previous.x === cell.x && previous.y === cell.y) return
      for (const step of cellsBetween(previous, cell).slice(1)) act(step)
      lastCell.current = cell
    }
  }

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0 || activeTool === ToolId.CURSOR) return
    const cell = worldToCell(event.point.x, event.point.z)
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
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Сцена                                                                        */
/* -------------------------------------------------------------------------- */

export interface CitySceneProps {
  grid: Grid
  activeTool: ToolId
  onPlace: (x: number, y: number) => void
  onRemove: (x: number, y: number) => void
  minutes: number
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

export function CityScene({ grid, activeTool, onPlace, onRemove, minutes }: CitySceneProps) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 768)
  const [sceneReady, setSceneReady] = useState(false)
  const markSceneReady = useCallback(() => setSceneReady(true), [])
  useEffect(() => {
    const updateViewport = () => setIsNarrow(window.innerWidth < 768)
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])
  const isReferencePreview = new URLSearchParams(window.location.search).get('preview') === 'cityrt'
  const cameraTarget: [number, number, number] = isReferencePreview ? [-0.5, 0, -0.5] : [0, 0, -3.5]
  const cameraPosition: [number, number, number] = [
    cameraTarget[0] + CAMERA_POSITION[0],
    CAMERA_POSITION[1],
    cameraTarget[2] + CAMERA_POSITION[2],
  ]
  const shadowMapSize: [number, number] = isNarrow ? [1024, 1024] : [2048, 2048]
  const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const controlsRef = useRef<PannableControls | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const activePointers = useRef(new Set<number>())
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
  const releasePointer = (pointerId: number) => {
    activePointers.current.delete(pointerId)
    const canvas = controlsRef.current?.domElement
    if (!canvas) return
    try {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    } catch { /* Embedded browsers can invalidate capture before dispatching pointerleave. */ }
    canvas.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId }))
  }
  return (
    <>
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onPointerDownCapture={(event) => activePointers.current.add(event.pointerId)}
        onPointerUpCapture={(event) => activePointers.current.delete(event.pointerId)}
        onPointerCancelCapture={(event) => activePointers.current.delete(event.pointerId)}
        onPointerLeave={(event) => {
          if (activePointers.current.has(event.pointerId)) releasePointer(event.pointerId)
        }}
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
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
      <Suspense fallback={null}>
      <SceneCompiler onReady={markSceneReady} />
      <fogExp2 attach="fog" args={['#eae4d5', 0.012]} />
      <NightManager minutes={minutes} />
      {/* Remove <color attach="background" ... /> as it's managed by NightManager */}

      <OrthographicCamera makeDefault position={cameraPosition} zoom={isReferencePreview ? 90 : 56} near={-200} far={400} />

      <MapControls
        ref={controlsRef as never}
        makeDefault
        enabled
        target={cameraTarget}
        enableRotate
        minPolarAngle={ISO_POLAR_ANGLE}
        maxPolarAngle={ISO_POLAR_ANGLE}
        minZoom={20}
        maxZoom={250}
        enablePan
        enableZoom
        zoomSpeed={1.0}
        panSpeed={1.2}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        enableDamping
        dampingFactor={0.12}
        screenSpacePanning={false}
        mouseButtons={{
          // Левая кнопка двигает камеру только с курсором, иначе она строит.
          LEFT: activeTool === ToolId.CURSOR ? THREE.MOUSE.PAN : MOUSE_NONE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
        onChange={(event) => {
          const controls = (event as { target?: PannableControls } | undefined)?.target
          if (!controls) return
          // Не даём утащить камеру слишком далеко от города.
          const dx = THREE.MathUtils.clamp(controls.target.x, -PAN_LIMIT, PAN_LIMIT) - controls.target.x
          const dz = THREE.MathUtils.clamp(controls.target.z, -PAN_LIMIT, PAN_LIMIT) - controls.target.z
          if (dx !== 0 || dz !== 0) {
            controls.target.x += dx
            controls.target.z += dz
            controls.object.position.x += dx
            controls.object.position.z += dz
          }
        }}
      />

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
      <InteractionLayer grid={grid} activeTool={activeTool} onPlace={onPlace} onRemove={onRemove} />
      </Suspense>
    </Canvas>
      </div>
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 md:hidden" aria-label="Управление масштабом камеры">
        <button type="button" onClick={() => zoomBy('in')} aria-label="Приблизить" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[#292a2c]/35 bg-[#fbf9f4]/75 text-2xl font-medium text-[#292a2c] shadow-md backdrop-blur-sm active:scale-95">+</button>
        <button type="button" onClick={() => zoomBy('out')} aria-label="Отдалить" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[#292a2c]/35 bg-[#fbf9f4]/75 text-2xl font-medium text-[#292a2c] shadow-md backdrop-blur-sm active:scale-95">−</button>
      </div>
    {!sceneReady && <SceneLoadingOverlay />}
    </>
  )
}
