import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box, Cone, Cylinder, getCurrentNightLevel, getGradientMap } from './primitives'

const BULB_COLORS = ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#f472b6']
const bulbMaterials = BULB_COLORS.map((color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }))
const bulbBase = BULB_COLORS.map((color) => new THREE.Color(color))
const starMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', toneMapped: false })
const bulbGeometry = new THREE.SphereGeometry(1, 8, 6)
/** Хвоя без снежного шейдера, чтобы ёлка оставалась зелёной. */
const needles = ['#2f6b45', '#357a4e', '#3d8a58'].map((color) => new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() }))

/** Гирлянды мерцают, а ночью светятся ярче. */
function useTwinkle() {
  useFrame(({ clock }) => {
    const night = getCurrentNightLevel()
    const t = clock.elapsedTime
    bulbMaterials.forEach((material, index) => {
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.2 + index * 1.7))
      material.color.copy(bulbBase[index]).multiplyScalar(0.55 + night * 0.9 * pulse + (1 - night) * 0.2)
    })
    starMaterial.color.setRGB(1, 0.88 + 0.12 * Math.sin(t * 3), 0.3 + night * 0.4)
  })
}

const ORNAMENTS: Array<[number, number, number]> = Array.from({ length: 18 }, (_, i) => {
  const layer = i % 3
  const y = 0.32 + layer * 0.26 + (i % 2) * 0.05
  const radius = 0.3 - layer * 0.08
  const angle = i * 2.4
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
})

/** Главная ёлка города: доступна только зимой. */
export function ChristmasTreeMesh() {
  useTwinkle()
  return <group>
    <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
    <Cylinder radius={0.4} height={0.05} segments={16} position={[0, 0.065, 0]} color="#eef2f5" />
    <Cylinder radius={0.06} height={0.2} segments={8} position={[0, 0.18, 0]} color="#6b4a2f" />
    <Cone radius={0.42} height={0.42} segments={10} position={[0, 0.45, 0]} color="#2f6b45" material={needles[0]} />
    <Cone radius={0.33} height={0.36} segments={10} position={[0, 0.7, 0]} color="#357a4e" material={needles[1]} />
    <Cone radius={0.23} height={0.3} segments={10} position={[0, 0.93, 0]} color="#3d8a58" material={needles[2]} />
    <mesh position={[0, 1.12, 0]} rotation={[0, 0, Math.PI / 4]} material={starMaterial}><octahedronGeometry args={[0.07, 0]} /></mesh>
    {ORNAMENTS.map(([x, y, z], i) => <mesh key={i} position={[x, y, z]} scale={0.032} geometry={bulbGeometry} material={bulbMaterials[i % bulbMaterials.length]} />)}
    {[[-0.3, 0.3], [0.32, 0.22], [0.12, -0.34]].map(([x, z], i) => <group key={`gift-${i}`} position={[x, 0.13, z]}>
      <Box size={[0.12, 0.1, 0.12]} position={[0, 0, 0]} color={['#dc2626', '#2563eb', '#ca8a04'][i]} />
      <Box size={[0.13, 0.025, 0.03]} position={[0, 0.04, 0]} color="#fef3c7" outline={false} />
    </group>)}
  </group>
}
