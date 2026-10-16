import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

export type ModelAssetKind = 'cottage' | 'townhouse' | 'apartment' | 'store' | 'kayApartment' | 'largeBuilding' | 'skyscraper' | 'solarPanel' | 'hospital'

export const MODEL_ASSETS: Record<ModelAssetKind, string> = {
  cottage: '/models/city-pack-cottage.glb',
  townhouse: '/models/city-pack-townhouse.glb',
  apartment: '/models/city-pack-apartment.glb',
  store: '/models/city-pack-store.glb',
  kayApartment: '/models/kay-building.glb',
  largeBuilding: '/models/large-building.glb',
  skyscraper: '/models/skyscraper.glb',
  solarPanel: '/models/solar-panel.glb',
  hospital: '/models/hospital.glb',
}
const DEFAULT_TARGET: [number, number, number] = [1.72, 2.8, 1.72]

export function toonMaterial(source: THREE.Material): THREE.MeshToonMaterial {
  const sourceWithMaps = source as THREE.Material & {
    color?: THREE.Color
    map?: THREE.Texture | null
    alphaMap?: THREE.Texture | null
    alphaTest?: number
  }
  return new THREE.MeshToonMaterial({
    color: sourceWithMaps.color?.clone() ?? new THREE.Color('#ffffff'),
    map: sourceWithMaps.map ?? null,
    alphaMap: sourceWithMaps.alphaMap ?? null,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: sourceWithMaps.alphaTest ?? 0,
    side: source.side,
    depthWrite: source.depthWrite,
  })
}

/** Clone, toon-convert, and fit a downloaded GLTF model to a tile-sized envelope. */
export function prepareModel(scene: THREE.Group, target: [number, number, number], orientLengthAlongZ = false, tint?: string): THREE.Group {
  const model = scene.clone(true)
  model.updateMatrixWorld(true)
  let bounds = new THREE.Box3().setFromObject(model)
  let size = bounds.getSize(new THREE.Vector3())

  if (orientLengthAlongZ && size.x > size.z) {
    model.rotation.y = Math.PI / 2
    model.updateMatrixWorld(true)
    bounds = new THREE.Box3().setFromObject(model)
    size = bounds.getSize(new THREE.Vector3())
  }

  const scale = Math.min(
    target[0] / Math.max(size.x, 0.001),
    target[1] / Math.max(size.y, 0.001),
    target[2] / Math.max(size.z, 0.001),
  )
  const center = bounds.getCenter(new THREE.Vector3())
  model.scale.multiplyScalar(scale)
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
  model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const materials = sources.map((source) => {
      const converted = toonMaterial(source)
      const lightness = converted.color.r * 0.2126 + converted.color.g * 0.7152 + converted.color.b * 0.0722
      const isGlassOrTrim = /glass|window|tire|wheel|rubber|chrome/i.test(source.name)
      if (tint && !isGlassOrTrim && lightness > 0.18) converted.color.copy(new THREE.Color(tint))
      return converted
    })
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  return model
}

export function LoadedCityModel({
  kind,
  target = DEFAULT_TARGET,
  orientLengthAlongZ = false,
}: {
  kind: ModelAssetKind
  target?: [number, number, number]
  orientLengthAlongZ?: boolean
}) {
  const { scene } = useGLTF(MODEL_ASSETS[kind])
  const model = useMemo(() => prepareModel(scene, target, orientLengthAlongZ), [scene, target, orientLengthAlongZ])
  return <primitive object={model} />
}

export type RoadModuleName = 'road_corner' | 'road_junction' | 'road_straight' | 'road_straight_crossing' | 'road_tsplit'
export type RoadTileSelection = { model: RoadModuleName; rotation: number }
type RoadSide = 'north' | 'south' | 'east' | 'west'

/** Map the four connected edges to the matching Road Bits prototype and yaw. */
export function getRoadTileFromNeighbors(north: boolean, south: boolean, east: boolean, west: boolean): RoadTileSelection {
  const connected = (['north', 'south', 'east', 'west'] as RoadSide[]).filter((side) => ({ north, south, east, west })[side])
  if (connected.length === 4) return { model: 'road_junction', rotation: 0 }
  if (connected.length === 3) {
    const missing = (['north', 'south', 'east', 'west'] as RoadSide[]).find((side) => !connected.includes(side))!
    const rotationByOpening: Record<RoadSide, number> = { south: 0, west: Math.PI / 2, north: Math.PI, east: -Math.PI / 2 }
    return { model: 'road_tsplit', rotation: rotationByOpening[missing] }
  }
  if (connected.length === 2) {
    if (connected.includes('north') && connected.includes('south')) return { model: 'road_straight', rotation: 0 }
    if (connected.includes('east') && connected.includes('west')) return { model: 'road_straight', rotation: Math.PI / 2 }
    const pair = new Set(connected)
    const rotationByCorner = [
      { sides: ['north', 'east'], rotation: 0 },
      { sides: ['east', 'south'], rotation: -Math.PI / 2 },
      { sides: ['south', 'west'], rotation: Math.PI },
      { sides: ['west', 'north'], rotation: Math.PI / 2 },
    ]
    const corner = rotationByCorner.find(({ sides }) => sides.every((side) => pair.has(side as RoadSide)))
    return { model: 'road_corner', rotation: corner?.rotation ?? 0 }
  }
  if (connected.length === 1 && (connected[0] === 'east' || connected[0] === 'west')) return { model: 'road_straight', rotation: Math.PI / 2 }
  return { model: 'road_straight', rotation: 0 }
}

/** Select one named module from the bundled Road Bits scene and normalize it to one grid tile. */
export function LoadedRoadModule({ name, rotation = 0 }: { name: RoadModuleName; rotation?: number }) {
  const { scene } = useGLTF('/models/road-bits.glb')
  const model = useMemo(() => {
    const source = scene.getObjectByName(name)
    if (!source) return new THREE.Group()
    const module = source.clone(true)
    // The source GLB arranges its six module previews in a 3x2 atlas. Remove
    // that atlas offset before fitting the selected geometry into a city tile.
    module.position.set(0, 0, 0)
    const isolated = new THREE.Group()
    isolated.add(module)
    return prepareModel(isolated, [0.98, 0.14, 0.98])
  }, [name, scene])
  return <primitive object={model} rotation={[0, rotation, 0]} />
}

for (const asset of Object.values(MODEL_ASSETS)) useGLTF.preload(asset)
for (const asset of [
  '/models/city-pack-car.glb', '/models/city-pack-pickup.glb', '/models/city-pack-bus.glb', '/models/city-pack-tree.glb',
  '/models/road-bits.glb',
]) {
  useGLTF.preload(asset)
}
