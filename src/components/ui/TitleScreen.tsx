import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TileModel } from '../3d/BuildingMeshes'
import { TileType } from '../../types/city'
import { useI18n, type Language } from '../../i18n/I18nProvider'
import { InkOutlinePassEffect, ToonShadingSetup } from '../3d/InkOutlinePass'

function ShowcaseCity() {
  const { city, parks, trees, hills, infill, gardenCells, roundabouts } = useMemo(() => {
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
    // Two neighborhood squares plus a small planted court inside every block.
    const parkOrigins: [number, number][] = [[-11, 6], [9, 6], [-11, -2], [-5, -2], [1, -2], [7, -2]]
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
    const infillKeys = new Set(infill.map(({ x, z }) => `${x},${z}`))
    // Landscaped courtyard tiles fill the interior block gaps so the panorama
    // reads as a town with gardens rather than a city floating in bare soil.
    const gardenCells: { x: number; z: number; variant: number }[] = []
    for (let z = -3; z <= 2; z += 1) for (let x = -11; x <= 11; x += 1) {
      const key = `${x},${z}`
      if (occupiedKeys.has(key) || parkCells.has(key) || piazzaCells.has(key) || infillKeys.has(key)) continue
      const seed = Math.abs(Math.sin(x * 31.7 + z * 13.9) * 43758.5453) % 1
      gardenCells.push({ x, z, variant: Math.floor(seed * 100) })
    }
    const roundabouts: [number, number][] = [[-12, -13], [12, -13], [-12, 11], [12, 11]]
    return { parks: parkOrigins, trees, hills, infill, gardenCells, roundabouts, city: cells.map((cell, i) => ({ ...cell, i,
      north: roadKeys.has(`${cell.x},${cell.z - 1}`), south: roadKeys.has(`${cell.x},${cell.z + 1}`),
      east: roadKeys.has(`${cell.x + 1},${cell.z}`), west: roadKeys.has(`${cell.x - 1},${cell.z}`),
    })) }
  }, [])
  return (
    <>
      <color attach="background" args={['#EAE2D2']} />
      <fogExp2 attach="fog" args={['#EAE2D2', 0.006]} />
      <ambientLight intensity={0.65} color="#ecdcc9" />
      <directionalLight position={[35, 50, 25]} intensity={1.4} color="#fff7ea" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={0.5} shadow-camera-far={90} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-bias={-0.0003} />
      <OrbitControls autoRotate autoRotateSpeed={0.4} enablePan={false} enableZoom={false} target={[4.5, 0.9, -1]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshToonMaterial color="#cfb997" />
      </mesh>
      {hills.map((hill, i) => <mesh key={`hill-${i}`} position={[hill.x, -0.12, hill.z]} scale={hill.scale} receiveShadow>
        <icosahedronGeometry args={[1, 2]} /><meshToonMaterial color={i % 2 ? '#9b7548' : '#b49a66'} /><Edges color="#261c14" threshold={28} />
      </mesh>)}
      {trees.map((tree, i) => <ShowcaseTree key={`forest-${i}`} {...tree} />)}
      {city.map(({ x, z, type, i, north, south, east, west }) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          {type === TileType.RESIDENTIAL || type === TileType.COMMERCIAL
            ? <ShowcaseBuilding styleIndex={type === TileType.COMMERCIAL ? 3 : Math.abs(x * 7 + z * 11) % 4} commercial={type === TileType.COMMERCIAL} variant={i % 3} smoke={type === TileType.RESIDENTIAL && i % 5 === 0} />
            : <TileModel type={type} variant={i % 4} hasPower hasWater hasSupplies animate={false} north={north} south={south} east={east} west={west} />}
        </group>
      ))}
      {parks.map(([x, z], i) => <ShowcasePark key={`park-${i}`} position={[x, 0, z]} />)}
      {gardenCells.map(({ x, z, variant }) => <GardenCell key={`garden-${x}-${z}`} position={[x, 0, z]} variant={variant} />)}
      {infill.map(({ x, z, kind }, i) => <MicroInfill key={`infill-${x}-${z}-${i}`} position={[x, 0, z]} kind={kind} />)}
      {roundabouts.map(([x, z], i) => <ShowcaseRoundabout key={`roundabout-${i}`} position={[x, 0, z]} variant={i} />)}
      <ShowcasePiazza />
      <ShowcaseTraffic />
      <ParkedShowcaseCars />
      <Crosswalk position={[-0.6, 0.045, 4]} />
      <Crosswalk position={[6, 0.045, 0.6]} rotation={Math.PI / 2} />
      <ParkLights />
      <ToonShadingSetup />
      <InkOutlinePassEffect />
    </>
  )
}

function ShowcaseSceneReady({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let active = true
    void gl.compileAsync(scene, camera).catch(() => undefined).finally(() => { if (active) onReady() })
    return () => { active = false }
  }, [camera, gl, onReady, scene])
  return null
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

function GardenCell({ position, variant }: { position: [number, number, number]; variant: number }) {
  const autumn = ['#d97724', '#b43418', '#eab308', '#ca8a04']
  const leaf = autumn[variant % autumn.length]
  return <group position={position}>
    <mesh position={[0, 0.014, 0]} receiveShadow><boxGeometry args={[0.96, 0.028, 0.96]} /><meshToonMaterial color={variant % 5 === 0 ? '#72894b' : '#839450'} /></mesh>
    <mesh position={[0, 0.032, 0]}><boxGeometry args={[0.11, 0.012, 0.92]} /><meshToonMaterial color="#c8b99d" /></mesh>
    <mesh position={[0, 0.033, 0]}><boxGeometry args={[0.92, 0.012, 0.11]} /><meshToonMaterial color="#c8b99d" /></mesh>
    {variant % 9 === 0 ? <group position={[variant % 2 ? 0.28 : -0.28, 0.045, variant % 3 ? 0.28 : -0.28]}>
      <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.025, 0.045, 0.5, 5]} /><meshToonMaterial color="#493421" /></mesh>
      <mesh position={[0, 0.59, 0]} castShadow><icosahedronGeometry args={[0.27, 1]} /><meshToonMaterial color={leaf} /></mesh>
    </group> : <>
      <mesh position={[-0.3, 0.1, 0.28]} castShadow><icosahedronGeometry args={[0.13, 0]} /><meshToonMaterial color={leaf} /></mesh>
      <mesh position={[0.29, 0.11, -0.3]} castShadow><icosahedronGeometry args={[0.15, 0]} /><meshToonMaterial color={autumn[(variant + 1) % autumn.length]} /></mesh>
    </>}
    {variant % 4 === 0 && <mesh position={[0.05, 0.08, 0.31]} castShadow><boxGeometry args={[0.4, 0.06, 0.12]} /><meshToonMaterial color="#79583a" /></mesh>}
  </group>
}

function ShowcaseRoundabout({ position, variant }: { position: [number, number, number]; variant: number }) {
  return <group position={position}>
    <mesh position={[0, 0.035, 0]} receiveShadow><cylinderGeometry args={[0.72, 0.72, 0.07, 12]} /><meshToonMaterial color="#d8d0c0" /><Edges color="#261c14" threshold={28} /></mesh>
    <mesh position={[0, 0.079, 0]} receiveShadow><cylinderGeometry args={[0.42, 0.42, 0.025, 10]} /><meshToonMaterial color="#76864a" /></mesh>
    <group position={[0, 0.09, 0]}>
      <mesh position={[0, 0.24, 0]} castShadow><cylinderGeometry args={[0.035, 0.05, 0.45, 5]} /><meshToonMaterial color="#493421" /></mesh>
      <mesh position={[0, 0.54, 0]} castShadow><icosahedronGeometry args={[0.28, 1]} /><meshToonMaterial color={['#d97724', '#b43418', '#eab308', '#ca8a04'][variant]} /></mesh>
    </group>
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

function ParkedShowcaseCars() {
  const cars: { position: [number, number, number]; rotation: number; color: string }[] = [
    { position: [-12.45, 0.08, -9.5], rotation: 0, color: '#b43418' },
    { position: [12.45, 0.08, -8.8], rotation: 0, color: '#356b78' },
    { position: [-12.45, 0.08, 7.8], rotation: 0, color: '#d6a12e' },
    { position: [12.45, 0.08, 7.4], rotation: 0, color: '#536c47' },
  ]
  return <group>{cars.map((car, i) => <group key={i} position={car.position} rotation={[0, car.rotation, 0]}>
    <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.34, 0.13, 0.54]} /><meshToonMaterial color={car.color} /><Edges color="#261c14" threshold={28} /></mesh>
    <mesh position={[0, 0.2, -0.04]}><boxGeometry args={[0.25, 0.12, 0.25]} /><meshToonMaterial color="#9bb4b8" /></mesh>
    {[-1, 1].flatMap(side => [-1, 1].map(end => <mesh key={`${side}:${end}`} position={[side * 0.17, 0.06, end * 0.17]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.035, 8]} /><meshStandardMaterial color="#262626" /></mesh>))}
  </group>)}</group>
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

function ShowcaseBuilding({ styleIndex, commercial, variant, smoke = false }: { styleIndex: number; commercial: boolean; variant: number; smoke?: boolean }) {
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
    {!commercial && style.name !== 'modern' && <>
      <mesh position={[-0.28, 0.24 + height + 0.32, -0.18]} castShadow><boxGeometry args={[0.12, 0.48, 0.12]} /><meshToonMaterial color="#8b3a2b" /><Edges color="#261c14" threshold={28} /></mesh>
      {smoke && <SmokePuffs position={[-0.28, 0.24 + height + 0.58, -0.18]} />}
    </>}
  </group>
}

function SmokePuffs({ position }: { position: [number, number, number] }) {
  const puffOne = useRef<THREE.Mesh>(null)
  const puffTwo = useRef<THREE.Mesh>(null)
  const puffThree = useRef<THREE.Mesh>(null)
  const puffs = [puffOne, puffTwo, puffThree]
  useFrame(({ clock }) => {
    puffs.forEach((ref, i) => {
      const mesh = ref.current
      if (!mesh) return
      const phase = (clock.elapsedTime * 0.32 + i / puffs.length) % 1
      mesh.position.set(Math.sin(clock.elapsedTime * 0.7 + i) * 0.07, phase * 0.62, Math.cos(clock.elapsedTime * 0.5 + i) * 0.04)
      mesh.scale.setScalar(0.055 + phase * 0.13)
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.34
    })
  })
  return <group position={position}>
    <mesh ref={puffOne}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#77736f" transparent opacity={0.3} depthWrite={false} /></mesh>
    <mesh ref={puffTwo}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#77736f" transparent opacity={0.3} depthWrite={false} /></mesh>
    <mesh ref={puffThree}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#77736f" transparent opacity={0.3} depthWrite={false} /></mesh>
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

export interface CityProfile { cityName: string; mayorName: string; createdAt: string }
interface TitleScreenProps { onStart: (mode: 'new' | 'continue' | 'sandbox', profile?: CityProfile) => void; onResetProgress: () => void }

const CITY_NAMES: Record<Language, string[]> = {
  ru: ['Осенний Дол', 'Медовый Холм', 'Тихий Плёс', 'Дубовая Роща'],
  en: ['Amber Falls', 'Oak Hollow', 'Autumn Vale', 'Willowbrook'],
  de: ['Herbsttal', 'Eichenhain', 'Honighügel', 'Abendruh'],
  fr: ['Val d’Automne', 'Bois de Chêne', 'Colline Dorée', 'Rivière Paisible'],
}
const PROFILE_KEY = 'inkville-city-profile'

function readCityProfile(): CityProfile | undefined {
  try {
    const value = localStorage.getItem(PROFILE_KEY)
    if (!value) return undefined
    const profile = JSON.parse(value) as CityProfile
    return typeof profile.cityName === 'string' ? profile : undefined
  } catch { return undefined }
}

export function TitleScreen({ onStart, onResetProgress }: TitleScreenProps) {
  const { t, language, setLanguage } = useI18n()
  const [ready, setReady] = useState(false)
  const [assetsReady, setAssetsReady] = useState(false)
  const [progressComplete, setProgressComplete] = useState(false)
  const [showProgress, setShowProgress] = useState(true)
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [hasSave, setHasSave] = useState(() => {
    try { return Boolean(localStorage.getItem('inkville-save-v2')) } catch { return false }
  })
  const [showNaming, setShowNaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cityName, setCityName] = useState('')
  const [mayorName, setMayorName] = useState(() => t('title.mayorPlaceholder'))
  const [activeAction, setActiveAction] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('inkville-sound-enabled') !== 'false' } catch { return true }
  })
  useEffect(() => {
    if (assetsReady) return undefined
    const started = performance.now()
    const timer = window.setInterval(() => {
      const next = Math.min(95, ((performance.now() - started) / 1900) * 95)
      setProgress(next)
    }, 40)
    return () => window.clearInterval(timer)
  }, [assetsReady])
  useEffect(() => {
    if (!assetsReady) return undefined
    const finishFill = window.setTimeout(() => {
      setProgressComplete(true)
      setReady(true)
    }, 500)
    const removeBar = window.setTimeout(() => setShowProgress(false), 1000)
    return () => { window.clearTimeout(finishFill); window.clearTimeout(removeBar) }
  }, [assetsReady])
  const markAssetsReady = useCallback(() => {
    setProgress(100)
    setAssetsReady(true)
  }, [])
  const begin = (mode: 'new' | 'continue' | 'sandbox', profile?: CityProfile) => {
    if (!ready || leaving) return
    setLeaving(true)
    window.setTimeout(() => onStart(mode, profile), 650)
  }
  const createCity = () => {
    const profile = { cityName: cityName.trim(), mayorName: mayorName.trim() || t('title.mayorPlaceholder'), createdAt: new Date().toISOString() }
    if (!profile.cityName) return
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) } catch { /* City profile is optional when storage is unavailable. */ }
    setShowNaming(false)
    begin('new', profile)
  }
  const toggleSound = (value: boolean) => {
    setSoundEnabled(value)
    try { localStorage.setItem('inkville-sound-enabled', String(value)) } catch { /* Storage may be disabled. */ }
    document.documentElement.dataset.soundEnabled = String(value)
  }
  const resetProgress = () => {
    try { localStorage.removeItem('inkville-save-v2'); localStorage.removeItem(PROFILE_KEY) } catch { /* Storage may be disabled. */ }
    onResetProgress()
    setHasSave(false)
    setShowSettings(false)
  }
  const actionKeys = ['title.newCity', 'title.continue', 'title.sandbox', 'title.settings']
  const actionIndex = (key: string) => actionKeys.indexOf(key)
  return (
    <div className={`absolute inset-0 z-40 overflow-hidden bg-[#EAE2D2] transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10, 15, 18], fov: 38 }} gl={{ antialias: true }}>
        <ShowcaseCity />
        <ShowcaseSceneReady onReady={markAssetsReady} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_22%,rgba(23,28,34,0.44)_100%)]" />
      <section className="fixed left-12 top-1/2 z-40 w-[calc(100vw-64px)] max-w-[340px] -translate-y-1/2 rounded-3xl border-double border-2 border-[#2C241D] bg-[#F4EEDD]/95 p-6 text-[#2c241d] shadow-[8px_8px_0px_#2C241D] md:w-[380px] md:max-w-none">
        <div className="mb-4 flex items-start justify-between gap-2">
          <span className="inline-flex max-w-[220px] rounded-full border border-[#2C241D]/30 bg-[#fffaf0]/70 px-3 py-1 text-[9px] font-black uppercase tracking-[.13em] text-[#66513b]">{t('title.handInk')}</span>
          <select aria-label={t('language.label')} value={language} onChange={event => setLanguage(event.target.value as Language)} className="h-8 shrink-0 rounded-lg border border-[#2C241D]/40 bg-[#fffaf0] px-1.5 text-[10px] font-bold">
            <option value="ru">🇷🇺 RU</option><option value="en">🇬🇧 EN</option><option value="de">🇩🇪 DE</option><option value="fr">🇫🇷 FR</option>
          </select>
        </div>
        <h1 className="font-serif text-6xl font-black italic leading-none tracking-[-.07em]">Inkville</h1>
        <p className="mt-2 text-xs font-semibold tracking-[.08em] text-[#6b6255]">{t('title.tagline')}</p>
        {showProgress && <div className={`mt-5 h-2 origin-center overflow-hidden rounded-full border border-[#332f28]/60 bg-[#d8d0c0] transition-all duration-500 ease-out ${progressComplete ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
          <div className="h-full bg-[repeating-linear-gradient(135deg,#a6653d_0px,#a6653d_4px,#d59c61_4px,#d59c61_7px)] transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>}
        {!ready ? <p className="mt-2 h-5 text-xs font-semibold text-[#746958]">{t(`title.loading${Math.min(3, Math.floor(progress / 34) + 1)}`)}</p> : <div className="relative mt-4 grid gap-2 pl-7">
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 text-2xl transition-transform duration-200" style={{ transform: `translateY(${activeAction * 56}px) rotate(-42deg)` }}>✏️</span>
          <button onPointerEnter={() => setActiveAction(actionIndex('title.newCity'))} onFocus={() => setActiveAction(actionIndex('title.newCity'))} onClick={() => setShowNaming(true)} className="h-12 rounded-xl border-2 border-[#292720] bg-[#d6a15f] px-4 text-left text-sm font-black shadow-[3px_3px_0_#292720] transition hover:-translate-y-0.5 hover:bg-[#e0b273]">{t('title.newCity')}</button>
          <button disabled={!hasSave} onPointerEnter={() => setActiveAction(actionIndex('title.continue'))} onFocus={() => setActiveAction(actionIndex('title.continue'))} onClick={() => begin('continue', readCityProfile())} className="h-12 rounded-xl border-2 border-[#292720]/70 bg-[#f7f3eb] px-4 text-left text-sm font-bold enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-45">{t('title.continue')}</button>
          <button onPointerEnter={() => setActiveAction(actionIndex('title.sandbox'))} onFocus={() => setActiveAction(actionIndex('title.sandbox'))} onClick={() => begin('sandbox', readCityProfile() ?? { cityName: CITY_NAMES[language][0], mayorName: t('title.mayorPlaceholder'), createdAt: new Date().toISOString() })} className="h-12 rounded-xl border border-[#292720]/35 bg-white/35 px-4 text-left text-sm font-semibold transition hover:bg-white/65">{t('title.sandbox')}</button>
          <button onPointerEnter={() => setActiveAction(actionIndex('title.settings'))} onFocus={() => setActiveAction(actionIndex('title.settings'))} onClick={() => setShowSettings(true)} className="h-12 rounded-xl border border-[#292720]/35 bg-transparent px-4 text-left text-sm font-semibold transition hover:bg-white/45">{t('title.settings')}</button>
        </div>}
        <p className="mt-5 text-center text-[9px] font-semibold uppercase tracking-[.16em] text-[#8b806e]">{t('title.footer')}</p>
      </section>

      {showNaming && <div className="fixed inset-0 z-50 grid place-items-center bg-[#201a15]/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowNaming(false) }}>
        <form onSubmit={event => { event.preventDefault(); createCity() }} className="w-full max-w-md rounded-3xl border-2 border-[#2C241D] bg-[#F4EEDD] p-6 text-[#2c241d] shadow-[7px_7px_0px_#2C241D] sm:p-8">
          <h2 className="font-serif text-2xl font-black">{t('title.cityModal')}</h2>
          <label className="mt-5 block text-xs font-bold">{t('title.cityName')}
            <input autoFocus required maxLength={40} value={cityName} onChange={event => setCityName(event.target.value)} placeholder={t('title.cityPlaceholder')} className="mt-1.5 h-11 w-full rounded-xl border border-[#655340]/45 bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#9b6237]" />
          </label>
          <label className="mt-4 block text-xs font-bold">{t('title.mayorName')}
            <input maxLength={32} value={mayorName} onChange={event => setMayorName(event.target.value)} placeholder={t('title.mayorPlaceholder')} className="mt-1.5 h-11 w-full rounded-xl border border-[#655340]/45 bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#9b6237]" />
          </label>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => { const names = CITY_NAMES[language]; setCityName(names[Math.floor(Math.random() * names.length)]) }} className="rounded-lg border border-[#655340]/35 bg-white/50 px-3 py-2 text-xs font-bold">{t('title.randomName')}</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNaming(false)} className="rounded-lg border border-[#655340]/35 px-3 py-2 text-xs font-bold">{t('title.cancel')}</button>
              <button type="submit" className="rounded-lg border-2 border-[#292720] bg-[#d6a15f] px-4 py-2 text-xs font-black shadow-[2px_2px_0_#292720]">{t('title.startBuilding')}</button>
            </div>
          </div>
        </form>
      </div>}

      {showSettings && <div className="fixed inset-0 z-50 grid place-items-center bg-[#201a15]/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowSettings(false) }}>
        <div className="w-full max-w-sm rounded-3xl border-2 border-[#2C241D] bg-[#F4EEDD] p-6 text-[#2c241d] shadow-[7px_7px_0px_#2C241D]">
          <h2 className="font-serif text-2xl font-black">{t('title.settings')}</h2>
          <label className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold"><span>{t('title.sound')}<small className="mt-1 block text-[10px] font-normal text-stone-600">{t('title.soundNote')}</small></span><input type="checkbox" checked={soundEnabled} onChange={event => toggleSound(event.target.checked)} className="size-5 accent-[#a6653d]" /></label>
          <button onClick={() => { if (window.confirm(t('title.resetConfirm'))) resetProgress() }} className="mt-6 w-full rounded-xl border border-rose-800/40 bg-rose-50 px-4 py-3 text-left text-sm font-bold text-rose-800">{t('title.resetProgress')}</button>
          <button onClick={() => setShowSettings(false)} className="mt-3 w-full rounded-xl border border-[#655340]/35 px-4 py-2.5 text-sm font-bold">{t('title.cancel')}</button>
        </div>
      </div>}
    </div>
  )
}
