import re

city_hall_and_parks = """
export function SquareMesh() {
  return (
    <group>
      <Box size={[0.9, PAD_HEIGHT, 0.9]} position={[0, PAD_HEIGHT / 2, 0]} color="#a3e635" />
      <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, PAD_HEIGHT+0.05, 0]} color="#78350f" />
      <Cone args={[0.15, 0.3, 5]} position={[0, PAD_HEIGHT+0.25, 0]} color="#4ade80" />
    </group>
  )
}

export function ParkMesh() {
  return (
    <group position={[0.5, 0, 0.5]} scale={2}>
      <Box size={[0.9, PAD_HEIGHT, 0.9]} position={[0, PAD_HEIGHT / 2, 0]} color="#a3e635" />
      {[[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]].map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, PAD_HEIGHT+0.05, 0]} color="#78350f" />
          <Cone args={[0.15, 0.3, 5]} position={[0, PAD_HEIGHT+0.25, 0]} color="#4ade80" />
        </group>
      ))}
    </group>
  )
}

export function LargeParkMesh() {
  return (
    <group position={[1, 0, 1]} scale={3}>
      <Box size={[0.9, PAD_HEIGHT, 0.9]} position={[0, PAD_HEIGHT / 2, 0]} color="#a3e635" />
      <Cylinder args={[0.15, 0.15, 0.05, 16]} position={[0, PAD_HEIGHT+0.025, 0]} color="#d4d4d8" />
      <Cylinder args={[0.1, 0.1, 0.02, 16]} position={[0, PAD_HEIGHT+0.06, 0]} color="#60a5fa" />
      <Cylinder args={[0.02, 0.02, 0.1, 8]} position={[0, PAD_HEIGHT+0.1, 0]} color="#d4d4d8" />
      {[[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3], [-0.3,-0.3], [0.3,0.3]].map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, PAD_HEIGHT+0.05, 0]} color="#78350f" />
          <Cone args={[0.15, 0.3, 5]} position={[0, PAD_HEIGHT+0.25, 0]} color="#4ade80" />
        </group>
      ))}
    </group>
  )
}

export function CityHallMesh({ onClick }: { onClick?: () => void }) {
  return (
    <group position={[0.5, 0, 0.5]} onClick={onClick}>
      <Pad />
      <group position={[0, PAD_HEIGHT, 0]}>
        <Box size={[1.6, 0.6, 1.6]} position={[0, 0.3, 0]} color="#f0efe9" />
        <Box size={[1.8, 0.1, 1.8]} position={[0, 0.05, 0]} color="#e0ded5" />
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <Cylinder key={i} args={[0.08, 0.08, 0.8, 8]} position={[x, 0.4, 0.8]} color="#ffffff" />
        ))}
        <Cone args={[0.9, 0.4, 4]} position={[0, 1.0, 0.6]} rotation={[0, Math.PI / 4, 0]} color="#8b7355" />
        <Box size={[1.6, 0.2, 1.6]} position={[0, 0.7, 0]} color="#8b7355" />
        <Box size={[0.5, 1.2, 0.5]} position={[0, 1.2, 0]} color="#f0efe9" />
        <Box size={[0.55, 0.1, 0.55]} position={[0, 1.8, 0]} color="#8b7355" />
        <Cone args={[0.3, 0.6, 4]} position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]} color="#8b7355" />
        <Cylinder args={[0.15, 0.15, 0.05, 16]} position={[0, 1.5, 0.26]} rotation={[Math.PI / 2, 0, 0]} color="#ffffff" />
        <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, 1.5, 0.27]} color="#000000" />
        <Cylinder args={[0.01, 0.01, 0.5, 4]} position={[0, 2.65, 0]} color="#a0a0a0" />
        <Box size={[0.15, 0.1, 0.01]} position={[0.08, 2.8, 0]} color="#ef4444" />
      </group>
    </group>
  )
}
"""

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes + '\n' + city_hall_and_parks)
