import re

# 1. Update CityScene.tsx for longer shadows
with open('src/components/3d/CityScene.tsx', 'r') as f:
    scene_text = f.read()

# Change directional light position to [40, 20, 30] for longer shadows
scene_text = re.sub(r'position=\{\[\d+,\s*\d+,\s*\d+\]\}', 'position={[40, 20, 30]}', scene_text, count=1)
with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(scene_text)


# 2. Update BuildingMeshes.tsx
with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    mesh_text = f.read()

new_eu = """  // EU Style (Modular Recessed Facade)
  const walls = HOUSE_WALLS[variant % HOUSE_WALLS.length]
  const roof = HOUSE_ROOFS[variant % HOUSE_ROOFS.length]
  const fh = 0.35 // floor height

  return (
    <group>
      <Pad />
      <Box size={[0.98, 0.05, 0.98]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#e0dcd3" />
      
      {/* Back and side walls */}
      <Box size={[0.95, floors * fh, 0.1]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh)/2, -0.425]} color={walls} />
      <Box size={[0.1, floors * fh, 0.75]} position={[-0.425, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color={walls} />
      <Box size={[0.1, floors * fh, 0.75]} position={[0.425, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color={walls} />

      {/* Floors / Ceilings separating stories */}
      {Array.from({ length: floors + 1 }).map((_, i) => (
         <Box key={`floor-${i}`} size={[0.95, 0.05, 0.95]} position={[0, PAD_HEIGHT + 0.05 + i * fh - 0.025, 0]} color={walls} />
      ))}

      {/* Front Facade Pillars */}
      {Array.from({ length: floors }).map((_, i) => (
         <group key={`facade-${i}`} position={[0, PAD_HEIGHT + 0.05 + i * fh, 0]}>
            {/* 4 Pillars */}
            {[-0.425, -0.14, 0.14, 0.425].map(x => (
               <Box key={`pillar-${x}`} size={[0.1, fh - 0.05, 0.1]} position={[x, (fh - 0.05)/2, 0.425]} color={walls} />
            ))}
            
            {/* 3 Recessed Windows */}
            {[-0.28, 0, 0.28].map(x => (
               <group key={`win-${x}`} position={[x, (fh - 0.05)/2, 0.35]}>
                 {/* Dark Room Interior */}
                 <Box size={[0.18, fh - 0.05, 0.02]} position={[0, 0, 0]} color="#111" />
                 {/* Window frame */}
                 <Box size={[0.16, 0.2, 0.02]} position={[0, -0.02, 0.02]} color="#ffffff" />
                 <Window position={[0, -0.02, 0.03]} width={0.12} height={0.16} glass="#ffeebb" cross />
                 {/* Small balcony/sill */}
                 <Box size={[0.18, 0.02, 0.06]} position={[0, -(fh - 0.05)/2 + 0.01, 0.05]} color="#b5b5b5" />
               </group>
            ))}
         </group>
      ))}

      {/* Roof */}
      <group position={[0, PAD_HEIGHT + 0.05 + (floors * fh), 0]}>
        {/* Main Mansard Roof */}
        <Box size={[0.95, 0.2, 0.95]} position={[0, 0.1, 0]} color={roof} />
        
        {/* Dormer Windows (Дормеры) */}
        {[-0.28, 0.28].map(x => (
          <group key={`dormer-${x}`} position={[x, 0.1, 0.4]}>
            <Box size={[0.16, 0.16, 0.16]} position={[0, 0, 0]} color={walls} />
            <Box size={[0.2, 0.05, 0.2]} position={[0, 0.1, 0]} color={roof} /> {/* Flat dormer roof */}
            <Box size={[0.12, 0.12, 0.02]} position={[0, 0, 0.08]} color="#ffffff" />
            <Window position={[0, 0, 0.09]} width={0.08} height={0.1} glass="#ffeebb" cross />
          </group>
        ))}

        {/* Chimney & Smoke */}
        <group position={[-0.3, 0.2, -0.2]}>
          <Box size={[0.12, 0.3, 0.12]} position={[0, 0, 0]} color={walls} />
          <Box size={[0.14, 0.05, 0.14]} position={[0, 0.15, 0]} color="#b5b5b5" /> {/* Chimney cap */}
          <Smoke position={[0, 0.25, 0]} />
        </group>
      </group>
      
      {/* Front Door */}
      <Box size={[0.18, 0.25, 0.04]} position={[0, PAD_HEIGHT + 0.125, 0.4]} color="#4a3b2c" />
    </group>
  )
}
"""

mesh_text = re.sub(r'  // EU Style \(Wall-to-Wall\)[\s\S]*?\}\n(?=export)', new_eu, mesh_text)

# 3. Update SmallTree to be faceted
# We use sphereGeometry with low segments to make it faceted.
# args={[radius, widthSegments, heightSegments]}
new_tree = """function SmallTree({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <Cylinder radius={0.015} height={0.15} segments={4} position={[0, 0.075, 0]} color="#5c4033" />
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={getToonMaterial('#7cb342')}>
        <sphereGeometry args={[0.08, 5, 4]} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow material={getToonMaterial('#8cc63f')}>
        <sphereGeometry args={[0.06, 4, 3]} />
      </mesh>
    </group>
  )
}"""

mesh_text = re.sub(r'function SmallTree\(\{ position \}: \{ position: Vec3 \}\) \{[\s\S]*?\}\n', new_tree + '\n', mesh_text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(mesh_text)

