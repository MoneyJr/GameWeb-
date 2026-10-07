import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'

const BADGE_SEGMENTS = 28

/**
 * Парящий маркер "нет воды": белый круглый значок с синей каплей, перечёркнутой красной линией.
 * Всегда повёрнут к камере (Billboard) и мягко покачивается.
 */
export function NoWaterMarker({ height = 1.05 }: { height?: number }) {
  const bob = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (bob.current !== null) {
      bob.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.04
      bob.current.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.06
    }
  })

  return (
    <Billboard position={[0, height, 0]}>
      <group ref={bob}>
        {/* чёрная обводка + белый значок */}
        <mesh renderOrder={20}>
          <circleGeometry args={[0.215, BADGE_SEGMENTS]} />
          <meshBasicMaterial color="#14110d" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.001]} renderOrder={21}>
          <circleGeometry args={[0.185, BADGE_SEGMENTS]} />
          <meshBasicMaterial color="#fffaf0" depthTest={false} />
        </mesh>

        {/* капля: шар + конус */}
        <mesh position={[0, -0.035, 0.002]} renderOrder={22}>
          <circleGeometry args={[0.07, 20]} />
          <meshBasicMaterial color="#3fa7e0" depthTest={false} />
        </mesh>
        <mesh position={[0, 0.06, 0.002]} renderOrder={22}>
          <coneGeometry args={[0.063, 0.14, 3]} />
          <meshBasicMaterial color="#3fa7e0" depthTest={false} />
        </mesh>

        {/* красная перечёркивающая линия с тёмной подложкой */}
        <mesh position={[0, 0, 0.003]} rotation={[0, 0, Math.PI / 4]} renderOrder={23}>
          <planeGeometry args={[0.4, 0.075]} />
          <meshBasicMaterial color="#14110d" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.004]} rotation={[0, 0, Math.PI / 4]} renderOrder={24}>
          <planeGeometry args={[0.38, 0.05]} />
          <meshBasicMaterial color="#e0412f" depthTest={false} />
        </mesh>
      </group>
    </Billboard>
  )
}

export function SupplyShortageMarker() {
  return <Billboard position={[0, 1.2, 0]}>
    <mesh><circleGeometry args={[0.2, 24]} /><meshBasicMaterial color="#8b352b" depthTest={false} /></mesh>
    <mesh position={[0, 0, 0.01]}><boxGeometry args={[0.19, 0.055, 0.02]} /><meshBasicMaterial color="#fff4dc" depthTest={false} /></mesh>
  </Billboard>
}
