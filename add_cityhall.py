import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

city_hall = """
export function CityHallMesh({ onClick }: { onClick?: () => void }) {
  // 2x2 building, center is at [0.5, 0, 0.5]
  return (
    <group position={[0.5, 0, 0.5]} onClick={onClick}>
      <Pad />
      <group position={[0, PAD_HEIGHT, 0]}>
        {/* Main body */}
        <Box size={[1.6, 0.6, 1.6]} position={[0, 0.3, 0]} color="#f0efe9" />
        
        {/* Portico base */}
        <Box size={[1.8, 0.1, 1.8]} position={[0, 0.05, 0]} color="#e0ded5" />
        
        {/* Columns */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <Cylinder key={i} args={[0.08, 0.08, 0.8, 8]} position={[x, 0.4, 0.8]} color="#ffffff" />
        ))}
        
        {/* Pediment (Triangular roof over portico) */}
        <Cone args={[0.9, 0.4, 4]} position={[0, 1.0, 0.6]} rotation={[0, Math.PI / 4, 0]} color="#8b7355" />
        
        {/* Main roof */}
        <Box size={[1.6, 0.2, 1.6]} position={[0, 0.7, 0]} color="#8b7355" />
        
        {/* Clock Tower */}
        <Box size={[0.5, 1.2, 0.5]} position={[0, 1.2, 0]} color="#f0efe9" />
        <Box size={[0.55, 0.1, 0.55]} position={[0, 1.8, 0]} color="#8b7355" />
        <Cone args={[0.3, 0.6, 4]} position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]} color="#8b7355" />
        
        {/* Clock Face */}
        <Cylinder args={[0.15, 0.15, 0.05, 16]} position={[0, 1.5, 0.26]} rotation={[Math.PI / 2, 0, 0]} color="#ffffff" />
        <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, 1.5, 0.27]} color="#000000" /> {/* hand */}
        
        {/* Flagpole */}
        <Cylinder args={[0.01, 0.01, 0.5, 4]} position={[0, 2.65, 0]} color="#a0a0a0" />
        <Box size={[0.15, 0.1, 0.01]} position={[0.08, 2.8, 0]} color="#ef4444" />
      </group>
    </group>
  )
}
"""

meshes = meshes.replace('export function Pad()', city_hall + '\nexport function Pad()')

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes)
