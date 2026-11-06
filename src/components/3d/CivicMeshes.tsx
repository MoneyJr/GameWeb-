import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box, Cone, Cylinder, getFacadeMaterial, getFlagstoneMaterial, getToonMaterial, type Vec3 } from './primitives'
import { createParkedVehicle } from './Vehicles'
import { StreetTree } from './ModernMeshes'

/* Городская среда в стиле CityRT: парковки, площади, кампус, светофоры. */

/** Вальмовая крыша над прямоугольником w×d (четырёхгранная пирамида, растянутая по осям). */
function HipRoof({ width, depth, height, position, color = '#9aa0a5' }: { width: number; depth: number; height: number; position: Vec3; color?: string }) {
  return <group position={position} scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]}>
    <group rotation={[0, Math.PI / 4, 0]}><Cone radius={1} height={height} segments={4} position={[0, height / 2, 0]} color={color} /></group>
  </group>
}

function Bench({ position, rotation = 0 }: { position: Vec3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box size={[0.2, 0.025, 0.06]} position={[0, 0.07, 0]} color="#7a5a3c" outline={false} />
    <Box size={[0.2, 0.06, 0.015]} position={[0, 0.1, -0.03]} color="#7a5a3c" outline={false} />
    {[-0.08, 0.08].map((x) => <Box key={x} size={[0.015, 0.07, 0.05]} position={[x, 0.035, 0]} color="#2f2f2f" outline={false} />)}
  </group>
}

function Lamp({ position }: { position: Vec3 }) {
  return <group position={position}>
    <Cylinder radius={0.012} height={0.42} segments={6} position={[0, 0.21, 0]} color="#2c2c2c" outline={false} />
    <Box size={[0.05, 0.04, 0.05]} position={[0, 0.43, 0]} color="#fef3c7" outline={false} />
  </group>
}

/**
 * Парковка 2×1 в стиле CityRT: асфальт, белая разметка рядов и разноцветные припаркованные авто.
 * Слоты 2 и 5 оставлены свободными — из них реально выезжают в город и паркуются обратно автомобили TrafficSystem.
 */
export function ParkingLotMesh({ variant = 0 }: { variant?: number }) {
  const parkedCars = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((slot) => ({
        slot,
        // Слоты 2 и 5 свободны для выезда/заезда реального городского трафика (TrafficSystem)
        show: slot !== 2 && slot !== 5 && ((slot + variant) % 5 !== 4),
        // Шаг 3 взаимно прост с 10 — задействованы все 10 цветов автомобилей
        model: createParkedVehicle((slot + variant * 2) * 3 + 1),
      })),
    [variant],
  )

  return (
    <group>
      {/* Асфальтовое покрытие и аккуратные угловые островки-бордюры (свободные выезды на дорогу со всех сторон) */}
      <Box size={[1.98, 0.05, 0.98]} position={[0, 0.025, 0]} color="#3f3d3b" />
      <Box size={[0.24, 0.058, 0.07]} position={[-0.86, 0.029, -0.455]} color="#d8d5cb" />
      <Box size={[0.24, 0.058, 0.07]} position={[0.86, 0.029, -0.455]} color="#d8d5cb" />
      <Box size={[0.24, 0.058, 0.07]} position={[-0.86, 0.029, 0.455]} color="#d8d5cb" />
      <Box size={[0.24, 0.058, 0.07]} position={[0.86, 0.029, 0.455]} color="#d8d5cb" />

      {/* Белая разметка парковочных карманов как на референсе CityRT */}
      <Box size={[1.56, 0.006, 0.018]} position={[0, 0.054, -0.38]} color="#f4f1ea" outline={false} castShadow={false} />
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={i}
          size={[0.018, 0.006, 0.34]}
          position={[-0.77 + i * 0.22, 0.054, -0.21]}
          color="#f4f1ea"
          outline={false}
          castShadow={false}
        />
      ))}
      {/* Пунктирная осевая линия проезда к улице */}
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <Box key={x} size={[0.16, 0.006, 0.016]} position={[x, 0.054, 0.2]} color="#f4f1ea" outline={false} castShadow={false} />
      ))}

      {/* Разноцветные припаркованные машины */}
      {parkedCars
        .filter((car) => car.show)
        .map(({ slot, model }) => (
          <group
            key={slot}
            position={[-0.66 + slot * 0.22, 0.05, -0.22]}
            rotation={[0, (slot + variant) % 2 ? 0 : Math.PI, 0]}
            scale={0.48}
          >
            <primitive object={model} />
          </group>
        ))}

      {/* Зелёные островки с деревьями и освещением по углам */}
      {[-0.88, 0.88].map((x) => (
        <StreetTree key={x} position={[x, 0.05, -0.43]} />
      ))}
      <Lamp position={[-0.86, 0.05, 0.43]} />
      <Lamp position={[0.86, 0.05, 0.43]} />
    </group>
  )
}

/** Площадь 1×1 с брусчаткой, скамейками и деревьями в кадках. */
export function PlazaMesh() {
  return <group>
    <Box size={[0.98, 0.05, 0.98]} position={[0, 0.025, 0]} color="#b9a888" material={getFlagstoneMaterial('#c4b293', 6)} />
    <Cylinder radius={0.16} height={0.06} segments={14} position={[0, 0.08, 0]} color="#c9c3b6" />
    <Cylinder radius={0.12} height={0.02} segments={14} position={[0, 0.115, 0]} color="#6aa6b8" outline={false} />
    {[[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].map(([x, z]) => <group key={`${x}${z}`} position={[x, 0.05, z]}>
      <Box size={[0.13, 0.08, 0.13]} position={[0, 0.04, 0]} color="#8a7d6a" />
      <StreetTree position={[0, 0.06, 0]} />
    </group>)}
    <Bench position={[0, 0.05, -0.36]} />
    <Bench position={[0, 0.05, 0.36]} rotation={Math.PI} />
    <Lamp position={[0.38, 0.05, 0]} />
  </group>
}

/** Городская площадь 2×2: брусчатка, беседка, клумбы, фонари. */
export function TownSquareMesh() {
  return <group>
    <Box size={[1.98, 0.05, 1.98]} position={[0, 0.025, 0]} color="#b9a888" material={getFlagstoneMaterial('#bfae8e', 5)} />
    {[[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].map(([x, z]) => <group key={`${x}${z}`} position={[x, 0.05, z]}>
      <Box size={[0.5, 0.05, 0.5]} position={[0, 0.025, 0]} color="#7a9a52" />
      <StreetTree position={[0, 0.05, 0]} />
      <Bench position={[0, 0, x < 0 ? 0.32 : -0.32]} rotation={x < 0 ? Math.PI : 0} />
    </group>)}
    {/* Беседка */}
    <group position={[0, 0.05, 0]}>
      <Cylinder radius={0.32} height={0.06} segments={8} position={[0, 0.03, 0]} color="#e8e4da" />
      {Array.from({ length: 8 }, (_, i) => <Cylinder key={i} radius={0.018} height={0.34} segments={6} position={[Math.cos(i * Math.PI / 4) * 0.27, 0.23, Math.sin(i * Math.PI / 4) * 0.27]} color="#f4f1ea" outline={false} />)}
      <Cone radius={0.36} height={0.22} segments={8} position={[0, 0.51, 0]} color="#4f5a63" />
      <Cylinder radius={0.03} height={0.08} segments={6} position={[0, 0.66, 0]} color="#c9a24e" outline={false} />
    </group>
    {[[-0.95, 0], [0.95, 0], [0, -0.95], [0, 0.95]].map(([x, z]) => <Lamp key={`${x}${z}`} position={[x, 0.05, z]} />)}
  </group>
}

/** Университетский кампус 3×3: кирпич внизу, белый верх, серые вальмовые крыши, портик и часовая башня. */
export function UniversityMesh() {
  const brick = getFacadeMaterial({ wall: '#a4483a', glass: '#3e5266', ink: '#f1ece2', spacing: [0.16, 0.36], frame: [0.3, 0.24] })
  const plaster = getFacadeMaterial({ wall: '#ebe9e3', glass: '#4c5f70', spacing: [0.16, 0.36], frame: [0.3, 0.24] })
  const floor = 0.36
  const Hall = ({ position, width, depth }: { position: Vec3; width: number; depth: number }) => <group position={position}>
    <Box size={[width, floor, depth]} position={[0, floor / 2, 0]} color="#a4483a" material={brick} />
    <Box size={[width, floor, depth]} position={[0, floor * 1.5, 0]} color="#ebe9e3" material={plaster} />
    <Box size={[width + 0.06, 0.04, depth + 0.06]} position={[0, floor * 2 + 0.02, 0]} color="#f4f2ec" />
    <HipRoof width={width + 0.04} depth={depth + 0.04} height={0.36} position={[0, floor * 2 + 0.04, 0]} />
  </group>
  return <group>
    <Box size={[2.98, 0.05, 2.98]} position={[0, 0.025, 0]} color="#7d9a52" />
    {/* Главный корпус с портиком */}
    <Hall position={[0, 0.05, -1.0]} width={2.5} depth={0.8} />
    <group position={[0, 0.05, -0.55]}>
      {[-0.27, -0.09, 0.09, 0.27].map((x) => <Cylinder key={x} radius={0.035} height={0.66} segments={8} position={[x, 0.33, 0]} color="#f4f2ec" />)}
      <Box size={[0.7, 0.07, 0.16]} position={[0, 0.69, -0.02]} color="#f4f2ec" />
      <HipRoof width={0.7} depth={0.2} height={0.16} position={[0, 0.725, -0.02]} color="#ebe9e3" />
    </group>
    {/* Боковые корпуса */}
    <Hall position={[-1.1, 0.05, 0.25]} width={0.7} depth={1.5} />
    <Hall position={[1.1, 0.05, 0.25]} width={0.7} depth={1.5} />
    {/* Часовая башня */}
    <group position={[0.78, 0.05, 1.12]}>
      <Box size={[0.32, 1.5, 0.32]} position={[0, 0.75, 0]} color="#ebe9e3" material={plaster} />
      <Cylinder radius={0.1} height={0.02} segments={20} position={[0, 1.25, 0.165]} rotation={[Math.PI / 2, 0, 0]} color="#fbfaf6" />
      <Box size={[0.01, 0.07, 0.006]} position={[0, 1.27, 0.177]} color="#222" outline={false} />
      <Box size={[0.05, 0.01, 0.006]} position={[0.02, 1.25, 0.177]} color="#222" outline={false} />
      <Box size={[0.36, 0.05, 0.36]} position={[0, 1.52, 0]} color="#f4f2ec" />
      <Cone radius={0.2} height={0.4} segments={8} position={[0, 1.75, 0]} color="#5a6067" />
    </group>
    {/* Двор: газон, кирпичные дорожки, деревья */}
    <Box size={[1.3, 0.02, 1.3]} position={[0, 0.06, 0.35]} color="#86a35a" outline={false} />
    <Box size={[0.16, 0.025, 1.4]} position={[0, 0.07, 0.35]} color="#b0594a" outline={false} />
    <group position={[0, 0.07, 0.35]} rotation={[0, Math.PI / 4, 0]}><Box size={[0.1, 0.022, 1.7]} position={[0, 0, 0]} color="#b0594a" outline={false} /></group>
    <group position={[0, 0.07, 0.35]} rotation={[0, -Math.PI / 4, 0]}><Box size={[0.1, 0.022, 1.7]} position={[0, 0, 0]} color="#b0594a" outline={false} /></group>
    {[[-0.5, -0.1], [0.5, -0.1], [-0.5, 0.8], [0.5, 0.8], [-0.25, 0.35], [0.25, 0.35]].map(([x, z]) => <StreetTree key={`${x}${z}`} position={[x, 0.07, z]} />)}
    {/* Ограда с кирпичными столбами вдоль улицы */}
    <Box size={[2.9, 0.06, 0.02]} position={[0, 0.1, 1.45]} color="#2a2a2a" outline={false} />
    {[-1.4, -0.7, 0.2, 1.4].map((x) => <Box key={x} size={[0.07, 0.16, 0.07]} position={[x, 0.13, 1.45]} color="#9a4535" />)}
  </group>
}

const signalOff = getToonMaterial('#2b2b2b')
const signalColors = { red: new THREE.MeshBasicMaterial({ color: '#ef4444', toneMapped: false }), yellow: new THREE.MeshBasicMaterial({ color: '#facc15', toneMapped: false }), green: new THREE.MeshBasicMaterial({ color: '#4ade80', toneMapped: false }) }
const bulbGeometry = new THREE.SphereGeometry(0.014, 6, 4)

/** Светофор на углу перекрёстка; две пары работают в противофазе. */
export function TrafficLight({ position, rotation = 0, phase = 0 }: { position: Vec3; rotation?: number; phase?: number }) {
  const bulbs = useMemo(() => [0, 1, 2].map(() => new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(bulbGeometry, signalOff)), [])
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + phase * 5) % 10
    const state = t < 4 ? 2 : t < 5 ? 1 : 0
    bulbs.forEach((bulb, index) => { bulb.material = index === state ? [signalColors.red, signalColors.yellow, signalColors.green][index] : signalOff })
  })
  return <group position={position} rotation={[0, rotation, 0]}>
    <Cylinder radius={0.01} height={0.48} segments={6} position={[0, 0.24, 0]} color="#2a2a2a" outline={false} />
    <Box size={[0.012, 0.012, 0.18]} position={[0, 0.46, 0.09]} color="#2a2a2a" outline={false} />
    <Box size={[0.05, 0.13, 0.04]} position={[0, 0.4, 0.17]} color="#3a3a3a" />
    {bulbs.map((bulb, index) => <primitive key={index} object={bulb} position={[0, 0.44 - index * 0.04, 0.192]} />)}
  </group>
}
