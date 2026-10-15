import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

export type ModelAssetKind = 'cottage' | 'townhouse' | 'apartment' | 'store'

export const MODEL_ASSETS: Record<ModelAssetKind, string> = {
  cottage: '/models/city-pack-cottage.glb',
  townhouse: '/models/city-pack-townhouse.glb',
  apartment: '/models/city-pack-apartment.glb',
  store: '/models/city-pack-store.glb',
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

for (const asset of Object.values(MODEL_ASSETS)) useGLTF.preload(asset)
for (const asset of ['/models/city-pack-car.glb', '/models/city-pack-pickup.glb', '/models/city-pack-bus.glb', '/models/city-pack-tree.glb']) {
  useGLTF.preload(asset)
}
