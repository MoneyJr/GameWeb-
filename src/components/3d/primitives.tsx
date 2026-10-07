import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/* -------------------------------------------------------------------------- */
/*  Общие ресурсы: геометрии, материалы и контуры кэшируются и переиспользуются  */
/* -------------------------------------------------------------------------- */

export type Vec3 = [number, number, number]

type Shape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number }
  | { kind: 'cone'; radius: number; height: number; segments: number }

export const OUTLINE_COLOR = '#14110d'

let gradientMap: THREE.DataTexture | null = null

/** 3-ступенчатая градиентная карта для "мультяшного" ступенчатого освещения. */
export function getGradientMap(): THREE.DataTexture {
  if (gradientMap === null) {
    const texture = new THREE.DataTexture(new Uint8Array([105, 180, 255]), 3, 1, THREE.RedFormat)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    gradientMap = texture
  }
  return gradientMap
}

const materialCache = new Map<string, THREE.MeshToonMaterial>()

export function getToonMaterial(color: string): THREE.MeshToonMaterial {
  let material = materialCache.get(color)
  if (material === undefined) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      // Сдвигаем грани назад, чтобы линии контура не мерцали (z-fighting).
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    materialCache.set(color, material)
  }
  return material
}

const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR })

const geometryCache = new Map<string, THREE.BufferGeometry>()
const edgesCache = new Map<string, THREE.EdgesGeometry>()

function shapeKey(shape: Shape): string {
  return JSON.stringify(shape)
}

function getGeometry(shape: Shape): THREE.BufferGeometry {
  const key = shapeKey(shape)
  let geometry = geometryCache.get(key)
  if (geometry === undefined) {
    switch (shape.kind) {
      case 'box':
        geometry = new THREE.BoxGeometry(shape.size[0], shape.size[1], shape.size[2])
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          shape.radiusTop,
          shape.radiusBottom,
          shape.height,
          shape.segments,
        )
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(shape.radius, shape.height, shape.segments)
        break
    }
    geometryCache.set(key, geometry)
  }
  return geometry
}

function getEdges(shape: Shape): THREE.EdgesGeometry {
  const key = shapeKey(shape)
  let edges = edgesCache.get(key)
  if (edges === undefined) {
    // Для гладких тел (цилиндры, конусы) рисуем только обод, для граней — все рёбра.
    const smooth =
      shape.kind === 'cylinder' || (shape.kind === 'cone' && shape.segments > 4)
    edges = new THREE.EdgesGeometry(getGeometry(shape), smooth ? 35 : 15)
    edgesCache.set(key, edges)
  }
  return edges
}

/** Псевдослучайное число из индекса (детерминированно, без Math.random в рендере). */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* -------------------------------------------------------------------------- */
/*  Ночное освещение: светящиеся окна и фонари управляются одним уровнем 0..1    */
/* -------------------------------------------------------------------------- */

/** Тёплый ламповый цвет горящих окон. */
export const NIGHT_WINDOW_COLOR = '#ffcc44'
const WARM_WINDOW = new THREE.Color(NIGHT_WINDOW_COLOR)

interface GlassEntry {
  material: THREE.MeshToonMaterial
  dayColor: THREE.Color
  lit: boolean
}

const glassMaterials = new Map<string, GlassEntry>()
let currentNightLevel = 0
/** Цвет выключенного окна глубокой ночью. */
const GLASS_NIGHT_DARK = new THREE.Color('#2a3448')

function paintGlass(entry: GlassEntry, level: number): void {
  if (entry.lit) {
    entry.material.emissiveIntensity = level * 1.15
    entry.material.color.lerpColors(entry.dayColor, WARM_WINDOW, level)
  } else {
    entry.material.emissiveIntensity = 0
    entry.material.color.lerpColors(entry.dayColor, GLASS_NIGHT_DARK, level)
  }
}

/**
 * Материал стекла. Горящие окна (lit) ночью получают emissive-свечение #ffcc44,
 * тёмные остаются просто тёмным стеклом.
 */
export function getGlassMaterial(color: string, lit: boolean): THREE.MeshToonMaterial {
  const key = `${color}|${lit ? 1 : 0}`
  let entry = glassMaterials.get(key)
  if (entry === undefined) {
    const material = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      emissive: WARM_WINDOW,
      emissiveIntensity: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    entry = { material, dayColor: new THREE.Color(color), lit }
    paintGlass(entry, currentNightLevel)
    glassMaterials.set(key, entry)
  }
  return entry.material
}

/** Лампочка уличного фонаря и два тёплых круга света на асфальте (внешний и внутренний). */
export const lampBulbMaterial = new THREE.MeshBasicMaterial({ color: '#6b6354' })
export const lampGlowOuterMaterial = new THREE.MeshBasicMaterial({
  color: NIGHT_WINDOW_COLOR,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
})
export const lampGlowInnerMaterial = new THREE.MeshBasicMaterial({
  color: '#ffe08a',
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
})

const BULB_DAY = new THREE.Color('#6b6354')
const BULB_NIGHT = new THREE.Color('#fff2a8')

/** Применяет уровень ночи (0 — день, 1 — глубокая ночь) ко всем светящимся материалам. */
export function applyNightLevel(level: number): void {
  currentNightLevel = level
  for (const entry of glassMaterials.values()) {
    if (entry.lit) {
      entry.material.emissiveIntensity = level * 1.15
      entry.material.color.lerpColors(entry.dayColor, WARM_WINDOW, level)
    }
  }
  lampBulbMaterial.color.lerpColors(BULB_DAY, BULB_NIGHT, level)
  lampGlowOuterMaterial.opacity = level * 0.26
  lampGlowInnerMaterial.opacity = level * 0.3
}

/** Зерно для выбора, какие окна здания горят ночью (задаётся тайлом). */
export const WindowSeedContext = createContext(0)

/* -------------------------------------------------------------------------- */
/*  Примитив: Mesh + MeshToonMaterial + чёрный контур рёбер (EdgesGeometry)      */
/* -------------------------------------------------------------------------- */

interface PartProps {
  shape: Shape
  color: string
  position: Vec3
  rotation?: Vec3
  outline?: boolean
  castShadow?: boolean
  material?: THREE.Material
}

function Part({
  shape,
  color,
  position,
  rotation,
  outline = true,
  castShadow = true,
  material,
}: PartProps) {
  return (
    <mesh
      geometry={getGeometry(shape)}
      material={material ?? getToonMaterial(color)}
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      {outline && <lineSegments geometry={getEdges(shape)} material={outlineMaterial} />}
    </mesh>
  )
}

export function Box({
  size,
  ...rest
}: { size: Vec3 } & Omit<PartProps, 'shape'>) {
  return <Part shape={{ kind: 'box', size }} {...rest} />
}

export function Cylinder({
  radius,
  radiusTop,
  height,
  segments = 16,
  ...rest
}: { radius: number; radiusTop?: number; height: number; segments?: number } & Omit<PartProps, 'shape'>) {
  return (
    <Part
      shape={{ kind: 'cylinder', radiusTop: radiusTop ?? radius, radiusBottom: radius, height, segments }}
      {...rest}
    />
  )
}

export function Cone({
  radius,
  height,
  segments = 16,
  ...rest
}: { radius: number; height: number; segments?: number } & Omit<PartProps, 'shape'>) {
  return <Part shape={{ kind: 'cone', radius, height, segments }} {...rest} />
}

/** Цоколь под зданием. */
export const PAD_HEIGHT = 0.06

export function Pad() {
  return <Box size={[0.94, PAD_HEIGHT, 0.94]} position={[0, PAD_HEIGHT / 2, 0]} color="#dcd5c3" />
}

/* -------------------------------------------------------------------------- */
/*  Объединённые геометрии: десятки тонких балок/окон рисуются одним мешем      */
/* -------------------------------------------------------------------------- */

export interface PartSpec {
  kind?: 'box' | 'cylinder'
  /** box: [x, y, z]; cylinder: [радиус, высота, число сегментов]. */
  size: Vec3
  position: Vec3
  /** Поворот (радианы) применяется последовательно вокруг осей X, Y, Z. */
  rotation?: Vec3
  /** Дополнительный поворот вокруг вертикальной оси Y, применяется после rotation и до смещения. */
  yaw?: number
}

/** Поворачивает спек вокруг вертикальной оси здания (позиция + yaw) — для 4 граней фасада. */
export function rotateSpecY(spec: PartSpec, angle: number): PartSpec {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const [x, y, z] = spec.position
  return {
    ...spec,
    position: [x * cos + z * sin, y, -x * sin + z * cos],
    yaw: (spec.yaw ?? 0) + angle,
  }
}

export function buildMergedGeometry(specs: readonly PartSpec[]): THREE.BufferGeometry {
  const geometries = specs.map((spec) => {
    const geometry: THREE.BufferGeometry =
      spec.kind === 'cylinder'
        ? new THREE.CylinderGeometry(spec.size[0], spec.size[0], spec.size[1], Math.max(3, Math.round(spec.size[2])))
        : new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2])
    if (spec.rotation !== undefined) {
      geometry.rotateX(spec.rotation[0])
      geometry.rotateY(spec.rotation[1])
      geometry.rotateZ(spec.rotation[2])
    }
    if (spec.yaw !== undefined) geometry.rotateY(spec.yaw)
    geometry.translate(spec.position[0], spec.position[1], spec.position[2])
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  return merged ?? new THREE.BufferGeometry()
}

interface MergedPartsProps {
  /** Массив нужно мемоизировать на стороне вызывающего кода. */
  specs: readonly PartSpec[]
  color?: string
  material?: THREE.Material
  outline?: boolean
  castShadow?: boolean
}

export function MergedParts({ specs, color = '#ffffff', material, outline = false, castShadow = true }: MergedPartsProps) {
  const geometry = useMemo(() => buildMergedGeometry(specs), [specs])
  const edges = useMemo(
    () => (outline && specs.length > 0 ? new THREE.EdgesGeometry(geometry, 25) : null),
    [geometry, outline, specs],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      edges?.dispose()
    },
    [geometry, edges],
  )
  if (specs.length === 0) return null
  return (
    <mesh geometry={geometry} material={material ?? getToonMaterial(color)} castShadow={castShadow} receiveShadow>
      {edges !== null && <lineSegments geometry={edges} material={outlineMaterial} />}
    </mesh>
  )
}

const domeCache = new Map<number, { geometry: THREE.SphereGeometry; edges: THREE.EdgesGeometry }>()

/** Купол — полусфера радиуса radius, стоящая на плоскости y = 0. */
export function Dome({ radius, color, position }: { radius: number; color: string; position: Vec3 }) {
  let entry = domeCache.get(radius)
  if (entry === undefined) {
    const geometry = new THREE.SphereGeometry(radius, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    entry = { geometry, edges: new THREE.EdgesGeometry(geometry, 35) }
    domeCache.set(radius, entry)
  }
  return (
    <mesh geometry={entry.geometry} material={getToonMaterial(color)} position={position} castShadow receiveShadow>
      <lineSegments geometry={entry.edges} material={outlineMaterial} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/*  Окно                                                                        */
/* -------------------------------------------------------------------------- */

export type Facing = 'z' | 'x' | '-z' | '-x'

export const FACING_ROTATION: Record<Facing, number> = { z: 0, x: Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }

interface WindowProps {
  /** Точка на поверхности стены. */
  position: Vec3
  facing?: Facing
  width?: number
  height?: number
  glass?: string
  frame?: string
  cross?: boolean
  sill?: boolean
}

/** Окно: рама, стекло, переплёт-крест и подоконник. Смотрит по локальной оси +Z (поворачивается через facing). */
export function Window({
  position,
  facing = 'z',
  width = 0.1,
  height = 0.12,
  glass = '#8fd3ff',
  frame = '#fff8ea',
  cross = true,
  sill = true,
}: WindowProps) {
  const seed = useContext(WindowSeedContext)
  const lit = hash01(seed * 3.17 + position[0] * 91.3 + position[1] * 57.9 + position[2] * 33.1) > 0.22
  return (
    <group position={position} rotation={[0, FACING_ROTATION[facing], 0]}>
      <Box size={[width + 0.04, height + 0.04, 0.012]} position={[0, 0, 0]} color={frame} />
      <Box
        size={[width, height, 0.024]}
        position={[0, 0, 0.005]}
        color={glass}
        material={getGlassMaterial(glass, lit)}
        castShadow={false}
      />
      {cross && (
        <>
          <Box
            size={[0.012, height, 0.03]}
            position={[0, 0, 0.007]}
            color={frame}
            outline={false}
            castShadow={false}
          />
          <Box
            size={[width, 0.012, 0.03]}
            position={[0, 0, 0.007]}
            color={frame}
            outline={false}
            castShadow={false}
          />
        </>
      )}
      {sill && (
        <Box size={[width + 0.07, 0.02, 0.05]} position={[0, -height / 2 - 0.03, 0.016]} color="#c9b99a" />
      )}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Дым из трубы                                                                */
/* -------------------------------------------------------------------------- */

export function Smoke({ position, active = true }: { position: Vec3; active?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const group = ref.current
    if (group === null || !active) return
    const t = clock.elapsedTime
    group.children.forEach((child, i) => {
      if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshBasicMaterial)) return
      const p = (t * 0.5 + i / 3) % 1
      child.position.y = p * 1.5
      child.scale.setScalar(1 + p * 1.5)
      child.material.opacity = (1 - p) * 0.5
    })
  })
  return (
    <group position={position} ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
