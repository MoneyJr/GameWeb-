import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/* -------------------------------------------------------------------------- */
/*  Общие ресурсы: геометрии, материалы и контуры кэшируются и переиспользуются  */
/* -------------------------------------------------------------------------- */

export type Vec3 = [number, number, number]

// City grid cells are 1 world unit wide. Leave a narrow 0.05 unit curb strip
// on either side while keeping the full drivable asphalt beneath both lanes.
export const ROAD_TILE_LENGTH = 1
export const ROAD_ASPHALT_WIDTH = 0.7
export const ROAD_LANE_OFFSET = ROAD_ASPHALT_WIDTH / 4
export const ROAD_CURB_WIDTH = (ROAD_TILE_LENGTH - ROAD_ASPHALT_WIDTH) / 2
export const ROAD_CURB_OFFSET = ROAD_TILE_LENGTH / 2 - ROAD_CURB_WIDTH / 2

type Shape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number }
  | { kind: 'cone'; radius: number; height: number; segments: number }

export const OUTLINE_COLOR = '#161412'

let gradientMap: THREE.DataTexture | null = null

/** 3-ступенчатая градиентная карта для "мультяшного" ступенчатого освещения. */
export function getGradientMap(): THREE.DataTexture {
  if (gradientMap === null) {
    const texture = new THREE.DataTexture(new Uint8Array([92, 152, 208, 255]), 4, 1, THREE.RedFormat)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    gradientMap = texture
  }
  return gradientMap
}

const materialCache = new Map<string, THREE.MeshToonMaterial>()

/** Общий уровень снега (0..1) для всех мультяшных материалов: снег ложится на верхние грани. */
export const snowUniform = { value: 0 }
export function setSnowLevel(level: number): void {
  snowUniform.value = level
}

/** Сила карандашной штриховки в тенях (0 — выключена, на низком качестве). */
export const hatchUniform = { value: 1 }
export function setHatching(strength: number): void {
  hatchUniform.value = strength
}
const HATCH_HEAD = 'uniform float uHatch;\n'
/** Тонкие диагональные штрихи на затенённых гранях — как в иллюстрации тушью. */
const HATCH_FRAGMENT = `
  float hatchLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  float hatchBase = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001);
  float hatchShade = 1.0 - clamp(hatchLum / hatchBase, 0.0, 1.0);
  float hatchLine = step(0.7, fract((gl_FragCoord.x - gl_FragCoord.y) / 5.0));
  outgoingLight *= 1.0 - hatchLine * smoothstep(0.3, 0.5, hatchShade) * 0.2 * uHatch;
  #include <opaque_fragment>`
const SNOW_VERTEX_HEAD = 'varying vec3 vSnowNormal;\nvarying float vSnowHeight;\n'
const SNOW_VERTEX_BODY = `
  mat4 snowModel = modelMatrix;
  #ifdef USE_INSTANCING
    snowModel = modelMatrix * instanceMatrix;
  #endif
  vSnowNormal = normalize((snowModel * vec4(objectNormal, 0.0)).xyz);`
const SNOW_FRAGMENT = `
  // Снег только на верхних гранях выше земли (крыши, карнизы), дороги и газоны не белеют.
  float snowCover = uSnow * smoothstep(0.3, 0.62, normalize(vSnowNormal).y) * step(0.12, vSnowHeight);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), snowCover);`
function addSnowCover(material: THREE.MeshToonMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = snowUniform
    shader.uniforms.uHatch = hatchUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SNOW_VERTEX_HEAD}`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>${SNOW_VERTEX_BODY}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  vSnowHeight = (snowModel * vec4(transformed, 1.0)).y;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uSnow;\n${HATCH_HEAD}${SNOW_VERTEX_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${SNOW_FRAGMENT}`)
      .replace('#include <opaque_fragment>', HATCH_FRAGMENT)
  }
  material.customProgramCacheKey = () => 'ink-toon-snow'
}

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
    addSnowCover(material)
    materialCache.set(color, material)
  }
  return material
}

/* -------------------------------------------------------------------------- */
/*  Фасады: сетка окон рисуется шейдером на всех вертикальных стенах          */
/* -------------------------------------------------------------------------- */

/** Уровень ночи для окон фасадов (0 — день, 1 — ночь). */
const facadeNightUniform = { value: 0 }

export interface FacadeOptions {
  /** Цвет стены (простенков и перекрытий). */
  wall: string
  /** Цвет стекла днём. */
  glass: string
  /** Цвет горящего окна ночью. */
  lit?: string
  /** Шаг окон по горизонтали и высота этажа. */
  spacing?: [number, number]
  /** Доля простенка по горизонтали и вертикали (0..0.5). */
  frame?: [number, number]
  /** Сплошное остекление с тонкими импостами (для стеклянных башен). */
  curtain?: boolean
  /** Цвет рамки окна. */
  ink?: string
}

const facadeCache = new Map<string, THREE.MeshToonMaterial>()

/** Материал стены с окнами: окна на всех сторонах, ночью часть загорается; снег ложится на крыши. */
export function getFacadeMaterial(options: FacadeOptions): THREE.MeshToonMaterial {
  const key = JSON.stringify(options)
  const cached = facadeCache.get(key)
  if (cached) return cached
  const { wall, glass, lit = '#ffd27a', spacing = [0.2, 0.3], frame = [0.2, 0.24], curtain = false } = options
  const material = new THREE.MeshToonMaterial({ color: wall, gradientMap: getGradientMap(), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  const glassColor = new THREE.Color(glass)
  const litColor = new THREE.Color(lit)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = snowUniform
    shader.uniforms.uHatch = hatchUniform
    shader.uniforms.uInk = { value: new THREE.Color(options.ink ?? '#2b2724') }
    shader.uniforms.uNight = facadeNightUniform
    shader.uniforms.uGlass = { value: glassColor }
    shader.uniforms.uLit = { value: litColor }
    shader.uniforms.uSpacing = { value: new THREE.Vector2(spacing[0], spacing[1]) }
    shader.uniforms.uFrame = { value: new THREE.Vector2(curtain ? 0.04 : frame[0], curtain ? 0.08 : frame[1]) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SNOW_VERTEX_HEAD}varying vec3 vFacadePos;\nvarying vec3 vFacadeNormal;\n`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>${SNOW_VERTEX_BODY}\n  vFacadeNormal = objectNormal;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  vSnowHeight = (snowModel * vec4(transformed, 1.0)).y;
  vFacadePos = transformed;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow; uniform float uNight; uniform vec3 uGlass; uniform vec3 uLit; uniform vec2 uSpacing; uniform vec2 uFrame; uniform vec3 uInk;\n${HATCH_HEAD}
${SNOW_VERTEX_HEAD}varying vec3 vFacadePos;\nvarying vec3 vFacadeNormal;\n`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float facadeWindow = 0.0;
  float facadeLit = 0.0;
  vec3 facadeN = normalize(vFacadeNormal);
  if (abs(facadeN.y) < 0.5) {
    float along = abs(facadeN.x) > 0.5 ? vFacadePos.z : vFacadePos.x;
    vec2 cell = vec2(along / uSpacing.x, vFacadePos.y / uSpacing.y);
    vec2 f = fract(cell);
    facadeWindow = step(uFrame.x, f.x) * step(f.x, 1.0 - uFrame.x) * step(uFrame.y, f.y) * step(f.y, 1.0 - uFrame.y);
    float seed = fract(sin(dot(floor(cell) + facadeN.xz * 31.0, vec2(12.9898, 78.233))) * 43758.5453);
    facadeLit = uNight * step(0.42, seed) * facadeWindow;
    // Лёгкий диагональный блик на стекле — «нарисованное» отражение неба.
    float streak = smoothstep(0.55, 0.6, fract((along + vFacadePos.y) * 0.9)) * 0.18;
    vec3 glassTone = mix(uGlass, vec3(1.0), streak + seed * 0.08);
    diffuseColor.rgb = mix(diffuseColor.rgb, glassTone, facadeWindow);
    // Тёмная рамка вокруг окна и светлый подоконник, как в рисунке тушью.
    float border = 0.05;
    float outer = step(uFrame.x - border, f.x) * step(f.x, 1.0 - uFrame.x + border) * step(uFrame.y - border, f.y) * step(f.y, 1.0 - uFrame.y + border);
    diffuseColor.rgb = mix(diffuseColor.rgb, uInk, (outer - facadeWindow) * 0.75);
    float sill = step(uFrame.y - border - 0.06, f.y) * step(f.y, uFrame.y - border) * step(uFrame.x - border, f.x) * step(f.x, 1.0 - uFrame.x + border);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.88), sill * 0.8);
  }${SNOW_FRAGMENT}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uLit * facadeLit * 0.95;`)
      .replace('#include <opaque_fragment>', HATCH_FRAGMENT)
  }
  material.customProgramCacheKey = () => `ink-facade-${key}`
  facadeCache.set(key, material)
  return material
}

const flagstoneCache = new Map<string, THREE.MeshToonMaterial>()
/** Брусчатка из камней неправильной формы (диаграмма Вороного в мировых координатах). */
export function getFlagstoneMaterial(color = '#b9a888', scale = 5): THREE.MeshToonMaterial {
  const key = `${color}|${scale}`
  const cached = flagstoneCache.get(key)
  if (cached) return cached
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = snowUniform
    shader.uniforms.uStoneScale = { value: scale }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneWorld;\n')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vStoneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow; uniform float uStoneScale;
varying vec3 vStoneWorld;
vec2 stoneHash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 sp = vStoneWorld.xz * uStoneScale;
  vec2 cellId = floor(sp);
  float f1 = 8.0, f2 = 8.0; vec2 nearest = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = stoneHash(cellId + g) * 0.8 + 0.1;
    float d = length(g + o - fract(sp));
    if (d < f1) { f2 = f1; f1 = d; nearest = cellId + g; } else if (d < f2) { f2 = d; }
  }
  float grout = 1.0 - smoothstep(0.03, 0.08, f2 - f1);
  float tint = stoneHash(nearest).x;
  diffuseColor.rgb *= 0.9 + tint * 0.18;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, grout);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), uSnow * 0.8);`)
  }
  material.customProgramCacheKey = () => `ink-flagstone-${key}`
  flagstoneCache.set(key, material)
  return material
}

let paverMaterial: THREE.MeshToonMaterial | null = null
/** Тротуарная плитка: швы рисуются шейдером в мировых координатах, стыки клеток незаметны. */
export function getPaverMaterial(): THREE.MeshToonMaterial {
  if (paverMaterial) return paverMaterial
  const material = new THREE.MeshToonMaterial({ color: '#d8d5cb', gradientMap: getGradientMap(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = snowUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaverWorld;\n')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vPaverWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying vec3 vPaverWorld;\n')
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 tile = fract(vPaverWorld.xz * vec2(6.0, 6.0));
  float seam = max(step(tile.x, 0.07), step(tile.y, 0.07));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, seam);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), uSnow * 0.85);`)
  }
  material.customProgramCacheKey = () => 'ink-paver'
  paverMaterial = material
  return material
}

const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.92 })

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
    edges = new THREE.EdgesGeometry(getGeometry(shape), smooth ? 35 : 30)
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

interface GlassEntry {
  material: THREE.MeshToonMaterial
  dayColor: THREE.Color
  nightColor: THREE.Color
  lit: boolean
}

const glassMaterials = new Map<string, GlassEntry>()
let currentNightLevel = 0
/** Цвет выключенного окна глубокой ночью. */
const GLASS_NIGHT_DARK = new THREE.Color('#2a3448')

function paintGlass(entry: GlassEntry, level: number): void {
  if (entry.lit) {
    entry.material.emissiveIntensity = level * 1.8
    entry.material.color.lerpColors(entry.dayColor, entry.nightColor, level)
  } else {
    entry.material.emissiveIntensity = 0
    entry.material.color.lerpColors(entry.dayColor, GLASS_NIGHT_DARK, level)
  }
}

/**
 * Материал стекла. Горящие окна (lit) ночью получают emissive-свечение #ffcc44,
 * тёмные остаются просто тёмным стеклом.
 */
export function getGlassMaterial(color: string, lit: boolean, nightColor = NIGHT_WINDOW_COLOR): THREE.MeshToonMaterial {
  const key = `${color}|${lit ? 1 : 0}|${nightColor}`
  let entry = glassMaterials.get(key)
  if (entry === undefined) {
    const material = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      emissive: nightColor,
      emissiveIntensity: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    entry = { material, dayColor: new THREE.Color(color), nightColor: new THREE.Color(nightColor), lit }
    paintGlass(entry, currentNightLevel)
    glassMaterials.set(key, entry)
  }
  return entry.material
}

/** Лампочка уличного фонаря и два тёплых круга света на асфальте (внешний и внутренний). */
export const lampBulbMaterial = new THREE.MeshBasicMaterial({ color: '#6b6354', toneMapped: false })
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
const BULB_NIGHT = new THREE.Color('#ffee88')
export const vehicleHeadlightMaterial = new THREE.MeshBasicMaterial({ color: '#fff4d2', toneMapped: false })
export const vehicleTaillightMaterial = new THREE.MeshBasicMaterial({ color: '#5b2928', toneMapped: false })
export const vehicleHeadlightBeamMaterial = new THREE.MeshBasicMaterial({ color: '#ffe8a3', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
const HEADLIGHT_DAY = new THREE.Color('#fff4d2')
const HEADLIGHT_NIGHT = new THREE.Color('#ffee88')
const TAILLIGHT_DAY = new THREE.Color('#5b2928')
const TAILLIGHT_NIGHT = new THREE.Color('#ff3528')
export const nightSignMaterial = new THREE.MeshStandardMaterial({ color: '#5cb3e6', emissive: '#42aaff', emissiveIntensity: 0, roughness: 1 })
export const cinemaSignMaterial = new THREE.MeshStandardMaterial({ color: '#e8292e', emissive: '#ff2525', emissiveIntensity: 0, roughness: 1 })
export const townHallClockMaterial = new THREE.MeshStandardMaterial({ color: '#fff1c2', emissive: '#efae48', emissiveIntensity: 0, roughness: 1 })

export function getCurrentNightLevel(): number {
  return currentNightLevel
}

/** Применяет уровень ночи (0 — день, 1 — глубокая ночь) ко всем светящимся материалам. */
export function applyNightLevel(level: number): void {
  currentNightLevel = level
  facadeNightUniform.value = level
  for (const entry of glassMaterials.values()) paintGlass(entry, level)
  lampBulbMaterial.color.lerpColors(BULB_DAY, BULB_NIGHT, level)
  lampGlowOuterMaterial.opacity = level * 0.26
  lampGlowInnerMaterial.opacity = level * 0.3
  vehicleHeadlightMaterial.color.lerpColors(HEADLIGHT_DAY, HEADLIGHT_NIGHT, level)
  vehicleTaillightMaterial.color.lerpColors(TAILLIGHT_DAY, TAILLIGHT_NIGHT, level)
  vehicleHeadlightBeamMaterial.opacity = level * 0.3
  nightSignMaterial.emissiveIntensity = level * 2.5
  cinemaSignMaterial.emissiveIntensity = level * 3
  townHallClockMaterial.emissiveIntensity = level * 1.8
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
