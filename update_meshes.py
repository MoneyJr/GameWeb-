import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

# Add Park, Wind, Coal, NoPowerMarker, SmogMarker
additional_meshes = """

export function Park() {
  return (
    <group>
      <Pad />
      <Box size={[0.8, 0.05, 0.8]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#77a85d" />
      <Cylinder radius={0.08} height={0.3} segments={6} position={[-0.2, PAD_HEIGHT + 0.15, -0.2]} color="#4a3b2c" />
      <Cone radius={0.25} height={0.4} segments={6} position={[-0.2, PAD_HEIGHT + 0.4, -0.2]} color="#4a7a3e" />
      <Cylinder radius={0.06} height={0.25} segments={6} position={[0.2, PAD_HEIGHT + 0.125, 0.1]} color="#4a3b2c" />
      <Cone radius={0.2} height={0.3} segments={6} position={[0.2, PAD_HEIGHT + 0.35, 0.1]} color="#538545" />
    </group>
  )
}

export function WindTurbine() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.z -= delta * 2 })
  return (
    <group>
      <Pad />
      <Box size={[0.4, 0.1, 0.4]} position={[0, PAD_HEIGHT + 0.05, 0]} color="#b5b8ba" />
      <Cylinder radius={0.04} radiusTop={0.02} height={0.8} segments={8} position={[0, PAD_HEIGHT + 0.45, 0]} color="#d6dadd" />
      <group position={[0, PAD_HEIGHT + 0.85, 0.05]}>
        <Box size={[0.1, 0.1, 0.12]} position={[0, 0, -0.05]} color="#a1a5a8" />
        <group ref={ref}>
          <Box size={[0.04, 0.7, 0.02]} position={[0, 0, 0.02]} color="#f0f2f4" />
          <Box size={[0.7, 0.04, 0.02]} position={[0, 0, 0.02]} color="#f0f2f4" />
        </group>
      </group>
    </group>
  )
}

export function CoalPlant() {
  return (
    <group>
      <Pad />
      <Box size={[0.7, 0.3, 0.6]} position={[-0.05, PAD_HEIGHT + 0.15, 0]} color="#56595c" />
      <Cylinder radius={0.12} radiusTop={0.08} height={0.7} segments={12} position={[0.15, PAD_HEIGHT + 0.35, -0.1]} color="#3a3c3e" />
      <Cylinder radius={0.12} radiusTop={0.08} height={0.7} segments={12} position={[-0.15, PAD_HEIGHT + 0.35, 0.1]} color="#3a3c3e" />
      {/* Smoke */}
      <Cylinder radius={0.06} height={0.15} segments={6} position={[0.15, PAD_HEIGHT + 0.8, -0.1]} color="#8c9195" opacity={0.6} transparent />
      <Cylinder radius={0.06} height={0.15} segments={6} position={[-0.15, PAD_HEIGHT + 0.8, 0.1]} color="#8c9195" opacity={0.6} transparent />
    </group>
  )
}

export function NoPowerMarker() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 1.3 + Math.sin(clock.elapsedTime * 4) * 0.1
    }
  })
  return (
    <group ref={ref} position={[0, 1.3, 0]}>
      <Billboard follow lockY={false} lockX={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.9} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

export function SmogMarker() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 1.3 + Math.cos(clock.elapsedTime * 3) * 0.05
    }
  })
  return (
    <group ref={ref} position={[0, 1.3, 0]}>
      <Billboard follow lockY={false} lockX={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#57534e" transparent opacity={0.8} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  )
}
"""

if 'export function Park' not in meshes:
    meshes = meshes.replace('/* -------------------------------------------------------------------------- */\n/*  Анимация постройки', additional_meshes + '\n/* -------------------------------------------------------------------------- */\n/*  Анимация постройки')

res_eu = """export function Residential({ variant = 0, style = 'EU' }: { variant?: number, style?: string }) {
  const walls = HOUSE_WALLS[variant % HOUSE_WALLS.length]
  const roof = HOUSE_ROOFS[variant % HOUSE_ROOFS.length]
  
  if (style === 'US') {
    const usWalls = ['#e6e1d3', '#a7b8c7', '#d0d6b6'][variant % 3]
    return (
      <group>
        <Pad />
        <Box size={[0.6, 0.35, 0.6]} position={[0, PAD_HEIGHT + 0.175, 0]} color={usWalls} />
        <Box size={[0.65, 0.05, 0.65]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#b9ad96" />
        <Cone radius={0.48} height={0.25} segments={4} position={[0, PAD_HEIGHT + 0.35 + 0.125, 0]} rotation={[0, Math.PI/4, 0]} color="#586770" />
        {[-0.15, 0.15].map(x => <Window key={x} position={[x, 0.25, 0.31]} width={0.12} height={0.15} glass="#ffffff" cross />)}
      </group>
    )
  }
  if (style === 'JP') {
    return (
      <group>
        <Pad />
        <Box size={[0.45, 0.5, 0.45]} position={[0, PAD_HEIGHT + 0.25, 0]} color="#f5f2eb" />
        <Box size={[0.5, 0.05, 0.5]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#cfcbc2" />
        <Box size={[0.5, 0.04, 0.5]} position={[0, PAD_HEIGHT + 0.52, 0]} color="#3d3e40" />
        {/* Balcony */}
        <Box size={[0.48, 0.1, 0.15]} position={[0, PAD_HEIGHT + 0.2, 0.23]} color="#5a5e63" />
        <Window position={[0, 0.35, 0.23]} width={0.2} height={0.2} glass="#8f97a1" />
      </group>
    )
  }

  // EU
  const roofBase = PAD_HEIGHT + 0.4
  const quarter = Math.PI / 4
  return (
    <group>
      <Pad />
      {/* корпус и цоколь */}
      <Box size={[0.54, 0.4, 0.54]} position={[0, PAD_HEIGHT + 0.2, 0]} color={walls} />
      <Box size={[0.565, 0.05, 0.565]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#b9ad96" />

      {/* крыша: три "ряда черепицы", каждый ярус чуть выступает над предыдущим */}
      <Cone radius={0.47} height={0.3} segments={4} position={[0, roofBase + 0.15, 0]} rotation={[0, quarter, 0]} color={roof} />
      <Cone radius={0.37} height={0.23} segments={4} position={[0, roofBase + 0.07 + 0.115, 0]} rotation={[0, quarter, 0]} color={roof} />
      <Cone radius={0.275} height={0.17} segments={4} position={[0, roofBase + 0.13 + 0.085, 0]} rotation={[0, quarter, 0]} color={roof} />

      {/* труба */}
      <Box size={[0.08, 0.25, 0.08]} position={[0.14, roofBase + 0.14, -0.1]} color="#a8553d" />
      <Box size={[0.11, 0.03, 0.11]} position={[0.14, roofBase + 0.28, -0.1]} color="#6b6358" />

      {/* окна фронтальные */}
      {[-0.14, 0.14].map((x) => (
        <Window key={x} position={[x, 0.3, 0.276]} width={0.14} height={0.18} glass="#ffeebb" cross />
      ))}
      <Window position={[0, 0.58, 0.15]} width={0.1} height={0.1} glass="#ffeebb" cross={false} />

      {/* дверь */}
      <Box size={[0.16, 0.2, 0.02]} position={[0, 0.15, 0.275]} color="#4a3b2c" />
      <Box size={[0.02, 0.02, 0.02]} position={[0.05, 0.15, 0.286]} color="#e3c68a" />
    </group>
  )
}"""

meshes = re.sub(r'export function Residential\(.*?\}\)', res_eu, meshes, flags=re.DOTALL)

# TileModelProps
meshes = meshes.replace('hasWater?: boolean', 'hasWater?: boolean\n  hasPower?: boolean\n  smog?: boolean\n  style?: string')

tile_model_base = """function TileModelBase({ type, variant = 0, hasWater = true, hasPower = true, smog = false, style = 'EU', north, south, east, west }: TileModelProps) {
  let model: ReactNode = null
  let dust = 0
  let needsWater = false
  let needsPower = false
  switch (type) {
    case TileType.ROAD:
      model = <Road north={north} south={south} east={east} west={west} />
      dust = 4
      break
    case TileType.RESIDENTIAL:
      model = <Residential variant={variant} style={style} />
      dust = 10
      needsWater = true
      needsPower = true
      break
    case TileType.COMMERCIAL:
      model = <Commercial />
      dust = 10
      needsWater = true
      needsPower = true
      break
    case TileType.INDUSTRIAL:
      model = <Industrial />
      dust = 12
      needsWater = true
      needsPower = true
      break
    case TileType.WATER_PUMP:
      model = <WaterPump />
      dust = 8
      break
    case TileType.PARK:
      model = <Park />
      dust = 6
      break
    case TileType.WIND:
      model = <WindTurbine />
      dust = 8
      break
    case TileType.COAL:
      model = <CoalPlant />
      dust = 12
      break
    default:
      return null
  }
  return (
    <>
      <PopIn>{model}</PopIn>
      <DustBurst count={dust} />
      {needsWater && !hasWater && <NoWaterMarker />}
      {needsPower && !hasPower && <NoPowerMarker />}
      {smog && <SmogMarker />}
    </>
  )
}"""

meshes = re.sub(r'function TileModelBase\(.*?\}\)', tile_model_base, meshes, flags=re.DOTALL)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes)
