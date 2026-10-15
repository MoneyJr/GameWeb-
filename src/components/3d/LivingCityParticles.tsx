import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Grid } from '../../types/city'
import { TileType } from '../../types/city'

type Walker = { x: number; z: number; phase: number; direction: number; axis: 'x' | 'z'; standing: boolean }
type Emitter = { x: number; y: number; z: number; phase: number; dark: boolean }

const PARTICLE_MATERIAL = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vAlpha; varying vec3 vColor; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*70.0; vAlpha=aAlpha; vColor=aColor; }`,
  fragmentShader: `varying float vAlpha; varying vec3 vColor; void main(){ vec2 p=gl_PointCoord-vec2(0.5); float d=length(p); if(d>0.5) discard; float edge=1.0-smoothstep(0.28,0.5,d); gl_FragColor=vec4(vColor,vAlpha*edge); }`,
})

const GRID_OFFSET = 31.5
const WALKER_COLORS = ['#8b3f2f', '#425b73', '#c17b32', '#61734a', '#704d70']

/** Shared smoke buffer plus instanced pedestrians, avoiding per-person draw calls. */
export function LivingCityParticles({ grid }: { grid: Grid }) {
  const points = useRef<THREE.Points>(null)
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const walkers = useMemo<Walker[]>(() => {
    const result: Walker[] = []
    for (const row of grid) for (const cell of row) {
      const isHome = cell.type === TileType.RESIDENTIAL
      const isShop = cell.type === TileType.COMMERCIAL
      const isPark = cell.type === TileType.PARK
      if (!isHome && !isShop && !isPark) continue
      const roadSides = [
        { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 },
      ].filter(({ dx, dz }) => grid[cell.y + dz]?.[cell.x + dx]?.type === TileType.ROAD)
      if (!roadSides.length) continue

      roadSides.forEach(({ dx, dz }, sideIndex) => {
        const roadX = cell.x + dx - GRID_OFFSET
        const roadZ = cell.y + dz - GRID_OFFSET
        // Road tiles have 0.2-unit sidewalks centered 0.4 from the road center.
        // Place walkers on the sidewalk nearest their home, shop, or park.
        const sidewalkX = roadX - dx * 0.4
        const sidewalkZ = roadZ - dz * 0.4
        const axis = dx !== 0 ? 'z' : 'x'
        const count = 2
        for (let i = 0; i < count; i += 1) result.push({
          x: sidewalkX + (axis === 'x' ? (i ? 0.2 : -0.2) : 0),
          z: sidewalkZ + (axis === 'z' ? (i ? 0.2 : -0.2) : 0),
          phase: (cell.x * 0.73 + cell.y * 1.17 + i * 2.4 + sideIndex) % (Math.PI * 2),
          direction: i ? -1 : 1,
          axis,
          // One person pauses by each storefront/porch; park visitors linger
          // along the walk beside the green rather than in the roadway.
          standing: isPark || i === 1,
        })
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
    const total = smokeCount
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
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    return geometry
  }, [emitters, smokeCount, walkers.length])
  const bodyGeometry = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 0.22, 7), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.06, 8, 6), [])
  const pedestrianMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffffff' }), [])
  const bodyTransform = useMemo(() => new THREE.Object3D(), [])
  const headTransform = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    const bodies = bodyRef.current
    const heads = headRef.current
    if (bodies) bodies.count = walkers.length
    if (heads) heads.count = walkers.length
    if (!bodies || !heads) return
    walkers.forEach((_, index) => {
      const color = new THREE.Color(WALKER_COLORS[index % WALKER_COLORS.length])
      bodies.setColorAt(index, color)
      heads.setColorAt(index, color.clone().multiplyScalar(0.72))
    })
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true
  }, [walkers])

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
    const bodies = bodyRef.current
    const heads = headRef.current
    for (let i = 0; i < walkers.length; i += 1) {
      const walker = walkers[i]
      const stride = walker.standing ? 0 : Math.sin(elapsed * 0.8 + walker.phase) * 0.16 * walker.direction
      const x = walker.x + (walker.axis === 'x' ? stride : 0)
      const z = walker.z + (walker.axis === 'z' ? stride : 0)
      // y=0.15 is the foot level above the road tile and its sidewalk slab.
      bodyTransform.position.set(x, 0.15 + 0.11, z)
      bodyTransform.rotation.set(0, walker.axis === 'x' ? Math.PI / 2 : 0, 0)
      bodyTransform.updateMatrix()
      bodies?.setMatrixAt(i, bodyTransform.matrix)
      headTransform.position.set(x, 0.15 + 0.22 + 0.06, z)
      headTransform.updateMatrix()
      heads?.setMatrixAt(i, headTransform.matrix)
    }
    position.needsUpdate = true
    alpha.needsUpdate = true
    pointSize.needsUpdate = true
    if (bodies) { bodies.instanceMatrix.needsUpdate = true; bodies.computeBoundingSphere() }
    if (heads) { heads.instanceMatrix.needsUpdate = true; heads.computeBoundingSphere() }
  })

  return <group>
    <points ref={points} geometry={geometry} material={PARTICLE_MATERIAL} frustumCulled={false} />
    <instancedMesh ref={bodyRef} args={[bodyGeometry, pedestrianMaterial, Math.max(walkers.length, 1)]} frustumCulled={false} />
    <instancedMesh ref={headRef} args={[headGeometry, pedestrianMaterial, Math.max(walkers.length, 1)]} frustumCulled={false} />
  </group>
}
