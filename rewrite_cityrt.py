import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

# 1. Inject FacetedTree component if not exists
faceted_tree = """function FacetedTree({ position, scale = 1 }: { position: Vec3, scale?: number }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <Cylinder radius={0.06} height={0.4} segments={5} position={[0, 0.2, 0]} color="#5c4033" />
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow material={getToonMaterial('#4a7a3e')}>
        <icosahedronGeometry args={[0.3, 0]} />
      </mesh>
      <mesh position={[-0.15, 0.65, 0.1]} castShadow receiveShadow material={getToonMaterial('#538545')} rotation={[Math.PI/4, 0, 0]}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh position={[0.15, 0.6, -0.15]} castShadow receiveShadow material={getToonMaterial('#7cb342')} rotation={[0, Math.PI/4, 0]}>
        <icosahedronGeometry args={[0.18, 0]} />
      </mesh>
    </group>
  )
}
"""
if "function FacetedTree" not in text:
    text = text.replace("export function Residential", faceted_tree + "\nexport function Residential")

# 2. Replace the EU style
new_eu = """  // EU Style (CityRT Diorama 3x3)
  const wallColor = "#f3ede2"
  const roofColor = "#b34a36"

  return (
    <group>
      {/* --- DIORAMA BASE 3x3 --- */}
      {/* Grass base */}
      <Box size={[3, 0.05, 3]} position={[0, 0.025, 0]} color="#8da66a" />
      
      {/* Sidewalk in front */}
      <Box size={[3, 0.06, 0.6]} position={[0, 0.03, 1.2]} color="#b0b3b8" />
      {/* Curb edge */}
      <Box size={[3, 0.07, 0.04]} position={[0, 0.035, 1.5]} color="#93979e" />
      
      {/* Road with Stop Line */}
      <Box size={[3, 0.04, 1.46]} position={[0, 0.02, 2.25]} color="#6b6f75" />
      {/* Stop Line */}
      <Box size={[2.8, 0.01, 0.1]} position={[0, 0.045, 1.6]} color="#ffffff" outline={false} castShadow={false} />
      {/* Dashed Line */}
      <Box size={[0.8, 0.01, 0.03]} position={[-0.8, 0.045, 2.25]} color="#ffffff" outline={false} castShadow={false} />
      <Box size={[0.8, 0.01, 0.03]} position={[0.8, 0.045, 2.25]} color="#ffffff" outline={false} castShadow={false} />

      {/* Fence (Left, Right, Back) */}
      {/* Back fence */}
      <Box size={[2.8, 0.4, 0.04]} position={[0, 0.225, -1.45]} color="#e3e0d8" />
      <Box size={[0.08, 0.45, 0.08]} position={[-1.4, 0.25, -1.45]} color="#d1cec5" />
      <Box size={[0.08, 0.45, 0.08]} position={[1.4, 0.25, -1.45]} color="#d1cec5" />
      {/* Left fence */}
      <Box size={[0.04, 0.4, 2.3]} position={[-1.45, 0.225, -0.3]} color="#e3e0d8" />
      <Box size={[0.08, 0.45, 0.08]} position={[-1.45, 0.25, 0.8]} color="#d1cec5" />
      {/* Right fence */}
      <Box size={[0.04, 0.4, 2.3]} position={[1.45, 0.225, -0.3]} color="#e3e0d8" />
      <Box size={[0.08, 0.45, 0.08]} position={[1.45, 0.25, 0.8]} color="#d1cec5" />

      {/* Yard Trees & Streetlight */}
      <FacetedTree position={[-1.0, 0.05, 1.1]} scale={0.8} />
      <FacetedTree position={[1.1, 0.05, -0.8]} scale={1.2} />
      
      {/* Streetlight */}
      <group position={[1.3, 0.06, 1.4]}>
        <Cylinder radius={0.02} height={0.8} segments={6} position={[0, 0.4, 0]} color="#333" />
        <Box size={[0.2, 0.02, 0.02]} position={[-0.1, 0.8, 0]} color="#333" />
        <Box size={[0.06, 0.03, 0.06]} position={[-0.2, 0.78, 0]} color="#ffed99" outline={false} />
      </group>


      {/* --- OLD TOWN BUILDING --- */}
      {/* 1. Plinth */}
      <Box size={[1.6, 0.3, 1.6]} position={[0, 0.2, 0]} color="#d8cfc4" />
      {/* Stepped Porch */}
      <Box size={[0.5, 0.1, 0.2]} position={[0, 0.1, 0.9]} color="#c0b9af" />
      <Box size={[0.4, 0.1, 0.2]} position={[0, 0.2, 0.8]} color="#c0b9af" />

      {/* 2. Building Core (Inner dark room for recessed windows) */}
      <Box size={[1.48, 1.4, 1.4]} position={[0, 1.05, -0.05]} color="#36322e" />

      {/* 3. Solid Side and Back Walls */}
      <Box size={[1.5, 1.4, 0.1]} position={[0, 1.05, -0.7]} color={wallColor} />
      <Box size={[0.1, 1.4, 1.4]} position={[-0.7, 1.05, 0]} color={wallColor} />
      <Box size={[0.1, 1.4, 1.4]} position={[0.7, 1.05, 0]} color={wallColor} />

      {/* 4. Modular Front Facade */}
      {/* Horizontal Beams */}
      <Box size={[1.5, 0.25, 0.1]} position={[0, 0.475, 0.7]} color={wallColor} /> {/* Base above plinth */}
      <Box size={[1.5, 0.2, 0.1]} position={[0, 1.05, 0.7]} color={wallColor} /> {/* Mid beam */}
      <Box size={[1.5, 0.25, 0.1]} position={[0, 1.625, 0.7]} color={wallColor} /> {/* Top beam */}

      {/* Vertical Pillars (creates 3 columns for windows) */}
      {[-0.65, -0.22, 0.22, 0.65].map(x => (
        <group key={`facade-pillar-${x}`}>
          <Box size={[0.2, 0.45, 0.1]} position={[x, 0.825, 0.7]} color={wallColor} />
          <Box size={[0.2, 0.45, 0.1]} position={[x, 1.375, 0.7]} color={wallColor} />
        </group>
      ))}

      {/* 6 Recessed Windows (with cross frame & sill) */}
      {[-0.435, 0, 0.435].map(x => 
        [0.825, 1.375].map((y, idx) => {
          // If it's the center bottom window, make it a door instead
          if (x === 0 && y === 0.825) {
            return (
              <group key="main-door" position={[0, 0.75, 0.68]}>
                <Box size={[0.28, 0.55, 0.05]} position={[0, 0, 0]} color="#573824" />
                <Box size={[0.34, 0.05, 0.06]} position={[0, 0.25, 0.02]} color="#e3d6c8" /> {/* Door architrave */}
              </group>
            )
          }

          return (
            <group key={`rec-win-${x}-${y}`} position={[x, y, 0.67]}>
               {/* Frame */}
               <Box size={[0.22, 0.42, 0.02]} position={[0, 0, 0]} color="#ffffff" />
               {/* Glass */}
               <Window position={[0, 0, 0.015]} width={0.16} height={0.34} glass="#b3d4eb" cross />
               {/* Protruding Sill */}
               <Box size={[0.28, 0.04, 0.1]} position={[0, -0.21, 0.04]} color="#d8cfc4" />
            </group>
          )
        })
      )}

      {/* 5. Roof with Dormers and Chimney */}
      <group position={[0, 1.75, 0]}>
        {/* Main Cone Roof */}
        <Cone radius={1.4} height={1.2} segments={4} position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]} color={roofColor} />
        
        {/* Gutters (желоба по краям) */}
        <Box size={[1.6, 0.04, 0.04]} position={[0, 0, 0.75]} color="#4a4d52" />
        <Box size={[1.6, 0.04, 0.04]} position={[0, 0, -0.75]} color="#4a4d52" />
        <Box size={[0.04, 0.04, 1.6]} position={[0.75, 0, 0]} color="#4a4d52" />
        <Box size={[0.04, 0.04, 1.6]} position={[-0.75, 0, 0]} color="#4a4d52" />

        {/* 2 Dormers (Слуховые окна) */}
        {[-0.35, 0.35].map(x => (
          <group key={`dormer-${x}`} position={[x, 0.3, 0.45]}>
            <Box size={[0.25, 0.25, 0.25]} position={[0, 0, 0]} color={wallColor} />
            <Cone radius={0.25} height={0.3} segments={4} position={[0, 0.27, 0]} rotation={[0, Math.PI/4, 0]} color={roofColor} />
            <Box size={[0.18, 0.18, 0.02]} position={[0, -0.02, 0.13]} color="#ffffff" />
            <Window position={[0, -0.02, 0.14]} width={0.12} height={0.14} glass="#b3d4eb" cross />
          </group>
        ))}

        {/* Chimney */}
        <group position={[0.35, 0.6, -0.2]}>
          <Box size={[0.2, 0.8, 0.2]} position={[0, 0, 0]} color="#8c3e2e" />
          <Box size={[0.24, 0.06, 0.24]} position={[0, 0.43, 0]} color="#383431" />
          <Smoke position={[0, 0.6, 0]} />
        </group>
      </group>

    </group>
  )
}
"""

text = re.sub(r'  // EU Style \(Based on exact user template\)[\s\S]*?\}\n(?=export)', new_eu, text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)

