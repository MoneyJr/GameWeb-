import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getGradientMap } from './primitives'

function applyToonGradient(scene: THREE.Scene) {
  const ramp = getGradientMap()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (material instanceof THREE.MeshToonMaterial && material.gradientMap !== ramp) {
        material.gradientMap = ramp
        material.needsUpdate = true
      }
    })
  })
}

/** Keep toon materials on the shared stepped ramp; the scene uses the regular R3F renderer. */
export function ToonShadingSetup() {
  const { scene } = useThree()
  const frameCount = useRef(0)
  useEffect(() => applyToonGradient(scene), [scene])
  useFrame(() => {
    frameCount.current += 1
    if (frameCount.current % 30 === 0) applyToonGradient(scene)
  })
  return null
}
