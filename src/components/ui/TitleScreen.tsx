import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TileModel } from '../3d/BuildingMeshes'
import { TileType } from '../../types/city'

function ShowcaseCity() {
  const { city, parks } = useMemo(() => {
    const cells: { x: number; z: number; type: TileType }[] = []
    const roads = new Set<string>()
    for (let z = -20; z <= 7; z++) for (let x = -15; x <= 7; x++) {
      if (x === 0 || z === 0 || x === -15 || x === -10 || x === -5 || x === 5 || z === -20 || z === -15 || z === -10 || z === -5 || z === 5) roads.add(`${x},${z}`)
    }
    const hallFootprint = new Set(['-2,-2', '-1,-2', '-2,-1', '-1,-1'])
    // Two real 2x2 green spaces and a 3x3 piazza occupy deliberate blocks.
    const parkOrigins: [number, number][] = [[1, 1], [3, -8]]
    const parkCells = new Set(parkOrigins.flatMap(([x, z]) => Array.from({ length: 4 }, (_, i) => `${x + (i % 2)},${z + Math.floor(i / 2)}`)))
    const piazzaCells = new Set(Array.from({ length: 9 }, (_, i) => `${-3 + (i % 3)},${1 + Math.floor(i / 3)}`))
    const landmarks: Record<string, TileType> = { '-2,-2': TileType.CITY_HALL, '3,-3': TileType.WATER_PUMP }
    for (let z = -20; z <= 7; z++) for (let x = -15; x <= 7; x++) {
      const key = `${x},${z}`
      if (parkCells.has(key) || piazzaCells.has(key)) continue
      if (roads.has(key)) cells.push({ x, z, type: TileType.ROAD })
      else if (hallFootprint.has(key)) {
        if (key === '-2,-2') cells.push({ x, z, type: TileType.CITY_HALL })
      } else if (landmarks[key]) cells.push({ x, z, type: landmarks[key] })
      else cells.push({ x, z, type: ((x * 7 + z * 11) % 6 === 0) ? TileType.COMMERCIAL : TileType.RESIDENTIAL })
    }
    const roadKeys = new Set(cells.filter(cell => cell.type === TileType.ROAD).map(({ x, z }) => `${x},${z}`))
    return { parks: parkOrigins, city: cells.map((cell, i) => ({ ...cell, i,
      north: roadKeys.has(`${cell.x},${cell.z - 1}`), south: roadKeys.has(`${cell.x},${cell.z + 1}`),
      east: roadKeys.has(`${cell.x + 1},${cell.z}`), west: roadKeys.has(`${cell.x - 1},${cell.z}`),
    })) }
  }, [])
  const camera = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera: activeCamera, clock }) => {
    const t = clock.elapsedTime
    // A gentle lateral drift keeps the long roofline moving through the frame.
    camera.set(4.4 + Math.sin(t * 0.075) * 1.1, 10.8, 13.2 + Math.cos(t * 0.055) * 0.8)
    target.set(-2.5 + Math.sin(t * 0.075) * 0.55, 0.8, 0.1)
    activeCamera.position.lerp(camera, 0.018)
    activeCamera.lookAt(target)
  })
  return (
    <>
      <color attach="background" args={['#eae4d5']} />
      <fogExp2 attach="fog" args={['#eae4d5', 0.015]} />
      <ambientLight intensity={0.55} color="#fff6e8" />
      <directionalLight position={[20, 18, 14]} intensity={1.9} color="#fff2db" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={0.5} shadow-camera-far={90} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-bias={-0.0003} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#7a9954" roughness={1} />
      </mesh>
      {city.map(({ x, z, type, i, north, south, east, west }) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          {type === TileType.RESIDENTIAL || type === TileType.COMMERCIAL
            ? <ShowcaseBuilding styleIndex={type === TileType.COMMERCIAL ? 3 : Math.abs(x * 7 + z * 11) % 4} commercial={type === TileType.COMMERCIAL} variant={i % 3} />
            : <TileModel type={type} variant={i % 4} hasPower hasWater hasSupplies animate={false} north={north} south={south} east={east} west={west} />}
        </group>
      ))}
      {parks.map(([x, z], i) => <ShowcasePark key={`park-${i}`} position={[x, 0, z]} />)}
      <ShowcasePiazza />
      <Crosswalk position={[-0.6, 0.045, 1.15]} />
      <Crosswalk position={[1.15, 0.045, 0.6]} rotation={Math.PI / 2} />
      <ParkLights />
    </>
  )
}

function ShowcasePark({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const foliage = ['#43662d', '#587c3b', '#859b4c', '#587c3b']
  const leafMaterials = useMemo(() => foliage.map(color => {
    const material = new THREE.MeshToonMaterial({ color })
    ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    return material
  }), [])
  const accentMaterial = useMemo(() => {
    const material = new THREE.MeshToonMaterial({ color: '#859b4c' })
    ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    return material
  }, [])
  return <group position={position}>
    <mesh position={[1, 0.025, 1]} receiveShadow><boxGeometry args={[1.94, 0.05, 1.94]} /><meshStandardMaterial color="#6d8c46" roughness={0.98} /></mesh>
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
    <mesh position={[0, 0.11, 0]} receiveShadow castShadow><boxGeometry args={[0.96, 0.22, 0.96]} /><meshStandardMaterial color="#d4ccc0" roughness={0.95} /></mesh>
    <mesh position={[0, 0.22 + height / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.9, height, 0.9]} /><meshStandardMaterial color={style.wall} roughness={0.94} /></mesh>
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
        <mesh position={[-0.19, 0.24 + height + 0.23, 0]} rotation={[0, 0, -0.58]} castShadow><boxGeometry args={[0.56, 0.085, 1.02]} /><meshStandardMaterial color={style.roof} roughness={0.95} /></mesh>
        <mesh position={[0.19, 0.24 + height + 0.23, 0]} rotation={[0, 0, 0.58]} castShadow><boxGeometry args={[0.56, 0.085, 1.02]} /><meshStandardMaterial color={style.roof} roughness={0.95} /></mesh>
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
const loadingLabels = ['Затачиваем карандаши...', 'Укладываем брусчатку...', 'Заливаем чернила...']

export function TitleScreen({ onStart }: TitleScreenProps) {
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
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [4.4, 10.8, 13.2], fov: 42 }} gl={{ antialias: true }}>
        <ShowcaseCity />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_22%,rgba(23,28,34,0.44)_100%)]" />
      <div className="absolute inset-y-0 left-0 flex w-full max-w-[560px] items-center px-8 sm:px-14">
        <section className="w-full rounded-[28px] border border-white/60 bg-[#f7f2e7]/75 p-7 shadow-[0_24px_70px_rgba(34,34,30,.22)] backdrop-blur-sm sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#34312b]/25 bg-white/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[.23em] text-[#665a48]">A city drawn by hand</div>
          <h1 className="font-serif text-6xl font-black italic tracking-[-.07em] text-[#26251f] sm:text-7xl">Inkville</h1>
          <p className="mt-2 text-sm font-semibold tracking-[.16em] text-[#6b6255]">A Hand-Drawn City Builder</p>
          <div className="mt-8 h-2 overflow-hidden rounded-full border border-[#332f28]/60 bg-[#d8d0c0]">
            <div className="h-full bg-[repeating-linear-gradient(135deg,#a6653d_0px,#a6653d_4px,#d59c61_4px,#d59c61_7px)] transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          {!ready ? <p className="mt-3 h-5 text-xs font-semibold text-[#746958]">{loadingLabels[Math.min(2, Math.floor(progress / 34))]}</p> : (
            <div className="mt-6 grid gap-3">
              <button onClick={() => begin('new')} className="rounded-xl border-2 border-[#292720] bg-[#d6a15f] px-5 py-3 text-sm font-black text-[#28251e] shadow-[3px_3px_0_#292720] transition hover:-translate-y-0.5 hover:bg-[#e0b273]">Начать строительство / New City</button>
              {hasSave && <button onClick={() => begin('continue')} className="rounded-xl border-2 border-[#292720]/70 bg-[#f7f3eb] px-5 py-3 text-sm font-bold text-[#38342c]">Продолжить / Continue</button>}
              <button onClick={() => begin('sandbox')} className="rounded-xl border border-[#292720]/35 bg-white/35 px-5 py-2.5 text-sm font-semibold text-[#514b40] transition hover:bg-white/65">Песочница / Sandbox</button>
            </div>
          )}
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[.18em] text-[#8b806e]">Inkville · Since the first brick</p>
        </section>
      </div>
    </div>
  )
}
