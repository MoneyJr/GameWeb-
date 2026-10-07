import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

park_meshes = """
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
      {/* 4 trees */}
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
      {/* Fountain in center */}
      <Cylinder args={[0.15, 0.15, 0.05, 16]} position={[0, PAD_HEIGHT+0.025, 0]} color="#d4d4d8" />
      <Cylinder args={[0.1, 0.1, 0.02, 16]} position={[0, PAD_HEIGHT+0.06, 0]} color="#60a5fa" />
      <Cylinder args={[0.02, 0.02, 0.1, 8]} position={[0, PAD_HEIGHT+0.1, 0]} color="#d4d4d8" />
      
      {/* Trees around */}
      {[[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3], [-0.3,-0.3], [0.3,0.3]].map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cylinder args={[0.02, 0.02, 0.1, 4]} position={[0, PAD_HEIGHT+0.05, 0]} color="#78350f" />
          <Cone args={[0.15, 0.3, 5]} position={[0, PAD_HEIGHT+0.25, 0]} color="#4ade80" />
        </group>
      ))}
    </group>
  )
}

"""

meshes = meshes.replace('export function CityHallMesh', park_meshes + '\nexport function CityHallMesh')

# Now modify TileModelBase
tile_model_logic = """
function TileModelBase({ type, variant = 0, hasWater = true, style, north, south, east, west }: TileModelProps) {
  let model: ReactNode = null
  let dust = 0
  let needsWater = false
  switch (type) {
    case TileType.ROAD:
      model = <Road north={north} south={south} east={east} west={west} />
      dust = 4
      break
    case TileType.RESIDENTIAL:
      model = <Residential variant={variant} style={style as any} />
      dust = 10
      needsWater = true
      break
    case TileType.COMMERCIAL:
      model = <Commercial />
      dust = 10
      needsWater = true
      break
    case TileType.INDUSTRIAL:
      model = <Industrial />
      dust = 12
      needsWater = true
      break
    case TileType.WATER_PUMP:
      model = <WaterPump />
      dust = 8
      break
    case TileType.CITY_HALL:
      model = <CityHallMesh onClick={() => window.dispatchEvent(new CustomEvent('OPEN_CITY_HALL'))} />
      dust = 20
      break
    case TileType.PARK:
      if (style === 'PARK') model = <ParkMesh />
      else if (style === 'LARGE_PARK') model = <LargeParkMesh />
      else model = <SquareMesh />
      dust = 5
      break
    case TileType.WIND:
      model = <WindTurbine />
      dust = 5
      break
    case TileType.COAL:
      model = <CoalPlant />
      dust = 15
      break
    default:
      return null
  }
"""

meshes = re.sub(r'function TileModelBase\(\{[\s\S]*?default:\n      return null\n  \}', tile_model_logic, meshes)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes)
