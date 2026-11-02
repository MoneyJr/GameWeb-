import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const AREA = 90
const HEIGHT = 26

/** Снегопад: вся анимация в шейдере, процессор не нагружается. Следует за центром камеры. */
export function Snowfall({ count = 2200 }: { count?: number }) {
  const group = useRef<THREE.Group>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * AREA
      positions[i * 3 + 1] = Math.random() * HEIGHT
      positions[i * 3 + 2] = (Math.random() - 0.5) * AREA
      seeds[i] = Math.random()
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return result
  }, [count])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: HEIGHT },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      uniform float uTime; uniform float uHeight; uniform float uPixelRatio;
      attribute float aSeed; varying float vAlpha;
      void main() {
        vec3 p = position;
        float speed = 1.1 + aSeed * 1.4;
        p.y = mod(position.y - uTime * speed, uHeight);
        p.x += sin(uTime * 0.6 + aSeed * 12.0) * 0.6;
        p.z += cos(uTime * 0.45 + aSeed * 9.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed * 2.6) * uPixelRatio;
        vAlpha = 0.5 + aSeed * 0.45;
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * (1.0 - smoothstep(0.25, 0.5, d)));
      }`,
  }), [])
  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta
    const controls = state.controls as unknown as { target?: THREE.Vector3 } | null
    if (controls?.target && group.current) group.current.position.set(controls.target.x, 0, controls.target.z)
  })
  return <group ref={group}><points geometry={geometry} material={material} frustumCulled={false} renderOrder={10} /></group>
}
