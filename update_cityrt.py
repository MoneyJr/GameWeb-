import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

# 1. New EU Style
new_eu = """  // EU Style (CityRT Wall-to-Wall, Scale Fix)
  const euWalls = ['#e2d7c3', '#d49b6a', '#c86a4b', '#e5ba73']
  const euRoofs = ['#9e3d2b', '#b84b36']
  const wallColor = euWalls[variant % euWalls.length]
  const roofColor = euRoofs[variant % euRoofs.length]
  const roofType = variant % 3
  const fh = 0.4 // floor height

  return (
    <group>
      <Pad />
      
      {/* Base Plinth */}
      <Box size={[0.95, 0.1, 0.95]} position={[0, PAD_HEIGHT + 0.05, 0]} color="#d8cfc4" />
      
      {/* Dark Inner Core for recessed windows */}
      <Box size={[0.85, floors * fh, 0.85]} position={[0, PAD_HEIGHT + 0.1 + (floors * fh)/2, -0.05]} color="#2b303a" />

      {/* Solid Side and Back Walls */}
      <Box size={[0.95, floors * fh, 0.05]} position={[0, PAD_HEIGHT + 0.1 + (floors * fh)/2, -0.45]} color={wallColor} />
      <Box size={[0.05, floors * fh, 0.85]} position={[-0.45, PAD_HEIGHT + 0.1 + (floors * fh)/2, 0]} color={wallColor} />
      <Box size={[0.05, floors * fh, 0.85]} position={[0.45, PAD_HEIGHT + 0.1 + (floors * fh)/2, 0]} color={wallColor} />

      {/* Front Facade (Modular) */}
      {/* Horizontal Beams */}
      {Array.from({ length: floors + 1 }).map((_, i) => (
        <Box key={`hbeam-${i}`} size={[0.95, 0.1, 0.05]} position={[0, PAD_HEIGHT + 0.1 + i * fh, 0.45]} color={wallColor} />
      ))}

      {/* Vertical Pillars (4 pillars -> 3 window columns) */}
      {Array.from({ length: floors }).map((_, floorIdx) => (
        <group key={`facade-floor-${floorIdx}`} position={[0, PAD_HEIGHT + 0.1 + floorIdx * fh + 0.05, 0]}>
          {[-0.425, -0.14, 0.14, 0.425].map(x => (
            <Box key={`pillar-${x}`} size={[0.1, fh - 0.1, 0.05]} position={[x, (fh - 0.1)/2, 0.45]} color={wallColor} />
          ))}

          {/* Windows / Door */}
          {[-0.28, 0, 0.28].map(x => {
            const isDoor = floorIdx === 0 && x === 0
            if (isDoor) {
               return (
                 <group key={`door`} position={[0, (fh - 0.1)/2, 0.44]}>
                    <Box size={[0.18, fh - 0.1, 0.04]} position={[0, 0, 0]} color="#3b2820" />
                 </group>
               )
            }
            return (
              <group key={`win-${x}`} position={[x, (fh - 0.1)/2, 0.43]}>
                 <Box size={[0.16, fh - 0.15, 0.02]} position={[0, 0.02, 0]} color="#ffffff" />
                 <Window position={[0, 0.02, 0.015]} width={0.12} height={fh - 0.19} glass="#b3d4eb" cross />
                 <Box size={[0.18, 0.04, 0.06]} position={[0, -(fh - 0.15)/2, 0.03]} color="#d8cfc4" />
              </group>
            )
          })}
        </group>
      ))}

      {/* Roof Variations */}
      <group position={[0, PAD_HEIGHT + 0.1 + floors * fh, 0]}>
        {roofType === 0 && (
          // Gabled Front (Двускатная крыша фронтоном вперед)
          <group>
            {/* We use a rotated cylinder with 3 segments for a triangular prism */}
            <Cylinder radius={0.67} height={0.95} segments={3} position={[0, 0.335, 0]} rotation={[Math.PI/2, Math.PI, 0]} color={roofColor} />
            <Box size={[0.95, 0.05, 0.95]} position={[0, 0.025, 0]} color={wallColor} />
            <Box size={[0.1, 0.6, 0.1]} position={[0.3, 0.4, -0.3]} color="#6e3328" /> {/* Chimney */}
          </group>
        )}
        
        {roofType === 1 && (
          // Hipped Roof with Dormers (Вальмовая мансарда)
          <group>
            <Cone radius={0.7} height={0.6} segments={4} position={[0, 0.3, 0]} rotation={[0, Math.PI/4, 0]} color={roofColor} />
            {/* Dormer */}
            <group position={[0, 0.15, 0.25]}>
              <Box size={[0.2, 0.2, 0.2]} position={[0, 0, 0]} color={wallColor} />
              <Cone radius={0.18} height={0.2} segments={4} position={[0, 0.2, 0]} rotation={[0, Math.PI/4, 0]} color={roofColor} />
              <Box size={[0.14, 0.14, 0.02]} position={[0, 0, 0.11]} color="#ffffff" />
              <Window position={[0, 0, 0.12]} width={0.1} height={0.1} glass="#b3d4eb" cross />
            </group>
            <Box size={[0.1, 0.6, 0.1]} position={[-0.2, 0.4, 0]} color="#6e3328" /> {/* Chimney */}
          </group>
        )}

        {roofType === 2 && (
          // Crow-stepped gable (Ступенчатый фронтон)
          <group>
            {/* Main Roof Core */}
            <Cylinder radius={0.67} height={0.95} segments={3} position={[0, 0.335, -0.05]} rotation={[Math.PI/2, Math.PI, 0]} color={roofColor} />
            {/* Steps on the front facade */}
            <Box size={[0.95, 0.15, 0.1]} position={[0, 0.075, 0.425]} color={wallColor} />
            <Box size={[0.75, 0.15, 0.1]} position={[0, 0.225, 0.425]} color={wallColor} />
            <Box size={[0.55, 0.15, 0.1]} position={[0, 0.375, 0.425]} color={wallColor} />
            <Box size={[0.35, 0.15, 0.1]} position={[0, 0.525, 0.425]} color={wallColor} />
            <Box size={[0.15, 0.15, 0.1]} position={[0, 0.675, 0.425]} color={wallColor} />
            <Box size={[0.1, 0.6, 0.1]} position={[0.2, 0.4, -0.2]} color="#6e3328" /> {/* Chimney */}
          </group>
        )}
      </group>
    </group>
  )
}
"""

text = re.sub(r'  // EU Style \(CityRT Diorama 3x3\)[\s\S]*?\}\n(?=export)', new_eu, text)

# 2. Update CityHallMesh
new_cityhall = """export function CityHallMesh() {
  return (
    <group>
      {/* Base: 2x2 footprint, meaning size up to 1.95 x 1.95 */}
      <Pad />
      <Pad position={[1, 0, 0]} />
      <Pad position={[0, 0, 1]} />
      <Pad position={[1, 0, 1]} />

      <Box size={[1.9, 0.2, 1.9]} position={[0.5, PAD_HEIGHT + 0.1, 0.5]} color="#d8cfc4" />
      
      {/* Main Building Body */}
      <Box size={[1.8, 1.2, 1.8]} position={[0.5, PAD_HEIGHT + 0.2 + 0.6, 0.5]} color="#c86a4b" />
      
      {/* High Clock Tower (Landmark) */}
      <group position={[0.5, PAD_HEIGHT + 0.2 + 1.2, 0.5]}>
         {/* Tower Base */}
         <Box size={[0.6, 2.5, 0.6]} position={[0, 1.25, 0]} color="#e2d7c3" />
         
         {/* Clock Tier */}
         <Box size={[0.64, 0.5, 0.64]} position={[0, 2.75, 0]} color="#d8cfc4" />
         {/* Clock Faces */}
         {[-0.33, 0.33].map(x => <Cylinder key={`c1-${x}`} radius={0.15} height={0.02} segments={12} position={[x, 2.75, 0]} rotation={[0, 0, Math.PI/2]} color="#ffffff" />)}
         {[-0.33, 0.33].map(z => <Cylinder key={`c2-${z}`} radius={0.15} height={0.02} segments={12} position={[0, 2.75, z]} rotation={[Math.PI/2, 0, 0]} color="#ffffff" />)}

         {/* Dark Slate Spire */}
         <Cone radius={0.35} height={1.2} segments={4} position={[0, 3.6, 0]} rotation={[0, Math.PI/4, 0]} color="#3a4454" />
      </group>

      {/* Main Building Roof */}
      <Box size={[1.9, 0.1, 1.9]} position={[0.5, PAD_HEIGHT + 1.45, 0.5]} color="#d8cfc4" />
      <Box size={[1.8, 0.4, 1.8]} position={[0.5, PAD_HEIGHT + 1.7, 0.5]} color="#b84b36" />
    </group>
  )
}
"""

text = re.sub(r'export function CityHallMesh\(\) \{[\s\S]*?\}\n', new_cityhall, text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)

