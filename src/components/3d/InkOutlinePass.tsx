import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { N8AOPass } from 'n8ao'
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

/** Keep all static and newly placed toon meshes on the shared stepped ramp. */
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

const inkSobelShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;
    float luminance(vec2 uv) {
      return dot(texture2D(tDiffuse, uv).rgb, vec3(0.299, 0.587, 0.114));
    }
    void main() {
      vec2 px = 1.6 / resolution;
      float tl = luminance(vUv + vec2(-px.x,  px.y));
      float tc = luminance(vUv + vec2( 0.0,   px.y));
      float tr = luminance(vUv + vec2( px.x,  px.y));
      float ml = luminance(vUv + vec2(-px.x,  0.0));
      float mr = luminance(vUv + vec2( px.x,  0.0));
      float bl = luminance(vUv + vec2(-px.x, -px.y));
      float bc = luminance(vUv + vec2( 0.0,  -px.y));
      float br = luminance(vUv + vec2( px.x, -px.y));
      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = -bl - 2.0 * bc - br + tl + 2.0 * tc + tr;
      float edge = smoothstep(0.18, 0.52, length(vec2(gx, gy)));
      vec4 color = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(mix(color.rgb, vec3(0.17, 0.12, 0.09), edge * 0.72), color.a);
    }
  `,
}

/** N8AO contact shadows followed by a subtle warm-ink Sobel edge pass. */
export function InkPostProcessing() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const effectComposer = new EffectComposer(gl)
    const ao = new N8AOPass(scene, camera, size.width, size.height)
    ao.configuration.aoRadius = 1.5
    ao.configuration.distanceFalloff = 1
    ao.configuration.intensity = 2
    ao.configuration.halfRes = true
    effectComposer.addPass(ao)
    const ink = new ShaderPass(inkSobelShader)
    effectComposer.addPass(ink)
    return effectComposer
  }, [camera, gl, scene])

  useLayoutEffect(() => {
    composer.setPixelRatio(Math.min(gl.getPixelRatio(), 1.5))
    composer.setSize(size.width, size.height)
  }, [composer, gl, size.height, size.width])

  useEffect(() => () => composer.dispose(), [composer])
  useFrame((_, delta) => composer.render(delta), 1)
  return null
}
