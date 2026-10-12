import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TileModel } from '../3d/BuildingMeshes'
import { TileType } from '../../types/city'
import { useI18n } from '../../i18n/I18nProvider'

function ShowcaseCity() {
  const { city, parks, trees, hills, infill } = useMemo(() => {
    const cells: { x: number; z: number; type: TileType }[] = []
    const roads = new Set<string>()
    // Two cross streets and three side streets create distinct blocks, with
    // a short break in the central avenue for the piazza.
    for (const x of [-12, -6, 6, 12]) for (let z = -13; z <= 11; z += 1) roads.add(`${x},${z}`)
    for (const z of [-5, 4]) for (let x = -13; x <= 13; x += 1) roads.add(`${x},${z}`)
    for (let z = -13; z <= -2; z += 1) roads.add(`0,${z}`)
    for (let z = 2; z <= 11; z += 1) roads.add(`0,${z}`)

    // Continuous street walls: the facades hug both sides of the cross streets,
    // with short planted courts tucked into the quieter gaps behind them.
    const frontageX = [-11, -10, -9, -8, -7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11]
    const homes: [number, number][] = frontageX.flatMap(x => [-6, -4, 3, 5].map(z => [x, z] as [number, number]))
    const hallFootprint = new Set(['-2,-4', '-1,-4', '-2,-3', '-1,-3'])
    const parkOrigins: [number, number][] = [[-11, 6], [9, 6]]
    const parkCells = new Set(parkOrigins.flatMap(([x, z]) => Array.from({ length: 4 }, (_, i) => `${x + (i % 2)},${z + Math.floor(i / 2)}`)))
    const piazzaCells = new Set(Array.from({ length: 9 }, (_, i) => `${-3 + (i % 3)},${-1 + Math.floor(i / 3)}`))
    const occupied = new Set([...parkCells, ...piazzaCells, ...hallFootprint])

    for (const [x, z] of homes) {
      const key = `${x},${z}`
      if (occupied.has(key)) continue
      cells.push({ x, z, type: ((x * 7 + z * 11) % 5 === 0) ? TileType.COMMERCIAL : TileType.RESIDENTIAL })
    }
    for (const [key, type] of [['-2,-4', TileType.CITY_HALL], ['4,-4', TileType.WATER_PUMP]] as [string, TileType][]) {
      const [x, z] = key.split(',').map(Number)
      cells.push({ x, z, type })
    }
    for (const key of roads) {
      const [x, z] = key.split(',').map(Number)
      // Let the paved piazza replace the center crossing in front of Town Hall.
      if (piazzaCells.has(key)) continue
      cells.push({ x, z, type: TileType.ROAD })
    }

    const trees: { x: number; z: number; scale: number; pine: boolean; seed: number }[] = []
    for (let z = -29; z <= 29; z += 3.2) for (let x = -29; x <= 29; x += 3.2) {
      const radius = Math.hypot(x, z)
      if (radius < 15.5 || radius > 29) continue
      const seed = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      const density = radius < 19 ? 0.22 : radius < 23 ? 0.55 : 0.84
      if (seed > density) continue
      trees.push({ x: x + Math.sin(seed * 19) * 0.65, z: z + Math.cos(seed * 23) * 0.65, scale: 0.78 + seed * 0.55, pine: seed > 0.48, seed })
    }
    ;[[-7.2, -9.2], [7.2, -9.2], [-7.2, 7.1], [7.2, 7.1], [-4.4, -1.6]].forEach(([x, z], i) => {
      trees.push({ x, z, scale: 0.68 + i * 0.035, pine: false, seed: 0.12 + i * 0.14 })
    })
    const hills = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2 + 0.18
      const radius = 23 + (i % 3) * 2
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: [3.4 + (i % 2), 0.75 + (i % 3) * 0.18, 2.8 + (i % 4) * 0.45] as [number, number, number] }
    })
    const occupiedKeys = new Set(cells.map(({ x, z }) => `${x},${z}`))
    const roadKeys = new Set(cells.filter(cell => cell.type === TileType.ROAD).map(({ x, z }) => `${x},${z}`))
    const infill: { x: number; z: number; kind: number }[] = []
    for (let z = -11; z <= 9; z += 1) for (let x = -11; x <= 11; x += 1) {
      const key = `${x},${z}`
      if (occupiedKeys.has(key) || parkCells.has(key) || piazzaCells.has(key)) continue
      const neighbors = [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].filter(([nx, nz]) => occupiedKeys.has(`${nx},${nz}`)).length
      const seed = Math.abs(Math.sin(x * 17.31 + z * 41.77) * 43758.5453) % 1
      if (neighbors >= 2 && seed > 0.78) infill.push({ x, z, kind: Math.floor(seed * 10) % 2 })
    }
    return { parks: parkOrigins, trees, hills, infill, city: cells.map((cell, i) => ({ ...cell, i,
      north: roadKeys.has(`${cell.x},${cell.z - 1}`), south: roadKeys.has(`${cell.x},${cell.z + 1}`),
      east: roadKeys.has(`${cell.x + 1},${cell.z}`), west: roadKeys.has(`${cell.x - 1},${cell.z}`),
    })) }
  }, [])
  return (
    <>
      <color attach="background" args={['#eae4d5']} />
      <fogExp2 attach="fog" args={['#e5dacf', 0.002]} />
      <ambientLight intensity={0.5} color="#fff6e8" />
      <directionalLight position={[35, 50, 25]} intensity={1.8} color="#fff1d9" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={0.5} shadow-camera-far={90} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-bias={-0.0003} />
      <OrbitControls autoRotate autoRotateSpeed={0.4} enablePan={false} enableZoom={false} target={[-1, 0.9, -1]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshToonMaterial color="#a69a69" />
      </mesh>
      {hills.map((hill, i) => <mesh key={`hill-${i}`} position={[hill.x, -0.12, hill.z]} scale={hill.scale} receiveShadow>
        <icosahedronGeometry args={[1, 2]} /><meshToonMaterial color={i % 2 ? '#9b7548' : '#b49a66'} /><Edges color="#261c14" threshold={28} />
      </mesh>)}
      {trees.map((tree, i) => <ShowcaseTree key={`forest-${i}`} {...tree} />)}
      {city.map(({ x, z, type, i, north, south, east, west }) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          {type === TileType.RESIDENTIAL || type === TileType.COMMERCIAL
            ? <ShowcaseBuilding styleIndex={type === TileType.COMMERCIAL ? 3 : Math.abs(x * 7 + z * 11) % 4} commercial={type === TileType.COMMERCIAL} variant={i % 3} />
            : <TileModel type={type} variant={i % 4} hasPower hasWater hasSupplies animate={false} north={north} south={south} east={east} west={west} />}
        </group>
      ))}
      {parks.map(([x, z], i) => <ShowcasePark key={`park-${i}`} position={[x, 0, z]} />)}
      {[[-3, -9.25], [3, -9.25], [-3, 7.2], [3, 7.2]].map(([x, z], i) => <ShowcaseCourtyard key={`courtyard-${i}`} position={[x, 0, z]} variant={i} />)}
      {infill.map(({ x, z, kind }, i) => <MicroInfill key={`infill-${x}-${z}-${i}`} position={[x, 0, z]} kind={kind} />)}
      <ShowcasePiazza />
      <ShowcaseTraffic />
      <Crosswalk position={[-0.6, 0.045, 4]} />
      <Crosswalk position={[6, 0.045, 0.6]} rotation={Math.PI / 2} />
      <ParkLights />
    </>
  )
}

const forestLeafMaterials = ['#d97724', '#b43418', '#eab308', '#ca8a04'].map((color) => {
  const material = new THREE.MeshToonMaterial({ color })
  ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
  return material
})

function ShowcaseTree({ x, z, scale, pine, seed }: { x: number; z: number; scale: number; pine: boolean; seed: number }) {
  const crown = forestLeafMaterials[Math.floor(seed * forestLeafMaterials.length)]
  return <group position={[x, 0, z]} scale={scale}>
    <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.045, 0.09, 1.1, 6]} /><meshToonMaterial color="#493421" /><Edges color="#261c14" threshold={28} />
    </mesh>
    {pine ? <>
      {[0.9, 1.35, 1.75].map((y, i) => <mesh key={y} position={[0, y, 0]} rotation={[0.1 * i, seed * 4 + i, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.58 - i * 0.095, 1]} /><primitive object={forestLeafMaterials[(Math.floor(seed * 4) + i) % 4]} attach="material" /><Edges color="#261c14" threshold={28} />
      </mesh>)}
    </> : <>
      <mesh position={[0, 1.38, 0]} rotation={[0.15, seed * 5, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.74, 1]} /><primitive object={crown} attach="material" /><Edges color="#261c14" threshold={28} />
      </mesh>
      <mesh position={[0.32, 1.62, -0.1]} rotation={[0.3, seed * 8, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.42, 1]} /><primitive object={forestLeafMaterials[(Math.floor(seed * 4) + 1) % 4]} attach="material" /><Edges color="#261c14" threshold={28} />
      </mesh>
    </>}
  </group>
}

function ShowcasePark({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const foliage = ['#d97724', '#b43418', '#eab308', '#ca8a04']
  const leafMaterials = useMemo(() => foliage.map(color => {
    const material = new THREE.MeshToonMaterial({ color })
    ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    return material
  }), [])
  const accentMaterial = useMemo(() => {
    const material = new THREE.MeshToonMaterial({ color: '#eab308' })
    ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    return material
  }, [])
  return <group position={position}>
    <mesh position={[1, 0.025, 1]} receiveShadow><boxGeometry args={[1.94, 0.05, 1.94]} /><meshToonMaterial color="#8b9454" /><Edges color="#261c14" threshold={28} /></mesh>
    <mesh position={[1, 0.056, 1]} receiveShadow><boxGeometry args={[1.82, 0.012, 0.18]} /><meshStandardMaterial color="#c8b99d" roughness={1} /></mesh>
    <mesh position={[1, 0.057, 1]} receiveShadow><boxGeometry args={[0.18, 0.014, 1.82]} /><meshStandardMaterial color="#c8b99d" roughness={1} /></mesh>
    {/* Low timber edging keeps each green square legible against the streets. */}
    {[
      [1, 0.09, 0.02, 1.98, 0.12, 0.07], [1, 0.09, 1.98, 1.98, 0.12, 0.07],
      [0.02, 0.09, 1, 0.07, 0.12, 1.98], [1.98, 0.09, 1, 0.07, 0.12, 1.98],
    ].map(([x, y, z, sx, sy, sz], i) => <mesh key={i} position={[x, y, z]} castShadow><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color="#79583a" roughness={0.92} /></mesh>)}
    {[[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]].map(([x, z], i) => <group key={i} position={[x, 0.07, z]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow><cylinderGeometry args={[0.055, 0.085, 0.64, 6]} /><meshStandardMaterial color="#3a281c" /></mesh>
      <mesh position={[0, 0.91, 0]} rotation={[0.18, i * 0.7, 0]} castShadow receiveShadow><icosahedronGeometry args={[0.43, 1]} /><primitive object={leafMaterials[i]} attach="material" /></mesh>
      <mesh position={[0.16, 1.13, -0.08]} rotation={[0.3, i * 0.9, 0]} castShadow><icosahedronGeometry args={[0.27, 1]} /><primitive object={i % 2 ? accentMaterial : leafMaterials[0]} attach="material" /></mesh>
    </group>)}
    <mesh position={[1, 0.17, 1]} castShadow><boxGeometry args={[0.48, 0.07, 0.16]} /><meshStandardMaterial color="#d3bd91" /></mesh>
    <mesh position={[1, 0.27, 0.94]} castShadow><boxGeometry args={[0.48, 0.16, 0.045]} /><meshStandardMaterial color="#79583a" /></mesh>
  </group>
}

function ShowcaseCourtyard({ position, variant }: { position: [number, number, number]; variant: number }) {
  const leaf = ['#d97724', '#eab308', '#b43418', '#ca8a04'][variant % 4]
  return <group position={position}>
    <mesh position={[0, 0.018, 0]} receiveShadow><boxGeometry args={[1.72, 0.035, 1.5]} /><meshToonMaterial color="#8b9454" /></mesh>
    <mesh position={[0, 0.042, 0]}><boxGeometry args={[1.58, 0.012, 0.12]} /><meshToonMaterial color="#c8b99d" /></mesh>
    <mesh position={[0, 0.043, 0]}><boxGeometry args={[0.12, 0.014, 1.42]} /><meshToonMaterial color="#c8b99d" /></mesh>
    {[-0.76, 0.76].map(x => <mesh key={x} position={[x, 0.09, 0]} castShadow><boxGeometry args={[0.035, 0.12, 1.48]} /><meshToonMaterial color="#79583a" /></mesh>)}
    <group position={[variant % 2 ? 0.48 : -0.48, 0, variant % 2 ? -0.36 : 0.36]}>
      <mesh position={[0, 0.44, 0]} castShadow><cylinderGeometry args={[0.045, 0.07, 0.8, 6]} /><meshToonMaterial color="#493421" /></mesh>
      <mesh position={[0, 0.98, 0]} castShadow><icosahedronGeometry args={[0.4, 1]} /><meshToonMaterial color={leaf} /></mesh>
      <mesh position={[0.2, 1.12, -0.06]} castShadow><icosahedronGeometry args={[0.24, 1]} /><meshToonMaterial color="#ca8a04" /></mesh>
    </group>
    <mesh position={[0.45, 0.13, -0.5]} castShadow><boxGeometry args={[0.38, 0.06, 0.14]} /><meshToonMaterial color="#79583a" /></mesh>
    {[-0.46, -0.28].map(x => <mesh key={x} position={[x, 0.09, -0.56]} castShadow><sphereGeometry args={[0.09, 7, 5]} /><meshToonMaterial color="#ea580c" /></mesh>)}
  </group>
}

function MicroInfill({ position, kind }: { position: [number, number, number]; kind: number }) {
  return <group position={position}>
    {kind === 0 ? <>
      <mesh position={[0, 0.035, 0]}><boxGeometry args={[0.9, 0.06, 0.9]} /><meshToonMaterial color="#82904f" /></mesh>
      <mesh position={[0, 0.12, -0.39]}><boxGeometry args={[0.82, 0.16, 0.045]} /><meshToonMaterial color="#79583a" /></mesh>
      <mesh position={[-0.22, 0.17, 0.12]}><sphereGeometry args={[0.11, 7, 5]} /><meshToonMaterial color="#ea580c" /></mesh>
      <mesh position={[0.24, 0.21, -0.08]}><icosahedronGeometry args={[0.18, 0]} /><meshToonMaterial color="#526b37" /></mesh>
    </> : <>
      <mesh position={[0, 0.025, 0]}><boxGeometry args={[0.94, 0.05, 0.94]} /><meshToonMaterial color="#777b79" /></mesh>
      {[-0.22, 0.02].map(x => <mesh key={x} position={[x, 0.14, -0.12]} castShadow><boxGeometry args={[0.18, 0.22, 0.2]} /><meshToonMaterial color="#4d5657" /></mesh>)}
      <mesh position={[0.28, 0.38, 0.22]} castShadow><cylinderGeometry args={[0.018, 0.028, 0.72, 6]} /><meshToonMaterial color="#34332e" /></mesh>
      <mesh position={[0.28, 0.77, 0.22]}><icosahedronGeometry args={[0.075, 0]} /><meshBasicMaterial color="#ffe08a" /></mesh>
    </>}
  </group>
}

function ShowcaseTraffic() {
  const cars = [
    { lane: 'x' as const, fixed: -5.28, phase: 0, color: '#b43418' },
    { lane: 'x' as const, fixed: 4.28, phase: 4.4, color: '#356b78' },
    { lane: 'x' as const, fixed: -4.72, phase: 11.2, color: '#d6a12e' },
    { lane: 'x' as const, fixed: 3.72, phase: 17.3, color: '#536c47' },
    { lane: 'z' as const, fixed: -6.28, phase: 2.3, color: '#724d74' },
    { lane: 'z' as const, fixed: 6.28, phase: 8.1, color: '#d27c34' },
    { lane: 'z' as const, fixed: 11.72, phase: 14.5, color: '#e7dfcf' },
  ]
  return <group>{cars.map((car, i) => <ShowcaseCar key={i} {...car} />)}</group>
}

function ShowcaseCar({ lane, fixed, phase, color }: { lane: 'x' | 'z'; fixed: number; phase: number; color: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const along = -11.5 + ((clock.elapsedTime * 0.48 + phase) % 23)
    ref.current.position.set(lane === 'x' ? along : fixed, 0.08, lane === 'z' ? along : fixed)
    ref.current.rotation.y = lane === 'z' ? Math.PI / 2 : 0
  })
  return <group ref={ref}>
    <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.34, 0.13, 0.54]} /><meshToonMaterial color={color} /><Edges color="#261c14" threshold={28} /></mesh>
    <mesh position={[0, 0.2, -0.04]}><boxGeometry args={[0.25, 0.12, 0.25]} /><meshToonMaterial color="#9bb4b8" /></mesh>
    {[-1, 1].flatMap(side => [-1, 1].map(end => <mesh key={`${side}:${end}`} position={[side * 0.17, 0.06, end * 0.17]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.035, 8]} /><meshStandardMaterial color="#262626" /></mesh>))}
  </group>
}

const facadePalettes = [
  { name: 'half-timber', wall: '#f4ede2', roof: '#a03b26', trim: '#3d2817' },
  { name: 'brownstone', wall: '#8c3a27', roof: '#363f4a', trim: '#e2b787' },
  { name: 'renaissance', wall: '#e2ba6e', roof: '#4a5260', trim: '#f5ead6' },
  { name: 'modern', wall: '#d6c7aa', roof: '#828894', trim: '#46525a' },
]

function ShowcaseBuilding({ styleIndex, commercial, variant }: { styleIndex: number; commercial: boolean; variant: number }) {
  const style = facadePalettes[styleIndex]
  const roofColor = style.name === 'modern'
    ? ['#828894', '#c5bcab', '#3d4450'][variant % 3]
    : style.roof
  const floors = 2 + (variant % 3)
  const height = floors * 0.43
  const front = 0.465
  const windowYs = Array.from({ length: floors }, (_, floor) => 0.34 + floor * 0.43)
  return <group>
    <mesh position={[0, 0.11, 0]} receiveShadow castShadow><boxGeometry args={[0.96, 0.22, 0.96]} /><meshToonMaterial color="#d4ccc0" /><Edges color="#261c14" threshold={28} /></mesh>
    <mesh position={[0, 0.22 + height / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.9, height, 0.9]} /><meshToonMaterial color={style.wall} /><Edges color="#261c14" threshold={28} /></mesh>
    {commercial ? <>
      <mesh position={[0, 0.47, front + 0.012]}><boxGeometry args={[0.66, 0.36, 0.025]} /><meshStandardMaterial color="#304552" metalness={0.12} roughness={0.3} /></mesh>
      <mesh position={[0, 0.47, front + 0.03]}><boxGeometry args={[0.58, 0.29, 0.014]} /><meshStandardMaterial color="#a8c4c4" roughness={0.22} /></mesh>
      <mesh position={[0, 0.68, front + 0.035]}><boxGeometry args={[0.78, 0.07, 0.09]} /><meshStandardMaterial color={style.trim} /></mesh>
    </> : windowYs.map((y, floor) => [-0.22, 0.22].map((x, side) => <group key={`window-${floor}-${side}`} position={[x, y, front + 0.012]}>
      <mesh castShadow><boxGeometry args={[0.14, 0.2, 0.025]} /><meshStandardMaterial color={style.trim} /></mesh>
      <mesh position={[0, 0, 0.017]}><boxGeometry args={[0.095, 0.145, 0.014]} /><meshStandardMaterial color="#26343b" roughness={0.35} /></mesh>
      <mesh position={[0, -0.12, 0.025]}><boxGeometry args={[0.2, 0.035, 0.06]} /><meshStandardMaterial color={style.trim} /></mesh>
    </group>))}
    {style.name === 'half-timber' && <group>
      {[-0.34, 0, 0.34].map(x => <mesh key={`post-${x}`} position={[x, 0.22 + height / 2, front + 0.025]}><boxGeometry args={[0.045, height, 0.045]} /><meshStandardMaterial color="#3d2817" /></mesh>)}
      {windowYs.map(y => <mesh key={`beam-${y}`} position={[0, y - 0.18, front + 0.025]}><boxGeometry args={[0.88, 0.045, 0.045]} /><meshStandardMaterial color="#3d2817" /></mesh>)}
      {[-1, 1].map(sign => <mesh key={`brace-${sign}`} position={[sign * 0.32, 0.42, front + 0.045]} rotation={[0, 0, sign * -0.55]}><boxGeometry args={[0.045, 0.56, 0.04]} /><meshStandardMaterial color="#3d2817" /></mesh>)}
    </group>}
    {style.name === 'renaissance' && windowYs.map(y => <mesh key={`cornice-${y}`} position={[0, y + 0.19, front + 0.025]} castShadow><boxGeometry args={[0.96, 0.045, 0.08]} /><meshStandardMaterial color="#f5ead6" /></mesh>)}
    {style.name === 'brownstone' && <group>
      {[0.56, 0.98, 1.4].filter(y => y < height + 0.2).map((y, i) => <group key={i} position={[0.43, y, front + 0.04]}>
        <mesh castShadow><boxGeometry args={[0.16, 0.035, 0.22]} /><meshStandardMaterial color="#4a5054" metalness={0.35} roughness={0.6} /></mesh>
        <mesh position={[0, -0.09, 0]}><boxGeometry args={[0.025, 0.18, 0.025]} /><meshStandardMaterial color="#4a5054" metalness={0.35} /></mesh>
      </group>)}
      {[-0.4, 0.4].map(x => <mesh key={x} position={[x, 0.24 + height, 0]} castShadow><boxGeometry args={[0.08, 0.12, 1.02]} /><meshStandardMaterial color="#e2b787" /></mesh>)}
    </group>}
    {style.name === 'modern' && <group>
      <mesh position={[0, 0.24 + height, 0]} castShadow><boxGeometry args={[0.94, 0.12, 0.94]} /><meshStandardMaterial color={roofColor} roughness={0.85} /></mesh>
      <mesh position={[-0.22, 0.38 + height, -0.12]} castShadow><boxGeometry args={[0.22, 0.16, 0.18]} /><meshStandardMaterial color="#9fa6a4" /></mesh>
      <mesh position={[0.23, 0.38 + height, 0.12]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.16, 8]} /><meshStandardMaterial color="#a56d4b" /></mesh>
    </group>}
    {style.name !== 'modern' && (style.name === 'half-timber'
      ? <group>
        <mesh position={[-0.19, 0.24 + height + 0.23, 0]} rotation={[0, 0, -0.58]} castShadow><boxGeometry args={[0.56, 0.085, 1.02]} /><meshToonMaterial color={style.roof} /><Edges color="#261c14" threshold={28} /></mesh>
        <mesh position={[0.19, 0.24 + height + 0.23, 0]} rotation={[0, 0, 0.58]} castShadow><boxGeometry args={[0.56, 0.085, 1.02]} /><meshToonMaterial color={style.roof} /><Edges color="#261c14" threshold={28} /></mesh>
      </group>
      : <group>
        <mesh position={[0, 0.24 + height + 0.08, 0]} castShadow><boxGeometry args={[0.98, 0.14, 0.98]} /><meshStandardMaterial color={style.roof} roughness={0.92} /></mesh>
        {style.name === 'renaissance' && <>
          <mesh position={[0, 0.24 + height + 0.19, -0.28]} rotation={[-0.48, 0, 0]} castShadow><boxGeometry args={[0.98, 0.08, 0.62]} /><meshStandardMaterial color={style.roof} roughness={0.92} /></mesh>
          <mesh position={[0, 0.24 + height + 0.19, 0.28]} rotation={[0.48, 0, 0]} castShadow><boxGeometry args={[0.98, 0.08, 0.62]} /><meshStandardMaterial color={style.roof} roughness={0.92} /></mesh>
        </>}
      </group>)}
    <mesh position={[0, 0.25 + height, front + 0.045]} castShadow><boxGeometry args={[0.98, 0.055, 0.12]} /><meshStandardMaterial color={style.trim} roughness={0.85} /></mesh>
  </group>
}

function ShowcasePiazza() {
  return <group position={[-2, 0, 2]}>
    <mesh position={[0, 0.025, 0]} receiveShadow><boxGeometry args={[2.96, 0.05, 2.96]} /><meshStandardMaterial color="#d9d0c0" roughness={0.95} /></mesh>
    {/* Fine inset joints read as pale cut-stone paving from the menu camera. */}
    {[-1, 0, 1].map((v) => <group key={v}>
      <mesh position={[v, 0.052, 0]}><boxGeometry args={[0.018, 0.006, 2.9]} /><meshStandardMaterial color="#b9ad9a" /></mesh>
      <mesh position={[0, 0.052, v]}><boxGeometry args={[2.9, 0.006, 0.018]} /><meshStandardMaterial color="#b9ad9a" /></mesh>
    </group>)}
    <group position={[0, 0.075, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow><cylinderGeometry args={[0.46, 0.5, 0.1, 12]} /><meshStandardMaterial color="#aaa18f" roughness={0.85} /></mesh>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.34, 0.36, 0.04, 12]} /><meshStandardMaterial color="#799ba0" roughness={0.25} metalness={0.08} /></mesh>
      <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.025, 0.035, 0.42, 6]} /><meshStandardMaterial color="#d8d0c0" /></mesh>
      <mesh position={[0, 0.55, 0]}><icosahedronGeometry args={[0.075, 1]} /><meshStandardMaterial color="#b9dce0" transparent opacity={0.78} /></mesh>
    </group>
    {[[-1.05, 0.18, -0.9], [1.05, 0.18, 0.9]].map(([x, y, z], i) => <group key={i} position={[x, y, z]}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.025, 0.04, 0.6, 6]} /><meshStandardMaterial color="#34332e" /></mesh>
      <mesh position={[0, 0.64, 0]} castShadow><icosahedronGeometry args={[0.09, 0]} /><meshStandardMaterial color="#e7c779" emissive="#8a6030" emissiveIntensity={0.16} /></mesh>
      <mesh position={[0, 0.74, 0]}><boxGeometry args={[0.17, 0.025, 0.17]} /><meshStandardMaterial color="#34332e" /></mesh>
    </group>)}
    {[[-1.1, 0, 0.95], [1.1, 0, -0.95]].map(([x, , z], i) => <group key={i} position={[x, 0.08, z]}>
      <mesh position={[0, 0.13, 0]} castShadow><boxGeometry args={[0.42, 0.07, 0.16]} /><meshStandardMaterial color="#79583a" /></mesh>
      <mesh position={[0, 0.25, -0.06]} castShadow><boxGeometry args={[0.42, 0.16, 0.045]} /><meshStandardMaterial color="#79583a" /></mesh>
    </group>)}
    {/* Harvest wine stall, oak barrels, and small bunting at the piazza edge. */}
    <group position={[1.03, 0.06, -0.93]}>
      {[-0.19, 0.19].map((x) => <mesh key={`market-post-${x}`} position={[x, 0.25, 0]} castShadow><boxGeometry args={[0.035, 0.5, 0.035]} /><meshToonMaterial color="#76513a" /><Edges color="#261c14" threshold={28} /></mesh>)}
      <mesh position={[0, 0.51, 0]} castShadow><boxGeometry args={[0.47, 0.07, 0.3]} /><meshToonMaterial color="#f4ead8" /><Edges color="#261c14" threshold={28} /></mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => <mesh key={`market-stripe-${i}`} position={[x, 0.55, 0.015]}><boxGeometry args={[0.06, 0.018, 0.27]} /><meshToonMaterial color={i % 2 ? '#b43418' : '#d97724'} /></mesh>)}
      {[-0.27, 0.27].map((x) => <mesh key={`barrel-${x}`} position={[x, 0.11, 0.15]}><cylinderGeometry args={[0.075, 0.07, 0.18, 8]} /><meshToonMaterial color="#8b5b34" /><Edges color="#261c14" threshold={28} /></mesh>)}
      {Array.from({ length: 5 }, (_, i) => <mesh key={`bunting-${i}`} position={[-0.35 + i * 0.17, 0.71 - (i % 2) * 0.035, -0.09]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.055, 0.12, 3]} /><meshToonMaterial color={['#b43418', '#eab308', '#2e6c64'][i % 3]} /></mesh>)}
    </group>
  </group>
}

function Crosswalk({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[(i - 2.5) * 0.14, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[0.085, 0.76]} /><meshStandardMaterial color="#eee8d9" roughness={0.9} />
    </mesh>)}
  </group>
}

function ParkLights() {
  const positions: [number, number, number][] = [[-4.3, 0, -3.15], [-3.7, 0, -3.15], [3.2, 0, 3.85], [3.8, 0, 3.85]]
  return <group>{positions.map(([x, y, z], i) => <group key={i} position={[x, y, z]}>
    <mesh position={[0, 0.47, 0]} castShadow><cylinderGeometry args={[0.025, 0.04, 0.94, 6]} /><meshStandardMaterial color="#34332e" roughness={0.8} /></mesh>
    <mesh position={[0, 0.99, 0]} castShadow><icosahedronGeometry args={[0.11, 0]} /><meshStandardMaterial color="#e7c779" emissive="#8a6030" emissiveIntensity={0.18} roughness={0.55} /></mesh>
    <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[0.2, 0.035, 0.2]} /><meshStandardMaterial color="#34332e" /></mesh>
  </group>)}</group>
}

interface TitleScreenProps { onStart: (mode: 'new' | 'continue' | 'sandbox') => void }
export function TitleScreen({ onStart }: TitleScreenProps) {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const hasSave = useMemo(() => {
    try { return Boolean(localStorage.getItem('inkville-save')) } catch { return false }
  }, [])
  useEffect(() => {
    const started = performance.now()
    const timer = window.setInterval(() => {
      const next = Math.min(100, ((performance.now() - started) / 1900) * 100)
      setProgress(next)
      if (next >= 100) { setReady(true); window.clearInterval(timer) }
    }, 40)
    return () => window.clearInterval(timer)
  }, [])
  const begin = (mode: 'new' | 'continue' | 'sandbox') => {
    if (!ready || leaving) return
    setLeaving(true)
    window.setTimeout(() => onStart(mode), 650)
  }
  return (
    <div className={`absolute inset-0 z-40 overflow-hidden bg-[#eae4d5] transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [18, 21, 24], fov: 42 }} gl={{ antialias: true }}>
        <ShowcaseCity />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_22%,rgba(23,28,34,0.44)_100%)]" />
      <div className="absolute inset-y-0 left-0 flex w-full max-w-[560px] items-center px-8 sm:px-14">
        <section className="w-full rounded-[28px] border border-white/60 bg-[#f7f2e7]/75 p-7 shadow-[0_24px_70px_rgba(34,34,30,.22)] backdrop-blur-sm sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#34312b]/25 bg-white/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[.23em] text-[#665a48]">{t('title.eyebrow')}</div>
          <h1 className="font-serif text-6xl font-black italic tracking-[-.07em] text-[#26251f] sm:text-7xl">Inkville</h1>
          <p className="mt-2 text-sm font-semibold tracking-[.16em] text-[#6b6255]">{t('title.tagline')}</p>
          <div className="mt-8 h-2 overflow-hidden rounded-full border border-[#332f28]/60 bg-[#d8d0c0]">
            <div className="h-full bg-[repeating-linear-gradient(135deg,#a6653d_0px,#a6653d_4px,#d59c61_4px,#d59c61_7px)] transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          {!ready ? <p className="mt-3 h-5 text-xs font-semibold text-[#746958]">{t(`title.loading${Math.min(3, Math.floor(progress / 34) + 1)}`)}</p> : (
            <div className="mt-6 grid gap-3">
              <button onClick={() => begin('new')} className="rounded-xl border-2 border-[#292720] bg-[#d6a15f] px-5 py-3 text-sm font-black text-[#28251e] shadow-[3px_3px_0_#292720] transition hover:-translate-y-0.5 hover:bg-[#e0b273]">{t('title.newCity')}</button>
              {hasSave && <button onClick={() => begin('continue')} className="rounded-xl border-2 border-[#292720]/70 bg-[#f7f3eb] px-5 py-3 text-sm font-bold text-[#38342c]">{t('title.continue')}</button>}
              <button onClick={() => begin('sandbox')} className="rounded-xl border border-[#292720]/35 bg-white/35 px-5 py-2.5 text-sm font-semibold text-[#514b40] transition hover:bg-white/65">{t('title.sandbox')}</button>
            </div>
          )}
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[.18em] text-[#8b806e]">{t('title.footer')}</p>
        </section>
      </div>
    </div>
  )
}
