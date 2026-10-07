import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

new_eu = """  // EU Style (Modular Recessed Facade)
  const walls = HOUSE_WALLS[variant % HOUSE_WALLS.length]
  const roof = HOUSE_ROOFS[variant % HOUSE_ROOFS.length]
  const fh = 0.35 // floor height

  return (
    <group>
      <Pad />
      <Box size={[0.98, 0.05, 0.98]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#e0dcd3" />
      
      {/* Dark Inner Core (creates the illusion of room depth) */}
      <Box size={[0.85, floors * fh, 0.85]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color="#111111" />
      
      {/* Side and Back walls (Solid for simplicity, or we can make them solid walls) */}
      <Box size={[0.95, floors * fh, 0.95]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color={walls} />
      {/* Wait, if I put a solid wall, the dark core is hidden. I must use a solid wall but offset the front, OR build the front from pieces. */}
      {/* Let's rebuild the main block as a U-shape, or just put 4 large walls and the front wall is modular. */}
      {/* Actually, it's easier to just draw the main solid block, and for the front, place dark deep "holes", and then the window inside them. Wait, drawing a dark box OVER the wall just makes a dark protruding box. Z-fighting or sticking out. */}
      {/* To make it recessed, the main block must NOT cover the front. */}
    </group>
  )
}
"""

# Let's write a better replacement script next.
