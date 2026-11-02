import * as THREE from 'three'
import { Box, Cone, Cylinder, getFacadeMaterial, getToonMaterial, type Vec3 } from './primitives'
import { currentSeason } from '../../lib/season'

/* Современный стиль (ранги «Город» и выше): фасады с сеткой окон, детали на крышах, озеленённые площади. */

const sphere = new THREE.SphereGeometry(1, 10, 8)
const blobOutline = new THREE.MeshBasicMaterial({ color: '#1b1a17', side: THREE.BackSide })

/** Дерево-«облачко» в стиле иллюстрации: несколько шаров с чернильной обводкой. */
export function BlobTree({ position, scale = 1, color = '#5f9a4a' }: { position: Vec3; scale?: number; color?: string }) {
  const crowns: Array<[number, number, number, number]> = [[0, 0.34, 0, 0.17], [0.09, 0.42, 0.04, 0.12], [-0.08, 0.4, -0.05, 0.11]]
  return <group position={position} scale={scale}>
    <Cylinder radius={0.025} radiusTop={0.018} height={0.26} segments={6} position={[0, 0.13, 0]} color="#5a4030" outline={false} />
    {crowns.map(([x, y, z, r], index) => <group key={index} position={[x, y, z]} scale={r}>
      <mesh geometry={sphere} material={getToonMaterial(index === 0 ? color : shade(color, index))} castShadow receiveShadow />
      <mesh geometry={sphere} material={blobOutline} scale={1.09} />
    </group>)}
  </group>
}

function shade(color: string, index: number) {
  const value = new THREE.Color(color)
  value.offsetHSL(0, 0, index === 1 ? 0.06 : -0.04)
  return `#${value.getHexString()}`
}

/** Детали крыши: кондиционеры, вентиляция, солнечные панели. */
function RoofKit({ width, depth, y, solar = true }: { width: number; depth: number; y: number; solar?: boolean }) {
  return <group position={[0, y, 0]}>
    <Box size={[width * 0.28, 0.12, depth * 0.22]} position={[-width * 0.22, 0.06, -depth * 0.2]} color="#c9cdd0" />
    <Box size={[width * 0.16, 0.08, depth * 0.16]} position={[width * 0.25, 0.04, -depth * 0.25]} color="#b5babe" />
    <Cylinder radius={Math.min(width, depth) * 0.05} height={0.1} segments={10} position={[width * 0.28, 0.05, depth * 0.05]} color="#9aa1a6" />
    {solar && [-1, 0, 1].map((i) => <Box key={i} size={[width * 0.2, 0.025, depth * 0.24]} position={[i * width * 0.22, 0.05, depth * 0.24]} rotation={[-0.25, 0, 0]} color="#2f4a72" />)}
  </group>
}

/** Площадь у здания: плитка, газон и деревья по углам. */
function Plaza({ w, d }: { w: number; d: number }) {
  return <group>
    <Box size={[w - 0.02, 0.06, d - 0.02]} position={[0, 0.03, 0]} color="#c8c6bf" />
    <Box size={[w * 0.32, 0.03, d * 0.18]} position={[-w * 0.3, 0.075, d * 0.36]} color="#7fae5a" outline={false} />
    <Box size={[w * 0.32, 0.03, d * 0.18]} position={[w * 0.3, 0.075, d * 0.36]} color="#7fae5a" outline={false} />
    <BlobTree position={[-w * 0.38, 0.06, d * 0.38]} scale={w * 0.55} />
    <BlobTree position={[w * 0.38, 0.06, d * 0.38]} scale={w * 0.5} color="#6aa84f" />
  </group>
}

/** Современный жилой дом 1×1: светлый фасад, акцентные балконы, техника на крыше. */
export function ModernBlockMesh() {
  const facade = getFacadeMaterial({ wall: '#ece8e1', glass: '#5d8aa3', spacing: [0.17, 0.27], frame: [0.18, 0.22] })
  const height = 1.9
  return <group>
    <Box size={[0.98, 0.06, 0.98]} position={[0, 0.03, 0]} color="#c8c6bf" />
    <Box size={[0.78, 0.32, 0.78]} position={[0, 0.22, 0]} color="#7d8487" />
    <Box size={[0.74, height, 0.74]} position={[0, 0.38 + height / 2, 0]} color="#ece8e1" material={facade} />
    {Array.from({ length: 6 }, (_, floor) => <Box key={floor} size={[0.5, 0.035, 0.08]} position={[0.08, 0.62 + floor * 0.27, 0.41]} color={floor % 2 ? '#c2593a' : '#e0a458'} />)}
    <Box size={[0.8, 0.06, 0.8]} position={[0, 0.38 + height + 0.03, 0]} color="#5b6266" />
    <RoofKit width={0.74} depth={0.74} y={0.38 + height + 0.06} />
    <BlobTree position={[-0.38, 0.06, 0.38]} scale={0.6} />
  </group>
}

/** Офисная башня 2×2: подиум с витринами и башня со стеклянным фасадом. */
export function OfficeTowerMesh() {
  const podium = getFacadeMaterial({ wall: '#8a9196', glass: '#bfe3ef', spacing: [0.32, 0.38], frame: [0.06, 0.12] })
  const tower = getFacadeMaterial({ wall: '#3c5566', glass: '#4f8fb3', spacing: [0.16, 0.24], curtain: true })
  const towerHeight = 5.2
  return <group>
    <Plaza w={2} d={2} />
    <Box size={[1.7, 0.8, 1.5]} position={[0, 0.46, -0.15]} color="#8a9196" material={podium} />
    <Box size={[1.76, 0.06, 1.56]} position={[0, 0.89, -0.15]} color="#e9eaea" />
    <Box size={[1.12, towerHeight, 1.12]} position={[0.1, 0.92 + towerHeight / 2, -0.2]} color="#3c5566" material={tower} />
    {[-0.46, 0.66].map((x) => <Box key={x} size={[0.05, towerHeight, 0.05]} position={[x, 0.92 + towerHeight / 2, 0.37]} color="#e9eaea" />)}
    <Box size={[1.2, 0.18, 1.2]} position={[0.1, 0.92 + towerHeight + 0.09, -0.2]} color="#e9eaea" />
    <RoofKit width={1.1} depth={1.1} y={0.92 + towerHeight + 0.18} solar={false} />
    <Box size={[0.9, 0.04, 0.26]} position={[0, 0.62, 0.66]} color="#e9eaea" />
  </group>
}

/** Стеклянный небоскрёб 2×2: три ступени, вертикальные рёбра и шпиль. */
export function GlassSkyscraperMesh() {
  const glass = getFacadeMaterial({ wall: '#2f5d6b', glass: '#5fb3c9', spacing: [0.14, 0.22], curtain: true })
  const glassHigh = getFacadeMaterial({ wall: '#2c4f63', glass: '#7cc4d8', spacing: [0.14, 0.22], curtain: true })
  const tiers: Array<{ size: [number, number]; height: number; material: THREE.Material }> = [
    { size: [1.4, 1.4], height: 4.2, material: glass },
    { size: [1.15, 1.15], height: 3.2, material: glassHigh },
    { size: [0.85, 0.85], height: 2.2, material: glass },
  ]
  let y = 0.06
  return <group>
    <Plaza w={2} d={2} />
    {tiers.map((tier, index) => {
      const base = y
      y += tier.height + 0.1
      return <group key={index}>
        <Box size={[tier.size[0], tier.height, tier.size[1]]} position={[0, base + tier.height / 2, 0]} color="#2f5d6b" material={tier.material} />
        <Box size={[tier.size[0] + 0.08, 0.1, tier.size[1] + 0.08]} position={[0, base + tier.height + 0.05, 0]} color="#e6eef0" />
        {[-1, 1].map((side) => <Box key={side} size={[0.04, tier.height, 0.04]} position={[side * tier.size[0] / 2, base + tier.height / 2, tier.size[1] / 2]} color="#e6eef0" />)}
      </group>
    })}
    <Cylinder radius={0.05} radiusTop={0.01} height={1.2} segments={8} position={[0, y + 0.6, 0]} color="#e6eef0" />
    <mesh position={[0, y + 1.22, 0]} scale={0.05}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ef4444" toneMapped={false} /></mesh>
  </group>
}

const SEASON = currentSeason()
/** Уличные «леденцы»: зелёные, зимой заснеженные, осенью часть желтеет. */
const STREET_TREE_COLORS = SEASON === 'winter' ? ['#e3eaee', '#d5dfe5'] : SEASON === 'autumn' ? ['#6c9a4c', '#7aa555', '#d9a03a'] : SEASON === 'spring' ? ['#8cc56a', '#f3b6cf'] : ['#5f9446', '#6fa553']
const facetSphere = new THREE.IcosahedronGeometry(1, 1)
let streetTreeIndex = 0

/** Дерево вдоль тротуара: тонкий ствол и круглая крона с обводкой. */
export function StreetTree({ position }: { position: Vec3 }) {
  const color = STREET_TREE_COLORS[(streetTreeIndex++) % STREET_TREE_COLORS.length]
  return <group position={position}>
    <Cylinder radius={0.012} height={0.3} segments={5} position={[0, 0.15, 0]} color="#4a3628" outline={false} />
    <group position={[0, 0.36, 0]} scale={0.1}>
      <mesh geometry={facetSphere} material={getToonMaterial(color)} castShadow />
      <mesh geometry={facetSphere} material={blobOutline} scale={1.12} />
    </group>
  </group>
}

/** Кирпичный лофт 1×1: пожарная лестница, бак для воды и пергола на крыше. */
export function BrickLoftMesh() {
  const brick = getFacadeMaterial({ wall: '#a8462f', glass: '#3e5266', ink: '#f1ece2', spacing: [0.16, 0.26], frame: [0.22, 0.2] })
  const height = 1.55
  const top = 0.06 + height
  return <group>
    <Box size={[0.98, 0.06, 0.98]} position={[0, 0.03, 0]} color="#c8c6bf" />
    <Box size={[0.8, height, 0.8]} position={[0, 0.06 + height / 2, 0]} color="#a8462f" material={brick} />
    <Box size={[0.84, 0.08, 0.84]} position={[0, top + 0.04, 0]} color="#7d3424" />
    <Box size={[0.76, 0.02, 0.76]} position={[0, top + 0.09, 0]} color="#5b5f61" outline={false} />
    <Box size={[0.82, 0.12, 0.82]} position={[0, 0.12, 0]} color="#5d2b20" />
    {/* Пожарная лестница по фасаду */}
    {Array.from({ length: 5 }, (_, floor) => <group key={floor} position={[0.18, 0.36 + floor * 0.28, 0.43]}>
      <Box size={[0.3, 0.015, 0.08]} position={[0, 0, 0]} color="#222" outline={false} />
      <Box size={[0.3, 0.06, 0.006]} position={[0, 0.04, 0.04]} color="#222" outline={false} />
      <Box size={[0.012, 0.3, 0.012]} position={[floor % 2 ? -0.1 : 0.1, 0.13, 0.02]} rotation={[0, 0, floor % 2 ? 0.6 : -0.6]} color="#222" outline={false} />
    </group>)}
    {/* Деревянный бак для воды на опорах */}
    <group position={[-0.2, top + 0.1, -0.18]}>
      {[[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.015, 0.14, 0.015]} position={[x, 0.07, z]} color="#3b3b3b" outline={false} />)}
      <Cylinder radius={0.1} height={0.2} segments={10} position={[0, 0.24, 0]} color="#8a5a35" />
      <Cone radius={0.11} height={0.07} segments={10} position={[0, 0.375, 0]} color="#6b4428" />
    </group>
    <group position={[0.18, top + 0.1, 0.12]}>
      {[[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.015, 0.14, 0.015]} position={[x, 0.07, z]} color="#3e2c22" outline={false} />)}
      <Box size={[0.3, 0.02, 0.26]} position={[0, 0.15, 0]} color="#5a3e2c" />
    </group>
    <Box size={[0.14, 0.08, 0.1]} position={[0.25, top + 0.14, -0.25]} color="#c9cdd0" />
  </group>
}
