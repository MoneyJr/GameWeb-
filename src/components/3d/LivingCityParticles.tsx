import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Grid } from '../../types/city'
import { TileType } from '../../types/city'

type Walker = { x: number; z: number; phase: number; direction: number }
type Emitter = { x: number; y: number; z: number; phase: number; dark: boolean }

const PARTICLE_MATERIAL = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vAlpha; varying vec3 vColor; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*70.0; vAlpha=aAlpha; vColor=aColor; }`,
  fragmentShader: `varying float vAlpha; varying vec3 vColor; void main(){ vec2 p=gl_PointCoord-vec2(0.5); float d=length(p); if(d>0.5) discard; float edge=1.0-smoothstep(0.28,0.5,d); gl_FragColor=vec4(vColor,vAlpha*edge); }`,
})

const GRID_OFFSET = 31.5

/** Shared point buffer for chimney smoke and tiny walkers; no per-particle React meshes. */
export function LivingCityParticles({ grid }: { grid: Grid }) {
  const points = useRef<THREE.Points>(null)
  const walkers = useMemo<Walker[]>(() => {
    const result: Walker[] = []
    for (const row of grid) for (const cell of row) {
      if (cell.type !== TileType.RESIDENTIAL && cell.type !== TileType.COMMERCIAL) continue
      for (let i = 0; i < 2; i += 1) result.push({
        x: cell.x - GRID_OFFSET + (i ? 0.38 : -0.38),
        z: cell.y - GRID_OFFSET + 0.39,
        phase: (cell.x * 0.73 + cell.y * 1.17 + i * 2.4) % (Math.PI * 2),
        direction: i ? -1 : 1,
      })
    }
    return result
  }, [grid])
  const emitters = useMemo<Emitter[]>(() => {
    const result: Emitter[] = []
    for (const row of grid) for (const cell of row) {
      if (cell.type === TileType.INDUSTRIAL && cell.catalogId === 'ind_factory') result.push({ x: cell.x - GRID_OFFSET - 0.28, y: 4.15, z: cell.y - GRID_OFFSET - 0.2, phase: cell.x * 0.31 + cell.y, dark: true })
      if (cell.type === TileType.RESIDENTIAL && (cell.catalogId === 'res_cottage' || cell.catalogId === 'res_townhouse')) result.push({ x: cell.x - GRID_OFFSET - 0.28, y: 1.0, z: cell.y - GRID_OFFSET - 0.2, phase: cell.x * 0.67 + cell.y * 0.29, dark: false })
    }
    return result
  }, [grid])
  const smokeCount = emitters.length * 5
  const geometry = useMemo(() => {
    const total = smokeCount + walkers.length * 2
    const position = new Float32Array(total * 3)
    const size = new Float32Array(total)
    const alpha = new Float32Array(total)
    const color = new Float32Array(total * 3)
    for (let i = 0; i < smokeCount; i += 1) {
      size[i] = 0.15 + (i % 5) * 0.025
      const dark = emitters[Math.floor(i / 5)]?.dark
      const c = new THREE.Color(dark ? '#5b5c5a' : '#f5f0e8')
      color.set([c.r, c.g, c.b], i * 3)
    }
    for (let i = smokeCount; i < total; i += 1) {
      size[i] = i % 2 === 0 ? 0.14 : 0.09
      const c = new THREE.Color(i % 2 === 0 ? '#654735' : '#d7c4a8')
      color.set([c.r, c.g, c.b], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    return geometry
  }, [emitters, smokeCount, walkers.length])

  useFrame(({ clock }) => {
    const target = points.current
    if (!target) return
    const elapsed = clock.elapsedTime
    const position = target.geometry.getAttribute('position') as THREE.BufferAttribute
    const alpha = target.geometry.getAttribute('aAlpha') as THREE.BufferAttribute
    const pointSize = target.geometry.getAttribute('aSize') as THREE.BufferAttribute
    for (let e = 0; e < emitters.length; e += 1) {
      const emitter = emitters[e]
      for (let p = 0; p < 5; p += 1) {
        const index = e * 5 + p
        const phase = ((elapsed * 0.42 + p * 0.2 + emitter.phase) % 1)
        position.setXYZ(index, emitter.x + Math.sin(elapsed * 0.7 + p + emitter.phase) * (0.06 + phase * 0.12), emitter.y + phase * 0.78, emitter.z + Math.cos(elapsed * 0.52 + p) * 0.04)
        alpha.setX(index, (1 - phase) * (emitter.dark ? 0.45 : 0.32))
        pointSize.setX(index, (0.12 + phase * 0.1) * 1.8)
      }
    }
    for (let i = 0; i < walkers.length; i += 1) {
      const walker = walkers[i]
      const stride = Math.sin(elapsed * 0.8 + walker.phase) * 0.16 * walker.direction
      const body = smokeCount + i * 2
      position.setXYZ(body, walker.x + stride, 0.12, walker.z)
      position.setXYZ(body + 1, walker.x + stride, 0.23, walker.z)
      alpha.setX(body, 0.95); alpha.setX(body + 1, 0.95)
    }
    position.needsUpdate = true
    alpha.needsUpdate = true
    pointSize.needsUpdate = true
  })

  return <points ref={points} geometry={geometry} material={PARTICLE_MATERIAL} frustumCulled={false} />
}
