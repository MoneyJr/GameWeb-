import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { getGradientMap } from './primitives'

function collectInkMeshes(scene: THREE.Scene): THREE.Object3D[] {
  const result: THREE.Object3D[] = []
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return
    let parent: THREE.Object3D | null = object
    while (parent) {
      if (parent.userData.noInkOutline) return
      parent = parent.parent
    }
    if (object.geometry.boundingSphere === null) object.geometry.computeBoundingSphere()
    if ((object.geometry.boundingSphere?.radius ?? 0) <= 80) result.push(object)
  })
  return result
}

/** Apply the shared three-band toon ramp to both cached and inline materials. */
export function ToonShadingSetup() {
  const { scene } = useThree()
  useEffect(() => {
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
  }, [scene])
  return null
}

/** Screen-space ink contour pass, with large terrain planes and UI/ghost meshes excluded. */
export function InkOutlinePassEffect() {
  const { gl, scene, camera, size } = useThree()
  const frameCount = useRef(0)
  const outlineRef = useRef<OutlinePass | null>(null)
  const { composer, outline } = useMemo(() => {
    const nextComposer = new EffectComposer(gl)
    nextComposer.addPass(new RenderPass(scene, camera))
    const nextOutline = new OutlinePass(new THREE.Vector2(size.width, size.height), scene, camera)
    nextOutline.edgeStrength = 1.8
    nextOutline.edgeThickness = 1.6
    nextOutline.pulsePeriod = 0
    nextOutline.visibleEdgeColor.set('#2a1e17')
    nextOutline.hiddenEdgeColor.set('#2a1e17')
    nextComposer.addPass(nextOutline)
    nextComposer.addPass(new OutputPass())
    return { composer: nextComposer, outline: nextOutline }
  }, [camera, gl, scene, size.height, size.width])

  useEffect(() => {
    composer.setSize(size.width, size.height)
    return () => composer.dispose()
  }, [composer, size.height, size.width])

  useEffect(() => {
    outlineRef.current = outline
    outlineRef.current.selectedObjects = collectInkMeshes(scene)
  }, [outline, scene])

  useFrame((_, delta) => {
    frameCount.current += 1
    if (frameCount.current % 30 === 0) {
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        const ramp = getGradientMap()
        materials.forEach((material) => {
          if (material instanceof THREE.MeshToonMaterial && material.gradientMap !== ramp) {
            material.gradientMap = ramp
            material.needsUpdate = true
          }
        })
      })
      const activeOutline = outlineRef.current
      if (activeOutline) activeOutline.selectedObjects = collectInkMeshes(scene)
    }
    composer.render(delta)
  }, 1)
  return null
}
