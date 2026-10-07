import re

with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# isRoad helper is missing? Let's add it at the top of recomputeServices
if 'const isRoad = (x: number, y: number): boolean =>' not in sim:
    # Actually, isRoad was in useCitySimulation? Let's see if inBounds is defined.
    # It says: 'isRoad is not defined'.
    sim = sim.replace('function recomputeServices(grid: Grid): Grid {', 'function recomputeServices(grid: Grid): Grid {\n  const isRoad = (x: number, y: number): boolean => inBounds(x, y) && grid[y][x].type === TileType.ROAD\n')

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

# Fix the duplicate Residential function and stray brace.
# Let's just find everything from the first "export function Residential" to the end and replace it correctly.
# The error says line 255/768, "unmatched closing brace } before an uncontained block { const walls = HOUSE_WALLS... }".
# My script did `meshes = re.sub(r'export function Residential\(.*?\}\)', res_eu, meshes, flags=re.DOTALL)`.
# Since Residential has nested braces, `.*?\}\)` didn't match the whole function, it probably matched until the FIRST `})` inside the function!
# And so it left the rest of the old Residential function there!

# Let's fix it by finding the start of the second "const walls = HOUSE_WALLS" or similar.
# Actually, I'll just write a script that replaces the entire file content or specific blocks carefully.
