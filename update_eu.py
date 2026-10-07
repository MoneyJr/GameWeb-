import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

# Replace HOUSE_ROOFS if they exist
text = text.replace("const HOUSE_ROOFS = ['#4a4a4a', '#8b5a2b', '#8b2b2b']", "const HOUSE_ROOFS = ['#b8533c', '#9e432f', '#a1422c']")

new_eu = """  // EU Style (Wall-to-Wall)
  const walls = HOUSE_WALLS[variant % HOUSE_WALLS.length]
  const roof = HOUSE_ROOFS[variant % HOUSE_ROOFS.length]
  const fh = 0.35

  return (
    <group>
      <Pad />
      <Box size={[0.98, 0.05, 0.98]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#e0dcd3" />
      
      {/* Main walls */}
      <Box size={[0.95, (floors * fh), 0.95]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color={walls} />
      
      {/* Cornice */}
      <Box size={[0.98, 0.05, 0.98]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh) + 0.025, 0]} color="#d3cbbd" />

      {/* Windows per floor */}
      {Array.from({ length: floors }).map((_, i) => (
         <group key={i} position={[0, PAD_HEIGHT + 0.05 + i * fh, 0]}>
             <group position={[0, fh/2, 0.476]}>
               {[-0.25, 0, 0.25].map(x => (
                 <group key={x} position={[x, 0, 0]}>
                   <Box size={[0.16, 0.2, 0.02]} position={[0, 0, 0]} color="#ffffff" />
                   <Window position={[0, 0, 0.01]} width={0.12} height={0.16} glass="#ffeebb" cross />
                 </group>
               ))}
             </group>
         </group>
      ))}

      {/* Roof */}
      <group position={[0, PAD_HEIGHT + 0.05 + (floors * fh) + 0.05, 0]}>
        {/* Slanted Mansard Roof (using a rotated box or simple slope) */}
        {/* Using a pyramid/cone or just a box that acts as a mansard roof */}
        <Box size={[0.95, 0.3, 0.95]} position={[0, 0.15, 0]} color={roof} />
        {/* Or rather, to make it look like a sloped roof, let's just use a pyramid */}
        <Cone radius={0.65} height={0.4} segments={4} position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]} color={roof} />
        
        {/* Dormer Windows (Мансардные окна) */}
        {[-0.2, 0.2].map(x => (
          <group key={`dormer-${x}`} position={[x, 0.15, 0.35]}>
            <Box size={[0.16, 0.16, 0.16]} position={[0, 0, 0]} color={walls} />
            <Cone radius={0.12} height={0.15} segments={4} position={[0, 0.15, 0]} rotation={[0, Math.PI/4, 0]} color={roof} />
            <Box size={[0.12, 0.12, 0.02]} position={[0, 0, 0.08]} color="#ffffff" />
            <Window position={[0, 0, 0.09]} width={0.08} height={0.1} glass="#ffeebb" cross />
          </group>
        ))}

        {/* Chimney & Smoke */}
        <group position={[-0.3, 0.2, -0.2]}>
          <Box size={[0.1, 0.4, 0.1]} position={[0, 0, 0]} color="#a8553d" />
          <Box size={[0.12, 0.03, 0.12]} position={[0, 0.2, 0]} color="#6b6358" />
          <Smoke position={[0, 0.25, 0]} />
        </group>
      </group>
      
      {/* Door */}
      <Box size={[0.2, 0.25, 0.02]} position={[0, PAD_HEIGHT + 0.15, 0.475]} color="#4a3b2c" />
    </group>
  )
}
"""

text = re.sub(r'  // EU Style \(Fachwerk / Gothic\)[\s\S]*?\}\n(?=export)', new_eu, text)

# The prompt also mentioned HOUSE_ROOFS. If I didn't replace it above because the string was slightly different, I'll regex it.
text = re.sub(r"const HOUSE_ROOFS = \[.*?\]", "const HOUSE_ROOFS = ['#b8533c', '#9e432f', '#a1422c']", text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)

