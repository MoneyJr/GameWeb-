import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

new_road = """function Road({ north, south, east, west }: RoadLinks) {
  const isIntersection = (north || south) && (east || west)
  const isStraightX = east || west || (!north && !south)
  const isStraightZ = north || south

  return (
    <group>
      {/* Asphalt */}
      <Box size={[1, 0.04, 1]} position={[0, 0.02, 0]} color="#7a7d84" />

      {/* Sidewalks (тротуары с бордюрами) */}
      {isStraightX && !isIntersection && (
        <group>
          <Box size={[1, 0.06, 0.2]} position={[0, 0.03, -0.4]} color="#d3d3d3" />
          <Box size={[1, 0.06, 0.2]} position={[0, 0.03, 0.4]} color="#d3d3d3" />
        </group>
      )}
      {isStraightZ && !isIntersection && (
        <group>
          <Box size={[0.2, 0.06, 1]} position={[-0.4, 0.03, 0]} color="#d3d3d3" />
          <Box size={[0.2, 0.06, 1]} position={[0.4, 0.03, 0]} color="#d3d3d3" />
        </group>
      )}
      {isIntersection && (
        <group>
          <Box size={[0.2, 0.06, 0.2]} position={[-0.4, 0.03, -0.4]} color="#d3d3d3" />
          <Box size={[0.2, 0.06, 0.2]} position={[0.4, 0.03, -0.4]} color="#d3d3d3" />
          <Box size={[0.2, 0.06, 0.2]} position={[-0.4, 0.03, 0.4]} color="#d3d3d3" />
          <Box size={[0.2, 0.06, 0.2]} position={[0.4, 0.03, 0.4]} color="#d3d3d3" />
        </group>
      )}

      {/* Road Markings */}
      {!isIntersection && isStraightX && (
        <Box size={[0.4, 0.01, 0.02]} position={[0, 0.045, 0]} color="#ffffff" outline={false} castShadow={false} />
      )}
      {!isIntersection && isStraightZ && (
        <Box size={[0.02, 0.01, 0.4]} position={[0, 0.045, 0]} color="#ffffff" outline={false} castShadow={false} />
      )}

      {/* Zebra Crossings at Intersections */}
      {isIntersection && (
        <group position={[0, 0.045, 0]}>
          {[-0.25, 0.25].map(x => (
            <group key={`zebra-x-${x}`} position={[x, 0, 0]}>
              {[-0.1, 0, 0.1].map(z => <Box key={z} size={[0.1, 0.01, 0.04]} position={[0, 0, z]} color="#ffffff" outline={false} castShadow={false} />)}
            </group>
          ))}
          {[-0.25, 0.25].map(z => (
            <group key={`zebra-z-${z}`} position={[0, 0, z]}>
              {[-0.1, 0, 0.1].map(x => <Box key={x} size={[0.04, 0.01, 0.1]} position={[x, 0, 0]} color="#ffffff" outline={false} castShadow={false} />)}
            </group>
          ))}
        </group>
      )}

      {/* Streetlights and Trees */}
      {isStraightX && !isIntersection && (
        <group>
          <Streetlight position={[0, 0, -0.35]} />
          <SmallTree position={[-0.3, 0, -0.35]} />
          <SmallTree position={[0.3, 0, 0.35]} />
          <Streetlight position={[0, 0, 0.35]} rotation={[0, Math.PI, 0]} />
        </group>
      )}
      {isStraightZ && !isIntersection && (
        <group>
          <Streetlight position={[-0.35, 0, 0]} rotation={[0, Math.PI/2, 0]} />
          <SmallTree position={[-0.35, 0, -0.3]} />
          <SmallTree position={[0.35, 0, 0.3]} />
          <Streetlight position={[0.35, 0, 0]} rotation={[0, -Math.PI/2, 0]} />
        </group>
      )}
    </group>
  )
}

function Streetlight({ position, rotation = [0, 0, 0] }: { position: Vec3, rotation?: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder radius={0.01} height={0.4} segments={6} position={[0, 0.2, 0]} color="#333" />
      <Box size={[0.12, 0.02, 0.02]} position={[0, 0.4, 0.05]} color="#333" />
      <Box size={[0.04, 0.02, 0.04]} position={[0, 0.39, 0.08]} color="#ffffcc" outline={false} />
    </group>
  )
}

function SmallTree({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <Cylinder radius={0.015} height={0.15} segments={6} position={[0, 0.075, 0]} color="#5c4033" />
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={getToonMaterial('#7cb342')}>
        <sphereGeometry args={[0.08, 8, 8]} />
      </mesh>
    </group>
  )
}
"""

text = re.sub(r'function Road\(\{ north, south, east, west \}: RoadLinks\) \{[\s\S]*?\}\n\n(?:type Facing|const FACING_ROTATION)', new_road + "\n\ntype Facing", text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)

